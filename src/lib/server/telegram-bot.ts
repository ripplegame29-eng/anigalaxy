/**
 * Возможности бота кроме входа: красивые карточки аниме с постерами, поиск,
 * топ, случайное, профиль и уведомления о новых сериях.
 * Вход и привязка живут в telegram-login.ts.
 */

import { getDoc } from "./docs";
import { getDb } from "./db";
import { tg } from "./telegram-login";
import { ensureRefCode } from "./referrals";
import { num, str, type Database } from "./sqlite";
import { catalog, getTitleDetail, quickSearch } from "../kodik";
import type { AnimeCard } from "../types";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://anigalaxy.space").replace(/\/$/, "");
const CHANNEL = "https://t.me/anigalaxyspace";
const SUPPORT = "https://t.me/anigalaxy_supp";
const COLLECTIONS_KEY = "animehub:collections:v1";
const FAVORITES_KEY = "animehub:favorites:v1";

const esc = (s: string): string => s.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));

interface From {
  id: number;
  username?: string;
}

/** Главное меню — «панель управления» внутри чата */
const MENU = {
  inline_keyboard: [
    [
      { text: "🔎 Найти аниме", callback_data: "m:search" },
      { text: "🎲 Случайное", callback_data: "f:rnd" },
    ],
    [
      { text: "🏆 Топ", callback_data: "f:top" },
      { text: "🔥 Онгоинги", callback_data: "f:ong" },
      { text: "🎭 Жанры", callback_data: "g:menu" },
    ],
    [
      { text: "⭐ Избранное", callback_data: "m:fav" },
      { text: "👤 Профиль", callback_data: "m:me" },
    ],
    [
      { text: "🎁 Пригласить друга", callback_data: "m:invite" },
      { text: "👑 Premium", callback_data: "m:premium" },
    ],
    [{ text: "🪐 Открыть AniGalaxy", web_app: { url: `${SITE}/tg` } }],
    [
      { text: "💬 Поддержка", callback_data: "s:menu" },
      { text: "📣 Наш канал", url: CHANNEL },
    ],
  ],
};

/** Постоянные кнопки под полем ввода: всё главное — в один тап */
const KEYBOARD = {
  keyboard: [
    [{ text: "🔎 Поиск" }, { text: "🎲 Случайное" }],
    [{ text: "🏆 Топ" }, { text: "🔥 Онгоинги" }, { text: "🎭 Жанры" }],
    [{ text: "⭐ Избранное" }, { text: "👤 Профиль" }],
    [{ text: "👑 Premium" }, { text: "💬 Поддержка" }],
  ],
  resize_keyboard: true,
  is_persistent: true,
  input_field_placeholder: "Название аниме или команда…",
};

/** Нажатия на постоянные кнопки приходят обычным текстом */
const BUTTON_TEXT: Record<string, string> = {
  "🔎 Поиск": "m:search",
  "🎲 Случайное": "f:rnd",
  "🏆 Топ": "f:top",
  "🔥 Онгоинги": "f:ong",
  "🎭 Жанры": "g:menu",
  "⭐ Избранное": "m:fav",
  "👤 Профиль": "m:me",
  "👑 Premium": "m:premium",
  "💬 Поддержка": "s:menu",
};

const WELCOME =
  "✨ <b>AniGalaxy</b> — аниме без рекламы и лишних шагов\n\nИщите тайтлы, листайте подборки с постерами, читайте о новых сериях в день выхода и следите за уровнем — всё прямо в Telegram.\n\n<i>Выберите, с чего начать 👇</i>";

