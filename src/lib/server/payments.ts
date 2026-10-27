import { createHmac, timingSafeEqual } from "node:crypto";

/** Демо-оплата без провайдера: только вне продакшена или при явном PAYMENTS_MODE=demo */
export const demoPaymentsEnabled = (): boolean =>
  process.env.PAYMENTS_MODE === "demo" || (process.env.NODE_ENV !== "production" && process.env.PAYMENTS_MODE !== "live");

export const checkoutUrlFor = (orderId: string): string | null => {
  const base = process.env.PAYMENT_CHECKOUT_URL;
  return base ? `${base}${base.includes("?") ? "&" : "?"}order=${encodeURIComponent(orderId)}` : null;
};

/** Подпись вебхука: HMAC-SHA256 от тела запроса секретом PAYMENT_WEBHOOK_SECRET (hex) */
export function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}
