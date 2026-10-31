/**
 * Заказы оплаты и выдача покупок.
 *
 * Заказ создаётся до похода в Platega и хранит товар, сумму и метаданные.
 * Подтверждённый платёж выдаёт покупку ровно один раз: `granted_at` —
 * атомарная отметка в SQLite, повторный колбэк или поллинг ничего не удвоит.
 */

import { randomUUID } from "node:crypto";

import { BATTLEPASS } from "../battlepass/config";
import { PRODUCTS, type PaymentProduct } from "../payments/catalog";
import { PROGRESS_DOC_KEY } from "../sync-keys";
import { setPremiumDays } from "./admin";
import { adjustBalance, editProfile, pushNotice, setItem } from "./admin-edit";
import { getDoc } from "./docs";
import { queueGrant } from "./grants";
import { num, str, type Database } from "./sqlite";
import { findUserById, findUserByNickname, type UserRow } from "./users";

const DAY_MS = 86_400_000;
const SYSTEM = { nickname: "AniGalaxy" } as unknown as UserRow;

export type PaymentOrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELED"
  | "FAILED"
  | "INVALID"
  | "CHARGEBACKED"
  | "PARTIALLY_REFUNDED"
  | "DISPUTED";

export interface GiftOrderMeta {
  mode: "friend" | "random";
  recipientId?: number;
  recipientNickname?: string;
  count: number;
  promoCode?: string;
  deliveredTo?: number[];
}

export interface PaymentOrderMeta {
  gift?: GiftOrderMeta;
  withPack?: boolean;
}

export interface PaymentOrder {
  id: string;
  userId: number;
  productId: string;
  title: string;
  amount: number;
  currency: string;
  status: PaymentOrderStatus;
  provider: string;
  transactionId: string | null;
  checkoutUrl: string;
  payload: string;
  meta: PaymentOrderMeta;
  deliverAt: number;
  confirmedAt: number;
  grantedAt: number;
  createdAt: number;
  updatedAt: number;
}

function parseMeta(raw: string): PaymentOrderMeta {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return {};
    const source = value as Record<string, unknown>;
    const giftRaw = source.gift;
    let gift: GiftOrderMeta | undefined;
    if (giftRaw && typeof giftRaw === "object") {
      const g = giftRaw as Record<string, unknown>;
      const mode = g.mode === "random" ? "random" : "friend";
      gift = {
        mode,
        recipientId: typeof g.recipientId === "number" && Number.isFinite(g.recipientId) ? Math.floor(g.recipientId) : undefined,
        recipientNickname: typeof g.recipientNickname === "string" ? g.recipientNickname.slice(0, 32) : undefined,
        count: typeof g.count === "number" && Number.isFinite(g.count) ? Math.floor(g.count) : 1,
        promoCode: typeof g.promoCode === "string" ? g.promoCode.slice(0, 32) : undefined,
        deliveredTo: Array.isArray(g.deliveredTo)
          ? g.deliveredTo.filter((id): id is number => typeof id === "number" && Number.isFinite(id))
          : undefined,
      };
    }
    return {
      gift,
      withPack: typeof source.withPack === "boolean" ? source.withPack : undefined,
    };
  } catch {
    return {};
  }
}

function toOrder(row: Record<string, unknown>): PaymentOrder {
  return {
    id: str(row.id),
    userId: num(row.user_id),
    productId: str(row.product_id),
    title: str(row.title),
    amount: num(row.amount),
    currency: str(row.currency, "RUB"),
    status: str(row.status, "PENDING") as PaymentOrderStatus,
    provider: str(row.provider, "platega"),
    transactionId: row.transaction_id === null || row.transaction_id === undefined ? null : str(row.transaction_id),
    checkoutUrl: str(row.checkout_url),
    payload: str(row.payload),
    meta: parseMeta(str(row.meta, "{}")),
    deliverAt: num(row.deliver_at),
    confirmedAt: num(row.confirmed_at),
    grantedAt: num(row.granted_at),
    createdAt: num(row.created_at),
    updatedAt: num(row.updated_at),
  };
}

