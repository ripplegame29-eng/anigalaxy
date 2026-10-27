/**
 * Возможности бота кроме входа: красивые карточки аниме с постерами, поиск,
 * топ, случайное, профиль и уведомления о новых сериях.
 * Вход и привязка живут в telegram-login.ts.
 */

import { getDoc } from "./docs";
import { getDb } from "./db";
import { tg } from "./telegram-login";
import { num, str, type Database } from "./sqlite";
import { catalog, getTitleDetail, quickSearch } from "../kodik";
import type { AnimeCard } from "../types";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://anigalaxy.space").replace(/\/$/, "");
const CHANNEL = "https://t.me/anigalaxyspace";
const COLLECTIONS_KEY = "animehub:collections:v1";
const FAVORITES_KEY = "animehub:favorites:v1";

const esc = (s: string): string => s.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));

interface From {
  id: number;
  username?: string;
}

const MENU = {
  inline_keyboard: [
    [
      { text: "🔎 Найти аниме", callback_data: "m:search" },
      { text: "🎲 Случайное", callback_data: "f:rnd" },
    ],
    [
      { text: "🏆 Топ рейтинга", callback_data: "f:top" },
      { text: "🔥 Сейчас выходит", callback_data: "f:ong" },
    ],
    [
      { text: "👤 Мой профиль", callback_data: "m:me" },
      { text: "🔔 Новые серии", callback_data: "m:notify" },
    ],
    [{ text: "🌐 Открыть AniGalaxy", url: SITE }],
    [
      { text: "💬 Поддержка", url: `${SITE}/#support` },
      { text: "📣 Наш канал", url: CHANNEL },
    ],
  ],
};

const WELCOME =
  "✨ <b>Добро пожаловать в AniGalaxy!</b>\n\nСмотрите аниме в отличном качестве, собирайте награды и растите уровень. Здесь в Telegram я помогу быстро найти тайтл, покажу ваш профиль и напишу, когда выйдет новая серия.\n\n<i>Выберите, с чего начать 👇</i>";

const HELP =
  "<b>🪐 Что умеет бот</b>\n\n/menu — главное меню\n/search <i>название</i> — найти аниме\n/random — случайное аниме\n/top — топ по рейтингу\n/new — что выходит сейчас\n/me — профиль, уровень и баланс\n/notify — уведомления о новых сериях\n\n💡 Можно просто написать название аниме — я его найду.";

function send(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  return tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra });
}

/** Фото с подписью; если Telegram не смог загрузить картинку, отправляем обычным текстом */
async function sendCard(chatId: number, photo: string | undefined, caption: string, markup: unknown): Promise<void> {
  if (photo) {
    const r = await tg("sendPhoto", { chat_id: chatId, photo, caption, parse_mode: "HTML", reply_markup: markup });
    if (r.ok) return;
  }
  await send(chatId, caption, { reply_markup: markup });
}

function userByTg(db: Database, tgId: number) {
  return db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(String(tgId));
}

/* -------------------------------- Карточки ------------------------------ */

interface CardList {
  cards: AnimeCard[];
  label: string;
  at: number;
}
const lists = new Map<string, CardList>();

function keepList(cards: AnimeCard[], label: string): string {
  const now = Date.now();
  for (const [k, v] of lists) if (now - v.at > 60 * 60_000) lists.delete(k);
  if (lists.size > 300) lists.delete(lists.keys().next().value as string);
  const key = Math.random().toString(36).slice(2, 8);
  lists.set(key, { cards, label, at: now });
  return key;
}

const stars = (rating: number): string => {
  const n = Math.round(rating / 2);
  return "★".repeat(n) + "☆".repeat(5 - n);
};

