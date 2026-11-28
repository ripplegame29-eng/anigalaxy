/**
 * Клиент RollyPay. Живёт только на сервере: `X-API-Key` и `signing_secret`
 * читаются из окружения и никогда не попадают в браузер.
 *
 * Документация: https://docs.rollypay.io/
 * Создание платежа: POST /api/v1/payments → `pay_url`.
 * Статус: GET /api/v1/payments/{payment_id}.
 * Колбэк: POST на Callback URL кассы, подпись HMAC-SHA256(`${X-Timestamp}.${rawBody}`).
 */

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const DEFAULT_API_URL = "https://api.rollypay.io";
const TIMEOUT_MS = 15_000;

export class RollyPayError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 0, code = "") {
    super(message);
    this.name = "RollyPayError";
    this.status = status;
    this.code = code;
  }
}

export interface RollyPayCreated {
  paymentId: string;
  status: string;
  url: string;
  expiresAt?: string;
}

export interface RollyPayPayment {
  id: string;
  orderId: string;
  status: string;
  amount: number;
  currency: string;
  test: boolean;
}

export interface RollyPayCreateInput {
  amount: number;
  orderId: string;
  description: string;
  successUrl: string;
  failUrl: string;
  customerId: string;
}

/** Настроены ли ключи. Секреты наружу не отдаём даже в виде длины. */
export function rollypayConfigured(): boolean {
  return Boolean(process.env.ROLLYPAY_API_KEY?.trim() && process.env.ROLLYPAY_SIGNING_SECRET?.trim());
}

/** Тестовый режим кассы (sandbox): платежи без реальных денег. */
export function rollypayTestMode(): boolean {
  const value = (process.env.ROLLYPAY_TEST || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function apiUrl(): string {
  return (process.env.ROLLYPAY_API_URL || DEFAULT_API_URL).trim().replace(/\/+$/, "");
}

function headers(): Record<string, string> {
  const apiKey = process.env.ROLLYPAY_API_KEY?.trim();
  if (!apiKey) throw new RollyPayError("Платёжный шлюз не настроен", 0, "not_configured");
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-API-Key": apiKey,
    // Одноразовое значение: повтор в течение 10 минут RollyPay отклоняет.
    "X-Nonce": randomUUID(),
  };
}

function safeMessage(data: unknown): { message: string; code: string } {
  if (!data || typeof data !== "object") return { message: "", code: "" };
  const source = data as Record<string, unknown>;
  const message = [source.message, source.error, source.detail]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);
  const code = typeof source.code === "string" ? source.code : "";
  return { message: message ? message.slice(0, 300) : "", code };
}

async function request(path: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl()}${path}`, {
      ...init,
      headers: headers(),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof RollyPayError) throw error;
    throw new RollyPayError("Платёжный шлюз недоступен", 0, "network");
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    const { message, code } = safeMessage(data);
    throw new RollyPayError(message || `Платёжный шлюз ответил ${response.status}`, response.status, code);
  }
  return data;
}

/** Ответ бывает и плоским, и в обёртке `{ data: {...} }` — принимаем оба. */
function unwrap(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  const source = data as Record<string, unknown>;
  if (source.data && typeof source.data === "object" && !Array.isArray(source.data)) {
    return source.data as Record<string, unknown>;
  }
  return source;
}

const text = (value: unknown): string => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "");

export async function createRollyPayPayment(input: RollyPayCreateInput): Promise<RollyPayCreated> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new RollyPayError("Некорректная сумма заказа", 400, "bad_amount");
  }
  const body: Record<string, unknown> = {
    amount: input.amount.toFixed(2),
    payment_currency: "RUB",
    order_id: input.orderId,
    description: input.description.slice(0, 240),
    customer_id: input.customerId,
    success_redirect_url: input.successUrl,
    fail_redirect_url: input.failUrl,
    redirect_url: input.successUrl,
    metadata: { order_id: input.orderId, user_id: input.customerId },
  };
  const terminalId = process.env.ROLLYPAY_TERMINAL_ID?.trim();
  if (terminalId) body.terminal_id = terminalId;
  if (rollypayTestMode()) body.test = true;

  const reply = unwrap(await request("/api/v1/payments", { method: "POST", body: JSON.stringify(body) }));
  const paymentId = text(reply?.payment_id) || text(reply?.id);
  const url = text(reply?.pay_url);
  const status = text(reply?.status) || "created";
  if (!paymentId || !url) {
    throw new RollyPayError("Платёжный шлюз вернул неполный ответ", 502, "bad_response");
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new RollyPayError("Платёжный шлюз вернул некорректную ссылку", 502, "bad_url");
  }
  if (parsed.protocol !== "https:") {
    throw new RollyPayError("Платёжная ссылка должна быть HTTPS", 502, "bad_url");
  }
  return { paymentId, status, url, expiresAt: text(reply?.expires_at) || undefined };
}

/** Статус платежа. null — RollyPay не знает такой id (404). */
export async function fetchRollyPayPayment(paymentId: string): Promise<RollyPayPayment | null> {
  let reply: Record<string, unknown> | null;
  try {
    reply = unwrap(await request(`/api/v1/payments/${encodeURIComponent(paymentId)}`, { method: "GET" }));
  } catch (error) {
    if (error instanceof RollyPayError && error.status === 404) return null;
    throw error;
  }
  const status = text(reply?.status);
  if (!status) throw new RollyPayError("Платёжный шлюз вернул пустой статус", 502, "bad_response");
  return {
    id: text(reply?.payment_id) || text(reply?.id) || paymentId,
    orderId: text(reply?.order_id),
    status,
    amount: Number(reply?.amount ?? NaN),
    currency: text(reply?.payment_currency) || text(reply?.currency) || "RUB",
    // В ответе на GET флага `test` нет — песочницу выдаёт `environment: "sandbox"`.
    test: reply?.test === true || text(reply?.environment).toLowerCase() === "sandbox",
  };
}

/**
 * Статус RollyPay → статус заказа AniGalaxy.
 * created/processing (в т. ч. недоплата криптой) — ждём; paid — выдаём;
 * canceled/expired — отмена без списания; chargeback/refunded — откат после оплаты.
 */
export function rollypayOrderStatus(status: string): string {
  switch (status.trim().toLowerCase()) {
    case "paid":
      return "CONFIRMED";
    case "canceled":
    case "cancelled":
    case "expired":
      return "CANCELED";
    case "chargeback":
      return "CHARGEBACKED";
    case "refunded":
      return "REFUNDED";
    default:
      return "PENDING";
  }
}

/**
 * Подлинность колбэка: HMAC-SHA256 от `${X-Timestamp}.${сырое тело}` ключом
 * signing_secret кассы, hex. Сравнение за постоянное время.
 */
export function verifyRollyPayCallback(rawBody: string, timestamp: string, signature: string): boolean {
  const secret = process.env.ROLLYPAY_SIGNING_SECRET?.trim() ?? "";
  if (!secret || !timestamp || !signature) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const actual = signature.trim().replace(/^sha256=/i, "").toLowerCase();
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(actual, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
