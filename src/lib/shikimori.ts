/**
 * Серверный клиент Shikimori API.
 *
 * Нужен ровно для двух вещей на странице тайтла:
 *   - «Кадры из аниме» (`/api/animes/{id}/screenshots`, 29–40 картинок);
 *   - трейлер (`/api/animes/{id}/videos` — там лежат YouTube-ролики,
 *     часто с русскими названиями: «Трейлер Animax», «Тизер (AniLot) Озвучка»).
 *
 * ID берём из Kodik (`shikimori_id`), поэтому отдельной склейки баз не нужно.
 *
 * Важный нюанс: на машине работает системный прокси, которым пользуется
 * PowerShell, но не Node. `shikimori.one` в обход прокси не резолвится,
 * а `shikimori.io` (тот же API, тот же формат ответа) — резолвится.
 * Поэтому пробуем несколько origin'ов и запоминаем рабочий.
 */
import "server-only";

const MINUTE = 60_000;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const PRIMARY = process.env.SHIKIMORI_API_URL ?? "https://shikimori.io";
const ORIGINS = [...new Set([PRIMARY, "https://shikimori.io", "https://shikimori.one"])];

/** origin, на котором в последний раз получился ответ */
let healthy: string | undefined;

/* --------------------- Отрицательный кэш ошибок ---------------------- */

const memoCache = new Map<string, { at: number; value?: unknown; error?: string }>();
/** Пока Shikimori лежит — не дёргаем его заново на каждый запрос страницы */
const NEGATIVE_TTL = 30_000;

async function memo<T>(key: string, ttlMs: number, producer: () => Promise<T>): Promise<T> {
  const hit = memoCache.get(key);
  const now = Date.now();

  if (hit) {
    if (hit.error && now - hit.at < NEGATIVE_TTL) throw new Error(hit.error);
    if (hit.value !== undefined && now - hit.at < ttlMs) return hit.value as T;
  }

  try {
    const value = await producer();
    if (memoCache.size > 300) memoCache.clear();
    memoCache.set(key, { at: now, value });
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    memoCache.set(key, { at: now, error: message });
    throw error;
  }
}

/* ---------------------------- HTTP слой ------------------------------ */

