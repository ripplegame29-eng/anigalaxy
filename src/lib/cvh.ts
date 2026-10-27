import "server-only";
import { withCache } from "@/lib/kodik";
import { proxied } from "@/lib/stream-proxy";
import type { CvhPlaylist, CvhStudio } from "@/lib/types";

/**
 * CVH (CdnVideoHub) — источник, который AnimeGO показывает как «CVH».
 *
 * `cvh_id` совпадает с `shikimori_id`, поэтому тайтл и постер уже есть в
 * карточке Kodik. Плейлист отдаёт все серии всех озвучек, а по `vkId`
 * конкретной дорожки можно получить HLS. Видео лежит на okcdn/vkuser и
 * привязано к IP сервера, поэтому:
 *
 *  • резолвим поток на сервере и кэшируем всего на 10 минут;
 *  • браузеру отдаём не подписанный URL, а ссылки на /api/cvh/proxy;
 *  • master-плейлист разбираем здесь же и возвращаем готовые варианты
 *    1080/720/480 — плееру не нужны уровни hls.js.
 */

const API_BASE = "https://plapi.cdnvideohub.com/api/v1/player/sv";
const PUB = "747";
const AGGR = "mali";
const MINUTE = 60_000;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const API_HEADERS = {
  "user-agent": USER_AGENT,
  referer: "https://animego.org/",
  accept: "application/json",
};

interface RawCvhItem {
  cvhId?: string;
  vkId?: string;
  voiceStudio?: string | null;
  voiceType?: string | null;
  season?: number | string | null;
  episode?: number | string | null;
}

interface CvhItem {
  videoId: string;
  studio: string;
  voiceType: string;
  season: number;
  episode: number;
  subtitles: boolean;
}

interface CvhVideoResponse {
  sources?: Record<string, string | null | undefined> | null;
  thumbUrl?: string | null;
  duration?: number | null;
}

export interface CvhStream {
  /** Качество → прокси-ссылка на HLS-вариант */
  sources: Record<string, string>;
  /** Название выбранной озвучки */
  translation?: string;
  voiceType?: string;
  poster?: string;
  duration?: number;
}

function idOf(value: string | number): string {
  const id = String(value).trim();
  if (!/^\d+$/.test(id) || id === "0") {
    throw new Error("CVH: нужен числовой shikimori id");
  }
  return id;
}

