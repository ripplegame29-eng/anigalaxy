import { withCache } from "@/lib/kodik";

/**
 * Клиент каталога AniLiberty (бывшая AniLibria) для совместного просмотра.
 *
 * API публичный, ключ не требуется: https://anilibria.top/api/docs/v1
 * (OAS 3.0, старый api.anilibria.tv/v3 выведен из эксплуатации — 410).
 * Только серверные вызовы из роутов `/api/anilibria/*`; браузеру отдаём
 * уже смапленные модели. Стримы — HLS (m3u8) с cache.libria.fun, CDN
 * отражает Origin, поэтому плеер грузит их напрямую через hls.js.
 */

/**
 * AniLiberty скрывает часть релизов от адресов дата-центров (404 с сервера, хотя из браузера
 * зрителя релиз открывается). Для таких случаев есть запрос из браузера: `anilibria-browser.ts`.
 * ANILIBRIA_BASE — необязательный адрес зеркала API (прокси).
 */
const BASE = (process.env.ANILIBRIA_BASE || "https://anilibria.top/api/v1").replace(/\/+$/, "");

/** Таймаут запроса к чужому API */
const TIMEOUT_MS = 10_000;

import { buildDetail, toAniCard, type AniSearchCard, type AniTitleDetail, type RawRelease } from "./anilibria-map";
export type { AniEpisode, AniSearchCard, AniTitleDetail } from "./anilibria-map";

/** GET на чужой API: таймаут + проверка статуса */
async function getJson(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`anilibria ${res.status} on ${path}`);
  return res.json();
}

/** Поиск тайтлов: `?query=` → карточки (30 с кэша — дебаунс и так есть) */
export async function searchReleases(query: string, limit = 6): Promise<AniSearchCard[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  return withCache(`anilib:search:${q.toLowerCase()}:${limit}`, 30_000, async () => {
    const data = await getJson(
      `/app/search/releases?query=${encodeURIComponent(q)}`,
    );
    const list = Array.isArray(data) ? (data as RawRelease[]) : [];
    return list.slice(0, limit).map(toAniCard);
  });
}

/** Тайтл с сериями по алиасу или числовому id; не найден → null (404 у них) */
export async function getRelease(idOrAlias: string): Promise<AniTitleDetail | null> {
  const key = idOrAlias.trim();
  if (!key) return null;
  return withCache(`anilib:title:${key}`, 5 * 60_000, async () => {
    let raw: RawRelease;
    try {
      raw = (await getJson(`/anime/releases/${encodeURIComponent(key)}`)) as RawRelease;
    } catch {
      return null;
    }
    return buildDetail(raw);
  });
}

/**
 * Точное сопоставление нашего тайтла с релизом AniLiberty.
 *
 * По названию искать нельзя: на «Чёрный клевер» каталог отдаёт спэшл, а
 * на многие тайтлы — просто соседний сериал с похожим словом в имени,
 * и зритель попадал на чужое аниме. Имя тут нужно лишь чтобы сузить
 * выдачу, а выбирает релиз совпадение id Shikimori/MAL. Не совпал ни
 * один — значит, у AniLiberty этого тайтла нет, и озвучку не предлагаем.
 */
export async function matchRelease(animeId: number, names: string[]): Promise<AniSearchCard | null> {
  if (!animeId) return null;
  const queries = names
    .map((name) => name.trim())
    .filter((name) => name.length >= 2)
    .slice(0, 3);
  if (!queries.length) return null;
  return withCache(`anilib:match:${animeId}`, 30 * 60_000, async () => {
    for (const query of queries) {
      const cards = await searchReleases(query, 15);
      const hit = cards.find((card) => card.shikimoriId === animeId);
      if (hit) return hit;
    }
    return null;
  });
}

/** Запасной путь для комнат без алиаса: первый результат по названию */
export async function findByQuery(query: string): Promise<AniTitleDetail | null> {
  const cards = await searchReleases(query, 1);
  if (!cards[0]) return null;
  return getRelease(cards[0].alias);
}