export function createPaymentOrder(
  db: Database,
  input: {
    userId: number;
    product: PaymentProduct;
    amount: number;
    meta: PaymentOrderMeta;
    deliverAt?: number;
    now?: number;
  },
): PaymentOrder {
  const now = input.now ?? Date.now();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO payment_orders
       (id, user_id, product_id, title, amount, currency, status, provider, payload, meta, deliver_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'RUB', 'PENDING', 'platega', ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.userId,
    input.product.id,
    input.product.title,
    input.amount,
    id,
    JSON.stringify(input.meta),
    Math.max(0, Math.floor(input.deliverAt ?? 0)),
    now,
    now,
  );
  const order = findPaymentOrder(db, id);
  if (!order) throw new Error("Заказ не сохранился");
  return order;
}

export function findPaymentOrder(db: Database, id: string): PaymentOrder | null {
  const row = db.prepare("SELECT * FROM payment_orders WHERE id = ?").get(id);
  return row ? toOrder(row) : null;
}

export function findPaymentOrderForUser(db: Database, id: string, userId: number): PaymentOrder | null {
  const row = db.prepare("SELECT * FROM payment_orders WHERE id = ? AND user_id = ?").get(id, userId);
  return row ? toOrder(row) : null;
}

export function findPaymentOrderByTransaction(db: Database, transactionId: string): PaymentOrder | null {
  const row = db.prepare("SELECT * FROM payment_orders WHERE transaction_id = ?").get(transactionId);
  return row ? toOrder(row) : null;
}

export function findPaymentOrderByPayload(db: Database, payload: string): PaymentOrder | null {
  if (!payload) return null;
  const row = db.prepare("SELECT * FROM payment_orders WHERE payload = ?").get(payload);
  return row ? toOrder(row) : null;
}

export function attachPlategaTransaction(
  db: Database,
  orderId: string,
  input: { transactionId: string; checkoutUrl: string; status?: string },
  now = Date.now(),
): void {
  db.prepare(
    `UPDATE payment_orders
       SET transaction_id = ?, checkout_url = ?, updated_at = ?
     WHERE id = ? AND status = 'PENDING'`,
  ).run(input.transactionId, input.checkoutUrl, now, orderId);
}

export function failPaymentOrder(db: Database, orderId: string, now = Date.now()): void {
  db.prepare("UPDATE payment_orders SET status = 'FAILED', updated_at = ? WHERE id = ? AND status = 'PENDING'").run(now, orderId);
}

export interface ProviderUpdate {
  transactionId: string;
  status: string;
  amount: number;
  currency: string;
}

export type ReconcileResult =
  | { ok: true; order: PaymentOrder; granted: boolean }
  | { ok: false; error: string; order: PaymentOrder };

function sameAmounts(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100);
}

/**
 * Применить статус Platega к заказу. Вызывается из колбэка и из проверки
 * статуса; оба пути идемпотентны. Сумма и валюта сверяются с заказом.
 */
