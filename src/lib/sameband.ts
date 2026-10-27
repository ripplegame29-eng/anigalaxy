import "server-only";
import { withCache } from "@/lib/kodik";
import { proxied } from "@/lib/stream-proxy";
import type { AniSearchCard, AniTitleDetail } from "@/lib/anilibria";
import type { SameBandMatch } from "@/lib/types";

/**
 * SameBand (sameband.studio) — DLE-каталог с прямыми HLS-сериями.
 *
 * У сайта нет публичного API: поиск — POST на index.php?do=search, страница
 * тайтла содержит iframe плеера, плеер — ссылку на playlist.txt, а playlist —
 * JSON с `file: "[480p]/v/...m3u8,[720p]/...,[1080p]/..."`.
 *
 * Парсим HTML регулярками: структура DLE стабильна, а тянуть cheerio ради
 * нескольких селекторов не хочется. Все ссылки на видео заворачиваем в
 * /api/sameband/proxy — у SameBand нет CORS.
 */

const BASE = "https://sameband.studio";
const MINUTE = 60_000;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface SearchCard {
  title: string;
  url: string;
  poster?: string;
  year?: number;
}

interface PageInfo {
  title: string;
  poster?: string;
  description?: string;
  year?: number;
  playerUrl: string;
}

interface PlaylistItem {
  title?: string;
  file?: string;
  thumbnails?: string;
}

export interface SameBandDetail extends AniTitleDetail {
  description?: string;
  url: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  laquo: "«",
  lt: "<",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  raquo: "»",
  hellip: "…",
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (match, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    })
    .replace(/&#(\d+);/g, (match, decimal: string) => {
      const code = Number.parseInt(decimal, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    })
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

function stripTags(value: string): string {
  return decodeEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function absolute(value: string, base = BASE): string {
  try {
    return new URL(decodeEntities(value), base).toString();
  } catch {
    return value;
  }
}

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("ru")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Совпадение названий как набора слов: «Фрирен: провожающая…» = «Провожающая… Фрирен» */
function sameTokens(a: string, b: string): boolean {
  const left = a.split(" ").filter(Boolean).sort().join(" ");
  const right = b.split(" ").filter(Boolean).sort().join(" ");
  return left.length > 0 && left === right;
}

function isSameBandUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "sameband.studio" || url.hostname.endsWith(".sameband.studio"));
  } catch {
    return false;
  }
}

/**
 * Cloudflare/DLE ставят cookie уже на первом запросе. Без общей банки
 * страница плеера и playlist.txt могут ответить 403 — Python-клиент
 * anicli-api хранит их в httpx.Client, поэтому повторяем это поведение.
 */
const cookieJar = new Map<string, Map<string, string>>();