const HELP =
  "<b>🪐 Что умеет бот</b>\n\n<b>Каталог</b>\n/search <i>название</i> — найти аниме\n/random — случайное аниме\n/top — топ по рейтингу\n/new — что выходит сейчас\n/genres — подборки по жанрам\n\n<b>Вместе</b>\n/together — смотреть с друзьями в одной комнате\n\n<b>Ваш аккаунт</b>\n/me — профиль, уровень и баланс\n/fav — избранное\n/invite — ссылка для друзей и награды\n/premium — подписка\n/notify — уведомления о новых сериях\n\n<b>Помощь</b>\n/support — поддержка и быстрые ответы\n\n💡 Можно просто написать название — я найду. А в любом чате наберите <code>@anigalaxy_bot название</code>, чтобы отправить аниме другу.";

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
      [{ text: "📤 Отправить другу", switch_inline_query: card.title.slice(0, 60) }],
      ...(total > 1
        ? [[
            { text: "◀️", callback_data: `v:${key}:${prev}` },
            { text: `${i + 1} / ${total}`, callback_data: "noop" },
            { text: "▶️", callback_data: `v:${key}:${next}` },
          ]]
        : []),
      [
        { text: "🎲 Ещё", callback_data: "f:rnd" },
        { text: "🎭 Жанры", callback_data: "g:menu" },
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

/** Витрина жанров: эмодзи и название для запроса в каталог */
const GENRE_GRID: [string, string][] = [
  ["🗡", "Экшен"], ["🧙", "Фэнтези"], ["💕", "Романтика"], ["😂", "Комедия"],
  ["🎭", "Драма"], ["🧭", "Приключения"], ["🚀", "Фантастика"], ["🕵️", "Детектив"],
  ["☕", "Повседневность"], ["😱", "Триллер"], ["🌀", "Исэкай"], ["🏫", "Школа"],
  ["⚽", "Спорт"], ["🤖", "Меха"], ["👻", "Ужасы"], ["🧠", "Психологическое"],
];

const typing = (chatId: number, action = "typing") => void tg("sendChatAction", { chat_id: chatId, action });

async function genreMenu(chatId: number, messageId?: number): Promise<void> {
  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < GENRE_GRID.length; i += 2) {
    rows.push(
      GENRE_GRID.slice(i, i + 2).map(([emoji, name], j) => ({ text: `${emoji} ${name}`, callback_data: `g:${i + j}` })),
    );
  }
  rows.push([{ text: "🏠 Меню", callback_data: "m:menu" }]);
  const text = "🎭 <b>Жанры</b>\n\nВыберите настроение — подберу лучшие тайтлы с постерами.";
  if (messageId) {
    const r = await tg("editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", reply_markup: { inline_keyboard: rows } });
    if (r.ok) return;
  }
  await send(chatId, text, { reply_markup: { inline_keyboard: rows } });
}

async function genreFeed(chatId: number, index: number): Promise<void> {
  const item = GENRE_GRID[index];
  if (!item) return;
  typing(chatId, "upload_photo");
  try {
    const r = await catalog({ genre: item[1], sort: "rating" });
    if (!r.cards.length) return void (await send(chatId, `В жанре «${esc(item[1])}» пока пусто. Попробуйте другой.`, { reply_markup: { inline_keyboard: [[{ text: "🎭 Жанры", callback_data: "g:menu" }]] } }));
    return showList(chatId, r.cards.slice(0, 12), `${item[0]} ${item[1]}`);
  } catch {
    await send(chatId, "Каталог сейчас не отвечает. Попробуйте чуть позже.");
  }
}

async function feed(chatId: number, kind: "top" | "ong" | "rnd"): Promise<void> {
  typing(chatId, "upload_photo");
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
  typing(chatId);
  try {
    const cards = await quickSearch(query, 10);
    if (!cards.length) return void (await send(chatId, `По запросу «${esc(query)}» ничего не нашлось 🙈\nПроверьте написание или попробуйте оригинальное название.`));
    await showList(chatId, cards, `🔎 «${query}»`);
  } catch {
    await send(chatId, "Каталог сейчас не отвечает. Попробуйте чуть позже.");
  }
}

/* --------------------------- Новые разделы ------------------------------ */

const nf = (n: number): string => n.toLocaleString("ru-RU");
const BACK_MENU = [{ text: "🏠 Меню", callback_data: "m:menu" }];

const notLinked = (what: string) =>
  `🔗 <b>${what}</b> появится после привязки аккаунта.\n\nОткройте на сайте <b>Настройки → Профиль</b> и нажмите «Привязать Telegram» — это займёт полминуты.`;
