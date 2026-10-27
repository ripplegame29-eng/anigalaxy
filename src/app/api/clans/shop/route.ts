import { CRYSTAL_PACKS } from "@/lib/clan-rules";
import { createOrder, markOrderPaid } from "@/lib/server/clan-economy";
import { json, route, readJson } from "@/lib/server/http";
import { checkoutUrlFor, demoPaymentsEnabled } from "@/lib/server/payments";

export const runtime = "nodejs";

export const GET = route(() => json({ packs: CRYSTAL_PACKS, demo: demoPaymentsEnabled(), live: !!process.env.PAYMENT_CHECKOUT_URL }), { auth: true });

/** Создать заказ на кристаллы. В демо-режиме {confirm:true} сразу зачисляет их. */
export const POST = route(
  async ({ db, request, user }) => {
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);
    const order = createOrder(db, user!.id, String(body.pack ?? ""));
    if (!order.ok) return json({ error: order.error }, 400);
    const url = checkoutUrlFor(order.value.id);
    if (url) return json({ ok: true, orderId: order.value.id, checkoutUrl: url });
    if (!demoPaymentsEnabled()) return json({ error: "Оплата пока не подключена" }, 503);
    markOrderPaid(db, order.value.id, "demo");
    return json({ ok: true, orderId: order.value.id, demo: true, crystals: order.value.crystals });
  },
  { write: true, auth: true },
);
