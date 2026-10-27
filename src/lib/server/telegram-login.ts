/**
 * Вход через Telegram-бота: без виджета и без пароля.
 *
 * 1. Сайт просит `startLogin` — сервер выдаёт одноразовый токен, короткий код и ссылку на бота.
 * 2. Человек открывает бота, видит там тот же код и подтверждает вход кнопкой.
 * 3. Сайт опрашивает `loginStatus`; как только вход подтверждён, сервер один раз
 *    выдаёт сессию (токен тут же «сгорает»).
 *
 * Код сверяется глазами: так чужая ссылка не может войти в ваш аккаунт, даже если
 * вам её подсунули. Сообщения бота принимаются либо вебхуком (`handleUpdate` из
 * /api/tglogin/webhook), либо лёгким опросом getUpdates, который работает, только
 * пока есть ожидающие входы.
 */

import { randomBytes, randomInt } from "node:crypto";

import { getDb } from "./db";
import { createSession, upsertTelegramUser, type UserRow } from "./users";
import { num, str, type Database } from "./sqlite";
import { handleBotMessage, handleBotCallback } from "./telegram-bot";

export const LOGIN_TTL_MS = 5 * 60 * 1000;
const POLLER_IDLE_MS = 10 * 60 * 1000;

/* ------------------------------ Telegram API --------------------------- */

interface TgReply<T = unknown> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
}
type Transport = (method: string, body: Record<string, unknown>, timeoutMs: number) => Promise<TgReply>;

const defaultTransport: Transport = async (method, body, timeoutMs) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN не задан" };
  const base = (process.env.TELEGRAM_API_BASE || "https://api.telegram.org").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return (await res.json()) as TgReply;
  } catch (error) {
    return { ok: false, description: error instanceof Error ? error.message : "сеть недоступна" };
  }
};
let transport: Transport = defaultTransport;
/** Для тестов: подменить отправку запросов в Telegram */
export function setTelegramTransport(next: Transport | null): void {
  transport = next ?? defaultTransport;
}
export const tg = (method: string, body: Record<string, unknown>, timeoutMs = 15_000) => transport(method, body, timeoutMs);

export const botUsername = (): string =>
  (process.env.TELEGRAM_BOT_USERNAME || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "").replace(/^@/, "");

/* --------------------------------- Старт ------------------------------- */

export interface StartResult {
  token: string;
  code: string;
  link: string;
  expiresAt: number;
}

/** "Chrome · Windows" из User-Agent: показываем в сообщении бота, чтобы было что сверить */
export function deviceLabel(ua: string): string {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /YaBrowser/.test(ua) ? "Яндекс Браузер" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Браузер";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "неизвестная система";
  return `${browser} · ${os}`;
}

export function startLogin(db: Database, meta: { ip: string; ua: string; now?: number }): { ok: true; value: StartResult } | { ok: false; error: string } {
  const now = meta.now ?? Date.now();
  const bot = botUsername();
  if (!bot || !process.env.TELEGRAM_BOT_TOKEN) return { ok: false, error: "Вход через Telegram не настроен" };
  db.prepare("DELETE FROM tg_logins WHERE created_at < ?").run(now - 60 * 60 * 1000);
  const recent = num(db.prepare("SELECT COUNT(*) AS n FROM tg_logins WHERE ip = ? AND created_at > ?").get(meta.ip, now - 60_000)?.n);
  if (recent >= 8) return { ok: false, error: "Слишком много попыток. Подождите минуту" };
  const token = randomBytes(18).toString("base64url");
  const code = String(randomInt(1000, 10000));
  const expiresAt = now + LOGIN_TTL_MS;
  db.prepare("INSERT INTO tg_logins (token, code, status, created_at, expires_at, ip, ua) VALUES (?, ?, 'pending', ?, ?, ?, ?)").run(
    token,
    code,
    now,
    expiresAt,
    meta.ip.slice(0, 64),
    meta.ua.slice(0, 200),
  );
  ensurePoller();
  return { ok: true, value: { token, code, link: `https://t.me/${bot}?start=login_${token}`, expiresAt } };
}

/** Начать привязку Telegram к аккаунту `userId`: тот же поток, но ссылка `link_…` */
export function startLink(db: Database, userId: number, meta: { ip: string; ua: string; now?: number }): { ok: true; value: StartResult } | { ok: false; error: string } {
  const now = meta.now ?? Date.now();
  const bot = botUsername();
  if (!bot || !process.env.TELEGRAM_BOT_TOKEN) return { ok: false, error: "Telegram не настроен" };
  const recent = num(db.prepare("SELECT COUNT(*) AS n FROM tg_logins WHERE ip = ? AND created_at > ?").get(meta.ip, now - 60_000)?.n);
  if (recent >= 8) return { ok: false, error: "Слишком много попыток. Подождите минуту" };
  const token = randomBytes(18).toString("base64url");
  const code = String(randomInt(1000, 10000));
  const expiresAt = now + LOGIN_TTL_MS;
  db.prepare("INSERT INTO tg_logins (token, code, status, created_at, expires_at, ip, ua, user_id) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?)").run(
    token,
    code,
    now,
    expiresAt,
    meta.ip.slice(0, 64),
    meta.ua.slice(0, 200),
    userId,
  );
  ensurePoller();
  return { ok: true, value: { token, code, link: `https://t.me/${bot}?start=link_${token}`, expiresAt } };
}

