import { json, readJson, route } from "@/lib/server/http";
import { claimWelcome, welcomeState } from "@/lib/server/welcome";

export const runtime = "nodejs";

/** Состояние приветственного квеста */
export const GET = route(({ db, user }) => json(welcomeState(db, user!)), { auth: true });

/** `{ day }` — забрать награду дня */
export const POST = route(
  async ({ db, request, user }) => {
    const body = await readJson(request);
    const result = claimWelcome(db, user!, Number(body?.day));
    if (!result.ok) return json({ error: result.error }, 400);
    return json({ ok: true, state: welcomeState(db, user!) });
  },
  { write: true, auth: true },
);
