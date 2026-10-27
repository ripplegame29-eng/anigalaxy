/**
 * Возможности бота кроме входа: меню, поиск аниме, профиль и уведомления
 * о новых сериях. Вход и привязка живут в telegram-login.ts.
 */

import { getDoc } from "./docs";
import { getDb } from "./db";
import { tg } from "./telegram-login";
import { num, str, type Database } from "./sqlite";
import { getTitleDetail, quickSearch } from "../kodik";
const COLLECTIONS_KEY = "animehub:collections:v1";
const FAVORITES_KEY = "animehub:favorites:v1";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://anigalaxy.space").replace(/\/$/, "");

const esc = (s: string): string => s.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));

interface From {
  id: number;
  username?: string;
}

const MENU = {
  inline_keyboard: [
    [
      { text: "🌐 Открыть сайт", url: SITE },
      { text: "📣 Канал", url: "https://t.me/anialaxyspace" },
    ],
    [
      { text: "👤 Мой профиль", callback_data: "m:me" },
      { text: "🔍 Поиск аниме", callback_data: "m:search" },
    ],
    [{ text: "🔔 Уведомления о сериях", callback_data: "m:notify" }],
  ],
};

function send(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  return tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra });
}

function userByTg(db: Database, tgId: number) {
  return db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(String(tgId));
}

const HELP =
  "<b>Бот AniGalaxy</b>\n\n/menu — меню\n/search название — найти аниме\n/me — профиль, уровень и баланс\n/notify — уведомления о новых сериях\n\nМожно просто написать название аниме — я его найду.";

/** Сообщение в личке: команда или текст для поиска */
export async function handleBotMessage(db: Database, text: string, from: From, chatId: number): Promise<void> {
  const cmd = /^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/.exec(text);
  if (!cmd) return search(chatId, text);
  const name = cmd[1].toLowerCase();
  const arg = cmd[2].trim();
  switch (name) {
    case "start":
      return void (await send(chatId, "Привет! Это бот AniGalaxy. Ищите аниме, смотрите профиль и получайте уведомления о новых сериях.", { reply_markup: MENU }));
    case "menu":
      return void (await send(chatId, "Что открыть?", { reply_markup: MENU }));
    case "help":
      return void (await send(chatId, HELP));
    case "search":
      return arg ? search(chatId, arg) : void (await send(chatId, "Напишите название после команды, например: <code>/search Наруто</code>"));
    case "me":
      return profile(db, from.id, chatId);
    case "notify":
      return notifyToggle(db, from.id, chatId, false);
    default:
      await send(chatId, "Такой команды нет. Список команд: /help");
  }
}

export async function handleBotCallback(db: Database, cb: { id: string; from: From; data?: string; message?: { chat: { id: number } } }): Promise<void> {
  const chatId = cb.message?.chat.id;
  await tg("answerCallbackQuery", { callback_query_id: cb.id });
  if (!chatId) return;
  if (cb.data === "m:me") return profile(db, cb.from.id, chatId);
  if (cb.data === "m:search") return void (await send(chatId, "Напишите название аниме одним сообщением."));
  if (cb.data === "m:notify") return notifyToggle(db, cb.from.id, chatId, true);
}

async function search(chatId: number, q: string): Promise<void> {
  const query = q.trim().slice(0, 80);
  if (query.length < 2) return void (await send(chatId, "Напишите хотя бы две буквы названия."));
  let cards;
  try {
    cards = await quickSearch(query, 6);
  } catch {
    return void (await send(chatId, "Каталог сейчас не отвечает. Попробуйте чуть позже."));
  }
  if (!cards.length) return void (await send(chatId, `По запросу «${esc(query)}» ничего не нашлось. Проверьте написание.`));
  const lines = cards.map((c, i) => `${i + 1}. <b>${esc(c.title)}</b>${c.year ? ` · ${c.year}` : ""}${c.rating ? ` · ★ ${c.rating.toFixed(1)}` : ""}`);
  await send(chatId, `Нашёл по запросу «${esc(query)}»:\n\n${lines.join("\n")}`, {
    reply_markup: { inline_keyboard: cards.map((c, i) => [{ text: `${i + 1}. ${c.title.slice(0, 40)} — смотреть`, url: `${SITE}/title/${c.id}` }]) },
  });
}

async function profile(db: Database, tgId: number, chatId: number): Promise<void> {
  const u = userByTg(db, tgId);
  if (!u) {
    return void (await send(chatId, "Этот Telegram пока не привязан к аккаунту. Откройте «Настройки → Профиль» на сайте и нажмите «Привязать Telegram».", {
      reply_markup: { inline_keyboard: [[{ text: "Открыть настройки", url: `${SITE}/settings` }]] },
    }));
  }
  const st = db.prepare("SELECT level, xp_total, ac_balance FROM player_stats WHERE user_id = ?").get(num(u.id));
  const until = num(u.premium_until);
  const premium = until > Date.now() ? `до ${new Date(until).toLocaleDateString("ru-RU")}` : "нет";
  await send(
    chatId,
    `<b>${esc(str(u.display_name) || str(u.nickname))}</b>\n\nУровень: <b>${num(st?.level, 1)}</b>\nОпыт: ${num(st?.xp_total).toLocaleString("ru-RU")} XP\nБаланс: ${num(st?.ac_balance).toLocaleString("ru-RU")} AC\nPremium: ${premium}`,
    { reply_markup: { inline_keyboard: [[{ text: "Открыть профиль", url: `${SITE}/profile` }]] } },
  );
}