function caption(card: AnimeCard, i: number, total: number, label: string): string {
  const meta: string[] = [];
  if (card.rating) meta.push(`⭐ <b>${card.rating.toFixed(1)}</b>`);
  if (card.year) meta.push(`📅 ${card.year}`);
  if (card.kind === "movie") meta.push("🎞 Фильм");
  else if (card.lastEpisode) meta.push(`🎞 ${card.lastEpisode}${card.episodesTotal ? ` из ${card.episodesTotal}` : ""} эп.`);
  const lines = [`🎬 <b>${esc(card.title)}</b>`];
  if (card.titleOrig && card.titleOrig !== card.title) lines.push(`<i>${esc(card.titleOrig)}</i>`);
  if (meta.length) lines.push("", meta.join("  ·  "));
  if (card.rating) lines.push(`<code>${stars(card.rating)}</code>`);
  if (card.genres?.length) lines.push("", `🏷 ${card.genres.slice(0, 4).map(esc).join(" · ")}`);
  if (card.description) {
    const d = card.description.replace(/\s+/g, " ").trim();
    lines.push("", `<blockquote>${esc(d.length > 280 ? `${d.slice(0, 277)}…` : d)}</blockquote>`);
  }
  lines.push("", `<i>${esc(label)} · ${i + 1} из ${total}</i>`);
  const out = lines.join("\n");
  return out.length > 1000 ? out.slice(0, 997) + "…" : out;
}

function cardKeyboard(key: string, i: number, total: number, card: AnimeCard) {
  const prev = (i - 1 + total) % total;
  const next = (i + 1) % total;
  return {
    inline_keyboard: [
      [{ text: "▶️ Смотреть на сайте", url: `${SITE}/title/${card.id}` }],
      ...(total > 1
        ? [[
            { text: "◀️", callback_data: `v:${key}:${prev}` },
            { text: `${i + 1} / ${total}`, callback_data: "noop" },
            { text: "▶️", callback_data: `v:${key}:${next}` },
          ]]
        : []),
      [
        { text: "🎲 Случайное", callback_data: "f:rnd" },
        { text: "🏠 Меню", callback_data: "m:menu" },
      ],
    ],
  };
}

