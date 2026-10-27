import "server-only";
import { withCache } from "@/lib/kodik";
import { proxied } from "@/lib/stream-proxy";
import type { AniBoomMatch, AniBoomVoice } from "@/lib/types";

/**
 * AnimeGO + AniBoom.
 *
 * AnimeGO — агрегатор, который для части озвучек отдаёт плеер AniBoom.
 * Поток AniBoom — обычный HLS (m3u8), поэтому его можно играть тем же
 * hls.js, что CVH/SameBand. DASH-вариант не используем: HLS есть у всех
 * проверенных дорожек, а лишний плеер (dash.js) только утяжелил бы клиент.
 *
 * Схема:
 *   поиск AnimeGO по названию/году
 *     → /player/<anime_id> (JSON, HTML внутри data.content)
 *     → кнопки с data-provider-title="AniBoom"
 *     → embed-страница AniBoom
 *     → data-parameters → hls.src
 *     → master m3u8 → варианты 1080/720/480 через /api/aniboom/proxy
 */

const MIRROR = process.env.ANIMEGO_MIRROR?.trim();
const ANIMEGO_BASE = MIRROR
  ? MIRROR.startsWith("http")
    ? MIRROR.replace(/\/$/, "")
    : `https://${MIRROR.replace(/\/$/, "")}`
  : "https://animego.me";

const MINUTE = 60_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

const HTML_HEADERS = {
  "user-agent": USER_AGENT,
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
};

const PLAYER_HEADERS = {
  ...HTML_HEADERS,
  "x-requested-with": "XMLHttpRequest",
  referer: "https://animego.org/",
  accept: "application/json, text/javascript, */*; q=0.01",
};

const EMBED_HEADERS = {
  "user-agent": USER_AGENT,
  "accept-language": "ru-RU,ru;q=0.9",
  referer: "https://animego.org/",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

const STREAM_HEADERS = {
  "user-agent": USER_AGENT,
  origin: "https://aniboom.one",
  referer: "https://aniboom.one/",
  accept: "*/*",
};

export interface AniBoomStream {
  sources: Record<string, string>;
  poster?: string;
  duration?: number;
}

interface AnimeGoSearchCard {
  animeId: string;
  title: string;
  year?: number;
  url: string;
  poster?: string;
}

interface AnimeGoVoices {
  voices: AniBoomVoice[];
  episodesTotal?: number;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

function parseAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of tag.matchAll(/([a-zA-Z0-9:_-]+)\s*=\s*"([^"]*)"/g)) {
    attrs[match[1].toLowerCase()] = decodeEntities(match[2]);
  }
  for (const match of tag.matchAll(/([a-zA-Z0-9:_-]+)\s*=\s*'([^']*)'/g)) {
    const key = match[1].toLowerCase();
    if (!(key in attrs)) attrs[key] = decodeEntities(match[2]);
  }
  return attrs;
}

