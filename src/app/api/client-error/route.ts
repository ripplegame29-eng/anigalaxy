import { clientIp, json, readJson, route } from "@/lib/server/http";
import { logError } from "@/lib/server/errors";

export const runtime = "nodejs";

/** Простое ограничение: не больше 20 сообщений в минуту с одного адреса */
const hits = new Map<string, { at: number; n: number }>();

/** Ошибки из браузера игроков попадают в журнал админ-панели */
export const POST = route(
  async ({ db, request, user }) => {
    const ip = clientIp(request);
    const now = Date.now();
    const entry = hits.get(ip);
    if (!entry || now - entry.at > 60_000) hits.set(ip, { at: now, n: 1 });
    else if (++entry.n > 20) return json({ ok: false }, 429);
    if (hits.size > 5000) hits.clear();

    const body = await readJson(request);
    const message = typeof body?.message === "string" ? body.message : "";
    if (!message) return json({ ok: false }, 400);
    logError(db, {
      source: "client",
      message,
      stack: typeof body?.stack === "string" ? body.stack : "",
      path: typeof body?.path === "string" ? body.path : "",
      userId: user?.id,
    });
    return json({ ok: true });
  },
  { write: true },
);
