"use client";

/**
 * Тир-лист аниме — виджет профиля.
 *
 * Разметка, стили и поведение взяты из макета `anime-tierlist.html` один в
 * один (классы `tl-*`, перетаскивание, корзина, окно выбора, переименование
 * рядов двойным кликом). Отличается источник данных: макет искал по
 * демо-массиву из двадцати выдуманных названий без id, здесь работает
 * настоящий каталог Kodik через `/api/kodik/search` — поэтому в ряд
 * попадают тайлы с Kodik-идентификаторами и настоящими постерами.
 *
 * Хранилище браузерное, как и остальные виджеты профиля: `localStorage`
 * проекта, а не ключ `anime-tierlist:v2` из макета. Название, подписи рядов и
 * состав живут здесь; счётчик аниме считается из строк, поэтому разойтись с
 * содержимым он не может.
 */

import { createLocalStore } from "./store";

/** Ряды тир-листа: буква и цвет из макета */
export const TIERS: { label: string; color: string }[] = [
  { label: "S", color: "#ff6b57" },
  { label: "A", color: "#ffb26b" },
  { label: "B", color: "#ffe66b" },
  { label: "C", color: "#86ef86" },
  { label: "D", color: "#7fd8ff" },
  { label: "F", color: "#ff80ff" },
];

export const TIER_LIST_KEY = "animehub:tierlist:v1";

export interface TierItem {
  id: string;
  title: string;
  poster?: string;
}

export interface TierListState {
  title: string;
  /** Подписи рядов: по умолчанию S, A, B, C, D, F; ряд можно переименовать */
  labels: string[];
  /** Сколько аниме лежит в каждом ряду */
  rows: string[][];
  /** Тайлы по id — чтобы не тянуть каталог при каждой отрисовке */
  items: Record<string, TierItem>;
}

const empty = (): TierListState => ({
  title: "Мой тир-лист",
  labels: TIERS.map((tier) => tier.label),
  rows: TIERS.map(() => []),
  items: {},
});

function parse(raw: string): TierListState | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Partial<TierListState>;
  if (!Array.isArray(data.rows) || data.rows.length !== TIERS.length) return null;
  const base = empty();
  const labels = TIERS.map((tier, i) => {
    const label = data.labels?.[i];
    return typeof label === "string" && label.trim() ? label.slice(0, 14) : tier.label;
  });
  const rows = TIERS.map((tier, i) =>
    Array.isArray(data.rows?.[i]) ? data.rows[i].filter((id): id is string => typeof id === "string") : [],
  );
  const items: Record<string, TierItem> = {};
  if (data.items && typeof data.items === "object") {
    for (const [id, item] of Object.entries(data.items as Record<string, TierItem>)) {
      if (item && typeof item.title === "string") items[id] = { id, title: item.title, poster: item.poster };
    }
  }
  // Из строк убираем id без карточки: иначе в ряду останется пустое место
  const clean = rows.map((row) => row.filter((id) => Boolean(items[id])));
  return {
    title: typeof data.title === "string" ? data.title.slice(0, 60) : base.title,
    labels,
    rows: clean,
    items,
  };
}

const store = createLocalStore<TierListState>(TIER_LIST_KEY, empty(), parse);

export function useTierList(): TierListState {
  return store.useStore();
}

export function readTierList(): TierListState {
  return store.get();
}

function save(next: TierListState): void {
  store.set(next);
}

export function setTierTitle(title: string): void {
  const state = store.get();
  save({ ...state, title: title.slice(0, 60) });
}

export function renameTier(index: number, label: string): void {
  const state = store.get();
  const clean = label.trim().slice(0, 14) || TIERS[index].label;
  const labels = [...state.labels];
  labels[index] = clean;
  save({ ...state, labels });
}

/**
 * Положить тайл в ряд или убрать его (`tier = -1`).
 *
 * Аниме не может лежать в двух рядах сразу, поэтому перед добавлением оно
 * убирается из прежнего — как в макете.
 */
export function placeInTier(id: string, tier: number): void {
  const state = store.get();
  const rows = state.rows.map((row) => row.filter((item) => item !== id));
  if (tier > -1 && tier < rows.length) rows[tier] = [...rows[tier], id];
  save({ ...state, rows });
}

/** Запомнить карточку тайла, чтобы ряд не зависел от каталога */
export function rememberItem(item: TierItem): void {
  const state = store.get();
  if (state.items[item.id]?.title === item.title) return;
  save({ ...state, items: { ...state.items, [item.id]: item } });
}

/** Очистить ряды, названия и подписи оставить */
export function clearTiers(): void {
  const state = store.get();
  save({ ...state, rows: TIERS.map(() => []) });
}

export function tierOf(state: TierListState, id: string): number {
  return state.rows.findIndex((row) => row.includes(id));
}

export const tierCount = (state: TierListState): number =>
  state.rows.reduce((sum, row) => sum + row.length, 0);

/**
 * Оттенок карточки — тот же подсчёт, что в макете: от названия, чтобы
 * повторы одного тайла в разных местах совпадали по цвету.
 */
export function hueOf(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) % 360;
  return `hsl(${h} 40% 32%)`;
}

/* ───────────────────────────── Каталог Kodik ───────────────────────────── */

/**
 * Поиск по каталогу для окна выбора. Макет звал `TIERLIST_CONFIG.search` —
 * здесь это маршруты сайта: на пустом запросе Kodik ничего не отдаёт, поэтому
 * открываем окно популярными тайлами (`/api/kodik/top`), а по вводу ищем
 * названием (`/api/kodik/search`), как поиск в шапке.
 *
 * Ошибку не глотаем: окно покажет её текстом, молчаливый пустой список
 * выглядел бы как «ничего не нашлось».
 */
export async function searchCatalog(query: string): Promise<TierItem[]> {
  const trimmed = query.trim();
  const response = trimmed
    ? await fetch(`/api/kodik/search?${new URLSearchParams({ q: trimmed, limit: "20" })}`)
    : await fetch("/api/kodik/top");
  if (!response.ok) throw new Error("catalog");
  const data = (await response.json()) as {
    results?: { id: string; title: string; poster?: string }[];
    cards?: { id: string; title: string; poster?: string }[];
  };
  const rows = data.results ?? data.cards ?? [];
  return rows.map((item) => ({ id: item.id, title: item.title, poster: item.poster }));
}