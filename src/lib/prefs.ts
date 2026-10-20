"use client";

/**
 * Пользовательские настройки сайта: тема, акцентный цвет, звёздное небо,
 * уведомления и плеер.
 *
 * Всё лежит в одном ключе `animehub:prefs:v1`. Один ключ вместо семи —
 * потому что панель «Сохранить» у этих настроек одна, и записывать по
 * очереди семь сторов значило бы оставить интерфейс в состоянии, где
 * половина полей применена, а половина нет.
 *
 * Значения по умолчанию совпадают с текущим поведением сайта: у человека,
 * который ничего не открывал, тема тёмная, акцент синий, звёзд 70. Ничего
 * не перекрашивается и не появляется само после обновления страницы.
 */

import { createLocalStore } from "./store";

export type ThemeId = "dark" | "light" | "system";
export type AccentId = "sirius" | "nova" | "aurora" | "sakura" | "sun";
export type QualityId = "360" | "480" | "720" | "1080";
export type SpeedId = "0.75" | "1" | "1.25" | "1.5" | "2";

/** Что присылать: ключ — как в макете, значение — флаг «включено» */
export type NotifyEvent =
  | "newEpisodes"
  | "replies"
  | "ratings"
  | "rewards"
  | "gifts"
  | "premium";

export const NOTIFY_EVENTS: { id: NotifyEvent; title: string; hint: string; locked?: string }[] = [
  { id: "newEpisodes", title: "Новые серии", hint: "Выход новых серий у тайтлов из списков «Смотрю» и «Запланировано»" },
  { id: "replies", title: "Ответы и упоминания", hint: "Ответы на ваши комментарии, упоминания, записи на стене профиля и в подборках" },
  { id: "ratings", title: "Оценки", hint: "Когда ваши комментарии оценивают" },
  {
    id: "rewards",
    title: "Награды и достижения",
    hint: "Открытые достижения, еженедельные награды за место в топе и призы розыгрышей",
    locked: "2 уведомления о начислении всегда приходят в колокольчик — это подтверждение, что вам что-то выдали.",
  },
  {
    id: "gifts",
    title: "Подарки и рефералы",
    hint: "Подарки от пользователей, подарочные подписки и начисления по реферальной программе",
    locked: "5 уведомлений о начислении всегда приходят в колокольчик — это подтверждение, что вам что-то выдали.",
  },
  { id: "premium", title: "Подписка", hint: "Когда Premium подходит к концу или не удалось продлить" },
];

/**
 * Акцентные цвета макета. `a` — основной, `b` — второй градиента,
 * `rgb` — тройка для цветов с прозрачностью через rgb(... / alpha).
 */
export const ACCENTS: {
  id: AccentId;
  name: string;
  a: string;
  b: string;
  rgb: string;
}[] = [
  { id: "sirius", name: "Сириус", a: "#2b7fff", b: "#18b8e8", rgb: "43,127,255" },
  { id: "nova", name: "Нова", a: "#8b5cff", b: "#d04dff", rgb: "139,92,255" },
  { id: "aurora", name: "Аврора", a: "#14c8c0", b: "#34e0a1", rgb: "20,200,192" },
  { id: "sakura", name: "Сакура", a: "#ff4d8a", b: "#ff9a5c", rgb: "255,77,138" },
  { id: "sun", name: "Солнце", a: "#f5b74a", b: "#ffd36b", rgb: "245,183,74" },
];

export const QUALITIES: { id: QualityId; label: string; premium?: boolean }[] = [
  { id: "360", label: "360p" },
  { id: "480", label: "480p" },
  { id: "720", label: "720p" },
  { id: "1080", label: "1080p", premium: true },
];

export const SPEEDS: SpeedId[] = ["0.75", "1", "1.25", "1.5", "2"];

export interface Prefs {
  theme: ThemeId;
  accent: AccentId;
  /** Сколько звёзд на фоне, 0…320 */
  stars: number;
  notify: Record<NotifyEvent, boolean>;
  /** Новые серии присылать только из списка «Смотрю» */
  notifyWatchingOnly: boolean;
  notifyFavouriteDubs: boolean;
  /** Плеер */
  quality: QualityId;
  autoplayNext: boolean;
  skipOp: boolean;
  rememberDub: boolean;
  ambient: boolean;
  speed: SpeedId;
  /** Размер субтитров, px */
  subtitleSize: number;
  subtitleBg: boolean;
  /** Горячие клавиши: какие включены */
  keys: { play: boolean; seek: boolean; volume: boolean; fullscreen: boolean; skip: boolean; next: boolean };
}

export const DEFAULT_PREFS: Prefs = {
  theme: "dark",
  accent: "sirius",
  stars: 70,
  notify: {
    newEpisodes: true,
    replies: true,
    ratings: true,
    rewards: true,
    gifts: true,
    premium: true,
  },
  notifyWatchingOnly: false,
  notifyFavouriteDubs: false,
  quality: "720",
  autoplayNext: true,
  skipOp: false,
  rememberDub: true,
  ambient: false,
  speed: "1",
  subtitleSize: 22,
  subtitleBg: true,
  keys: { play: true, seek: true, volume: true, fullscreen: true, skip: true, next: true },
};

