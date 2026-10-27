import { markOrderPaid } from "@/lib/server/clan-economy";
import { getDb, dbAvailable } from "@/lib/server/db";
import { verifySignature } from "@/lib/server/payments";

export const runtime = "nodejs";

/** Вебхук провайдера: {orderId, ref, status:"paid"} + заголовок x-signature (HMAC-SHA256 тела) */
export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-signature"))) return Response.json({ error: "bad signature" }, { status: 401 });
  if (!dbAvailable()) return Response.json({ error: "no db" }, { status: 503 });
  let body: { orderId?: string; ref?: string; status?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  if (body.status !== "paid" || !body.orderId) return Response.json({ ok: true });
  const r = markOrderPaid(getDb(), String(body.orderId), String(body.ref ?? ""));
  return Response.json(r.ok ? { ok: true } : { error: r.error }, { status: r.ok ? 200 : 400 });
}
