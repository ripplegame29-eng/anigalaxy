"use client";

/**
 * Любимые карты на профиле.
 *
 * Коллекция карт живёт на сервере игры и чужому профилю недоступна, поэтому
 * выбранные карты хранятся отдельным документом-снимком: id карты, фольга,
 * уровень и эволюция. Документ синхронизируется как остальные ключи
 * `animehub:` и отдаётся гостю (см. PUBLIC_KEYS в server/profile-view.ts).
 * Если карту потом продали или распылили, на профиле остаётся снимок —
 * игрок сам уберёт её в Студии.
 */

import { createLocalStore } from "./store";

export const FAVCARDS_KEY = "animehub:favcards:v1";
export const MAX_FAVCARDS = 6;

export interface FavCard {
  /** id экземпляра в инвентаре (0 — неизвестен, например после импорта) */
  inv: number;
  cardId: string;
  foil: boolean;
  level: number;
  evo: number;
}

function parse(raw: string): FavCard[] | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(value)) return null;
  const out: FavCard[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    if (typeof c.cardId !== "string" || !c.cardId) continue;
    out.push({
      inv: typeof c.inv === "number" ? c.inv : 0,
      cardId: c.cardId,
      foil: c.foil === true,
      level: typeof c.level === "number" ? Math.max(1, Math.min(99, Math.round(c.level))) : 1,
      evo: typeof c.evo === "number" ? Math.max(0, Math.min(5, Math.round(c.evo))) : 0,
    });
    if (out.length >= MAX_FAVCARDS) break;
  }
  return out;
}

const store = createLocalStore<FavCard[]>(FAVCARDS_KEY, [], parse);

export const useFavCards = (): FavCard[] => store.useStore();
export const readFavCards = (): FavCard[] => store.get();

export function saveFavCards(list: FavCard[]): void {
  store.set(list.slice(0, MAX_FAVCARDS));
}

/** Ключ экземпляра: у одинаковых карт разные экземпляры различаются по inv */
export const favKey = (c: Pick<FavCard, "inv" | "cardId">): string => `${c.inv}:${c.cardId}`;

export function toggleFavCard(card: FavCard): void {
  const list = store.get();
  const key = favKey(card);
  if (list.some((item) => favKey(item) === key)) {
    store.set(list.filter((item) => favKey(item) !== key));
  } else if (list.length < MAX_FAVCARDS) {
    store.set([...list, card]);
  }
}

/** Сдвиг карты в ряду: -1 — левее, 1 — правее */
export function moveFavCard(index: number, dir: -1 | 1): void {
  const list = [...store.get()];
  const to = index + dir;
  if (to < 0 || to >= list.length) return;
  [list[index], list[to]] = [list[to], list[index]];
  store.set(list);
}