export function reconcilePaymentOrder(
  db: Database,
  order: PaymentOrder,
  update: ProviderUpdate,
  now = Date.now(),
): ReconcileResult {
  const status = update.status.toUpperCase();
  if (update.transactionId && order.transactionId && update.transactionId !== order.transactionId) {
    return { ok: false, error: "Чужой идентификатор транзакции", order };
  }
  if (!order.transactionId && update.transactionId) {
    db.prepare("UPDATE payment_orders SET transaction_id = ?, updated_at = ? WHERE id = ?").run(
      update.transactionId,
      now,
      order.id,
    );
  }

  if (status === "PENDING") {
    return { ok: true, order: findPaymentOrder(db, order.id) ?? order, granted: false };
  }

  if (status === "CONFIRMED") {
    if (!sameAmounts(update.amount, order.amount) || update.currency.toUpperCase() !== order.currency.toUpperCase()) {
      db.prepare("UPDATE payment_orders SET status = 'INVALID', updated_at = ? WHERE id = ? AND granted_at = 0").run(now, order.id);
      return { ok: false, error: "Сумма или валюта не совпали с заказом", order: findPaymentOrder(db, order.id) ?? order };
    }
    db.prepare(
      `UPDATE payment_orders
         SET status = 'CONFIRMED',
             confirmed_at = CASE WHEN confirmed_at = 0 THEN ? ELSE confirmed_at END,
             updated_at = ?
       WHERE id = ?`,
    ).run(now, now, order.id);
    const fresh = findPaymentOrder(db, order.id) ?? order;
    if (fresh.deliverAt > now) {
      return { ok: true, order: fresh, granted: false };
    }
    const grant = grantPaymentOrder(db, fresh, now);
    return { ok: true, order: grant.order, granted: grant.granted };
  }

  if (status === "CANCELED") {
    db.prepare("UPDATE payment_orders SET status = 'CANCELED', updated_at = ? WHERE id = ? AND status = 'PENDING'").run(
      now,
      order.id,
    );
    return { ok: true, order: findPaymentOrder(db, order.id) ?? order, granted: false };
  }

  const known: PaymentOrderStatus[] = ["CHARGEBACKED", "PARTIALLY_REFUNDED", "DISPUTED"];
  if (known.includes(status as PaymentOrderStatus)) {
    db.prepare("UPDATE payment_orders SET status = ?, updated_at = ? WHERE id = ? AND status = 'CONFIRMED'").run(
      status,
      now,
      order.id,
    );
    return { ok: true, order: findPaymentOrder(db, order.id) ?? order, granted: false };
  }

  return { ok: true, order: findPaymentOrder(db, order.id) ?? order, granted: false };
}

function hasProgress(db: Database, userId: number): boolean {
  return Boolean(getDoc(db, userId, PROGRESS_DOC_KEY));
}

function hasProfile(db: Database, userId: number): boolean {
  return Boolean(getDoc(db, userId, "animehub:profile:v1"));
}

function notice(db: Database, userId: number, text: string, now: number): void {
  if (!hasProfile(db, userId)) return;
  editProfile(db, userId, (profile) => pushNotice(profile, text, now), now);
}

function creditAc(db: Database, userId: number, amount: number, note: string, now: number): void {
  if (amount <= 0) return;
  if (hasProgress(db, userId)) {
    adjustBalance(db, SYSTEM, userId, { ac: amount, note }, now);
    notice(db, userId, `${note}: +${amount} AC`, now);
    return;
  }
  // Прогресса на сервере ещё нет: подарок уедет вместе с первой синхронизацией,
  // иначе созданный здесь пустой документ затрёт локальный прогресс игрока.
  queueGrant(db, userId, { ac: amount, note, notice: `${note}: +${amount} AC` }, now);
}

function grantPremium(db: Database, userId: number, days: number, text: string, now: number): void {
  const result = setPremiumDays(db, userId, days, now);
  if (!result.ok) throw new Error(result.error);
  notice(db, userId, text, now);
}

function grantItems(db: Database, userId: number, product: PaymentProduct, now: number): void {
  if (product.tag && hasProgress(db, userId)) {
    setItem(db, SYSTEM, userId, "tag", product.tag, true, { label: "Донатер" }, now);
    notice(db, userId, "Открыт тег «Донатер»", now);
  }
  if (product.effect && hasProfile(db, userId)) {
    setItem(db, SYSTEM, userId, "effect", product.effect, true, { label: "Глитч-эффект", notify: true }, now);
  }
}

