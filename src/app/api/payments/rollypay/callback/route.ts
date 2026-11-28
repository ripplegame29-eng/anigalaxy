import { dbAvailable, getDb } from "@/lib/server/db";
import {
  findPaymentOrder,
  findPaymentOrderByTransaction,
  reconcilePaymentOrder,
  type PaymentOrder,
} from "@/lib/server/payment-orders";
import {
  rollypayConfigured,
  rollypayOrderStatus,
  rollypayTestMode,
  verifyRollyPayCallback,
} from "@/lib/server/rollypay";

export const runtime = "nodejs";

interface CallbackBody {
  event_type?: unknown;
  payment_id?: unknown;
  order_id?: unknown;
  status?: unknown;
  amount?: unknown;
  currency?: unknown;
  test?: unknown;
}

/**
 * Колбэк RollyPay.
 *
 * URL задаётся в настройках кассы: https://<домен>/api/payments/rollypay/callback.
 * Подпись проверяем по сырому телу до разбора JSON. Отвечаем 2xx, чтобы
 * RollyPay не повторял доставку; повтор безопасен — выдача помечена `granted_at`.
 */
export async function POST(request: Request): Promise<Response> {
  if (!rollypayConfigured()) return Response.json({ error: "not configured" }, { status: 503 });

  const raw = await request.text();
  const timestamp = request.headers.get("x-timestamp")?.trim() ?? "";
  const signature = request.headers.get("x-signature")?.trim() ?? "";
  if (!verifyRollyPayCallback(raw, timestamp, signature)) {
    return Response.json({ error: "bad signature" }, { status: 403 });
  }
  if (!dbAvailable()) return Response.json({ error: "no db" }, { status: 503 });

  let body: CallbackBody;
  try {
    body = JSON.parse(raw) as CallbackBody;
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  // Тестовые платежи не выдают покупки на боевом сайте.
  if (body.test === true && !rollypayTestMode()) return Response.json({ ok: true, ignored: "test" });

  const paymentId = typeof body.payment_id === "string" ? body.payment_id : "";
  const orderId = typeof body.order_id === "string" ? body.order_id : "";
  const status = typeof body.status === "string" ? body.status : "";
  const amount = Number(body.amount);
  const currency = typeof body.currency === "string" ? body.currency : "RUB";
  if (!paymentId || !status) return Response.json({ ok: true, ignored: "no payment" });

  const db = getDb();
  const order: PaymentOrder | null =
    (orderId ? findPaymentOrder(db, orderId) : null) ?? findPaymentOrderByTransaction(db, paymentId);

  // Неизвестный заказ: подтверждаем приём, чтобы RollyPay не тратил повторы.
  if (!order) return Response.json({ ok: true, ignored: true });

  const mapped = rollypayOrderStatus(status);
  if (mapped === "CONFIRMED" && !Number.isFinite(amount)) {
    return Response.json({ error: "bad amount" }, { status: 400 });
  }

  const result = reconcilePaymentOrder(db, order, { transactionId: paymentId, status: mapped, amount, currency });
  if (!result.ok) {
    console.error("[rollypay] callback", paymentId, result.error);
    // 2xx: повторная доставка того же события ничего не исправит, заказ уже помечен.
    return Response.json({ ok: false, error: result.error });
  }
  return Response.json({ ok: true });
}