const LINK_MARKUP = { inline_keyboard: [[{ text: "⚙️ Привязать на сайте", url: `${SITE}/settings` }], BACK_MENU] };

/** Приветствие: для привязанного аккаунта — по имени и с уровнем */
async function welcome(db: Database, from: From, chatId: number): Promise<void> {
  const u = userByTg(db, from.id);
  let text = WELCOME;
  if (u) {
    const st = db.prepare("SELECT level FROM player_stats WHERE user_id = ?").get(num(u.id));
    const name = esc(str(u.display_name) || str(u.nickname));
    text = `✨ <b>С возвращением, ${name}!</b>\n\n🏅 Уровень <b>${num(st?.level, 1)}</b> · ${num(u.premium_until) > Date.now() ? "👑 Premium активен" : "аккаунт привязан"}\n\nЧто посмотрим сегодня?\n\n<i>Выберите раздел 👇</i>`;
  }
  await sendCard(chatId, `${SITE}/cat.png`, text, MENU);
  // Постоянные кнопки ставятся отдельным сообщением: у одного сообщения только одна клавиатура
  await send(chatId, "⌨️ Быстрые кнопки включены — всё главное теперь под рукой.", { reply_markup: KEYBOARD });
}

async function favorites(db: Database, tgId: number, chatId: number): Promise<void> {
  const u = userByTg(db, tgId);
  if (!u) return void (await send(chatId, notLinked("Избранное"), { reply_markup: LINK_MARKUP }));
  const ids: string[] = [];
  try {
    for (const id of JSON.parse(getDoc(db, num(u.id), FAVORITES_KEY)?.value ?? "[]") as unknown[]) {
      if (typeof id === "string" && /^(serial|movie)-\d+$/.test(id)) ids.push(id);
    }
  } catch {
    /* повреждённый документ — считаем список пустым */
  }
  if (!ids.length) {
    return void (await send(chatId, "⭐ <b>Избранное пока пусто</b>\n\nДобавляйте тайтлы на сайте кнопкой «Избранное» — они появятся здесь, и я буду писать о новых сериях.", {
      reply_markup: { inline_keyboard: [[{ text: "🔎 Найти аниме", callback_data: "m:search" }, { text: "🏆 Топ", callback_data: "f:top" }], BACK_MENU] },
    }));
  }
  typing(chatId, "upload_photo");
  const found = await Promise.all(ids.slice(0, 12).map((id) => getTitleDetail(id).then((d) => d?.card ?? null).catch(() => null)));
  const cards = found.filter((c): c is AnimeCard => Boolean(c));
  if (!cards.length) return void (await send(chatId, "Не получилось загрузить избранное — каталог не отвечает. Попробуйте чуть позже."));
  await showList(chatId, cards, `⭐ Избранное · ${ids.length}`);
}

async function invite(db: Database, tgId: number, chatId: number): Promise<void> {
  const u = userByTg(db, tgId);
  if (!u) return void (await send(chatId, notLinked("Реферальная ссылка"), { reply_markup: LINK_MARKUP }));
  const code = ensureRefCode(db, num(u.id));
  const link = `${SITE}/?ref=${encodeURIComponent(code)}`;
  const row = db.prepare("SELECT COUNT(*) AS c, SUM(CASE WHEN qualified_at > 0 THEN 1 ELSE 0 END) AS q FROM referrals WHERE inviter_id = ?").get(num(u.id));
  const total = num(row?.c);
  const done = num(row?.q);
  const share = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Смотрю аниме на AniGalaxy — заходи, дарят бонус за регистрацию 🎁")}`;
  await send(
    chatId,
    `🎁 <b>Пригласите друга — получите награды</b>\n\nВаша ссылка:\n<code>${esc(link)}</code>\n\n👥 Приглашено: <b>${total}</b>\n✅ Дошли до зачёта: <b>${done}</b>\n\n<i>Друг получает бонус за регистрацию, а вы — награды за каждого активного приглашённого.</i>`,
    { reply_markup: { inline_keyboard: [[{ text: "📤 Отправить ссылку", url: share }], [{ text: "🪐 Все награды на сайте", url: `${SITE}/referrals` }], BACK_MENU] } },
  );
}

