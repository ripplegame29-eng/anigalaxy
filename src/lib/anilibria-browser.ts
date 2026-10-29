import { buildDetail, toAniCard, type AniTitleDetail, type RawRelease } from "./anilibria-map";
import type { AnimeCard } from "./types";

/**
 * Релиз AniLiberty, запрошенный прямо из браузера зрителя.
 *
 * AniLiberty не отдаёт часть релизов адресам дата-центров, поэтому серверу такой
 * тайтл «не виден». У зрителя обычный домашний адрес, и API разрешает запросы из
 * браузера (CORS), так что запасной путь — спросить самим.
 */
export async function fetchReleaseInBrowser(alias: string, signal?: AbortSignal): Promise<AniTitleDetail | null> {
  const key = alias.trim();
  if (!key) return null;
  try {
    const res = await fetch(`https://anilibria.top/api/v1/anime/releases/${encodeURIComponent(key)}`, {
      headers: { accept: "application/json" },
      signal,
    });
    if (!res.ok) return null;
    return buildDetail((await res.json()) as RawRelease);
  } catch {
    return null;
  }
}

const norm = (s?: string): string => (s ?? "").toLowerCase().replace(/[^a-zа-яё0-9]+/g, "");

/**
 * Поиск AniLiberty из браузера: карточки с id вида «ani-алиас».
 * Нужен, чтобы находить релизы, скрытые от адреса сервера (см. fetchReleaseInBrowser).
 */
export async function searchReleasesInBrowser(query: string, limit = 8, signal?: AbortSignal): Promise<AnimeCard[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const res = await fetch(`https://anilibria.top/api/v1/app/search/releases?query=${encodeURIComponent(q)}`, {
      headers: { accept: "application/json" },
      signal: signal ?? AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    const list = Array.isArray(data) ? (data as RawRelease[]) : [];
    return list
      .slice(0, limit)
      .map(toAniCard)
      .filter((c) => c.alias)
      .map((c) => ({ ...c, id: `ani-${c.alias}` }));
  } catch {
    return [];
  }
}

/**
 * Добавляет к выдаче сервера карточки AniLiberty, которых в ней нет
 * (совпадение по id, id Shikimori или названию). Порядок сервера сохраняется.
 */
export function addAniExtras(cards: AnimeCard[], extras: AnimeCard[]): AnimeCard[] {
  if (!extras.length) return cards;
  const ids = new Set(cards.map((c) => c.id));
  const shiki = new Set(cards.map((c) => c.shikimoriId).filter(Boolean));
  const names = new Set(cards.flatMap((c) => [norm(c.title), norm(c.titleOrig)]).filter(Boolean));
  const add = extras.filter(
    (c) =>
      !ids.has(c.id) &&
      !(c.shikimoriId && shiki.has(c.shikimoriId)) &&
      !names.has(norm(c.title)) &&
      !(c.titleOrig && names.has(norm(c.titleOrig))),
  );
  return add.length ? [...cards, ...add] : cards;
}