function normalizeTitle(value: string): string {
  return value
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameTokens(a: string, b: string): boolean {
  const left = a.split(" ").filter(Boolean).sort().join(" ");
  const right = b.split(" ").filter(Boolean).sort().join(" ");
  return left.length > 0 && left === right;
}

function titleMatches(candidate: string, wanted: string): boolean {
  const title = normalizeTitle(candidate);
  const target = normalizeTitle(wanted);
  if (!title || !target) return false;
  return title === target || sameTokens(title, target);
}

async function fetchText(
  url: string,
  headers: Record<string, string>,
  timeout = 20_000,
): Promise<{ text: string; finalUrl: string; response: Response }> {
  const response = await fetch(url, {
    headers,
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) {
    throw new Error(`AnimeGO/AniBoom ответил HTTP ${response.status}`);
  }
  const text = await response.text();
  return { text, finalUrl: response.url || url, response };
}

function parseSearchCards(html: string): AnimeGoSearchCard[] {
  const starts = [
    ...html.matchAll(/<div[^>]*class="[^"]*\bani-grid__item\b[^"]*"[^>]*>/gi),
  ].map((match) => match.index ?? 0);

  const cards: AnimeGoSearchCard[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < starts.length; i += 1) {
    const block = html.slice(starts[i], starts[i + 1] ?? html.length);
    let href = "";
    let title = "";
    let poster: string | undefined;

    for (const tag of block.matchAll(/<a\b[^>]*>/gi)) {
      const attrs = parseAttrs(tag[0]);
      if (attrs.href?.startsWith("/anime/") && attrs.title) {
        href = attrs.href;
        title = attrs.title.trim();
        break;
      }
      if (attrs.href?.startsWith("/anime/") && !href) href = attrs.href;
    }

    if (!href) continue;
    if (!title) {
      const image = /<img\b[^>]*>/i.exec(block)?.[0];
      if (image) {
        const attrs = parseAttrs(image);
        title = attrs.alt?.trim() ?? "";
        poster = attrs.src;
      }
    }
    if (!title) continue;

    const yearMatch =
      /\bani-grid__item-genres__link\b[^>]*>\s*((?:19|20)\d{2})\s*</i.exec(
        block,
      );
    const animeId = /-(\d+)(?:[/?#]|$)/.exec(href)?.[1] ?? "";
    if (!animeId || seen.has(animeId)) continue;
    seen.add(animeId);

    cards.push({
      animeId,
      title: decodeEntities(title),
      year: yearMatch ? Number(yearMatch[1]) : undefined,
      url: new URL(href, ANIMEGO_BASE).toString(),
      poster,
    });
  }

  return cards;
}

async function searchAnimeGo(query: string): Promise<AnimeGoSearchCard[]> {
  const url = `${ANIMEGO_BASE}/search/anime?q=${encodeURIComponent(query)}`;
  const { text } = await fetchText(url, HTML_HEADERS);
  return parseSearchCards(text);
}

async function getAnimeGoVoices(animeId: string): Promise<AnimeGoVoices> {
  if (!/^\d+$/.test(animeId)) {
    throw new Error("AniBoom: нужен числовой anime_id");
  }

  return withCache(`aniboom:voices:${animeId}`, 30 * MINUTE, async () => {
    const { text } = await fetchText(
      `${ANIMEGO_BASE}/player/${animeId}`,
      PLAYER_HEADERS,
    );

    let content = "";
    try {
      const data = JSON.parse(text) as { data?: { content?: string } };
      content = data.data?.content ?? "";
    } catch {
      throw new Error("AnimeGO вернул плеер не в формате JSON");
    }
    if (!content) throw new Error("AnimeGO не отдал HTML плеера");

    const voices: AniBoomVoice[] = [];
    const seen = new Set<number>();

    for (const tag of content.matchAll(/<button\b[^>]*>/gi)) {
      const attrs = parseAttrs(tag[0]);
      if ((attrs["data-provider-title"] ?? "").toLowerCase() !== "aniboom") {
        continue;
      }

      const translationId = Number(attrs["data-ptranslation"]);
      let embed = attrs["data-player"]?.trim() ?? "";
      if (embed.startsWith("//")) embed = `https:${embed}`;
      const label = (attrs["data-translation-title"] ?? "")
        .replace(/\s*\(ошибка\)\s*$/i, "")
        .trim();

      if (!Number.isFinite(translationId) || translationId <= 0) continue;
      if (!label || !embed || !/^https?:\/\//i.test(embed)) continue;
      if (seen.has(translationId)) continue;
      seen.add(translationId);
      voices.push({ translationId, label, embed });
    }

    if (!voices.length) {
      throw new Error("У этого тайтла нет озвучек AniBoom");
    }

    let episodesTotal: number | undefined;
    for (const match of content.matchAll(/data-episode-number="(\d+)"/gi)) {
      const number = Number(match[1]);
      if (Number.isFinite(number) && number > 0) {
        episodesTotal = Math.max(episodesTotal ?? 0, number);
      }
    }

    return { voices, episodesTotal };
  });
}

/**
 * Ищем точное совпадение в AnimeGO. Частичные названия не используем:
 * «Фрирен» легко открывает второй сезон вместо первого.
 */
export async function matchAniBoom(
  names: string[],
  year?: number,
): Promise<AniBoomMatch | null> {
  const wanted = [...new Set(names.map((name) => name.trim()).filter(Boolean))].slice(
    0,
    4,
  );
  if (!wanted.length) return null;

  return withCache(
    `aniboom:match:${wanted.join("|")}:${year ?? ""}`,
    30 * MINUTE,
    async () => {
      let picked: AnimeGoSearchCard | null = null;

      for (const name of wanted) {
        let cards: AnimeGoSearchCard[] = [];
        try {
          cards = await searchAnimeGo(name);
        } catch {
          continue;
        }

        for (const card of cards) {
          if (!wanted.some((item) => titleMatches(card.title, item))) continue;
          if (year && card.year && card.year !== year) continue;
          picked = card;
          break;
        }
        if (picked) break;
      }

      if (!picked) return null;

      const data = await getAnimeGoVoices(picked.animeId);
      if (!data.voices.length) return null;

      return {
        animeId: picked.animeId,
        title: picked.title,
        year: picked.year,
        episodesTotal: data.episodesTotal,
        voices: data.voices,
      };
    },
  );
}

/**
 * Разбираем master m3u8 на готовые варианты. Плеер получает отдельные
 * ссылки 1080/720/480 и переключает качество без уровней hls.js.
 */
async function resolveVariants(masterUrl: string): Promise<Record<string, string>> {
  const { text, finalUrl } = await fetchText(masterUrl, STREAM_HEADERS);
  const lines = text.split(/\r?\n/);
  const variants: Record<string, string> = {};
  // Звук отдельным потоком: прямая ссылка на видео-вариант играла бы без звука
  const separateAudio = lines.some((line) => /^#EXT-X-MEDIA:.*TYPE=AUDIO/i.test(line.trim()));

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXT-X-STREAM-INF")) continue;
    const resolution = /RESOLUTION=\d+x(\d+)/i.exec(line);
    const next = lines[i + 1]?.trim();
    if (!resolution || !next || next.startsWith("#")) continue;

    const height = Number(resolution[1]);
    if (!Number.isFinite(height) || height <= 0) continue;

    try {
      const absolute = new URL(next, finalUrl).toString();
      const key = String(height);
      if (!variants[key]) {
        variants[key] = separateAudio
          ? `${proxied("/api/aniboom/proxy", finalUrl)}&h=${height}`
          : proxied("/api/aniboom/proxy", absolute);
      }
    } catch {
      /* битая строка — пропускаем */
    }
  }

  const result: Record<string, string> = {};
  for (const key of ["1080", "720", "480"]) {
    if (variants[key]) result[key] = variants[key];
  }

  if (!Object.keys(result).length) {
    result["1080"] = proxied("/api/aniboom/proxy", masterUrl);
  }
  return result;
}

/** Резолв выбранной дорожки AniBoom в HLS-варианты */
export async function getAniBoomStream(
  embedUrl: string,
  episode: number,
): Promise<AniBoomStream> {
  const embed = new URL(embedUrl);
  if (embed.protocol !== "https:" && embed.protocol !== "http:") {
    throw new Error("AniBoom: ссылка должна быть http/https");
  }
  if (embed.hostname !== "aniboom.one" && embed.hostname !== "www.aniboom.one") {
    throw new Error("AniBoom: ссылка ведёт не на aniboom.one");
  }
  if (!embed.pathname.startsWith("/embed/")) {
    throw new Error("AniBoom: ссылка не является embed-плеером");
  }
  embed.searchParams.set("episode", String(Math.max(1, Math.trunc(episode))));

  return withCache(
    `aniboom:stream:${episode}:${embed.toString()}`,
    10 * MINUTE,
    async () => {
      const { text } = await fetchText(embed.toString(), EMBED_HEADERS);
      const videoTag = /<video\b[^>]*>/i.exec(text)?.[0];
      if (!videoTag) throw new Error("AniBoom: на странице нет video-тега");

      const attrs = parseAttrs(videoTag);
      const rawParameters = attrs["data-parameters"];
      if (!rawParameters) {
        throw new Error("AniBoom: нет data-parameters");
      }

      let parameters: Record<string, unknown>;
      try {
        parameters = JSON.parse(decodeEntities(rawParameters)) as Record<
          string,
          unknown
        >;
      } catch {
        throw new Error("AniBoom: не разобрал data-parameters");
      }

      let hlsUrl: string | null = null;
      if (typeof parameters.hls === "string") {
        try {
          const parsed = JSON.parse(parameters.hls) as { src?: string };
          hlsUrl = parsed.src?.trim() || null;
        } catch {
          hlsUrl = null;
        }
      }

      if (!hlsUrl) {
        const hasDash = typeof parameters.dash === "string" && parameters.dash;
        throw new Error(
          hasDash
            ? "AniBoom отдал только DASH-поток (HLS не найден)"
            : "AniBoom не отдал HLS-поток",
        );
      }

      const sources = await resolveVariants(hlsUrl);
      const poster =
        typeof parameters.poster === "string" ? parameters.poster : undefined;
      const rawDuration = Number(parameters.duration);
      const duration =
        Number.isFinite(rawDuration) && rawDuration > 0
          ? Math.trunc(rawDuration)
          : undefined;

      return { sources, poster, duration };
    },
  );
}
