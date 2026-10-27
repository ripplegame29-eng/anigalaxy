"use client";

import { createLocalStore } from "./store";

/**
 * Память о тайтлах.
 *
 * Избранное и подборки хранят только id тайтла Kodik — этого мало для
 * плиток в профиле. Сюда записывается {id → название, постер, жанры,
 * студии, год, рейтинг} в момент, когда тайтл попадает в список или
 * открывается на просмотре, и отсюда же подтягивается карточка на витрине,
 * в истории и в «Моём списке».
 *
 * Поля кроме id и title необязательны: у записей, сделанных до их
 * появления, их просто нет, и виджеты обязаны это переживать (рисовать
 * «нет данных», а не выдумывать значения).
 */
export interface TitleMeta {
  id: string;
  title: string;
  poster?: string;
  /** Жанры по латинским ключам каталога — как их отдаёт Kodik */
  genres?: string[];
  /** Анимационные студии из карточки Kodik */
  studios?: string[];
  year?: number;
  /** Основной рейтинг: Shikimori → Кинопоиск → IMDb */
  rating?: number;
  /** Сколько серий вышло всего — знаменатель для «12 / 24 серий» */
  episodesTotal?: number;
  /** Манга: ссылка ведёт на /manga/<id>, а не на /title/<id> */
  manga?: boolean;
}

const EMPTY: Record<string, TitleMeta> = {};

/** Список строк, пришедших из хранилища: режем мусор, режем по длине */
function strList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  return out.length ? out.slice(0, 24) : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parse(raw: string): Record<string, TitleMeta> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const out: Record<string, TitleMeta> = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      const item = value as Partial<TitleMeta>;
      if (item && typeof item.title === "string") {
        out[id] = {
          id,
          title: item.title,
          poster: typeof item.poster === "string" ? item.poster : undefined,
          genres: strList(item.genres),
          studios: strList(item.studios),
          year: num(item.year),
          rating: num(item.rating),
          episodesTotal: num(item.episodesTotal),
          manga: item.manga === true ? true : undefined,
        };
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

/**
 * Запомнить тайтл (вызывается из карточек, списка и плеера).
 *
 * Новые поля не затирают старые: вызывающий может знать только название
 * (например, список), и тогда уже сохранённые жанры остаются.
 */
export function rememberTitle(meta: Partial<TitleMeta> & { id: string; title: string }): void {
  if (!meta.id || !meta.title) return;
  titlesStore.update((state) => {
    const prev = state[meta.id];
    const next: TitleMeta = {
      id: meta.id,
      title: meta.title,
      poster: meta.poster ?? prev?.poster,
      genres: meta.genres?.length ? meta.genres.slice(0, 24) : prev?.genres,
      studios: meta.studios?.length ? meta.studios.slice(0, 24) : prev?.studios,
      year: meta.year ?? prev?.year,
      rating: meta.rating ?? prev?.rating,
      episodesTotal: meta.episodesTotal ?? prev?.episodesTotal,
      manga: meta.manga ?? prev?.manga,
    };
    const same =
      prev &&
      prev.title === next.title &&
      prev.poster === next.poster &&
      prev.year === next.year &&
      prev.rating === next.rating &&
      prev.episodesTotal === next.episodesTotal &&
      prev.manga === next.manga &&
      (prev.genres ?? []).join("|") === (next.genres ?? []).join("|") &&
      (prev.studios ?? []).join("|") === (next.studios ?? []).join("|");
    if (same) return state;
    // Больше 400 тайтлов — начинаем заново, иначе хранилище разрастается
    const base = Object.keys(state).length > 400 ? {} : state;
    return { ...base, [meta.id]: next };
  });
}

export function titleMeta(id: string): TitleMeta | undefined {
  return titlesStore.get()[id];
}

/** id → данные; для плиток профиля и истории */
export function useTitles(): Record<string, TitleMeta> {
  return titlesStore.useStore();
}
