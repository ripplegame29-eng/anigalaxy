/**
 * Модель фильтров каталога и работа с query-строкой.
 * Файл используется и серверной страницей, и клиентскими компонентами,
 * поэтому не содержит серверных импортов.
 */

export interface CatalogState {
  q?: string;
  type?: "all" | "serial" | "movie";
  kind?: string;
  status?: string;
  genre?: string;
  yearFrom?: number;
  yearTo?: number;
  sort: string;
}

export type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export const TYPE_OPTIONS = [
  { value: "all", label: "Все" },
  { value: "serial", label: "Сериалы" },
  { value: "movie", label: "Фильмы" },
] as const;

export const STATUS_OPTIONS = [
  { value: "", label: "Любой" },
  { value: "ongoing", label: "Онгоинг" },
  { value: "released", label: "Завершён" },
  { value: "anons", label: "Анонс" },
] as const;

export const KIND_OPTIONS = [
  { value: "", label: "Любой тип" },
  { value: "tv", label: "ТВ Сериал" },
  { value: "movie", label: "Фильм" },
  { value: "ova", label: "OVA" },
  { value: "ona", label: "ONA" },
  { value: "special", label: "Спешл" },
] as const;

export const SORT_OPTIONS = [
  { value: "rating", label: "По рейтингу" },
  { value: "fresh", label: "Сначала новые" },
  { value: "updated", label: "Недавно обновлённые" },
  { value: "year", label: "По году" },
  { value: "kinopoisk", label: "Топ Кинопоиска" },
  { value: "title", label: "А–Я" },
] as const;

/** Разбирает query-строку страницы в объект фильтров */
export function parseQuery(sp: SearchParams): CatalogState {
  const yearFrom = Number(first(sp.yearFrom));
  const yearTo = Number(first(sp.yearTo));
  const type = first(sp.type);

  return {
    q: first(sp.q)?.trim() || undefined,
    type: type === "serial" || type === "movie" || type === "all" ? type : undefined,
    kind: first(sp.kind) || undefined,
    status: first(sp.status) || undefined,
    genre: first(sp.genre) || undefined,
    yearFrom: Number.isFinite(yearFrom) && yearFrom ? yearFrom : undefined,
    yearTo: Number.isFinite(yearTo) && yearTo ? yearTo : undefined,
    sort: first(sp.sort) || "rating",
  };
}

/** Объект фильтров -> query-строка (пустые значения отбрасываются) */
export function toSearch(state: CatalogState): string {
  const sp = new URLSearchParams();

  if (state.q) sp.set("q", state.q);
  if (state.type && state.type !== "all") sp.set("type", state.type);
  if (state.kind) sp.set("kind", state.kind);
  if (state.status) sp.set("status", state.status);
  if (state.genre) sp.set("genre", state.genre);
  if (state.yearFrom) sp.set("yearFrom", String(state.yearFrom));
  if (state.yearTo) sp.set("yearTo", String(state.yearTo));
  if (state.sort && state.sort !== "rating") sp.set("sort", state.sort);

  const result = sp.toString();
  return result ? `?${result}` : "";
}

/** Есть ли хоть один активный фильтр (для кнопки «Сбросить») */
export function hasActiveFilters(state: CatalogState): boolean {
  return Boolean(
    state.q || state.type || state.kind || state.status || state.genre || state.yearFrom || state.yearTo,
  );
}
