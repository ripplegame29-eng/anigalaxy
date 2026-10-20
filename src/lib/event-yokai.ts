"use client";

/**
 * Ивент «Ночь ёкаев» — данные и состояние.
 *
 * Всё живёт в браузере: сервера у проекта нет, поэтому ни фонарики, ни
 * задания, ни обмен не синхронизируются между устройствами. Что можно было
 * превратить в выдумку — общий счётчик фонариков всего сайта, обмен на
 * несуществующую валюту AniCoin, награды-предметы, которых нет в каталоге, —
 * заменено на реальные данные: фонарики капают за задания и мини-игру,
 * обмен идёт в настоящие атомы профиля (`addCoins`), дни Premium выдаёт
 * `activatePremium`, прогресс заданий считается по истории просмотра и
 * собственным действиям игрока.
 */

import { activatePremium } from "./auth";
import { addCoins } from "./profile";
import { syncLegacyDelta } from "./progression/service";
import { createLocalStore, dayKey } from "./store";

/* ─────────────────────────── Константы ивента ─────────────────────────── */

/** Финал ивента (дата из макета) */
export const EVENT_END = new Date("2026-11-03T23:59:59").getTime();
/** Потолок фонариков у одного игрока */
export const EVENT_MAX = 1000;
/** Фонариков на один уровень дороги */
export const EVENT_STEP = 100;
/** Курс обмена: фонарики → атомы профиля */
export const LANTERNS_PER_ATOM = 10;

export const EVENT_LABEL = "Ночь ёкаев";
export const EVENT_DAYS_LEFT_LABEL = "Сезонный ивент · до 3 ноября";

/* ───────────────────────────── Награды дороги ─────────────────────────── */

export interface TrackReward {
  /** Текст награды — он же подпись в клетке */
  label: string;
  /** Атомы в профильный счёт */
  atoms: number;
  /** Дней Premium; без аккаунта награда не выдаётся */
  premiumDays: number;
}

export interface TrackLevel {
  free: TrackReward;
  prem: TrackReward;
}

const atoms = (n: number): TrackReward => ({ label: `+${n} AC`, atoms: n, premiumDays: 0 });
const premium = (days: number): TrackReward => ({
  label: `${days} ${days === 1 ? "день" : days < 5 ? "дня" : "дней"} Premium`,
  atoms: 0,
  premiumDays: days,
});

/**
 * Десять уровней дороги. Награды только те, что сайт правда умеет выдать:
 * атомы (`addCoins`) и дни Premium (`activatePremium`). Рамок, титулов и
 * стикер-паков в каталоге нет — обещать их было бы враньём, поэтому их
 * заменили атомы, а дизайн призов остался в блоке «Эксклюзивы ивента».
 */
export const TRACK: TrackLevel[] = [
  { free: atoms(50), prem: atoms(100) },
  { free: atoms(100), prem: atoms(150) },
  { free: atoms(100), prem: atoms(200) },
  { free: atoms(150), prem: atoms(250) },
  { free: atoms(200), prem: atoms(300) },
  { free: atoms(250), prem: atoms(350) },
  { free: atoms(300), prem: atoms(400) },
  { free: atoms(350), prem: atoms(500) },
  { free: atoms(400), prem: premium(7) },
  { free: atoms(500), prem: atoms(700) },
];

/** Рубежи костра для всего сайта — плановые, а не достигнутые */
export const MILESTONES: { at: number; label: string }[] = [
  { at: 62_500, label: "+50 AC всем" },
  { at: 125_000, label: "Стикер-пак" },
  { at: 187_500, label: "+100 AC" },
  { at: 250_000, label: "Фон «Костёр духов»" },
];

export const MILESTONE_GOAL = MILESTONES[MILESTONES.length - 1].at;

/* ────────────────────────────── Задания дня ───────────────────────────── */

export interface EventQuest {
  id: string;
  title: string;
  note: string;
  goal: number;
  /** Фонариков за выполнение (умножается на Premium) */
  lanterns: number;
  /** Иконка 24×24 из макета */
  icon: string;
}

