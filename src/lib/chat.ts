"use client";

/**
 * Общий чат AniGalaxy — боковая панель, как в мессенджерах.
 *
 * Серверов у проекта нет, поэтому «онлайн» честно симулируется локально:
 * история и свои сообщения хранятся в `localStorage`, а боты-зрители
 * периодически пишут реплики (и иногда отвечают на сообщения игрока).
 * Хранилище — общий `createLocalStore`: между вкладками браузера
 * сообщения синхронизируются событием `storage`.
 */

import { createLocalStore, localId } from "./store";

export interface ChatMessage {
  id: string;
  author: string;
  text: string;
  at: number;
  /** id тега прогрессии — капсула рядом с ником */
  tagId?: string;
  /** сообщение самого пользователя */
  self?: boolean;
}

export interface ChatState {
  messages: ChatMessage[];
  /** отметка «прочитано до» — для бейджа непрочитанных на кнопке */
  lastRead: number;
  /** стартовая история уже засеяна */
  seeded: boolean;
}

const EMPTY: ChatState = { messages: [], lastRead: 0, seeded: false };

/** Максимум сообщений в локальной истории */
export const CHAT_HISTORY_LIMIT = 100;
/** Максимум символов в одном сообщении */
export const CHAT_TEXT_LIMIT = 300;

function parse(raw: string): ChatState | null {
  try {
    const data = JSON.parse(raw) as Partial<ChatState>;
    if (!data || typeof data !== "object") return null;
    const messages = (Array.isArray(data.messages) ? data.messages : [])
      .filter((m): m is ChatMessage =>
        Boolean(m) && typeof m === "object" && typeof m.id === "string" && typeof m.text === "string" && typeof m.at === "number",
      )
      .slice(-CHAT_HISTORY_LIMIT);
    return {
      messages,
      lastRead: typeof data.lastRead === "number" ? data.lastRead : 0,
      seeded: data.seeded === true,
    };
  } catch {
    return null;
  }
}

const store = createLocalStore<ChatState>("animehub:chat:v1", EMPTY, parse);

export function useChat(): ChatState {
  return store.useStore();
}

export function getChatState(): ChatState {
  return store.get();
}

/** Непрочитанные (не свои, после отметки lastRead) — бейдж на кнопке */
export function unreadChatCount(state: ChatState): number {
  return state.messages.filter((m) => !m.self && m.at > state.lastRead).length;
}

export function markChatRead(): void {
  store.update((state) => ({ ...state, lastRead: Date.now() }));
}

function push(message: Omit<ChatMessage, "id" | "at"> & { at?: number }): void {
  store.update((state) => ({
    ...state,
    messages: [...state.messages, { ...message, id: localId("m"), at: message.at ?? Date.now() }].slice(-CHAT_HISTORY_LIMIT),
  }));
}

/* ------------------------------ Участники-боты -------------------------- */

interface ChatBot {
  author: string;
  tagId?: string;
  lines: string[];
  replies: string[];
}

const BOTS: ChatBot[] = [
  {
    author: "SAH4R_TV",
    tagId: "tag_legend",
    lines: [
      "поставьте лайк на подборку пж",
      "только что досмотрел — финал огонь",
      "го обсуждать последнюю серию",
      "залетел на стрим — и пропал на три часа",
    ],
    replies: ["поддерживаю!", "это да", "согласен на все сто"],
  },
  {
    author: "sleepy",
    tagId: "tag_vampire",
    lines: [
      "кто-нибудь смотрит новый сезон?",
      "+1 серия перед сном, классика",
      "спокойной ночи всем",
      "не могу остановиться, третья серия подряд",
    ],
    replies: ["угу", "точно-точно", "я так же"],
  },
  {
    author: "Kuroi",
    tagId: "tag_ghoul",
    lines: [
      "пасиба за пивас",
      "гляньте мою новую рамку",
      "сегодня дропнулась редкая рамка",
      "кто в курсе, когда вторая часть?",
    ],
    replies: ["ого, повезло", "поздравляю!", "красавчик"],
  },
  {
    author: "mochi",
    tagId: "tag_otaku",
    lines: [
      "всем привет!",
      "какой тайтл взять на выходные?",
      "посоветуйте что-нибудь душевное",
      "продлил премиум, рамка того стоила",
    ],
    replies: ["привет-привет", "плюсую", "кстати да"],
  },
  {
    author: "Хранитель",
    tagId: "tag_sage",
    lines: [
      "собрал третью подборку за неделю",
      "читаю сначала описание, потом смотрю",
      "тихий вечер — лучший вечер",
    ],
    replies: ["разумно", "хороший выбор"],
  },
  {
    author: "oni-chan",
    tagId: "tag_oni",
    lines: [
      "когда уже пятничный дроп?!",
      "братик, включай",
      "смотрю и плак (от смеха)",
    ],
    replies: ["ахах", "жиза", "сила"],
  },
  {
    author: "Тэнгу",
    tagId: "tag_tengu",
    lines: [
      "вихрь из перьев и пыли — это про мой недосмотр-лист",
      "пернул вперёд на две серии, не жалуюсь",
    ],
    replies: ["бывает", "летим дальше"],
  },
];

/* ------------------------------ Симуляция ------------------------------- */

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/** Стартовая история за последний час — один раз на хранилище */
export function seedChatIfEmpty(): void {
  const state = store.get();
  if (state.seeded) return;
  const now = Date.now();
  const history: ChatMessage[] = [];
  const count = 9;
  for (let i = 0; i < count; i += 1) {
    const bot = BOTS[i % BOTS.length];
    history.push({
      id: localId("m"),
      author: bot.author,
      text: bot.lines[i % bot.lines.length],
      at: now - (count - i) * (5 + Math.floor(Math.random() * 4)) * 60000,
      tagId: bot.tagId,
    });
  }
  history.sort((a, b) => a.at - b.at);
  store.set({ messages: history.slice(-CHAT_HISTORY_LIMIT), lastRead: now, seeded: true });
}

function pushBotLine(): void {
  const bot = pick(BOTS);
  push({ author: bot.author, text: pick(bot.lines), tagId: bot.tagId });
}

let replyTimer: number | null = null;

/** Свое сообщение + иногда «живой» ответ бота через пару секунд */
export function sendChatMessage(author: string, text: string, tagId?: string): void {
  const clean = text.trim().slice(0, CHAT_TEXT_LIMIT);
  if (!clean) return;
  push({ author, text: clean, tagId, self: true });
  if (Math.random() < 0.45) {
    if (replyTimer) window.clearTimeout(replyTimer);
    replyTimer = window.setTimeout(() => {
      const bot = pick(BOTS);
      push({ author: bot.author, text: pick(bot.replies), tagId: bot.tagId });
    }, 2500 + Math.random() * 4500);
  }
}

/**
 * Фоновый цикл «онлайна»: раз в 18–48 секунд кто-то из зрителей пишет.
 * Возвращает остановку. На вкладку — один цикл (сторож-синглтон).
 */
let loopStarted = false;
export function startChatSimulation(): () => void {
  if (loopStarted) return () => {};
  loopStarted = true;
  seedChatIfEmpty();
  let stopped = false;
  let timer: number | null = null;
  const tick = () => {
    if (stopped) return;
    timer = window.setTimeout(() => {
      pushBotLine();
      tick();
    }, 18000 + Math.random() * 30000);
  };
  tick();
  return () => {
    stopped = true;
    if (timer) window.clearTimeout(timer);
    loopStarted = false;
  };
}