async function notifyToggle(db: Database, tgId: number, chatId: number, flip: boolean): Promise<void> {
  const u = userByTg(db, tgId);
  if (!u) return profile(db, tgId, chatId);
  const uid = num(u.id);
  const row = db.prepare("SELECT enabled FROM tg_notify WHERE user_id = ?").get(uid);
  let on = row ? num(row.enabled) === 1 : true;
  if (flip) {
    on = !on;
    db.prepare("INSERT INTO tg_notify (user_id, enabled) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET enabled = excluded.enabled").run(uid, on ? 1 : 0);
  }
  await send(
    chatId,
    on
      ? "🔔 Уведомления <b>включены</b>: напишу, когда выйдет новая серия аниме из вашего избранного и списка «Смотрю»."
      : "🔕 Уведомления <b>выключены</b>.",
    { reply_markup: { inline_keyboard: [[{ text: on ? "Выключить" : "Включить", callback_data: "m:notify" }]] } },
  );
}

/* ----------------------------- Новые серии ----------------------------- */

function watchedIds(db: Database, userId: number): string[] {
  const ids = new Set<string>();
  const fav = getDoc(db, userId, FAVORITES_KEY);
  try {
    for (const id of JSON.parse(fav?.value ?? "[]") as unknown[]) if (typeof id === "string") ids.add(id);
  } catch {
    /* повреждённый документ пропускаем */
  }
  const cols = getDoc(db, userId, COLLECTIONS_KEY);
  try {
    for (const c of JSON.parse(cols?.value ?? "[]") as { name?: string; animeIds?: unknown[] }[]) {
      if (typeof c?.name === "string" && /смотрю/i.test(c.name)) for (const id of c.animeIds ?? []) if (typeof id === "string") ids.add(id);
    }
  } catch {
    /* то же */
  }
  return [...ids].filter((id) => /^(serial|movie)-\d+$/.test(id)).slice(0, 40);
}

/** Один проход: сравнить последнюю серию с запомненной и написать, если появилась новая */
export async function checkNewEpisodes(db: Database = getDb()): Promise<number> {
  const users = db
    .prepare("SELECT u.id, u.telegram_id FROM users u LEFT JOIN tg_notify n ON n.user_id = u.id WHERE u.telegram_id IS NOT NULL AND COALESCE(n.enabled, 1) = 1")
    .all();
  const perUser = new Map<number, { tg: string; ids: string[] }>();
  const unique = new Set<string>();
  for (const u of users) {
    const ids = watchedIds(db, num(u.id));
    if (!ids.length) continue;
    perUser.set(num(u.id), { tg: str(u.telegram_id), ids });
    ids.forEach((id) => unique.add(id));
  }
  const latest = new Map<string, { title: string; ep: number }>();
  for (const id of [...unique].slice(0, 150)) {
    try {
      const d = await getTitleDetail(id);
      if (d && d.card.lastEpisode) latest.set(id, { title: d.card.title, ep: d.card.lastEpisode });
    } catch {
      /* Kodik может не ответить, повторим в следующий проход */
    }
  }
  let sent = 0;
  for (const [uid, { tg: chat, ids }] of perUser) {
    for (const id of ids) {
      const now = latest.get(id);
      if (!now) continue;
      const row = db.prepare("SELECT last_ep FROM tg_episodes WHERE user_id = ? AND title_id = ?").get(uid, id);
      if (!row) {
        db.prepare("INSERT INTO tg_episodes (user_id, title_id, last_ep) VALUES (?, ?, ?)").run(uid, id, now.ep);
        continue;
      }
      if (now.ep <= num(row.last_ep)) continue;
      const res = await send(Number(chat), `🆕 <b>${esc(now.title)}</b>: вышла ${now.ep} серия`, {
        reply_markup: { inline_keyboard: [[{ text: "Смотреть", url: `${SITE}/title/${id}` }]] },
      });
      db.prepare("UPDATE tg_episodes SET last_ep = ? WHERE user_id = ? AND title_id = ?").run(now.ep, uid, id);
      if (res.ok) sent += 1;
    }
  }
  return sent;
}

/** Запускает проверку раз в 30 минут (один раз на процесс) */
export function startEpisodeWatcher(): void {
  const g = globalThis as { __agEpWatcher?: boolean };
  if (g.__agEpWatcher || !process.env.TELEGRAM_BOT_TOKEN) return;
  g.__agEpWatcher = true;
  const run = () => void checkNewEpisodes().catch((e) => console.error("[tgbot] серии:", e));
  setTimeout(run, 2 * 60_000);
  setInterval(run, 30 * 60_000);
}