/* ------------------------------ Обновления бота ------------------------- */

interface TgFrom {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}
export interface TgUpdate {
  update_id: number;
  message?: { message_id: number; text?: string; from?: TgFrom; chat: { id: number; type: string } };
  callback_query?: { id: string; from: TgFrom; data?: string; message?: { message_id: number; chat: { id: number } } };
}

const nameOf = (u: TgFrom): string => (u.username || [u.first_name, u.last_name].filter(Boolean).join(" ") || `tg_${u.id}`).trim();

function say(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  return tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra });
}

const esc = (s: string): string => s.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));

export async function handleUpdate(db: Database, update: TgUpdate, now = Date.now()): Promise<void> {
  const m = update.message;
  if (m?.text && m.from && m.chat.type === "private") {
    const text = m.text.trim();
    const hit = /^\/start(?:@\w+)?\s+(?:login|link)_([A-Za-z0-9_-]{16,64})$/.exec(text);
    if (hit) return askConfirm(db, hit[1], m.from, m.chat.id, now);
    await handleBotMessage(db, text, m.from, m.chat.id);
    return;
  }
  const cb = update.callback_query;
  if (cb?.data) {
    if (/^(ok|no):/.test(cb.data)) return answerCallback(db, cb, now);
    return handleBotCallback(db, cb);
  }
}

async function askConfirm(db: Database, token: string, from: TgFrom, chatId: number, now: number): Promise<void> {
  const row = db.prepare("SELECT * FROM tg_logins WHERE token = ?").get(token);
  if (!row || str(row.status) !== "pending" || num(row.expires_at) < now) {
    await say(chatId, "Эта ссылка устарела или уже использована. Вернитесь на сайт и нажмите «Войти через Telegram» ещё раз.");
    return;
  }
  const linking = num(row.user_id) > 0;
  const reply = await say(
    chatId,
    linking
      ? `<b>Привязка Telegram к AniGalaxy</b>\n\nКод на сайте: <b>${esc(str(row.code))}</b>\nУстройство: ${esc(deviceLabel(str(row.ua)))}\n\nЕсли код совпадает с тем, что на экране, подтвердите привязку. Если вы ничего не открывали, нажмите «Это не я».`
      : `<b>Вход в AniGalaxy</b>\n\nКод на сайте: <b>${esc(str(row.code))}</b>\nУстройство: ${esc(deviceLabel(str(row.ua)))}\n\nЕсли код совпадает с тем, что на экране, подтвердите вход. Если вы ничего не открывали, нажмите «Это не я».`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ Подтвердить", callback_data: `ok:${token}` },
          { text: "✖ Это не я", callback_data: `no:${token}` },
        ]],
      },
    },
  );
  const messageId = num((reply.result as { message_id?: number } | undefined)?.message_id);
  db.prepare("UPDATE tg_logins SET asked_by = ?, chat_id = ?, message_id = ? WHERE token = ? AND status = 'pending'").run(String(from.id), chatId, messageId, token);
}

async function answerCallback(db: Database, cb: NonNullable<TgUpdate["callback_query"]>, now: number): Promise<void> {
  const hit = /^(ok|no):([A-Za-z0-9_-]{16,64})$/.exec(cb.data ?? "");
  if (!hit) return;
  const [, action, token] = hit;
  const row = db.prepare("SELECT * FROM tg_logins WHERE token = ?").get(token);
  const reply = (text: string, alert = true) => tg("answerCallbackQuery", { callback_query_id: cb.id, text, show_alert: alert });
  if (!row || str(row.status) !== "pending" || num(row.expires_at) < now) {
    await reply("Запрос уже недействителен. Начните вход на сайте заново.");
    return;
  }
  if (str(row.asked_by) !== String(cb.from.id)) {
    await reply("Этот запрос открыт в другом аккаунте Telegram.");
    return;
  }
  const edit = (text: string) =>
    cb.message ? tg("editMessageText", { chat_id: cb.message.chat.id, message_id: cb.message.message_id, text, parse_mode: "HTML" }) : Promise.resolve();
  if (action === "no") {
    db.prepare("UPDATE tg_logins SET status = 'cancelled' WHERE token = ? AND status = 'pending'").run(token);
    await edit(num(row.user_id) > 0 ? "Привязка отменена." : "Вход отменён. Если это были не вы, просто проигнорируйте запрос.");
    await reply("Отменено", false);
    return;
  }
  db.prepare("UPDATE tg_logins SET status = 'confirmed', tg_id = ?, tg_name = ?, tg_username = ? WHERE token = ? AND status = 'pending'").run(
    String(cb.from.id),
    nameOf(cb.from),
    cb.from.username ?? "",
    token,
  );
  await edit(num(row.user_id) > 0 ? "✅ <b>Привязка подтверждена.</b>\nМожно вернуться на сайт." : "✅ <b>Вход подтверждён.</b>\nМожно вернуться на сайт.");
  await reply("Готово", false);
}