function cookieHeader(url: URL): string | undefined {
  const jar = cookieJar.get(url.hostname);
  if (!jar?.size) return undefined;
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function rememberCookies(url: URL, response: Response): void {
  const raw = response.headers.get("set-cookie");
  if (!raw) return;
  const jar = cookieJar.get(url.hostname) ?? new Map<string, string>();
  // Set-Cookie может склеиться в одну строку; Expires тоже содержит запятую,
  // поэтому режем только перед началом следующей пары name=value.
  for (const part of raw.split(/,(?=\s*[^;,=]+=)/)) {
    const pair = part.split(";")[0]?.trim();
    const eq = pair?.indexOf("=") ?? -1;
    if (!pair || eq <= 0) continue;
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  if (jar.size) cookieJar.set(url.hostname, jar);
}

async function fetchText(
  url: string,
  init: { referer?: string; method?: "GET" | "POST"; body?: URLSearchParams } = {},
): Promise<string> {
  if (!isSameBandUrl(url)) throw new Error("SameBand: недопустимый адрес");
  const target = new URL(url);
  const cookie = cookieHeader(target);
  const response = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      "accept-language": "ru-RU,ru;q=0.9,en;q=0.8",
      referer: init.referer ?? `${BASE}/`,
      ...(cookie ? { cookie } : {}),
      ...(init.body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    body: init.body,
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(25_000),
  });
  rememberCookies(target, response);
  if (!response.ok) {
    throw new Error(`SameBand ответил HTTP ${response.status}`);
  }
  return response.text();
}

function parseSearch(html: string): SearchCard[] {
  const cards: SearchCard[] = [];
  /**
   * anicli-api берёт все `.col-auto`, а не только `<article>`: DLE может
   * отдать карточку div'ом или li. Идём по началам карточек, чтобы не
   * зависеть от вложенности тегов.
   */
  const starts = [...html.matchAll(/<(article|div|li)\b[^>]*class="[^"]*\bcol-auto\b[^"]*"[^>]*>/gi)];

  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index].index ?? 0;
    const next = starts[index + 1]?.index ?? Math.min(start + 6000, html.length);
    const body = html.slice(start, next);

    const titleRaw =
      /<[a-z0-9]+[^>]*class="[^"]*\bposter\b[^"]*"[^>]*\btitle="([^"]*)"/i.exec(body)?.[1] ??
      /<[a-z0-9]+[^>]*\btitle="([^"]*)"[^>]*class="[^"]*\bposter\b[^"]*"/i.exec(body)?.[1] ??
      /<[a-z0-9]+[^>]*class="[^"]*\binfo-title\b[^"]*"[^>]*>([\s\S]*?)<\/[a-z0-9]+>/i.exec(body)?.[1];
    if (!titleRaw) continue;

    const href =
      /<[a-z0-9]+[^>]*class="[^"]*\bimage\b[^"]*"[^>]*\bhref="([^"]+)"/i.exec(body)?.[1] ??
      /<[a-z0-9]+[^>]*\bhref="([^"]+)"[^>]*class="[^"]*\bimage\b[^"]*"/i.exec(body)?.[1];
    if (!href) continue;

    const image =
      /<img[^>]*class="[^"]*\bswiper-lazy\b[^"]*"[^>]*\bsrc="([^"]+)"/i.exec(body)?.[1] ??
      /<img[^>]*\bsrc="([^"]+)"[^>]*class="[^"]*\bswiper-lazy\b[^"]*"/i.exec(body)?.[1] ??
      /<img[^>]*\bsrc="([^"]+)"/i.exec(body)?.[1];

    const yearRaw = /(\d{4})\s*г\./i.exec(stripTags(body))?.[1];
    const year = yearRaw ? Number(yearRaw) : undefined;

    cards.push({
      title: stripTags(titleRaw),
      url: absolute(href),
      poster: image ? absolute(image) : undefined,
      year: Number.isFinite(year) ? year : undefined,
    });
  }

  return cards;
}

/** Поиск по каталогу. Возвращает уже разобранные карточки. */
export async function searchSameBand(query: string): Promise<SameBandMatch[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  return withCache(`sameband:search:${q.toLowerCase()}`, 30_000, async () => {
    const body = new URLSearchParams({
      do: "search",
      subaction: "search",
      search_start: "0",
      full_search: "0",
      result_from: "1",
      story: q,
    });
    const html = await fetchText(`${BASE}/index.php?do=search`, {
      method: "POST",
      body,
      referer: `${BASE}/`,
    });
    return parseSearch(html).map((card) => ({
      url: card.url,
      title: card.title,
      poster: card.poster,
      year: card.year,
    }));
  });
}

/**
 * Подбор тайтла по названию/году. SameBand не отдаёт Shikimori id, поэтому
 * сравниваем нормализованные названия: точное совпадение обязательно.
 * Иначе легко открыть соседний сезон («Ванпанчмен 3» вместо «Ванпанчмен»).
 *
 * «Не найдено» не кэшируем на полчаса: сайт может быть временно недоступен,
 * и тогда кнопка источника не появится даже после восстановления.
 * Ошибку-пустышку withCache не запоминает.
 */
