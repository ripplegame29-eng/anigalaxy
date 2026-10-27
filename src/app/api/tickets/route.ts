import { json, readJson, route } from "@/lib/server/http";
import { createTicket, listUserTickets } from "@/lib/server/tickets";

export const runtime = "nodejs";

/** Мои обращения */
export const GET = route(({ db, user }) => json({ ok: true, tickets: listUserTickets(db, user!.id) }), { auth: true });

/** {subject, category, body} — новое обращение */
export const POST = route(
  async ({ db, request, user }) => {
    const body = await readJson(request);
    if (!body) return json({ ok: false, error: "Некорректный запрос" }, 400);
    const r = createTicket(db, user!.id, { subject: String(body.subject ?? ""), category: String(body.category ?? ""), body: String(body.body ?? "") });
    if (!r.ok) return json({ ok: false, error: r.error, code: r.code }, r.code === "rate_limit" ? 429 : 400);
    return json({ ok: true, id: r.value });
  },
  { write: true, auth: true },
);