async function premiumInfo(db: Database, tgId: number, chatId: number): Promise<void> {
  const u = userByTg(db, tgId);
  const until = u ? num(u.premium_until) : 0;
  const active = until > Date.now();
  const perks = "• Без рекламы на всём сайте\n• Эксклюзивные фоны и рамки профиля\n• Эффекты и стили ника\n• Подарок каждый месяц: монеты и заморозка серии\n• Приоритет в поддержке";
  const text = active
    ? `👑 <b>Premium активен</b>\n\nДействует до <b>${new Date(until).toLocaleDateString("ru-RU")}</b>.\n\n<b>Что у вас есть</b>\n${perks}`
    : `👑 <b>AniGalaxy Premium</b>\n\nСмотрите без рекламы и выделяйтесь в профиле.\n\n${perks}\n\n<i>Оплата на сайте: картой, криптой или звёздами Telegram. Подписка включается сразу.</i>`;
  await send(chatId, text, {
    reply_markup: { inline_keyboard: [[{ text: active ? "👑 Продлить" : "👑 Подключить Premium", url: `${SITE}/premium` }], [{ text: "💬 Вопрос по оплате", url: SUPPORT }], BACK_MENU] },
  });
}

/* ----------------------------- Смотреть вместе -------------------------- */

async function together(chatId: number): Promise<void> {
  await send(
    chatId,
    "🍿 <b>Смотреть вместе</b>\n\nСоздайте комнату — плеер синхронизируется у всех: пауза, перемотка и серия общие, есть чат.\n\n1. Откройте раздел и выберите аниме\n2. Нажмите «Отправить в Telegram» и выберите друга\n3. Друг нажмёт на ссылку и окажется в вашей комнате",
    { reply_markup: { inline_keyboard: [[{ text: "🍿 Создать комнату", web_app: { url: `${SITE}/watch-together` } }], [{ text: "🏠 Меню", callback_data: "m:menu" }]] } },
  );
}

/** Приглашение в комнату по ссылке t.me/бот?start=room_КОД */
async function roomInvite(chatId: number, code: string): Promise<void> {
  await send(chatId, `🍿 <b>Вас зовут смотреть аниме вместе</b>\n\nКомната <code>${code}</code>. Нажмите кнопку — плеер подстроится под друзей.`, {
    reply_markup: { inline_keyboard: [[{ text: "▶️ Войти в комнату", web_app: { url: `${SITE}/watch-together?room=${code}` } }]] },
  });
}

/* ------------------------------- Поддержка ------------------------------ */

const FAQ: { q: string; a: string }[] = [
  { q: "🔗 Привязать Telegram", a: "<b>Как привязать Telegram</b>\n\n1. Откройте сайт → <b>Настройки → Профиль</b>\n2. Нажмите «Привязать Telegram»\n3. Бот пришлёт код — сверьте его с кодом на экране и подтвердите\n\nПосле этого в боте появятся профиль, избранное и уведомления о сериях." },
  { q: "▶️ Не грузится видео", a: "<b>Видео не запускается или тормозит</b>\n\n• Откройте список озвучек и выберите другую — у каждой свой источник\n• В плеере переключите качество на 720p или ниже\n• Нажмите «Источник» под плеером и выберите другой плеер\n• Отключите VPN и блокировщики рекламы на нашем сайте\n• На iPhone обновите Safari и перезагрузите страницу\n\nНе помогло? Напишите нам — пришлите название тайтла и серию." },
  { q: "👑 Premium и оплата", a: "<b>Premium и оплата</b>\n\nПодписка оформляется на странице <b>Premium</b>: картой, криптой или звёздами Telegram. Включается сразу после оплаты.\n\nПромокод вводится там же — он добавляет дни подписки.\n\nСписали деньги, а Premium нет? Напишите нам с временем оплаты и способом — разберёмся быстро." },
  { q: "🔐 Вход и пароль", a: "<b>Вход в аккаунт</b>\n\nСамый простой способ — кнопка «Войти через Telegram»: бот пришлёт код, подтвердите, и вы внутри. Пароль не нужен.\n\nЕсли забыли пароль, войдите через Telegram и смените его в <b>Настройках</b>." },
  { q: "🐞 Сообщить об ошибке", a: "<b>Нашли ошибку?</b>\n\nЧтобы мы починили быстрее, напишите:\n• что делали и что пошло не так\n• устройство и браузер\n• адрес страницы\n• скриншот, если есть\n\nМы отвечаем лично и держим вас в курсе." },
];