export const PREFS_KEY = "animehub:prefs:v1";
export const PREFS_EVENT = "animehub:prefs-changed";

/* ------------------------------- Разбор -------------------------------- */

const THEMES = new Set<ThemeId>(["dark", "light", "system"]);
const ACCENT_IDS = new Set<AccentId>(ACCENTS.map((item) => item.id));
const QUALITY_IDS = new Set<QualityId>(QUALITIES.map((item) => item.id));
const SPEED_IDS = new Set<SpeedId>(SPEEDS);
const NOTIFY_IDS = new Set<NotifyEvent>(NOTIFY_EVENTS.map((item) => item.id));

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Разбор сохранённых настроек. Стор отдаёт парсеру СЫРУЮ строку, поэтому
 * JSON разбираем здесь же — иначе все проверки типов молча провалятся и
 * настройки будут откатываться к значениям по умолчанию при каждой
 * перезагрузке страницы.
 */
function parsePrefs(raw: string): Prefs | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<Prefs>;

  const notify = { ...DEFAULT_PREFS.notify };
  if (item.notify && typeof item.notify === "object" && !Array.isArray(item.notify)) {
    const src = item.notify as Partial<Record<NotifyEvent, unknown>>;
    for (const id of NOTIFY_IDS) notify[id] = bool(src[id], DEFAULT_PREFS.notify[id]);
  }

  const keys = { ...DEFAULT_PREFS.keys };
  if (item.keys && typeof item.keys === "object" && !Array.isArray(item.keys)) {
    const src = item.keys as Partial<Record<keyof Prefs["keys"], unknown>>;
    for (const id of Object.keys(keys) as (keyof Prefs["keys"])[]) {
      keys[id] = bool(src[id], DEFAULT_PREFS.keys[id]);
    }
  }

  return {
    theme: THEMES.has(item.theme as ThemeId) ? (item.theme as ThemeId) : DEFAULT_PREFS.theme,
    accent: ACCENT_IDS.has(item.accent as AccentId) ? (item.accent as AccentId) : DEFAULT_PREFS.accent,
    stars: clamp(item.stars, 0, 320, DEFAULT_PREFS.stars),
    notify,
    notifyWatchingOnly: bool(item.notifyWatchingOnly, DEFAULT_PREFS.notifyWatchingOnly),
    notifyFavouriteDubs: bool(item.notifyFavouriteDubs, DEFAULT_PREFS.notifyFavouriteDubs),
    quality: QUALITY_IDS.has(item.quality as QualityId) ? (item.quality as QualityId) : DEFAULT_PREFS.quality,
    autoplayNext: bool(item.autoplayNext, DEFAULT_PREFS.autoplayNext),
    skipOp: bool(item.skipOp, DEFAULT_PREFS.skipOp),
    rememberDub: bool(item.rememberDub, DEFAULT_PREFS.rememberDub),
    ambient: bool(item.ambient, DEFAULT_PREFS.ambient),
    speed: SPEED_IDS.has(item.speed as SpeedId) ? (item.speed as SpeedId) : DEFAULT_PREFS.speed,
    subtitleSize: clamp(item.subtitleSize, 14, 34, DEFAULT_PREFS.subtitleSize),
    subtitleBg: bool(item.subtitleBg, DEFAULT_PREFS.subtitleBg),
    keys,
  };
}

const prefsStore = createLocalStore<Prefs>(PREFS_KEY, DEFAULT_PREFS, parsePrefs);

export function readPrefs(): Prefs {
  return prefsStore.get();
}

/** Частичное обновление: меняются только переданные поля */
export function updatePrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...prefsStore.get(), ...patch };
  prefsStore.set(next);
  return next;
}

export function resetPrefs(): Prefs {
  prefsStore.set(DEFAULT_PREFS);
  return DEFAULT_PREFS;
}

export function usePrefs(): Prefs {
  return prefsStore.useStore();
}

export function accentOf(id: AccentId): (typeof ACCENTS)[number] {
  return ACCENTS.find((item) => item.id === id) ?? ACCENTS[0];
}

/* --------------------- Применение настройки к документу ------------------ */

/**
 * Настройки внешнего вида живут в атрибутах <html>, а не в состоянии
 * компонентов: иначе пришлось бы обходить весь интерфейс и передавать
 * пропсы, а нужно, чтобы цвет сменился на уже открытых страницах сразу.
 *
 * Тема применяется только к `.ag-root` — перекрашенным страницам. Шапка
 * и остальной сайт остаются тёмными: их оформление задано отдельными
 * переменными и не входит в этот макет.
 */
export function applyPrefs(prefs: Prefs): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  root.dataset.agTheme = prefs.theme;
  root.dataset.agAccent = prefs.accent;
  root.dataset.agStars = String(prefs.stars);

  const accent = accentOf(prefs.accent);
  root.style.setProperty("--color-accent", accent.a);
  root.style.setProperty("--color-accent-2", accent.b);
  root.style.setProperty("--ag-accent-rgb", accent.rgb);
}