export const QUESTS: EventQuest[] = [
  {
    id: "ep",
    title: "Посмотри 2 серии",
    note: "Любое аниме",
    goal: 2,
    lanterns: 40,
    icon: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8 20h8M12 16.5V20"/>',
  },
  {
    id: "gm",
    title: "Сыграй в «Лови ёкаев»",
    note: "Одна партия",
    goal: 1,
    lanterns: 50,
    icon: '<circle cx="12" cy="12" r="8.4"/><path d="M9 10.5h.01M15 10.5h.01M9 15c1.6 1.4 4.4 1.4 6 0"/>',
  },
  {
    id: "rw",
    title: "Забери награду с дороги",
    note: "Любой уровень",
    goal: 1,
    lanterns: 30,
    icon: '<path d="M3.5 18h17M3.5 18 2.5 8.7 8 12.4 12 5.6l4 6.8 5.5-3.7-1 9.3z"/>',
  },
  {
    id: "xc",
    title: "Обменяй фонарики на AC",
    note: "Хотя бы один AC",
    goal: 1,
    lanterns: 60,
    icon: '<circle cx="12" cy="12" r="8"/><path d="M12 7v10M7 12h10"/>',
  },
];

/* ─────────────────────────────── Состояние ────────────────────────────── */

export interface YokaiState {
  /** Фонарики, всего */
  lan: number;
  /** Задания, забранные сегодня: id → 1 */
  q: Record<string, 1>;
  /** Игра сегодня была: 1 */
  played: 0 | 1;
  /** День, когда забрали награду с дороги */
  rwDay: string;
  /** День последнего обмена фонариков */
  xcDay: string;
  /** Уровни дороги с забранной бесплатной наградой */
  free: number[];
  /** Уровни дороги с забранной наградой Premium */
  prem: number[];
  /** Сколько атомов обменяли за весь ивент */
  ac: number;
  /** Попытки мини-игры на сегодня */
  tries: number;
  /** Ключ дня */
  day: string;
}

const fresh = (): YokaiState => ({
  lan: 0,
  q: {},
  played: 0,
  rwDay: "",
  xcDay: "",
  free: [],
  prem: [],
  ac: 0,
  tries: 3,
  day: dayKey(),
});

/**
 * Смена дня обнуляет задания, отметку об игре и попытки: открытые уровни
 * дороги и сами фонарики остаются — они копятся за весь ивент.
 */
