import { timingSafeEqual } from "node:crypto";

import { json, route } from "@/lib/server/http";
import { handleUpdate, type TgUpdate } from "@/lib/server/telegram-login";

export const runtime = "nodejs";

/**
 * Вебхук бота (для сервера с HTTPS): setWebhook с url=<сайт>/api/tglogin/webhook
 * и secret_token=TELEGRAM_WEBHOOK_SECRET. Включается TELEGRAM_LOGIN_MODE=webhook.
 */
export const POST = route(async ({ db, request }) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return json({ ok: false }, 503);
  const given = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return json({ ok: false }, 403);
  const update = (await request.json().catch(() => null)) as TgUpdate | null;
  if (update && typeof update.update_id === "number") await handleUpdate(db, update);
  return json({ ok: true });
});
