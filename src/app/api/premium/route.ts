import { json, readJson, route } from "@/lib/server/http";
import { claimDrop, premiumState, startTrial } from "@/lib/server/premium";

export const runtime = "nodejs";

/** Статус Premium: пробный период и подарок месяца */
export const GET = route(({ db, user }) => json(premiumState(db, user!)), { auth: true });

/** `{ action: "trial" | "drop" }` */
export const POST = route(
  async ({ db, request, user }) => {
    const body = await readJson(request);
    const action = body?.action;
    const result = action === "trial" ? startTrial(db, user!) : action === "drop" ? claimDrop(db, user!) : null;
    if (!result) return json({ error: "Неизвестное действие" }, 400);
    if (!result.ok) return json({ error: result.error }, 400);
    return json({ ok: true, state: premiumState(db, user!) });
  },
  { write: true, auth: true },
);
