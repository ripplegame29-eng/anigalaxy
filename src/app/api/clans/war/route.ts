import { cwAttack, cwCancelSearch, cwSearch, cwState, cwVsBot } from "@/lib/server/clan-cardwar";
import { json, readJson, route } from "@/lib/server/http";

export const runtime = "nodejs";

/** Состояние клановой войны: поиск, подготовка, бой, итоги */
export const GET = route(
  ({ db, user }) => {
    const s = cwState(db, user!.id);
    return s ? json(s) : json({ error: "Вы не состоите в клане" }, 400);
  },
  { auth: true },
);

/** search {size} · vs_bot {size} · cancel · attack {pos} */
export const POST = route(
  async ({ db, request, user }) => {
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);
    const uid = user!.id;
    const n = Number(body.size ?? body.pos);
    switch (body.action) {
      case "search": {
        const r = cwSearch(db, uid, n);
        return r.ok ? json({ ok: true, result: r.value, state: cwState(db, uid) }) : json({ error: r.error }, 400);
      }
      case "vs_bot": {
        const r = cwVsBot(db, uid, n);
        return r.ok ? json({ ok: true, state: cwState(db, uid) }) : json({ error: r.error }, 400);
      }
      case "cancel": {
        const r = cwCancelSearch(db, uid);
        return r.ok ? json({ ok: true, state: cwState(db, uid) }) : json({ error: r.error }, 400);
      }
      case "attack": {
        const r = cwAttack(db, uid, n);
        return r.ok ? json({ ok: true, result: r.value, state: cwState(db, uid) }) : json({ error: r.error }, 400);
      }
      default:
        return json({ error: "Неизвестное действие" }, 400);
    }
  },
  { auth: true, write: true },
);
