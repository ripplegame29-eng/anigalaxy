import { withCache } from "@/lib/kodik";
import type { AnimeCard, AnimeKind } from "@/lib/types";

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
 * Часть релизов AniLiberty скрыта для адресов вне России (404 по IP сервера).
 * Если сайт стоит за рубежом, задайте ANILIBRIA_BASE — адрес зеркала API на российском
 * сервере (например https://ani-proxy.example.ru/api/v1).
 */
const BASE = (process.env.ANILIBRIA_BASE || "https://anilibria.top/api/v1").replace(/\/+$/, "");

/** Таймаут запроса к чужому API */
const TIMEOUT_MS = 10_000;

/** Ответ поиска/деталей — читаем только нужные поля */
interface RawName {
  main?: string | null;
  english?: string | null;
}

interface RawPoster {
  src?: string | null;
  optimized?: { src?: string | null } | null;
}

interface RawRelease {
  id?: number | null;
  alias?: string | null;
  name?: RawName | null;
  year?: number | null;
  type?: { value?: string | null } | null;
  poster?: RawPoster | null;
  shikimori?: { id?: number | null; rating?: number | null } | null;
  mal?: { id?: number | null } | null;
  rating?: { average?: number | null } | null;
  episodes_total?: number | null;
  description?: string | null;
  genres?: unknown;
  is_ongoing?: boolean | null;
  average_duration_of_episode?: number | null;
}

interface RawEpisode {
  id?: string | null;
  ordinal?: number | null;
  name?: string | null;
  duration?: number | null;
  hls_480?: string | null;
  hls_720?: string | null;
  hls_1080?: string | null;
}

/** Карточка из поиска AniLiberty: AnimeCard + алиас для плеера */
export interface AniSearchCard extends AnimeCard {
  /** Алиас тайтла в AniLiberty (`/anime/releases/{alias}`) */
  alias: string;
}

/** Серия с HLS-потоками по качествам */
export interface AniEpisode {
  id: string;
  /** Номер серии (может быть дробным у спецвыпусков, напр. 12.5) */
  number: number;
  name?: string;
  /** Длительность в секундах */
  duration?: number;
  /** Прямые ссылки m3u8 (отсутствующие качества — не выпущены) */
  sources: { "480"?: string; "720"?: string; "1080"?: string };
}

/** Тайтл с эпизодами — ответ `/api/anilibria/title` */
export interface AniTitleDetail {
  card: AniSearchCard;
  /** Только серии с хотя бы одним HLS-потоком, по возрастанию ordinal */
  episodes: AniEpisode[];
  episodesTotal?: number;
}

/** Тип AniLiberty → наш AnimeKind (открытая строка, смотрим KIND_LABELS) */
const KIND_BY_TYPE: Record<string, AnimeKind> = {
  TV: "tv",
  MOVIE: "movie",
  OVA: "ova",
  ONA: "ona",
  WEB: "ona",
  SPECIAL: "special",
  MUSIC: "music",
};

/** Относительный путь постера `/storage/...` → абсолютный URL */
function abs(path?: string | null): string | undefined {
  if (!path) return undefined;
  return path.startsWith("/") ? `https://anilibria.top${path}` : path;
}

/** `genres` в деталях бывает разной формы — собираем названия защитно */
function mapGenres(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): string[] => {
    if (typeof item === "string") return [item];
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      if (typeof obj.name === "string") return [obj.name];
      const title = obj.title;
      if (title && typeof title === "object") {
        const main = (title as Record<string, unknown>).main;
        if (typeof main === "string") return [main];
      }
    }
    return [];
  });
}

/** Сырой релиз → карточка для UI */
export function toAniCard(raw: RawRelease): AniSearchCard {
  const type = raw.type?.value ?? undefined;
  const rating = raw.shikimori?.rating ?? raw.rating?.average ?? undefined;
  const total = raw.episodes_total ?? undefined;
  return {
    id: String(raw.id ?? raw.alias ?? ""),
    alias: String(raw.alias ?? ""),
    title: raw.name?.main ?? String(raw.alias ?? ""),
    titleOrig: raw.name?.english ?? undefined,
    year: raw.year ?? undefined,
    poster: abs(raw.poster?.optimized?.src ?? raw.poster?.src),
    rating,
    ratingSource: raw.shikimori?.rating ? "shikimori" : undefined,
    kind: type ? (KIND_BY_TYPE[type] ?? type.toLowerCase()) : undefined,
    shikimoriId: raw.shikimori?.id ?? raw.mal?.id ?? undefined,
    genres: mapGenres(raw.genres),
    status: raw.is_ongoing === true ? "ongoing" : raw.is_ongoing === false ? "released" : undefined,
    duration: raw.average_duration_of_episode ?? undefined,
    episodesTotal: total,
    lastEpisode: total,
    description: raw.description ?? undefined,
  };
}

/** Сырая серия → модель плеера (null, если нет ни одного потока) */
function toEpisode(raw: RawEpisode): AniEpisode | null {
  const sources: AniEpisode["sources"] = {};
  if (raw.hls_480) sources["480"] = raw.hls_480;
  if (raw.hls_720) sources["720"] = raw.hls_720;
  if (raw.hls_1080) sources["1080"] = raw.hls_1080;
  if (!sources["480"] && !sources["720"] && !sources["1080"]) return null;
  return {
    id: String(raw.id ?? `${raw.ordinal ?? 0}`),
    number: raw.ordinal ?? 0,
    name: raw.name ?? undefined,
    duration: raw.duration ?? undefined,
    sources,
  };
}

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

function buildDetail(raw: RawRelease): AniTitleDetail | null {
  const card = toAniCard(raw);
  if (!card.alias && !card.id) return null;
  const episodesRaw = (raw as { episodes?: RawEpisode[] }).episodes;
  const episodes = (Array.isArray(episodesRaw) ? episodesRaw : [])
    .map(toEpisode)
    .filter((ep): ep is AniEpisode => ep !== null)
    .sort((a, b) => a.number - b.number);
  return { card, episodes, episodesTotal: raw.episodes_total ?? undefined };
}
