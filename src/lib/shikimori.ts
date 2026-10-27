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

/* ------------------------ Следующая серия ------------------------ */

interface AnimeDto {
  status?: string;
  episodes?: number;
  episodes_aired?: number;
  next_episode_at?: string | null;
}

export interface NextEpisode {
  /** Момент выхода, ISO-строка */
  at: string;
  /** Номер ближайшей серии */
  episode: number;
  /** Всего серий, если число известно */
  total?: number;
}

/**
 * Когда выйдет следующая серия. Shikimori отдаёт `next_episode_at` только
 * для идущих тайтлов; у завершённых и анонсов поля нет — тогда null и плашка
 * на странице не показывается. Дата в прошлом тоже отбрасывается: серия уже
 * вышла, а Shikimori ещё не обновил расписание.
 */
export async function nextEpisode(shikimoriId?: number): Promise<NextEpisode | null> {
  if (!shikimoriId) return null;
  try {
    return await memo(`shikimori:next:${shikimoriId}`, 15 * MINUTE, async () => {
      const anime = await api<AnimeDto>(`/api/animes/${shikimoriId}`);
      if (!anime.next_episode_at) return null;
      if (new Date(anime.next_episode_at).getTime() < Date.now() - 6 * 60 * 60 * 1000) return null;
      return {
        at: anime.next_episode_at,
        episode: (anime.episodes_aired ?? 0) + 1,
        total: anime.episodes && anime.episodes > 0 ? anime.episodes : undefined,
      } satisfies NextEpisode;
    });
  } catch {
    return null;
  }
}

/* ------------------------- Календарь выхода ------------------------- */

interface CalendarDto {
  next_episode?: number;
  next_episode_at?: string;
  anime?: {
    id?: number;
    name?: string;
    russian?: string;
    image?: { original?: string; preview?: string };
    kind?: string;
    score?: string;
    episodes?: number;
    episodes_aired?: number;
  };
}

export interface CalendarEntry {
  shikimoriId: number;
  /** Момент выхода серии, ISO */
  at: string;
  episode: number;
  total?: number;
  title: string;
  image?: string;
  score?: number;
}

/** Ближайшие серии идущих тайтлов (около двух недель вперёд) */
export async function calendar(): Promise<CalendarEntry[]> {
  return memo("shikimori:calendar", 15 * MINUTE, async () => {
    const rows = await api<CalendarDto[]>("/api/calendar?censored=true");
    const out: CalendarEntry[] = [];
    for (const row of rows) {
      const anime = row.anime;
      if (!anime?.id || !row.next_episode_at || !row.next_episode) continue;
      out.push({
        shikimoriId: anime.id,
        at: row.next_episode_at,
        episode: row.next_episode,
        total: anime.episodes && anime.episodes > 0 ? anime.episodes : undefined,
        title: anime.russian || anime.name || "",
        image: anime.image?.original ? asset(anime.image.original) : undefined,
        score: anime.score ? Number(anime.score) || undefined : undefined,
      });
    }
    return out;
  });
}


/* --------------------- Публичный список пользователя ----------------- */

export interface UserRate {
  sid: number;
  title: string;
  status: string;
  score: number;
}

interface RateDto {
  score?: number;
  status?: string;
  target_type?: string;
  anime?: { id?: number; name?: string; russian?: string };
}

interface FavouritesDto {
  animes?: { id?: number; name?: string; russian?: string }[];
}

/** Список аниме и избранное с публичного профиля Shikimori по нику */
export async function userLists(nick: string): Promise<{ rates: UserRate[]; favourites: UserRate[] }> {
  const id = encodeURIComponent(nick);
  const rows: RateDto[] = [];
  for (let page = 1; page <= 4; page += 1) {
    const chunk = await api<RateDto[]>(
      `/api/users/${id}/anime_rates?is_nickname=1&limit=1000&page=${page}`,
    );
    rows.push(...chunk);
    if (chunk.length < 1000) break;
  }
  const rates: UserRate[] = [];
  for (const row of rows) {
    const sid = Number(row.anime?.id);
    if (!Number.isFinite(sid) || sid <= 0) continue;
    rates.push({
      sid,
      title: row.anime?.russian || row.anime?.name || "",
      status: row.status ?? "planned",
      score: Number(row.score) || 0,
    });
  }
  let favourites: UserRate[] = [];
  try {
    const fav = await api<FavouritesDto>(`/api/users/${id}/favourites?is_nickname=1`);
    favourites = (fav.animes ?? [])
      .filter((a) => Number(a.id) > 0)
      .map((a) => ({ sid: Number(a.id), title: a.russian || a.name || "", status: "planned", score: 0 }));
  } catch {
    /* избранное необязательно */
  }
  return { rates, favourites };
}