const supportMenuMarkup = () => {
  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < FAQ.length; i += 2) rows.push(FAQ.slice(i, i + 2).map((f, j) => ({ text: f.q, callback_data: `s:${i + j}` })));
  return {
    inline_keyboard: [
      ...rows,
      [{ text: "✍️ Написать в поддержку", url: SUPPORT }],
      [{ text: "🌐 Форма на сайте", url: `${SITE}/#support` }, ...BACK_MENU],
    ],
  };
};

async function editOrSend(chatId: number, messageId: number | undefined, text: string, markup: unknown): Promise<void> {
  if (messageId) {
    const r = await tg("editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: markup });
    if (r.ok) return;
  }
  await send(chatId, text, { reply_markup: markup });
}

async function support(chatId: number, messageId?: number, faq?: number): Promise<void> {
  if (faq !== undefined && FAQ[faq]) {
    return editOrSend(chatId, messageId, FAQ[faq].a, {
      inline_keyboard: [[{ text: "✍️ Написать в поддержку", url: SUPPORT }], [{ text: "◀️ Быстрые ответы", callback_data: "s:menu" }, ...BACK_MENU]],
    });
  }
  return editOrSend(
    chatId,
    messageId,
    "💬 <b>Поддержка AniGalaxy</b>\n\nМы отвечаем лично — обычно в течение нескольких часов. Многое решается за минуту, поэтому сначала загляните в быстрые ответы 👇",
    supportMenuMarkup(),
  );
}

/* ------------------------------ Для владельца --------------------------- */

const pendingBroadcasts = new Map<string, { text: string; by: number; at: number }>();

function adminByTg(db: Database, tgId: number) {
  const u = userByTg(db, tgId);
  return u && str(u.role) === "admin" ? u : null;
}

async function stats(db: Database, chatId: number): Promise<void> {
  const users = num(db.prepare("SELECT COUNT(*) AS c FROM users").get()?.c);
  const linked = num(db.prepare("SELECT COUNT(*) AS c FROM users WHERE telegram_id IS NOT NULL").get()?.c);
  const premium = num(db.prepare("SELECT COUNT(*) AS c FROM users WHERE premium_until > ?").get(Date.now())?.c);
  const day = num(db.prepare("SELECT COUNT(*) AS c FROM users WHERE created_at > ?").get(Date.now() - 86_400_000)?.c);
  await send(chatId, `📊 <b>AniGalaxy</b>\n\n👥 Пользователей: <b>${nf(users)}</b>\n🆕 За сутки: <b>${nf(day)}</b>\n✈️ С Telegram: <b>${nf(linked)}</b>\n👑 Premium: <b>${nf(premium)}</b>`, { reply_markup: { inline_keyboard: [BACK_MENU] } });
}

async function broadcastPrepare(db: Database, from: From, chatId: number, text: string): Promise<void> {
  if (!adminByTg(db, from.id)) return void (await send(chatId, "Эта команда доступна только администраторам."));
  const body = text.trim();
  if (body.length < 3) return void (await send(chatId, "Напишите текст рассылки после команды:\n<code>/broadcast Текст сообщения</code>\n\nПоддерживается HTML-разметка: &lt;b&gt;, &lt;i&gt;, &lt;a&gt;."));
  const now = Date.now();
  for (const [k, v] of pendingBroadcasts) if (now - v.at > 15 * 60_000) pendingBroadcasts.delete(k);
  const key = Math.random().toString(36).slice(2, 8);
  pendingBroadcasts.set(key, { text: body, by: from.id, at: now });
  const count = num(db.prepare("SELECT COUNT(*) AS c FROM users WHERE telegram_id IS NOT NULL").get()?.c);
  await send(chatId, `📣 <b>Предпросмотр рассылки</b>\n\n${body}\n\n— — —\nПолучат: <b>${nf(count)}</b>`, {
    reply_markup: { inline_keyboard: [[{ text: `✅ Отправить (${nf(count)})`, callback_data: `b:ok:${key}` }, { text: "✖ Отмена", callback_data: `b:no:${key}` }]] },
  });
}

async function broadcastSend(db: Database, from: From, chatId: number, key: string, go: boolean): Promise<void> {
  const job = pendingBroadcasts.get(key);
  if (!job || job.by !== from.id || !adminByTg(db, from.id)) return void (await send(chatId, "Рассылка устарела. Создайте её заново: /broadcast"));
  pendingBroadcasts.delete(key);
  if (!go) return void (await send(chatId, "Рассылка отменена."));
  const rows = db.prepare("SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL").all();
  await send(chatId, `🚀 Отправляю ${nf(rows.length)} получателям…`);
  let ok = 0;
  for (const row of rows) {
    const r = await send(Number(str(row.telegram_id)), job.text, { reply_markup: { inline_keyboard: [[{ text: "🪐 Открыть AniGalaxy", web_app: { url: `${SITE}/tg` } }]] } });
    if (r.ok) ok += 1;
    await new Promise((res) => setTimeout(res, 45)); // ~22 сообщений в секунду, ниже лимита Telegram
  }
  await send(chatId, `✅ Готово: доставлено <b>${nf(ok)}</b> из <b>${nf(rows.length)}</b>.`);
}

/* --------------------------- Команды и кнопки --------------------------- */

export async function handleBotMessage(db: Database, text: string, from: From, chatId: number): Promise<void> {
  // Постоянные кнопки под полем ввода приходят обычным текстом
  const button = BUTTON_TEXT[text.trim()];
  if (button) return route(db, button, from, chatId);

  const cmd = /^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/.exec(text);
  if (!cmd) return search(chatId, text);
  const name = cmd[1].toLowerCase();
  const arg = cmd[2].trim();
  switch (name) {
    case "start": {
      const room = /^room_([A-Z2-9]{6})$/.exec(arg);
      return room ? roomInvite(chatId, room[1]) : welcome(db, from, chatId);
    }
    case "together":
      return together(chatId);
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
    case "genres":
      return genreMenu(chatId);
    case "fav":
    case "favorites":
      return favorites(db, from.id, chatId);
    case "invite":
      return invite(db, from.id, chatId);
    case "premium":
      return premiumInfo(db, from.id, chatId);
    case "support":
      return support(chatId);
    case "me":
      return profile(db, from.id, chatId);
    case "notify":
      return notifyToggle(db, from.id, chatId, false);
    case "stats":
      return adminByTg(db, from.id) ? stats(db, chatId) : void (await send(chatId, "Эта команда доступна только администраторам."));
    case "broadcast":
      return broadcastPrepare(db, from, chatId, arg);
    default:
      await send(chatId, "Такой команды нет. Список команд: /help");
  }
}

/** Общий маршрутизатор: и для inline-кнопок, и для постоянных */
async function route(db: Database, data: string, from: From, chatId: number, messageId?: number): Promise<void> {
  if (data === "m:me") return profile(db, from.id, chatId);
  if (data === "m:menu") return void (await send(chatId, "🪐 <b>Главное меню</b>", { reply_markup: MENU }));
  if (data === "m:search") return void (await send(chatId, "🔎 Напишите название аниме одним сообщением, например «Атака титанов»."));
  if (data === "m:notify") return notifyToggle(db, from.id, chatId, true);
  if (data === "m:fav") return favorites(db, from.id, chatId);
  if (data === "m:invite") return invite(db, from.id, chatId);
  if (data === "m:premium") return premiumInfo(db, from.id, chatId);
  if (data === "g:menu") return genreMenu(chatId, messageId);
  const g = /^g:(\d+)$/.exec(data);
  if (g) return genreFeed(chatId, Number(g[1]));
  if (data === "s:menu") return support(chatId, messageId);
  const sf = /^s:(\d+)$/.exec(data);
  if (sf) return support(chatId, messageId, Number(sf[1]));
  const b = /^b:(ok|no):(\w+)$/.exec(data);
  if (b) return broadcastSend(db, from, chatId, b[2], b[1] === "ok");
  if (data === "f:top" || data === "f:ong" || data === "f:rnd") return feed(chatId, data.slice(2) as "top" | "ong" | "rnd");
  const v = /^v:(\w+):(\d+)$/.exec(data);
  if (v) return showCard(chatId, v[1], Number(v[2]), messageId);
}

export async function handleBotCallback(db: Database, cb: { id: string; from: From; data?: string; message?: { message_id: number; chat: { id: number } } }): Promise<void> {
  const chatId = cb.message?.chat.id;
  await tg("answerCallbackQuery", { callback_query_id: cb.id });
  const data = cb.data ?? "";
  if (!chatId || data === "noop") return;
  return route(db, data, cb.from, chatId, cb.message?.message_id);
}

/** Inline-режим: `@бот название` в любом чате — карточки аниме для отправки другу */
export async function handleBotInline(q: { id: string; query: string }): Promise<void> {
  const text = q.query.trim().slice(0, 80);
  let cards: AnimeCard[] = [];
  try {
    if (text.length >= 2) cards = await quickSearch(text, 12);
    else cards = (await catalog({ sort: "rating", type: "serial" })).cards.slice(0, 12);
  } catch {
    cards = [];
  }
  const results = cards.slice(0, 20).map((card) => {
    const meta = [card.rating ? `⭐ ${card.rating.toFixed(1)}` : "", card.year ? String(card.year) : "", card.genres?.slice(0, 2).join(", ") ?? ""].filter(Boolean).join(" · ");
    const body = [`🎬 <b>${esc(card.title)}</b>`, meta ? `<i>${esc(meta)}</i>` : "", card.description ? `\n${esc(card.description.replace(/\s+/g, " ").slice(0, 220))}…` : ""].filter(Boolean).join("\n");
    return {
      type: "article",
      id: card.id.slice(0, 60),
      title: card.title,
      description: meta || "AniGalaxy",
      thumbnail_url: card.poster,
      input_message_content: { message_text: body, parse_mode: "HTML", disable_web_page_preview: false },
      reply_markup: { inline_keyboard: [[{ text: "▶️ Смотреть на AniGalaxy", url: `${SITE}/title/${card.id}` }]] },
    };
  });
  await tg("answerInlineQuery", { inline_query_id: q.id, results, cache_time: 300, is_personal: false });
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
        { command: "genres", description: "🎭 Подборки по жанрам" },
        { command: "fav", description: "⭐ Моё избранное" },
        { command: "together", description: "🍿 Смотреть вместе с другом" },
        { command: "me", description: "👤 Профиль, уровень и баланс" },
        { command: "invite", description: "🎁 Пригласить друга" },
        { command: "premium", description: "👑 AniGalaxy Premium" },
        { command: "support", description: "💬 Поддержка" },
        { command: "notify", description: "🔔 Уведомления о новых сериях" },
        { command: "help", description: "❓ Что умеет бот" },
      ],
    }),
    tg("setMyDescription", {
      description: "Бот AniGalaxy: вход на сайт, поиск аниме, профиль и уведомления о новых сериях.",
    }),
    tg("setMyShortDescription", { short_description: "Поиск аниме, профиль и новые серии на AniGalaxy" }),
    tg("setChatMenuButton", { menu_button: { type: "web_app", text: "AniGalaxy", web_app: { url: `${SITE}/tg` } } }),
  ]);
  const bad = results.find((r) => !r.ok);
  if (bad) console.error("[tgbot] настройка бота:", bad.description);
}
