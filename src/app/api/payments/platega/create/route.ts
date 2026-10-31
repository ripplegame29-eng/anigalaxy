import { GIFT_MAX_COUNT, GIFT_PROMO_CODES, PRODUCTS, normalizePromoCode, orderPrice } from "@/lib/payments/catalog";
import { json, readJson, route } from "@/lib/server/http";
import {
  attachPlategaTransaction,
  createPaymentOrder,
  failPaymentOrder,
  type GiftOrderMeta,
  type PaymentOrderMeta,
} from "@/lib/server/payment-orders";
import { PlategaError, createPlategaTransaction, plategaConfigured } from "@/lib/server/platega";
import { siteBaseUrl } from "@/lib/server/site-url";
import { num, type Database } from "@/lib/server/sqlite";
import { findUserByNickname, type UserRow } from "@/lib/server/users";

export const runtime = "nodejs";

const DAY_MS = 86_400_000;
const PENDING_WINDOW_MS = 10 * 60_000;
const MAX_PENDING = 10;

function cleanText(value: unknown, max = 120): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Создание заказа и платёжной ссылки Platega.
 *
 * Браузер присылает только `productId` и параметры подарка. Цену, состав
 * покупки и получателя проверяет сервер; клиентская цена не используется.
 */
export const POST = route(
  async ({ db, request, user }) => {
    if (!plategaConfigured()) {
      return json({ error: "Онлайн-оплата пока не настроена", code: "payments_unavailable" }, 503);
    }

    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);

    const productId = cleanText(body.productId, 40);
    const product = PRODUCTS[productId];
    if (!product) return json({ error: "Неизвестный товар" }, 400);

    const now = Date.now();
    const pending = db
      .prepare("SELECT COUNT(*) AS c FROM payment_orders WHERE user_id = ? AND status = 'PENDING' AND created_at > ?")
      .get(user!.id, now - PENDING_WINDOW_MS);
    if (num(pending?.c) >= MAX_PENDING) {
      return json({ error: "Слишком много незавершённых платежей. Попробуйте через несколько минут." }, 429);
    }

    const meta: PaymentOrderMeta = {};
    let count = 1;
    let promoCode = "";
    let deliverAt = 0;

    if (product.kind === "gift") {
      const mode = body.giftMode === "random" ? "random" : body.giftMode === "friend" ? "friend" : "";
      if (!mode) return json({ error: "Выберите, кому подарить Premium" }, 400);

      promoCode = normalizePromoCode(cleanText(body.promoCode, 32));
      if (promoCode && !GIFT_PROMO_CODES[promoCode]) {
        return json({ error: "Промокод не найден" }, 400);
      }

      const gift: GiftOrderMeta = { mode, count: 1, promoCode: promoCode || undefined };

      if (mode === "friend") {
        const nickname = cleanText(body.recipient, 32);
        if (!nickname) return json({ error: "Укажите получателя подарка" }, 400);
        const target = findUserByNickname(db, nickname);
        if (!target) return json({ error: "Профиль получателя не найден" }, 404);
        if (target.id === user!.id) return json({ error: "Premium уже есть на вашем аккаунте — выберите другого получателя" }, 400);
        gift.recipientId = target.id;
        gift.recipientNickname = target.nickname;

        const rawDeliver = Number(body.deliverAt);
        if (Number.isFinite(rawDeliver) && rawDeliver > now) {
          deliverAt = Math.min(Math.floor(rawDeliver), now + 365 * DAY_MS);
        }
      } else {
        const rawCount = Number(body.giftCount);
        if (!Number.isFinite(rawCount)) return json({ error: "Укажите количество подарков" }, 400);
        count = Math.round(rawCount);
        if (count < 1 || count > GIFT_MAX_COUNT) {
          return json({ error: `Количество подарков — от 1 до ${GIFT_MAX_COUNT}` }, 400);
        }
        const available = db
          .prepare("SELECT COUNT(*) AS c FROM users WHERE id <> ? AND banned_until <= ?")
          .get(user!.id, now);
        if (num(available?.c) < count) {
          return json({ error: "Сейчас не хватает получателей для такого количества подарков" }, 400);
        }
      }

      gift.count = count;
      meta.gift = gift;
      const amount = orderPrice(productId, { count, promoCode });
      if (amount === null) return json({ error: "Не удалось рассчитать стоимость подарка" }, 400);
      return createOrder(db, request, user!, product.id, amount, meta, deliverAt, now);
    }

    if (product.kind === "donation") meta.withPack = body.withPack !== false;
    return createOrder(db, request, user!, product.id, product.price, meta, 0, now);
  },
  { write: true, auth: true },
);

async function createOrder(
  db: Database,
  request: Request,
  user: UserRow,
  productId: string,
  amount: number,
  meta: PaymentOrderMeta,
  deliverAt: number,
  now: number,
): Promise<Response> {
  const product = PRODUCTS[productId];
  if (!product) return json({ error: "Неизвестный товар" }, 400);

  const order = createPaymentOrder(db, {
    userId: user.id,
    product,
    amount,
    meta,
    deliverAt,
    now,
  });

  const base = siteBaseUrl(request);
  const returnUrl = `${base}/payment/return?order=${encodeURIComponent(order.id)}`;
  const failedUrl = `${base}/payment/return?order=${encodeURIComponent(order.id)}&failed=1`;

  try {
    const created = await createPlategaTransaction({
      amount,
      description: `AniGalaxy · ${product.title}`,
      returnUrl,
      failedUrl,
      payload: order.id,
      userEmail: user.email,
      userId: String(user.id),
      userName: user.nickname,
    });
    attachPlategaTransaction(db, order.id, {
      transactionId: created.transactionId,
      checkoutUrl: created.url,
      status: created.status,
    });
    return json({ ok: true, orderId: order.id, url: created.url, amount, title: product.title });
  } catch (error) {
    failPaymentOrder(db, order.id);
    if (error instanceof PlategaError) {
      console.error("[platega] create", error.status, error.code, error.message);
      const message =
        error.status === 401
          ? "Платёжный шлюз отклонил авторизацию магазина"
          : error.status === 0
            ? "Платёжный шлюз недоступен. Попробуйте ещё раз."
            : "Не удалось создать платёж. Попробуйте ещё раз.";
      return json({ error: message, code: error.code || "provider_error" }, 502);
    }
    console.error("[platega] create", error);
    return json({ error: "Не удалось создать платёж. Попробуйте ещё раз." }, 502);
  }
}
