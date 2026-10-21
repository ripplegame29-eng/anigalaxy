import { json, route, readJson } from "@/lib/server/http";
import { changeUserPassword } from "@/lib/server/users";

export const runtime = "nodejs";

export const POST = route(
  async ({ db, request, user }) => {
    const body = await readJson(request);
    if (!body || !user) return json({ error: "Некорректный запрос" }, 400);
    const result = changeUserPassword(db, user.id, String(body.current ?? ""), String(body.next ?? ""));
    if (!result.ok) return json({ error: result.error, code: result.code }, result.code === "bad_password" ? 403 : 400);
    // Смена пароля завершает все сессии, включая эту: нужен повторный вход
    return json({ ok: true, relogin: true });
  },
  { write: true, auth: true },
);