class SameBandNoMatch extends Error {}

export async function matchSameBand(names: string[], year?: number): Promise<SameBandMatch | null> {
  const wanted = names
    .map((name) => normalize(name))
    .filter((name) => name.length >= 2)
    .slice(0, 3);
  if (!wanted.length) return null;

  try {
    return await withCache(`sameband:match:${wanted.join("|")}:${year ?? ""}`, 30 * MINUTE, async () => {
      const seen = new Set<string>();
      let best: { card: SameBandMatch; score: number } | null = null;
      let searchSuccesses = 0;
      let lastSearchError: unknown;

      for (const query of names) {
        let cards: SameBandMatch[];
        try {
          cards = await searchSameBand(query);
          searchSuccesses += 1;
        } catch (error) {
          lastSearchError = error;
          continue;
        }

        for (const card of cards) {
          if (seen.has(card.url)) continue;
          seen.add(card.url);

          const title = normalize(card.title);
          if (!title) continue;

          // Только точное название. Частичное совпадение («Ванпанчмен» →
          // «Ванпанчмен 3») легко открывает соседний сезон. Порядок слов
          // не важен: Kodik зовёт тайтл «Провожающая… Фрирен», а SameBand —
          // «Фрирен: провожающая…»; набор слов при этом тот же.
          const titleNoYear = title.replace(/\s+(?:19|20)\d{2}$/, "").trim();
          const exact = wanted.some(
            (item) =>
              item === title ||
              sameTokens(item, title) ||
              (card.year && (item === titleNoYear || sameTokens(item, titleNoYear))),
          );
          if (!exact) continue;

          // Если у карточки и у запроса есть год, они должны совпасть:
          // ремейк с тем же названием — не тот тайтл.
          if (year && card.year && card.year !== year) continue;

          const score = 100 + (year && card.year === year ? 30 : 0);
          if (!best || score > best.score) {
            best = { card, score };
          }
        }
      }

      if (!best) {
        // Если не ответил ни один поиск, это сбой SameBand, а не «нет тайтла».
        // Пробрасываем ошибку: маршрут отдаст 502, и клиент повторит в фоне.
        if (!searchSuccesses && lastSearchError) throw lastSearchError;
        throw new SameBandNoMatch();
      }
      return best.card;
    });
  } catch (error) {
    if (error instanceof SameBandNoMatch) return null;
    throw error;
  }
}

function parsePage(html: string, pageUrl: string): PageInfo {
  const titleRaw =
    /<h1[^>]*class="[^"]*\bp-0\b[^"]*\bm-0\b[^"]*"[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ??
    /<h1[^>]*class="[^"]*\bm-0\b[^"]*\bp-0\b[^"]*"[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ??
    /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ??
    /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  if (!titleRaw) throw new Error("SameBand: не удалось разобрать название");

  const posterRaw =
    /<[a-z0-9]+[^>]*class="[^"]*\bimage\b[^"]*"[^>]*>[\s\S]{0,2000}?<img[^>]*\bsrc="([^"]+)"/i.exec(html)?.[1] ??
    /<img[^>]*class="[^"]*\bposter\b[^"]*"[^>]*\bsrc="([^"]+)"/i.exec(html)?.[1];

  const iframeRaw =
    /<[a-z0-9]+[^>]*class="[^"]*\bplayer-content\b[^"]*"[^>]*>[\s\S]*?<iframe[^>]*\bsrc="([^"]+)"/i.exec(html)?.[1] ??
    /<[a-z0-9]+[^>]*class="[^"]*\bplayer\b[^"]*"[^>]*>[\s\S]*?<iframe[^>]*\bsrc="([^"]+)"/i.exec(html)?.[1];
  if (!iframeRaw) throw new Error("SameBand: на странице нет плеера");

  // .limiter может содержать вложенные div, поэтому берём кусок от его
  // открывающего тега, а не до первого </div>.
  const limiter = /<[a-z0-9]+[^>]*class="[^"]*\blimiter\b[^"]*"[^>]*>/i.exec(html);
  const descriptionBlock = limiter ? html.slice(limiter.index, limiter.index + 8000) : "";
  const description = [...descriptionBlock.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripTags(match[1] ?? ""))
    .filter(Boolean)
    .join(" ");

  const yearRaw = /(\d{4})\s*г\./i.exec(stripTags(html))?.[1];
  const year = yearRaw ? Number(yearRaw) : undefined;

  return {
    title: stripTags(titleRaw),
    poster: posterRaw ? absolute(posterRaw, pageUrl) : undefined,
    description: description || undefined,
    year: Number.isFinite(year) ? year : undefined,
    playerUrl: absolute(iframeRaw, pageUrl),
  };
}

