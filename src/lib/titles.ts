"use client";

import { createLocalStore } from "./store";

/**
 * Память о названиях и постерах.
 *
 * Избранное и подборки хранят только id тайтла Kodik — этого мало для
 * плиток в профиле. Сюда записывается {id → название, постер} в момент,
 * когда тайтл попадает в список или открывается на просмотре, и отсюда же
 * подтягивается карточка на витрине и в истории.
 */

export interface TitleMeta {
  id: string;
  title: string;
  poster?: string;
}

const EMPTY: Record<string, TitleMeta> = {};

function parse(raw: string): Record<string, TitleMeta> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const out: Record<string, TitleMeta> = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      const item = value as Partial<TitleMeta>;
      if (item && typeof item.title === "string") {
        out[id] = { id, title: item.title, poster: typeof item.poster === "string" ? item.poster : undefined };
      }
    }
    return out;
  } catch {
    return null;
  }
}

export const titlesStore = createLocalStore<Record<string, TitleMeta>>(
  "animehub:titles:v1",
  EMPTY,
  parse,
);

/** Запомнить тайтл (вызывается из карточек, списка и плеера) */
export function rememberTitle(meta: TitleMeta): void {
  if (!meta.id || !meta.title) return;
  titlesStore.update((state) => {
    const prev = state[meta.id];
    if (prev && prev.title === meta.title && prev.poster === meta.poster) return state;
    const next = Object.keys(state).length > 400 ? {} : state;
    return { ...next, [meta.id]: { id: meta.id, title: meta.title, poster: meta.poster ?? prev?.poster } };
  });
}

export function titleMeta(id: string): TitleMeta | undefined {
  return titlesStore.get()[id];
}

/** id → данные; для плиток профиля и истории */
export function useTitles(): Record<string, TitleMeta> {
  return titlesStore.useStore();
}
