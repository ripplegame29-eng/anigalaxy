import { deleteChatMessage, isAdmin, listUsers, recentChat, setBan, setPremiumDays, setRole, stats } from "@/lib/server/admin";
import { json, readJson, route } from "@/lib/server/http";
import { listReports, resolveReport } from "@/lib/server/social";

export const runtime = "nodejs";

/** `?view=stats|users|reports|chat` (+ `q` для users) — данные админ-панели, только для admin */
export const GET = route(
  ({ db, request, user }) => {
    if (!isAdmin(user)) return json({ error: "Недостаточно прав" }, 403);
    const params = request.nextUrl.searchParams;
    const view = params.get("view");
    if (view === "stats") return json({ stats: stats(db) });
    if (view === "users") return json({ users: listUsers(db, params.get("q") ?? "") });
    if (view === "reports") return json({ reports: listReports(db, params.get("status") === "resolved" ? "resolved" : "open") });
    if (view === "chat") return json({ messages: recentChat(db) });
    return json({ error: "Неизвестный раздел" }, 400);
  },
  { auth: true },
);

/** {action: ban|premium|role|resolve|deleteChat, ...} */
export const POST = route(
  async ({ db, request, user }) => {
    if (!isAdmin(user)) return json({ error: "Недостаточно прав" }, 403);
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);
    const id = Number(body.id);
    const reply = (result: { ok: boolean; error?: string }) =>
      result.ok ? json({ ok: true }) : json({ ok: false, error: result.error ?? "Не удалось" }, 400);

    switch (body.action) {
      case "ban":
        return reply(setBan(db, user, id, Number(body.days) || 0));
      case "premium":
        return reply(setPremiumDays(db, id, Number(body.days) || 0));
      case "role":
        return reply(setRole(db, user, id, String(body.role ?? "")));
      case "resolve": {
        const result = resolveReport(db, user.id, user.role, id);
        return reply(result.ok ? { ok: true } : { ok: false, error: result.error });
      }
      case "deleteChat":
        return reply(deleteChatMessage(db, id));
      default:
        return json({ error: "Неизвестное действие" }, 400);
    }
  },
  { write: true, auth: true },
);
