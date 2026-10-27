import type { NextRequest } from "next/server";

import { clientIp, json, route, setSessionCookie } from "@/lib/server/http";
import { verifyInitData } from "@/lib/server/telegram-webapp";
import type { Database } from "@/lib/server/sqlite";
import { createSession, toPublic, upsertTelegramUser } from "@/lib/server/users";

export const runtime = "nodejs";

const attempts = new Map<string, { n: number; reset: number }>();

/** Автовход из мини-приложения: подпись Telegram заменяет код подтверждения */
export const POST = route(({ db, request }) => handle(db, request));

async function handle(db: Database, request: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return json({ ok: false, error: "Telegram не настроен" }, 500);
  const ip = clientIp(request);
  const now = Date.now();
  const slot = attempts.get(ip);
  if (!slot || slot.reset < now) attempts.set(ip, { n: 1, reset: now + 60_000 });
  else if (++slot.n > 20) return json({ ok: false, error: "Слишком много попыток" }, 429);

  let initData = "";
  try {
    initData = String(((await request.json()) as { initData?: unknown }).initData ?? "");
  } catch {
    return json({ ok: false, error: "Некорректный запрос" }, 400);
  }
  const user = verifyInitData(initData, botToken, now);
  if (!user) return json({ ok: false, error: "Подпись Telegram не прошла проверку" }, 403);

  const nick = (user.username || user.first_name || `tg_${user.id}`).trim();
  const up = upsertTelegramUser(db, { telegramId: String(user.id), nickname: nick });
  if (!up.ok) return json({ ok: false, error: "Не удалось войти" }, 500);
  const session = createSession(db, up.value.id, { userAgent: request.headers.get("user-agent") ?? "", ip });
  const response = json({
    ok: true,
    nickname: up.value.nickname,
    telegram: { id: user.id, username: user.username ?? null, firstName: user.first_name ?? null, lastName: user.last_name ?? null, photoUrl: user.photo_url ?? null },
    account: toPublic(up.value),
  });
  setSessionCookie(response, request, session.token);
  return response;
}
