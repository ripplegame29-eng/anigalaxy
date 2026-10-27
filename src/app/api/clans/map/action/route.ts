import { attackTile, claimTile, claimWorldPrizes, foundCapital, fortifyTile } from "@/lib/server/clan-world";
import { json, route, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

/** found {tile} · claim {tile} · attack {tile, amount} · fortify {tile, amount} · prizes */
export const POST = route(
  async ({ db, request, user }) => {
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);
    const uid = user!.id;
    const done = (r: { ok: true; value: unknown } | { ok: false; error: string }) =>
      r.ok ? json({ ok: true, result: r.value ?? null }) : json({ error: r.error }, 400);
    switch (body.action) {
      case "found":
        return done(foundCapital(db, uid, body.tile));
      case "claim":
        return done(claimTile(db, uid, body.tile));
      case "attack":
        return done(attackTile(db, uid, body.tile, body.amount));
      case "fortify":
        return done(fortifyTile(db, uid, body.tile, body.amount));
      case "prizes":
        return json({ ok: true, titles: claimWorldPrizes(db, uid) });
      default:
        return json({ error: "Неизвестное действие" }, 400);
    }
  },
  { write: true, auth: true },
);
