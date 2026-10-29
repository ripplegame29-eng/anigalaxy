import { buildDetail, type AniTitleDetail, type RawRelease } from "./anilibria-map";

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