function qualitySources(
  file: string,
  baseUrl: string,
): { "480"?: string; "720"?: string; "1080"?: string } {
  const sources: { "480"?: string; "720"?: string; "1080"?: string } = {};
  for (const part of file.split(",")) {
    const match = /^\s*\[(\d+)p\]\s*(.+?)\s*$/.exec(part);
    if (!match) continue;
    const quality = match[1];
    if (quality !== "480" && quality !== "720" && quality !== "1080") continue;
    const url = absolute(match[2], baseUrl);
    sources[quality] = proxied("/api/sameband/proxy", url);
  }
  return sources;
}

/** Страница тайтла + серии с уже проксированными HLS-ссылками */
export async function getSameBandDetail(pageUrl: string): Promise<SameBandDetail> {
  const url = pageUrl.trim();
  if (!url) throw new Error("SameBand: не указан адрес тайтла");
  if (!isSameBandUrl(url)) throw new Error("SameBand: недопустимый адрес тайтла");

  return withCache(`sameband:detail:${url}`, 10 * MINUTE, async () => {
    const pageHtml = await fetchText(url, { referer: `${BASE}/` });
    const page = parsePage(pageHtml, url);

    const playerHtml = await fetchText(page.playerUrl, { referer: url });
    const playlistPath = /Playerjs\s*\(\s*\{[\s\S]*?\bfile\s*:\s*["']([^"']+)["']/i.exec(playerHtml)?.[1];
    if (!playlistPath) throw new Error("SameBand: плеер не отдал playlist");

    const playlistUrl = absolute(playlistPath, page.playerUrl);
    const playlistText = await fetchText(playlistUrl, { referer: page.playerUrl });
    let raw: PlaylistItem[];
    try {
      const parsed = JSON.parse(playlistText.replace(/^\uFEFF/, "")) as
        | PlaylistItem[]
        | { playlist?: PlaylistItem[] };
      raw = Array.isArray(parsed) ? parsed : parsed.playlist ?? [];
    } catch {
      throw new Error("SameBand: playlist не является JSON");
    }
    if (!Array.isArray(raw) || !raw.length) throw new Error("SameBand: playlist пуст");

    const episodes = raw
      .map((item, index) => {
        const sources = qualitySources(item.file ?? "", playlistUrl);
        if (!Object.keys(sources).length) return null;
        return {
          id: String(index + 1),
          number: index + 1,
          sources,
        };
      })
      .filter((item): item is { id: string; number: number; sources: { "480"?: string; "720"?: string; "1080"?: string } } => item !== null);

    if (!episodes.length) throw new Error("SameBand: серии не найдены");

    const card: AniSearchCard = {
      id: `sameband:${url}`,
      alias: url,
      title: page.title,
      year: page.year,
      poster: page.poster,
      description: page.description,
      genres: [],
      episodesTotal: episodes.length,
    };

    return {
      card,
      episodes,
      episodesTotal: episodes.length,
      description: page.description,
      url,
    };
  });
}
