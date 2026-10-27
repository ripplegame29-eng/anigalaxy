import { clientIp, json, route } from "@/lib/server/http";
import { linkStatus, startLink } from "@/lib/server/telegram-login";
import { str } from "@/lib/server/sqlite";

export const runtime = "nodejs";

/** Текущая привязка: { linked, username } */
export const GET = route(
  ({ db, request, user }) => {
    const token = request.nextUrl.searchParams.get("token");
    if (token) {
      if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return json({ ok: false, status: "unknown" }, 400);
      return json({ ok: true, ...linkStatus(db, token, user!.id) });
    }
    const row = db.prepare("SELECT telegram_id, telegram_username FROM users WHERE id = ?").get(user!.id);
    const linked = !!row && !!row.telegram_id;
    return json({ ok: true, linked, username: linked ? str(row?.telegram_username) : "" });
  },
  { auth: true },
);

/** Начать привязку Telegram к текущему аккаунту */
export const POST = route(
  ({ db, request, user }) => {
    const current = db.prepare("SELECT telegram_id FROM users WHERE id = ?").get(user!.id);
    if (current?.telegram_id) return json({ ok: false, error: "Telegram уже привязан" }, 400);
    const r = startLink(db, user!.id, { ip: clientIp(request), ua: request.headers.get("user-agent") ?? "" });
    return r.ok ? json({ ok: true, ...r.value }) : json({ ok: false, error: r.error }, 400);
  },
  { write: true, auth: true },
);

/** Отвязать Telegram (нельзя, если аккаунт создан через Telegram и другого входа нет) */
export const DELETE = route(
  ({ db, user }) => {
    if (user!.email.endsWith("@t.me")) {
      return json({ ok: false, error: "Аккаунт создан через Telegram: отвязав его, вы потеряете вход" }, 400);
    }
    db.prepare("UPDATE users SET telegram_id = NULL, telegram_username = '' WHERE id = ?").run(user!.id);
    return json({ ok: true });
  },
  { write: true, auth: true },
);
