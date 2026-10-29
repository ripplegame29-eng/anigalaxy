import { cancelRequest, donateCard, donateState, requestCards } from "@/lib/server/clan-donate";
import { json, readJson, route } from "@/lib/server/http";

export const runtime = "nodejs";

export const GET = route(
  ({ db, user }) => {
    const s = donateState(db, user!.id);
    return s ? json(s) : json({ error: "Вы не состоите в клане" }, 400);
  },
  { auth: true },
);

/** request {cardId, want} · give {id} · cancel */
export const POST = route(
  async ({ db, request, user }) => {
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);
    const uid = user!.id;
    let r: { ok: boolean; error?: string; value?: unknown };
    switch (body.action) {
      case "request":
        r = requestCards(db, uid, String(body.cardId ?? ""), Number(body.want));
        break;
      case "give":
        r = donateCard(db, uid, Number(body.id));
        break;
      case "cancel":
        r = cancelRequest(db, uid);
        break;
      default:
        return json({ error: "Неизвестное действие" }, 400);
    }
    return r.ok ? json({ ok: true, result: r.value ?? null, state: donateState(db, uid) }) : json({ error: r.error }, 400);
  },
  { auth: true, write: true },
);