async function api<T>(path: string): Promise<T> {
  const order = healthy
    ? [healthy, ...ORIGINS.filter((origin) => origin !== healthy)]
    : ORIGINS;

  let lastError: unknown;
  for (const origin of order) {
    try {
      const res = await fetch(origin + path, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Shikimori ответил ${res.status}`);
      healthy = origin;
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Shikimori недоступен: ${String(lastError).slice(0, 120)}`);
}

/** Ссылка на ассет относительно того origin'а, что сейчас жив */
function asset(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${healthy ?? PRIMARY}${path}`;
}

/* ----------------------------- Кадры --------------------------------- */

interface ScreenshotDto {
  original?: string;
  preview?: string;
}

export interface Shot {
  url: string;
  thumb: string;
}

/** Кадры тайтла с Shikimori. Пусто при ошибке — страница откатится на Kodik. */
export async function screenshots(shikimoriId?: number): Promise<Shot[]> {
  if (!shikimoriId) return [];

  return memo(`shikimori:screenshots:${shikimoriId}`, 60 * MINUTE, async () => {
    const rows = await api<ScreenshotDto[]>(`/api/animes/${shikimoriId}/screenshots`);
    const seen = new Set<string>();
    const shots: Shot[] = [];

    for (const row of rows) {
      const url = row.original ? asset(row.original) : "";
      if (!url || seen.has(url)) continue;
      seen.add(url);
      shots.push({ url, thumb: row.preview ? asset(row.preview) : url });
    }
    return shots;
  });
}

/* ---------------------------- Трейлеры ------------------------------- */

interface VideoDto {
  url?: string;
  player_url?: string;
  name?: string;
  kind?: string;
  hosting?: string;
}

export interface Trailer {
  /** id ролика на YouTube */
  id: string;
  /** подпись ролика из Shikimori */
  title: string;
  /** превью с YouTube */
  poster: string;
}

const YT_RE = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|watch\?v=))([A-Za-z0-9_-]{11})/;

/** Какие форматы вообще считаем трейлером (против опенингов/превью серий) */
const TRAILER_KINDS = new Set(["trailer", "pv", "preview", "anime_pv"]);

function youtubeId(...links: (string | undefined)[]): string | undefined {
  for (const link of links) {
    const match = link ? YT_RE.exec(link) : null;
    if (match) return match[1];
  }
  return undefined;
}

/** Чем русскоязычнее и «трейлернее» — тем выше */
function score(kind: string, name: string): number {
  let value = 0;

  if (kind === "trailer") value += 6;
  else if (kind === "pv") value += 5;
  else if (kind === "preview") value += 4;
  else value -= 4; // опенинги, эндинги, превью серий

  if (/[\u0400-\u04FF]/.test(name)) value += 4;
  if (/озвуч|дубляж|на русском/i.test(name)) value += 4;
  if (/трейлер/i.test(name)) value += 3;
  if (/тизер/i.test(name)) value += 2;
  if (/субтитры|\bsub\b|\bdub\b|crunchyroll|wakanim|netflix|funimation/i.test(name)) {
    value -= 3;
  }
  return value;
}

function pickFromVideos(videos: VideoDto[]): Trailer | null {
  const withId = videos
    .map((video) => ({
      video,
      id: youtubeId(video.url, video.player_url),
    }))
    .filter((row): row is { video: VideoDto; id: string } => Boolean(row.id));

  const preferred = withId.filter((row) => TRAILER_KINDS.has(row.video.kind ?? ""));
  const pool = preferred.length ? preferred : withId;
  if (!pool.length) return null;

  const best = pool
    .map((row) => ({ ...row, value: score(row.video.kind ?? "", row.video.name ?? "") }))
    .sort((a, b) => b.value - a.value)[0];

  return {
    id: best.id,
    title: best.video.name?.trim() || "Трейлер",
    poster: `https://i.ytimg.com/vi/${best.id}/hqdefault.jpg`,
  };
}

/* ------------- Запасной путь: поиск трейлера на YouTube --------------- */

async function youtubeSearch(query: string): Promise<Trailer | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      {
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "ru-RU,ru;q=0.9" },
        signal: AbortSignal.timeout(6_000),
        cache: "no-store",
      },
    );
    if (!res.ok) return null;

    const html = await res.text();
    const pairs = html.matchAll(
      /"videoRenderer":\{"videoId":"([^"]{11})"[\s\S]{0,800}?"title":\{"runs":\[\{"text":"([^"]{2,160})"/g,
    );

    for (const match of pairs) {
      const [, id, title] = match;
      if (!/трейлер|тизер|официальн|\bpv\b/i.test(title)) continue;
      if (/тон-?[а-я]*трейлер/i.test(title)) continue;
      return { id, title: title.replace(/\\u0026/g, "&"), poster: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
    }
  } catch {
    /* YouTube не ответил — трейлера просто не будет */
  }
  return null;
}

/**
 * Трейлер тайтла: сначала YouTube-ролики из Shikimori (там уже есть
 * русские озвучки), затем — поиск на YouTube по названию.
 */
export async function trailer(
  shikimoriId: number | undefined,
  title: string,
): Promise<Trailer | null> {
  if (!shikimoriId && !title) return null;

  const key = `shikimori:trailer:${shikimoriId ?? title}`;
  try {
    return await memo(key, 60 * MINUTE, async () => {
      if (shikimoriId) {
        try {
          const videos = await api<VideoDto[]>(`/api/animes/${shikimoriId}/videos`);
          const picked = pickFromVideos(videos);
          if (picked) return picked;
        } catch {
          /* Shikimori лёг — уходим на поиск YouTube */
        }
      }
      return youtubeSearch(`${title} трейлер официальный`);
    });
  } catch {
    return null;
  }
}
