import { createReport } from "@/lib/server/social";
import { json, route, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

/** {nickname, reason, text} — жалоба на игрока */
export const POST = route(
  async ({ db, request, user }) => {
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);
    const nickname = String(body.nickname ?? "").trim();
    const target = db.prepare("SELECT id, nickname FROM users WHERE nickname = ?").get(nickname);
    if (!target) return json({ error: "Игрок не найден" }, 404);
    if (Number(target.id) === user!.id) return json({ error: "Нельзя пожаловаться на себя" }, 400);
    const reason = `${String(body.reason ?? "Другое").slice(0, 40)}: ${String(body.text ?? "").trim()}`;
    const result = createReport(db, user!.id, { kind: "user", targetId: String(target.nickname), reason });
    return result.ok ? json({ ok: true }) : json({ error: result.error, code: result.code }, result.code === "rate_limit" ? 429 : 400);
  },
  { write: true, auth: true },
);
