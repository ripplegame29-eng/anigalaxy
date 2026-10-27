import { json, readJson, route } from "@/lib/server/http";
import { addMessage, getTicket, setTicketStatus } from "@/lib/server/tickets";

export const runtime = "nodejs";

/** Обращение с перепиской */
export const GET = route(
  ({ db, user, params }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return json({ ok: false, error: "Обращение не найдено" }, 404);
    const r = getTicket(db, id, { id: user!.id, staff: false });
    return r.ok ? json({ ok: true, ...r.value }) : json({ ok: false, error: r.error }, 404);
  },
  { auth: true },
);

/** {text} — ответ; {status: "closed"|"open"} — закрыть или открыть заново */
export const POST = route(
  async ({ db, request, user, params }) => {
    const id = Number(params.id);
    const body = await readJson(request);
    if (!Number.isInteger(id) || !body) return json({ ok: false, error: "Некорректный запрос" }, 400);
    const actor = { id: user!.id, staff: false };
    if (body.status === "closed" || body.status === "open") {
      const r = setTicketStatus(db, id, actor, body.status);
      return r.ok ? json({ ok: true }) : json({ ok: false, error: r.error }, 404);
    }
    const r = addMessage(db, id, actor, String(body.text ?? ""));
    if (!r.ok) return json({ ok: false, error: r.error, code: r.code }, r.code === "rate_limit" ? 429 : r.code === "not_found" ? 404 : 400);
    return json({ ok: true });
  },
  { write: true, auth: true },
);
