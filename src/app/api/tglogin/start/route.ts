import { clientIp, json, route } from "@/lib/server/http";
import { startLogin } from "@/lib/server/telegram-login";

export const runtime = "nodejs";

/** Начать вход: выдаёт токен, код для сверки и ссылку на бота */
export const POST = route(
  ({ db, request }) => {
    const r = startLogin(db, { ip: clientIp(request), ua: request.headers.get("user-agent") ?? "" });
    return r.ok ? json({ ok: true, ...r.value }) : json({ ok: false, error: r.error }, 400);
  },
  { write: true },
);