function parse(raw: string): YokaiState | null {
  let data: YokaiState;
  try {
    data = JSON.parse(raw) as YokaiState;
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const base = fresh();
  const today = dayKey();
  const state: YokaiState = {
    ...base,
    ...data,
    lan: Number.isFinite(data.lan) ? Math.max(0, Math.min(EVENT_MAX, Math.round(data.lan))) : 0,
    free: Array.isArray(data.free) ? data.free.filter((n) => Number.isInteger(n)) : [],
    prem: Array.isArray(data.prem) ? data.prem.filter((n) => Number.isInteger(n)) : [],
    q: data.q && typeof data.q === "object" ? data.q : {},
  };
  if (state.day !== today) {
    return { ...state, q: {}, played: 0, tries: 3, day: today };
  }
  return state;
}

export const yokaiStore = createLocalStore<YokaiState>(
  "animehub:event:yokai:v1",
  fresh(),
  parse,
);

/* ──────────────────────────────── Помощники ───────────────────────────── */

export const fmt = (n: number): string => Math.round(n).toLocaleString("ru-RU");

/** Уровень дороги: 0…10 */
export const trackLevel = (lan: number): number => Math.floor(lan / EVENT_STEP);

/** Множитель фонариков: Premium получает вдвое */
export const lanternMult = (premium: boolean): number => (premium ? 2 : 1);

/**
 * Начислить фонарики. Возвращает, сколько реально добавилось (потолок
 * ивента) и вырос ли уровень дороги — по нему зрится баннер и салюет.
 */
export function addLanterns(amount: number): { added: number; levelUp: boolean } {
  const state = yokaiStore.get();
  const before = trackLevel(state.lan);
  const next = Math.min(EVENT_MAX, state.lan + Math.max(0, Math.round(amount)));
  yokaiStore.set({ ...state, lan: next });
  return { added: next - state.lan, levelUp: trackLevel(next) > before };
}

export interface ClaimResult {
  /** Текст для тоста; при ошибке — почему не вышло */
  message: string;
  ok: boolean;
  /** Сколько фонариков положит вид (сам начисляет страница — с салютом) */
  lanterns: number;
}

/**
 * Забрать награду с дороги. Атомы падают в профиль сразу, дни Premium —
 * только аккаунту: без входа подписку продлить нечем.
 */
export function claimReward(kind: "free" | "prem", level: number): ClaimResult {
  const state = yokaiStore.get();
  const entry = TRACK[level - 1];
  if (!entry) return { message: "Такого уровня нет", ok: false, lanterns: 0 };
  if (trackLevel(state.lan) < level) return { message: "Уровень ещё не открыт", ok: false, lanterns: 0 };
  const list = kind === "free" ? state.free : state.prem;
  if (list.includes(level)) return { message: "Награда уже забрана", ok: false, lanterns: 0 };
  const reward = kind === "free" ? entry.free : entry.prem;

  if (reward.atoms > 0) addCoins(reward.atoms);
  /* Premium-награду отмечаем забранной только после успешной активации:
     иначе гость видел «забери ещё раз», а уровень уже был закрыт. */
  if (reward.premiumDays > 0 && !activatePremium(reward.premiumDays)) {
    return {
      message: "Дни Premium капают только аккаунту — войди и забери награду ещё раз",
      ok: false,
      lanterns: 0,
    };
  }
  if (reward.atoms > 0) syncLegacyDelta();
  yokaiStore.set({ ...state, [kind]: [...list, level], rwDay: dayKey() });
  return { message: `Награда получена: ${reward.label}`, ok: true, lanterns: 0 };
}

/** Забрать награду задания. Фонарики не начисляет — их капает вид, чтобы
 *  вместе с наградой сработал салют и баннер нового уровня */
export function claimQuest(id: string, premium: boolean): ClaimResult {
  const quest = QUESTS.find((item) => item.id === id);
  if (!quest) return { message: "Задание не найдено", ok: false, lanterns: 0 };
  const state = yokaiStore.get();
  if (state.q[id]) return { message: "Награда уже забрана", ok: false, lanterns: 0 };
  yokaiStore.set({ ...state, q: { ...state.q, [id]: 1 } });
  const reward = quest.lanterns * lanternMult(premium);
  return { message: `+${reward} фонариков`, ok: true, lanterns: reward };
}

/** Потратить попытку мини-игры; false — попытки на сегодня кончились */
export function takeTry(): boolean {
  const state = yokaiStore.get();
  if (state.tries < 1) return false;
  yokaiStore.set({ ...state, tries: state.tries - 1, played: 1 });
  return true;
}

/** Обменять фонарики на атомы профиля. Возвращает, сколько атомов зачислили. */
export function exchangeLanterns(atomsWanted: number): number {
  const state = yokaiStore.get();
  const cost = atomsWanted * LANTERNS_PER_ATOM;
  if (atomsWanted < 1 || state.lan < cost) return 0;
  yokaiStore.set({ ...state, lan: state.lan - cost, xcDay: dayKey(), ac: state.ac + atomsWanted });
  addCoins(atomsWanted);
  syncLegacyDelta();
  return atomsWanted;
}

/* ───────────────────────── Демо-рейтинг соперников ────────────────────── */

export interface Rival {
  n: string;
  v: number;
  pr: boolean;
  h: number;
}

/**
 * Соперники рейтинга — демонстрационные: сервера у проекта нет, сравнивать
 * фонарики не с кем. Набор собирается детерминированно (генератор макета),
 * чтобы список не прыгал между перезагрузками; подпись «демо» стоит рядом.
 */
export function rivals(): Rival[] {
  let seed = 11;
  const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const names = [
    "Sakura", "Kuro", "Yoru", "Hana", "Ryu", "Tsuki", "Neko", "Akira",
    "Mizu", "Kaze", "Hoshi", "Yuki",
  ];
  const suffixes = ["_chan", "Fox", "77", "_san", "Blade", "Moon", "Ronin", "", "_x", "Spirit", "Hunter", "Ink"];
  const pool: Rival[] = [];
  while (pool.length < 30) {
    const n = names[Math.floor(rnd() * names.length)] + suffixes[Math.floor(rnd() * suffixes.length)];
    if (pool.some((item) => item.n === n)) continue;
    pool.push({
      n,
      v: Math.min(EVENT_MAX, Math.round(985 * Math.pow(0.915, pool.length) + rnd() * 14)),
      pr: rnd() < 0.4,
      h: Math.floor(rnd() * 360),
    });
  }
  return pool;
}

/** Немного подвинуть соперника — рейтинг в демо живой, но выдуманный */
export function nudgeRival(list: Rival[], seedStep: number): Rival[] {
  const target = seedStep % 14;
  return list.map((item, index) =>
    index === target
      ? { ...item, v: Math.min(EVENT_MAX, item.v + 1 + ((seedStep * 7919) % 16)) }
      : item,
  );
}