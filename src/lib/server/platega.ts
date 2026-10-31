/**
 * Клиент Platega. Живёт только на сервере: `X-MerchantId` и `X-Secret`
 * читаются из окружения и никогда не попадают в браузер.
 *
 * Документация: https://docs.platega.io/
 * Создание без выбранного метода: POST /v2/transaction/process.
 */

const DEFAULT_API_URL = "https://app.platega.io";
const TIMEOUT_MS = 15_000;

export class PlategaError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 0, code = "") {
    super(message);
    this.name = "PlategaError";
    this.status = status;
    this.code = code;
  }
}

export interface PlategaCreatedTransaction {
  transactionId: string;
  status: string;
  url: string;
  expiresIn?: string;
  rate?: number;
}

export interface PlategaTransaction {
  id: string;
  status: string;
  amount: number;
  currency: string;
  paymentMethod?: string | number;
  payload?: string;
}

export interface PlategaCreateInput {
  amount: number;
  description: string;
  returnUrl: string;
  failedUrl: string;
  payload: string;
  userEmail: string;
  userId: string;
  userName: string;
}

/** Настроены ли ключи. Секрет наружу не отдаём даже в виде длины. */
export function plategaConfigured(): boolean {
  return Boolean(process.env.PLATEGA_MERCHANT_ID?.trim() && process.env.PLATEGA_SECRET?.trim());
}

function apiUrl(): string {
  return (process.env.PLATEGA_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
}

function headers(): Record<string, string> {
  const merchantId = process.env.PLATEGA_MERCHANT_ID?.trim();
  const secret = process.env.PLATEGA_SECRET?.trim();
  if (!merchantId || !secret) throw new PlategaError("Платёжный шлюз не настроен", 0, "not_configured");
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-MerchantId": merchantId,
    "X-Secret": secret,
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

async function request(path: string, init: RequestInit): Promise<{ status: number; data: unknown }> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl()}${path}`, {
      ...init,
      headers: headers(),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof PlategaError) throw error;
    throw new PlategaError("Платёжный шлюз недоступен", 0, "network");
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
    throw new PlategaError(message || `Платёжный шлюз ответил ${response.status}`, response.status, code);
  }
  return { status: response.status, data };
}

export async function createPlategaTransaction(input: PlategaCreateInput): Promise<PlategaCreatedTransaction> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new PlategaError("Некорректная сумма заказа", 400, "bad_amount");
  }
  const { data } = await request("/v2/transaction/process", {
    method: "POST",
    body: JSON.stringify({
      paymentDetails: { amount: input.amount, currency: "RUB" },
      description: input.description.slice(0, 240),
      return: input.returnUrl,
      failedUrl: input.failedUrl,
      payload: input.payload,
      orderId: input.payload,
      metadata: {
        user_email: input.userEmail,
        userId: input.userId,
        userName: input.userName,
      },
    }),
  });

  const reply = data as Record<string, unknown> | null;
  const transactionId = typeof reply?.transactionId === "string" ? reply.transactionId : "";
  const url = typeof reply?.url === "string" ? reply.url : "";
  const status = typeof reply?.status === "string" ? reply.status : "";
  if (!transactionId || !url || !status) {
    throw new PlategaError("Платёжный шлюз вернул неполный ответ", 502, "bad_response");
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new PlategaError("Платёжный шлюз вернул некорректную ссылку", 502, "bad_url");
  }
  if (parsed.protocol !== "https:") {
    throw new PlategaError("Платёжная ссылка должна быть HTTPS", 502, "bad_url");
  }

  return {
    transactionId,
    status,
    url,
    expiresIn: typeof reply?.expiresIn === "string" ? reply.expiresIn : undefined,
    rate: typeof reply?.rate === "number" ? reply.rate : undefined,
  };
}

/** Статус транзакции. null — Platega не знает такой id (404). */
export async function fetchPlategaTransaction(id: string): Promise<PlategaTransaction | null> {
  let response: { status: number; data: unknown };
  try {
    response = await request(`/transaction/${encodeURIComponent(id)}`, { method: "GET" });
  } catch (error) {
    if (error instanceof PlategaError && error.status === 404) return null;
    throw error;
  }
  const data = response.data as Record<string, unknown> | null;
  const status = typeof data?.status === "string" ? data.status : "";
  if (!status) throw new PlategaError("Платёжный шлюз вернул пустой статус", 502, "bad_response");
  const details = data?.paymentDetails && typeof data.paymentDetails === "object"
    ? (data.paymentDetails as Record<string, unknown>)
    : {};
  return {
    id: typeof data?.id === "string" ? data.id : id,
    status,
    amount: typeof details.amount === "number" ? details.amount : Number(details.amount ?? 0),
    currency: typeof details.currency === "string" ? details.currency : "RUB",
    paymentMethod:
      typeof data?.paymentMethod === "string" || typeof data?.paymentMethod === "number"
        ? (data.paymentMethod as string | number)
        : undefined,
    payload: typeof data?.payload === "string" ? data.payload : undefined,
  };
}

function safeEqual(expected: string, actual: string): boolean {
  if (!expected || !actual) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(actual, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqualSafe(a, b);
}

/** Сравнение без раннего выхода по длине (длину скрыть нельзя, но байты — да) */
function timingSafeEqualSafe(a: Buffer, b: Buffer): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Подлинность колбэка: Platega присылает те же MerchantId и Secret в заголовках. */
export function verifyPlategaCallback(headers: Headers): boolean {
  const merchantId = process.env.PLATEGA_MERCHANT_ID?.trim() ?? "";
  const secret = process.env.PLATEGA_SECRET?.trim() ?? "";
  if (!merchantId || !secret) return false;
  return (
    safeEqual(merchantId, headers.get("x-merchantid")?.trim() ?? "") &&
    safeEqual(secret, headers.get("x-secret")?.trim() ?? "")
  );
}
