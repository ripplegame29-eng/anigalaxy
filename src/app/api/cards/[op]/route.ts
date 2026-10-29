import { cardsAction, cardsState } from "@/lib/server/cards-state";
import { json, readJson, route } from "@/lib/server/http";

export const runtime = "nodejs";

/** Любое действие карточек: ответ — результат и свежее состояние */
export const POST = route(
  async ({ db, request, user, params }) => {
    const body = (await readJson(request)) ?? {};
    const res = cardsAction(db, user!.id, params.op, body);
    if (!res.ok) return json({ error: res.error }, 400);
    return json({ ok: true, result: res.value, state: cardsState(db, user!.id) });
  },
  { write: true, auth: true },
);
