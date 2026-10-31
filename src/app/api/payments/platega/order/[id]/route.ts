import { PRODUCTS } from "@/lib/payments/catalog";
import { json, route } from "@/lib/server/http";
import {
  findPaymentOrderForUser,
  processDueGrants,
  reconcilePaymentOrder,
  type PaymentOrder,
} from "@/lib/server/payment-orders";
import { PlategaError, fetchPlategaTransaction } from "@/lib/server/platega";

export const runtime = "nodejs";

const TERMINAL_BAD = new Set(["CANCELED", "FAILED", "INVALID"]);

/**
 * Статус своего заказа. Нужен странице возврата: колбэк может прийти с
 * задержкой, поэтому после оплаты браузер сам спрашивает Platega и доводит
 * заказ до выдачи. Повторный опрос безопасен — `granted_at` выдаётся один раз.
 */
export const GET = route(
  async ({ db, user, params }) => {
    const id = params.id ?? "";
    const order = findPaymentOrderForUser(db, id, user!.id);
    if (!order) return json({ error: "Заказ не найден" }, 404);

    let fresh: PaymentOrder = order;
    if (order.transactionId) {
      try {
        const transaction = await fetchPlategaTransaction(order.transactionId);
        if (transaction) {
          const result = reconcilePaymentOrder(db, order, {
            transactionId: transaction.id,
            status: transaction.status,
            amount: transaction.amount,
            currency: transaction.currency,
          });
          fresh = result.order;
        }
      } catch (error) {
        /* Шлюз недоступен — показываем сохранённый статус, колбэк догонит */
        if (!(error instanceof PlategaError)) throw error;
        console.error("[platega] status", order.id, error.status, error.code, error.message);
      }
    }

    if (fresh.status === "CONFIRMED") {
      try {
        processDueGrants(db);
      } catch (error) {
        console.error("[payments] due grants", error);
      }
      fresh = findPaymentOrderForUser(db, order.id, user!.id) ?? fresh;
    }

    const product = PRODUCTS[fresh.productId];
    return json({
      ok: true,
      order: {
        id: fresh.id,
        productId: fresh.productId,
        kind: product?.kind ?? "",
        title: fresh.title,
        amount: fresh.amount,
        currency: fresh.currency,
        status: fresh.status,
        granted: fresh.grantedAt > 0,
        failed: TERMINAL_BAD.has(fresh.status) || fresh.status === "INVALID",
        deliverAt: fresh.deliverAt,
        createdAt: fresh.createdAt,
      },
    });
  },
  { auth: true },
);
