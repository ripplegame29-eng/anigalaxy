import type { AnimeCard, AnimeKind } from "@/lib/types";

/**
 * Чистые типы и преобразования ответов AniLiberty. Без серверных зависимостей,
 * поэтому годятся и для браузера (запасной запрос, когда сервер не видит релиз).
 */

/** Ответ поиска/деталей — читаем только нужные поля */
export interface RawName {
  main?: string | null;
  english?: string | null;
}

export interface RawPoster {
  src?: string | null;
  optimized?: { src?: string | null } | null;
}

export interface RawRelease {
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

export interface RawEpisode {
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

export function buildDetail(raw: RawRelease): AniTitleDetail | null {
  const card = toAniCard(raw);
  if (!card.alias && !card.id) return null;
  const episodesRaw = (raw as { episodes?: RawEpisode[] }).episodes;
  const episodes = (Array.isArray(episodesRaw) ? episodesRaw : [])
    .map(toEpisode)
    .filter((ep): ep is AniEpisode => ep !== null)
    .sort((a, b) => a.number - b.number);
  return { card, episodes, episodesTotal: raw.episodes_total ?? undefined };
}