async function cvhJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: API_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`CVH ответил HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

function intOr(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : fallback;
}

function normalizeItem(raw: RawCvhItem): CvhItem | null {
  const videoId = String(raw.vkId ?? "").trim();
  if (!videoId) return null;

  const voiceType = String(raw.voiceType ?? "").trim();
  const studio = String(raw.voiceStudio ?? "").trim() || "Субтитры";
  const subtitles =
    !raw.voiceStudio ||
    voiceType.toLocaleLowerCase("ru").includes("субтитр") ||
    studio.toLocaleLowerCase("ru").includes("субтитр");

  return {
    videoId,
    studio,
    voiceType,
    season: intOr(raw.season, 1),
    episode: intOr(raw.episode, 1),
    subtitles,
  };
}

/** Сырой плейлист: нужен и для списка озвучек, и для резолва серии */
function rawPlaylist(shikimoriId: string): Promise<CvhItem[]> {
  const id = idOf(shikimoriId);
  return withCache(`cvh:raw:${id}`, 10 * MINUTE, async () => {
    const data = await cvhJson<{ items?: RawCvhItem[] }>(
      `${API_BASE}/playlist?pub=${PUB}&aggr=${AGGR}&id=${id}`,
    );
    const items = (data.items ?? [])
      .map(normalizeItem)
      .filter((item): item is CvhItem => item !== null);
    if (!items.length) throw new Error("CVH вернул пустой плейлист");
    return items;
  });
}

/** Плейлист для UI: сезоны и уникальные озвучки с числом серий */
export async function getCvhPlaylist(shikimoriId: string | number): Promise<CvhPlaylist> {
  const id = idOf(shikimoriId);
  return withCache(`cvh:playlist:${id}`, 10 * MINUTE, async () => {
    const items = await rawPlaylist(id);
    const seasons = new Set<number>();
    const episodes = new Set<string>();
    const studios = new Map<
      string,
      { episodes: Set<string>; seasons: Set<number>; subtitles: boolean }
    >();

    for (const item of items) {
      seasons.add(item.season);
      episodes.add(`${item.season}:${item.episode}`);
      let studio = studios.get(item.studio);
      if (!studio) {
        studio = { episodes: new Set(), seasons: new Set(), subtitles: item.subtitles };
        studios.set(item.studio, studio);
      }
      studio.episodes.add(`${item.season}:${item.episode}`);
      studio.seasons.add(item.season);
      studio.subtitles = studio.subtitles || item.subtitles;
    }

    const list: CvhStudio[] = [...studios.entries()]
      .map(([name, value]) => ({
        name,
        episodes: value.episodes.size,
        seasons: [...value.seasons].sort((a, b) => a - b),
        subtitles: value.subtitles,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));

    return {
      shikimori: id,
      seasons: [...seasons].sort((a, b) => a - b),
      episodesTotal: episodes.size,
      studios: list,
    };
  });
}

/** Мягкое сравнение студий: регистр, пробелы и дефисы не важны */
function studioKey(value: string): string {
  return value.toLocaleLowerCase("ru").replace(/[\W_]+/gu, "");
}

function pickStudio(pool: CvhItem[], studio?: string | null): CvhItem | null {
  if (!pool.length) return null;
  const wanted = studioKey(studio ?? "");
  if (!wanted) return pool[0] ?? null;

  const exact = pool.find((item) => studioKey(item.studio) === wanted);
  if (exact) return exact;

  const loose = pool.find((item) => {
    const key = studioKey(item.studio);
    return key.length > 0 && (key.includes(wanted) || wanted.includes(key));
  });
  return loose ?? null;
}

function hlsHeaders(url: string): Record<string, string> {
  const origin = new URL(url).origin;
  return {
    "user-agent": USER_AGENT,
    accept: "*/*",
    referer: `${origin}/`,
    origin,
  };
}

/**
 * Разбираем master m3u8 на варианты. Так плеер получает отдельные ссылки
 * 1080/720/480 и переключает качество без hls.js-уровней.
 */
async function resolveVariants(masterUrl: string): Promise<Record<string, string>> {
  const response = await fetch(masterUrl, {
    headers: hlsHeaders(masterUrl),
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`CVH master ответил HTTP ${response.status}`);
  }

  const text = await response.text();
  const base = response.url || masterUrl;
  const lines = text.split(/\r?\n/);
  const variants: Record<string, string> = {};

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXT-X-STREAM-INF")) continue;
    const resolution = /RESOLUTION=\d+x(\d+)/i.exec(line);
    const next = lines[i + 1]?.trim();
    if (!resolution || !next || next.startsWith("#")) continue;

    const height = Number(resolution[1]);
    if (!Number.isFinite(height) || height <= 0) continue;

    try {
      const absolute = new URL(next, base).toString();
      const key = String(height);
      if (!variants[key]) variants[key] = proxied("/api/cvh/proxy", absolute);
    } catch {
      /* битая строка — пропускаем */
    }
  }

  const wanted = ["1080", "720", "480"];
  const result: Record<string, string> = {};
  for (const key of wanted) {
    if (variants[key]) result[key] = variants[key];
  }

  // Если master неожиданный (или качеств меньше), отдаём его целиком:
  // hls.js сам выберет лучший вариант.
  if (!Object.keys(result).length) {
    result["1080"] = proxied("/api/cvh/proxy", masterUrl);
  }
  return result;
}

/**
 * Резолв серии в HLS. `studio` — название из плейлиста; сравнение мягкое,
 * чтобы «AniLibria» находила «AnilibriaTV».
 */
export async function getCvhStream(
  shikimoriId: string | number,
  season: number,
  episode: number,
  studio?: string | null,
): Promise<CvhStream> {
  const id = idOf(shikimoriId);
  const seasonNumber = intOr(season, 1);
  const episodeNumber = intOr(episode, 1);

  return withCache(
    `cvh:stream:${id}:${seasonNumber}:${episodeNumber}:${studio ?? ""}`,
    10 * MINUTE,
    async () => {
      const items = await rawPlaylist(id);
      const pool = items.filter(
        (item) => item.season === seasonNumber && item.episode === episodeNumber,
      );
      if (!pool.length) {
        throw new Error(
          `CVH: серии ${episodeNumber} нет в сезоне ${seasonNumber}`,
        );
      }

      const chosen = pickStudio(pool, studio);
      if (!chosen) {
        throw new Error(
          `CVH: озвучка «${studio ?? ""}» не найдена для этой серии`,
        );
      }

      const video = await cvhJson<CvhVideoResponse>(
        `${API_BASE}/video/${encodeURIComponent(chosen.videoId)}`,
      );
      const hlsUrl = video.sources?.hlsUrl;
      if (!hlsUrl) {
        throw new Error("CVH не отдал HLS-поток");
      }

      const sources = await resolveVariants(hlsUrl);
      return {
        sources,
        translation: chosen.studio,
        voiceType: chosen.voiceType || undefined,
        poster: video.thumbUrl ?? undefined,
        duration:
          typeof video.duration === "number" && video.duration > 0
            ? video.duration
            : undefined,
      };
    },
  );
}
