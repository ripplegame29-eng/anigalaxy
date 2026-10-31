import { dbAvailable, getDb } from "@/lib/server/db";
import {
  findPaymentOrder,
  findPaymentOrderByTransaction,
  reconcilePaymentOrder,
  type PaymentOrder,
} from "@/lib/server/payment-orders";
import { plategaConfigured, verifyPlategaCallback } from "@/lib/server/platega";

export const runtime = "nodejs";

interface CallbackBody {
  id?: unknown;
  amount?: unknown;
  currency?: unknown;
  status?: unknown;
  paymentMethod?: unknown;
  payload?: unknown;
}

/**
 * Колбэк Platega.
 *
 * URL задаётся в личном кабинете: Настройки → Callback URLs. Публичный HTTPS
 * обязателен. Отвечаем 200, чтобы Platega не повторяла доставку; повторный
 * статус безопасен — выдача помечена `granted_at`.
 */
export async function POST(request: Request): Promise<Response> {
  if (!plategaConfigured()) return Response.json({ error: "not configured" }, { status: 503 });
  if (!verifyPlategaCallback(request.headers)) {
    return Response.json({ error: "bad signature" }, { status: 401 });
  }
  if (!dbAvailable()) return Response.json({ error: "no db" }, { status: 503 });

  let body: CallbackBody;
  try {
    body = (await request.json()) as CallbackBody;
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const transactionId = typeof body.id === "string" ? body.id : "";
  const status = typeof body.status === "string" ? body.status : "";
  const payload = typeof body.payload === "string" ? body.payload : "";
  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
  const currency = typeof body.currency === "string" ? body.currency : "";
  if (!transactionId || !status || !Number.isFinite(amount) || !currency) {
    return Response.json({ error: "bad payload" }, { status: 400 });
  }

  const db = getDb();
  const order: PaymentOrder | null =
    findPaymentOrder(db, payload) ?? findPaymentOrderByTransaction(db, transactionId);

  // Неизвестный заказ: подтверждаем приём, чтобы Platega не тратила повторы.
  if (!order) return Response.json({ ok: true, ignored: true });

  const result = reconcilePaymentOrder(db, order, { transactionId, status, amount, currency });
  if (!result.ok) {
    console.error("[platega] callback", transactionId, result.error);
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
