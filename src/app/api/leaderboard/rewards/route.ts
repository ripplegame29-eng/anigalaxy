import { claimReward, pendingRewards } from "@/lib/server/leaderboard";
import { json, route, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

/** Невыплаченные призы за прошедшие недели */
export const GET = route(({ db, user }) => json({ rewards: pendingRewards(db, user!.id) }), { auth: true });

/** Забрать приз недели (один раз): `{ weekKey }` */
export const POST = route(
  async ({ db, request, user }) => {
    const body = await readJson(request);
    const week = typeof body?.weekKey === "string" ? body.weekKey : "";
    const reward = claimReward(db, user!.id, week);
    return reward ? json({ ok: true, reward }) : json({ error: "Приз уже получен или не найден" }, 409);
  },
  { write: true, auth: true },
);
