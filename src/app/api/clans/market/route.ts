import { marketBuy, marketView } from "@/lib/server/clan-market";
import { json, readJson, route } from "@/lib/server/http";

export const runtime = "nodejs";

/** Клановый рынок: GET — баланс алмазов и покупки за неделю; POST {itemId} — купить */
export const GET = route(({ db, user }) => json(marketView(db, user!.id)), { auth: true });

export const POST = route(
  async ({ db, request, user }) => {
    const body = await readJson(request);
    const r = marketBuy(db, user!.id, String(body?.itemId ?? ""));
    return r.ok ? json({ ok: true, ...r.value, ...marketView(db, user!.id) }) : json({ error: r.error }, 400);
  },
  { write: true, auth: true },
);