/** Показать карточку: новым сообщением или правкой существующего */
async function showCard(chatId: number, key: string, i: number, messageId?: number): Promise<void> {
  const list = lists.get(key);
  if (!list || !list.cards[i]) {
    await send(chatId, "Этот список уже устарел. Начните поиск заново: /menu");
    return;
  }
  const card = list.cards[i];
  const text = caption(card, i, list.cards.length, list.label);
  const markup = cardKeyboard(key, i, list.cards.length, card);
  if (!messageId) return sendCard(chatId, card.poster, text, markup);
  if (card.poster) {
    const r = await tg("editMessageMedia", {
      chat_id: chatId,
      message_id: messageId,
      media: { type: "photo", media: card.poster, caption: text, parse_mode: "HTML" },
      reply_markup: markup,
    });
    if (r.ok) return;
  }
  const r2 = await tg("editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: markup });
  if (!r2.ok) await sendCard(chatId, card.poster, text, markup);
}

async function showList(chatId: number, cards: AnimeCard[], label: string): Promise<void> {
  if (!cards.length) return void (await send(chatId, "Ничего не нашлось. Попробуйте другой запрос."));
  await showCard(chatId, keepList(cards, label), 0);
}

const GENRES = ["Фэнтези", "Экшен", "Романтика", "Комедия", "Драма", "Приключения", "Фантастика", "Детектив", "Повседневность", "Триллер"];

async function feed(chatId: number, kind: "top" | "ong" | "rnd"): Promise<void> {
  try {
    if (kind === "top") {
      const r = await catalog({ sort: "rating", type: "serial" });
      return showList(chatId, r.cards.slice(0, 12), "🏆 Топ рейтинга");
    }
    if (kind === "ong") {
      const r = await catalog({ status: "ongoing", sort: "updated" });
      return showList(chatId, r.cards.slice(0, 12), "🔥 Сейчас выходит");
    }
    const genre = GENRES[Math.floor(Math.random() * GENRES.length)];
    const r = await catalog({ genre, sort: "rating" });
    const pool = [...r.cards].sort(() => Math.random() - 0.5).slice(0, 8);
    return showList(chatId, pool, `🎲 Случайное · ${genre}`);
  } catch {
    await send(chatId, "Каталог сейчас не отвечает. Попробуйте чуть позже.");
  }
}

async function search(chatId: number, q: string): Promise<void> {
  const query = q.trim().slice(0, 80);
  if (query.length < 2) return void (await send(chatId, "Напишите хотя бы две буквы названия."));
  try {
    const cards = await quickSearch(query, 10);
    if (!cards.length) return void (await send(chatId, `По запросу «${esc(query)}» ничего не нашлось 🙈\nПроверьте написание или попробуйте оригинальное название.`));
    await showList(chatId, cards, `🔎 «${query}»`);
  } catch {
    await send(chatId, "Каталог сейчас не отвечает. Попробуйте чуть позже.");
  }
}

/* --------------------------- Команды и кнопки --------------------------- */

export async function handleBotMessage(db: Database, text: string, from: From, chatId: number): Promise<void> {
  const cmd = /^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/.exec(text);
  if (!cmd) return search(chatId, text);
  const name = cmd[1].toLowerCase();
  const arg = cmd[2].trim();
  switch (name) {
    case "start":
      return sendCard(chatId, `${SITE}/cat.png`, WELCOME, MENU);
    case "menu":
      return void (await send(chatId, "🪐 <b>Главное меню</b>", { reply_markup: MENU }));
    case "help":
      return void (await send(chatId, HELP, { reply_markup: MENU }));
    case "search":
      return arg ? search(chatId, arg) : void (await send(chatId, "Напишите название после команды, например: <code>/search Наруто</code>"));
    case "random":
      return feed(chatId, "rnd");
    case "top":
      return feed(chatId, "top");
    case "new":
      return feed(chatId, "ong");
    case "me":
      return profile(db, from.id, chatId);
    case "notify":
      return notifyToggle(db, from.id, chatId, false);
    default:
      await send(chatId, "Такой команды нет. Список команд: /help");
  }
}

export async function handleBotCallback(db: Database, cb: { id: string; from: From; data?: string; message?: { message_id: number; chat: { id: number } } }): Promise<void> {
  const chatId = cb.message?.chat.id;
  await tg("answerCallbackQuery", { callback_query_id: cb.id });
  const data = cb.data ?? "";
  if (!chatId || data === "noop") return;
  if (data === "m:me") return profile(db, cb.from.id, chatId);
  if (data === "m:menu") return void (await send(chatId, "🪐 <b>Главное меню</b>", { reply_markup: MENU }));
  if (data === "m:search") return void (await send(chatId, "🔎 Напишите название аниме одним сообщением, например «Атака титанов»."));
  if (data === "m:notify") return notifyToggle(db, cb.from.id, chatId, true);
  if (data === "f:top" || data === "f:ong" || data === "f:rnd") return feed(chatId, data.slice(2) as "top" | "ong" | "rnd");
  const v = /^v:(\w+):(\d+)$/.exec(data);
  if (v) return showCard(chatId, v[1], Number(v[2]), cb.message?.message_id);
}

async function profile(db: Database, tgId: number, chatId: number): Promise<void> {
  const u = userByTg(db, tgId);
  if (!u) {
    return void (await send(chatId, "🔗 Этот Telegram пока не привязан к аккаунту.\n\nОткройте на сайте <b>Настройки → Профиль</b> и нажмите «Привязать Telegram». После этого здесь появятся ваш уровень, баланс и уведомления о сериях.", {
      reply_markup: { inline_keyboard: [[{ text: "⚙️ Открыть настройки", url: `${SITE}/settings` }], [{ text: "🏠 Меню", callback_data: "m:menu" }]] },
    }));
  }
  const st = db.prepare("SELECT level, xp_total, ac_balance FROM player_stats WHERE user_id = ?").get(num(u.id));
  const until = num(u.premium_until);
  const hasPremium = until > Date.now();
  const nf = (n: number) => n.toLocaleString("ru-RU");
  const lines = [
    `${hasPremium ? "👑" : "👤"} <b>${esc(str(u.display_name) || str(u.nickname))}</b>`,
    hasPremium ? "<i>Premium-участник</i>" : "<i>Участник AniGalaxy</i>",
    "",
    `🏅 Уровень  <b>${num(st?.level, 1)}</b>`,
    `✨ Опыт  <b>${nf(num(st?.xp_total))}</b> XP`,
    `🪙 Баланс  <b>${nf(num(st?.ac_balance))}</b> AC`,
    hasPremium ? `👑 Premium до  <b>${new Date(until).toLocaleDateString("ru-RU")}</b>` : "👑 Premium  не подключён",
  ];
  await send(chatId, lines.join("\n"), {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🪐 Открыть профиль", url: `${SITE}/profile` }],
        hasPremium ? [{ text: "🏠 Меню", callback_data: "m:menu" }] : [{ text: "👑 Подключить Premium", url: `${SITE}/premium` }, { text: "🏠 Меню", callback_data: "m:menu" }],
      ],
    },
  });
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
      ? "🔔 <b>Уведомления включены</b>\n\nНапишу, когда выйдет новая серия аниме из вашего избранного и списка «Смотрю»."
      : "🔕 <b>Уведомления выключены</b>\n\nНовые серии больше не будут приходить в Telegram.",
    { reply_markup: { inline_keyboard: [[{ text: on ? "🔕 Выключить" : "🔔 Включить", callback_data: "m:notify" }], [{ text: "🏠 Меню", callback_data: "m:menu" }]] } },
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
  const latest = new Map<string, { title: string; ep: number; poster?: string }>();
  for (const id of [...unique].slice(0, 150)) {
    try {
      const d = await getTitleDetail(id);
      if (d && d.card.lastEpisode) latest.set(id, { title: d.card.title, ep: d.card.lastEpisode, poster: d.card.poster });
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
      const markup = { inline_keyboard: [[{ text: "▶️ Смотреть серию", url: `${SITE}/title/${id}` }], [{ text: "🔕 Отключить уведомления", callback_data: "m:notify" }]] };
      const text = `🆕 <b>Вышла ${now.ep} серия!</b>\n\n🎬 ${esc(now.title)}\n\n<i>Уже доступна на AniGalaxy</i>`;
      let ok = false;
      if (now.poster) ok = (await tg("sendPhoto", { chat_id: Number(chat), photo: now.poster, caption: text, parse_mode: "HTML", reply_markup: markup })).ok;
      if (!ok) ok = (await send(Number(chat), text, { reply_markup: markup })).ok;
      const res = { ok };
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
  setTimeout(() => void configureBot().catch((e) => console.error("[tgbot] настройка:", e)), 15_000);
  const run = () => void checkNewEpisodes().catch((e) => console.error("[tgbot] серии:", e));
  setTimeout(run, 2 * 60_000);
  setInterval(run, 30 * 60_000);
}

/** Список команд, описание и кнопка меню бота: ставится сам при запуске сайта */
export async function configureBot(): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  const results = await Promise.all([
    tg("setMyCommands", {
      commands: [
        { command: "menu", description: "🪐 Главное меню" },
        { command: "search", description: "🔎 Найти аниме по названию" },
        { command: "random", description: "🎲 Случайное аниме" },
        { command: "top", description: "🏆 Топ по рейтингу" },
        { command: "new", description: "🔥 Что выходит сейчас" },
        { command: "me", description: "👤 Профиль, уровень и баланс" },
        { command: "notify", description: "🔔 Уведомления о новых сериях" },
        { command: "help", description: "❓ Что умеет бот" },
      ],
    }),
    tg("setMyDescription", {
      description: "Бот AniGalaxy: вход на сайт, поиск аниме, профиль и уведомления о новых сериях.",
    }),
    tg("setMyShortDescription", { short_description: "Поиск аниме, профиль и новые серии на AniGalaxy" }),
    tg("setChatMenuButton", { menu_button: { type: "commands" } }),
  ]);
  const bad = results.find((r) => !r.ok);
  if (bad) console.error("[tgbot] настройка бота:", bad.description);
}