/* --------------------------------- Статус ------------------------------ */

export type LoginStatus =
  | { status: "pending" | "expired" | "cancelled" | "unknown" | "banned" }
  | {
      status: "ok";
      user: UserRow;
      telegram: { id: number; username: string | null; firstName: string | null; lastName: string | null; photoUrl: null };
      session: { token: string; expiresAt: number };
    };

export function loginStatus(db: Database, token: string, meta: { ip: string; ua: string; now?: number }): LoginStatus {
  const now = meta.now ?? Date.now();
  const row = db.prepare("SELECT * FROM tg_logins WHERE token = ?").get(token);
  if (!row || num(row.user_id) > 0) return { status: "unknown" };
  const status = str(row.status);
  if (status === "cancelled") return { status: "cancelled" };
  if (status === "consumed") return { status: "unknown" };
  if (status === "confirmed") {
    // Отдаём сессию ровно один раз: следующий опрос увидит consumed
    const claimed = db.prepare("UPDATE tg_logins SET status = 'consumed' WHERE token = ? AND status = 'confirmed'").run(token);
    if (!num((claimed as { changes?: number }).changes)) return { status: "unknown" };
    const id = str(row.tg_id);
    const username = str(row.tg_username);
    const name = str(row.tg_name);
    const upserted = upsertTelegramUser(db, { telegramId: id, nickname: username || name || `tg_${id}`, now });
    if (!upserted.ok) return { status: "unknown" };
    if (upserted.value.bannedUntil > now) return { status: "banned" };
    const session = createSession(db, upserted.value.id, { userAgent: meta.ua, ip: meta.ip, now });
    return {
      status: "ok",
      user: upserted.value,
      telegram: { id: Number(id), username: username || null, firstName: name || null, lastName: null, photoUrl: null },
      session,
    };
  }
  return num(row.expires_at) < now ? { status: "expired" } : { status: "pending" };
}

/* ------------------------------ Статус привязки ------------------------ */

export type LinkStatus =
  | { status: "pending" | "expired" | "cancelled" | "unknown" }
  | { status: "taken" }
  | { status: "ok"; username: string; name: string };

/** Опрос привязки: подтверждённый запрос записывает telegram_id в аккаунт ровно один раз */
export function linkStatus(db: Database, token: string, userId: number, now = Date.now()): LinkStatus {
  const row = db.prepare("SELECT * FROM tg_logins WHERE token = ?").get(token);
  if (!row || num(row.user_id) !== userId) return { status: "unknown" };
  const status = str(row.status);
  if (status === "cancelled") return { status: "cancelled" };
  if (status === "consumed") return { status: "unknown" };
  if (status === "confirmed") {
    const claimed = db.prepare("UPDATE tg_logins SET status = 'consumed' WHERE token = ? AND status = 'confirmed'").run(token);
    if (!num((claimed as { changes?: number }).changes)) return { status: "unknown" };
    const id = str(row.tg_id);
    const other = db.prepare("SELECT id FROM users WHERE telegram_id = ? AND id <> ?").get(id, userId);
    if (other) return { status: "taken" };
    db.prepare("UPDATE users SET telegram_id = ?, telegram_username = ? WHERE id = ?").run(id, str(row.tg_username), userId);
    return { status: "ok", username: str(row.tg_username), name: str(row.tg_name) };
  }
  return num(row.expires_at) < now ? { status: "expired" } : { status: "pending" };
}

/* -------------------------------- Приём сообщений ---------------------- */

interface PollerState {
  running: boolean;
  offset: number;
  idleUntil: number;
}

/** Опрос getUpdates живёт только пока кто-то входит; в режиме вебхука не нужен */
export function ensurePoller(): void {
  if (process.env.TELEGRAM_LOGIN_MODE === "webhook" || !process.env.TELEGRAM_BOT_TOKEN) return;
  const g = globalThis as { __agTgPoller?: PollerState };
  const state = (g.__agTgPoller ??= { running: false, offset: 0, idleUntil: 0 });
  state.idleUntil = Date.now() + POLLER_IDLE_MS;
  if (state.running) return;
  state.running = true;
  void loop(state);
}

async function loop(state: PollerState): Promise<void> {
  try {
    while (Date.now() < state.idleUntil) {
      const res = await tg("getUpdates", { offset: state.offset, timeout: 20, allowed_updates: ["message", "callback_query"] }, 30_000);
      if (!res.ok) {
        if (res.error_code === 409) {
          console.error("[tglogin] у бота включён вебхук. Поставьте TELEGRAM_LOGIN_MODE=webhook и настройте /api/tglogin/webhook");
          return;
        }
        console.error("[tglogin] getUpdates:", res.description);
        await new Promise((r) => setTimeout(r, 4000));
        continue;
      }
      for (const update of (res.result as TgUpdate[] | undefined) ?? []) {
        state.offset = update.update_id + 1;
        try {
          await handleUpdate(getDb(), update);
        } catch (error) {
          console.error("[tglogin] обработка:", error);
        }
      }
    }
  } finally {
    state.running = false;
  }
}