function grantGift(db: Database, order: PaymentOrder, product: PaymentProduct, now: number): void {
  const gift = order.meta.gift;
  const days = product.premiumDays ?? 0;
  if (!gift || days <= 0) return;

  const recipients: { id: number; nickname: string }[] = [];
  if (gift.mode === "friend") {
    const target =
      (gift.recipientId ? findUserById(db, gift.recipientId) : null) ??
      (gift.recipientNickname ? findUserByNickname(db, gift.recipientNickname) : null);
    if (target) recipients.push({ id: target.id, nickname: target.nickname });
  } else {
    const count = Math.max(1, Math.min(800, Math.floor(gift.count)));
    const rows = db
      .prepare(
        `SELECT id, nickname FROM users
         WHERE id <> ? AND banned_until <= ?
         ORDER BY RANDOM() LIMIT ?`,
      )
      .all(order.userId, now, count);
    for (const row of rows) {
      recipients.push({ id: num(row.id), nickname: str(row.nickname) });
    }
  }

  for (const recipient of recipients) {
    grantPremium(
      db,
      recipient.id,
      days,
      `Вам подарили Premium на ${days} дн.${gift.mode === "random" ? " от случайного зрителя" : ""}`,
      now,
    );
  }

  if (recipients.length) {
    db.prepare("UPDATE payment_orders SET meta = ?, updated_at = ? WHERE id = ?").run(
      JSON.stringify({ ...order.meta, gift: { ...gift, deliveredTo: recipients.map((r) => r.id) } }),
      now,
      order.id,
    );
  }
}

function grantEntitlements(db: Database, order: PaymentOrder, now: number): void {
  const product = PRODUCTS[order.productId];
  if (!product) throw new Error(`Неизвестный товар: ${order.productId}`);

  if (product.kind === "premium") {
    const days = product.premiumDays ?? 0;
    grantPremium(db, order.userId, days, `Premium продлён на ${days} дн.`, now);
    return;
  }

  if (product.kind === "battlepass") {
    const left = Math.max(0, Math.ceil((BATTLEPASS.to - now) / DAY_MS));
    const days = left + 30;
    grantPremium(db, order.userId, days, `Боевой пропуск активирован: Premium на ${days} дн.`, now);
    return;
  }

  if (product.kind === "coins") {
    creditAc(db, order.userId, product.ac ?? 0, product.title, now);
    return;
  }

  if (product.kind === "donation") {
    const withPack = order.meta.withPack !== false;
    if (withPack) creditAc(db, order.userId, product.ac ?? 0, product.title, now);
    const days = product.premiumDays ?? 0;
    if (days > 0) grantPremium(db, order.userId, days, `${product.title}: Premium на ${days} дн.`, now);
    grantItems(db, order.userId, product, now);
    return;
  }

  if (product.kind === "gift") {
    grantGift(db, order, product, now);
  }
}

/**
 * Выдать покупку. Атомарно занимает отметку `granted_at`; повторный вызов
 * видит её и ничего не делает.
 */
export function grantPaymentOrder(
  db: Database,
  order: PaymentOrder,
  now = Date.now(),
): { ok: true; order: PaymentOrder; granted: boolean } {
  const claim = db
    .prepare(
      `UPDATE payment_orders SET granted_at = ?, updated_at = ?
       WHERE id = ? AND status = 'CONFIRMED' AND granted_at = 0`,
    )
    .run(now, now, order.id);
  if (!num((claim as { changes?: number }).changes)) {
    return { ok: true, order: findPaymentOrder(db, order.id) ?? order, granted: false };
  }

  try {
    const fresh = findPaymentOrder(db, order.id) ?? order;
    grantEntitlements(db, fresh, now);
    return { ok: true, order: findPaymentOrder(db, order.id) ?? fresh, granted: true };
  } catch (error) {
    db.prepare("UPDATE payment_orders SET granted_at = 0, updated_at = ? WHERE id = ?").run(now, order.id);
    throw error;
  }
}

/** Выдать отложенные подарки, у которых наступила дата доставки */
export function processDueGrants(db: Database, now = Date.now()): number {
  const rows = db
    .prepare(
      `SELECT * FROM payment_orders
       WHERE status = 'CONFIRMED' AND granted_at = 0 AND (deliver_at = 0 OR deliver_at <= ?)
       ORDER BY created_at LIMIT 50`,
    )
    .all(now);
  let granted = 0;
  for (const row of rows) {
    try {
      if (grantPaymentOrder(db, toOrder(row), now).granted) granted += 1;
    } catch (error) {
      console.error("[payments] не удалось выдать заказ", str(row.id), error);
    }
  }
  return granted;
}
