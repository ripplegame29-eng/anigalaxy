/**
 * Серверный клиент Kodik API.
 *
 * Все запросы идут с бэкенда Next.js (Route Handlers / Server Components),
 * поэтому API-токен никогда не попадает в браузер, а CORS не возникает.
 *
 * Документация: https://bd.kodikres.com/api/info
 * Базовый адрес: https://kodik-api.com (методы принимают POST).
 */
import "server-only";
import { absoluteUrl, cardKey, dedupeCards, toCard } from "./anime";
import type {
  AnimeCard,
  CatalogQuery,
  KodikListResponse,
  KodikResult,
  KodikSearchResponse,
  KodikSeasonsMap,
  KodikTranslation,
  SeasonRef,
  TranslationOption,
  TitleDetail,
} from "./types";

const BASE_URL = process.env.KODIK_API_URL ?? "https://kodik-api.com";
const TOKEN = process.env.KODIK_TOKEN ?? "1bbfc5f8aac7419ba7f482ad7859cfb6";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/* ------------------------------------------------------------------ */
/* Маленький TTL-кэш в памяти процесса                                  */
/* ------------------------------------------------------------------ */

interface CacheEntry {
  expires: number;
  value: unknown;
}

const memoryCache = new Map<string, CacheEntry>();

/** Чтение из кэша (undefined — промах) */
function cacheGet<T>(key: string): T | undefined {
  const hit = memoryCache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    memoryCache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function cacheSet(key: string, value: unknown, ttlMs: number): void {
  // Не даём кэшу разрастись без ограничений
  if (memoryCache.size > 500) memoryCache.clear();
  memoryCache.set(key, { expires: Date.now() + ttlMs, value });
}

/** Обёртка над любым запросом с кэшированием (её же использует shikimori.ts) */
export async function withCache<T>(key: string, ttlMs: number, producer: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;
  const value = await producer();
  cacheSet(key, value, ttlMs);
  return value;
}

/* ------------------------------------------------------------------ */
/* Базовый запрос                                                       */
/* ------------------------------------------------------------------ */

const MINUTE = 60_000;

class KodikError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
    this.name = "KodikError";
  }
}

/** Выполняет POST-запрос к Kodik API и возвращает распарсенный JSON */
async function kodikPost<T>(
  path: string,
  params: Record<string, string | number | undefined | null> = {},
): Promise<T> {
  const search = new URLSearchParams();
  search.set("token", TOKEN);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    search.set(k, String(v));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(`${BASE_URL}/${path}?${search.toString()}`, {
      method: "POST",
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
      // Свой кэш Next.js не работает с POST — полагаемся на withCache
      cache: "no-store",
    });

    if (!res.ok) throw new KodikError(`Kodik API вернул ${res.status} для /${path}`);

    const data = (await res.json()) as T & { error?: string };
    if (data && typeof data === "object" && "error" in data && data.error) {
      throw new KodikError(`Kodik API: ${data.error}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Публичные методы API                                                 */
/* ------------------------------------------------------------------ */

/** Расширенный поиск (заголовок, фильтры) */
export function search(params: Record<string, string | number | undefined | null>): Promise<KodikSearchResponse> {
  return kodikPost<KodikSearchResponse>("search", {
    with_material_data: 1,
    limit: 10,
    ...params,
  });
}

/** Список материалов с пагинацией-курсором */
export function list(params: Record<string, string | number | undefined | null>): Promise<KodikListResponse> {
  return kodikPost<KodikListResponse>("list", {
    with_material_data: 1,
    limit: 24,
    ...params,
  });
}

/** Быстрый поиск для шапки (только нужные поля) */
export async function quickSearch(q: string, limit = 8): Promise<AnimeCard[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const key = `quick:${query.toLowerCase()}:${limit}`;

  return withCache(key, 5 * MINUTE, async () => {
    // Kodik склеивает один тайтл десятками material-id и урезает выдачу
    // до ~100 записей, поэтому тянем всё и отбираем уникальные.
    const res = await search({
      title: query,
      limit: 100,
      types: "anime,anime-serial",
      with_material_data: 1,
    });
    return dedupeCards(res.results.map(toCard)).slice(0, limit);
  });
}

/* ------------------------------------------------------------------ */
/* Каталог                                                              */
/* ------------------------------------------------------------------ */

const SORT_MAP: Record<string, { sort?: string; order?: "asc" | "desc" }> = {
  rating: { sort: "shikimori_rating", order: "desc" },
  kinopoisk: { sort: "kinopoisk_rating", order: "desc" },
  updated: { sort: "updated_at", order: "desc" },
  fresh: { sort: "created_at", order: "desc" },
  year: { sort: "year", order: "desc" },
  title: { sort: "title", order: "asc" },
};

/** Раскладка query-параметров страницы каталога в параметры Kodik */
export function catalogParams(q: CatalogQuery): Record<string, string | number | undefined> {
  const types =
    q.type === "serial" ? "anime-serial" : q.type === "movie" ? "anime" : "anime,anime-serial";

  // Годы Kodik принимает только списком — разворачиваем диапазон
  let years: string | undefined;
  if (q.yearFrom || q.yearTo) {
    const from = Math.max(q.yearFrom ?? 1970, 1960);
    const to = Math.min(q.yearTo ?? new Date().getFullYear(), new Date().getFullYear() + 1);
    if (from <= to && to - from <= 70) {
      years = Array.from({ length: to - from + 1 }, (_, i) => from + i).join(",");
    }
  }

  const sortCfg = SORT_MAP[q.sort ?? "rating"] ?? SORT_MAP.rating;

  return {
    types,
    // `title` понимает только /search — для /list это лишний параметр
    title: q.q?.trim() || undefined,
    anime_kind: q.kind || undefined,
    anime_status: q.status || undefined,
    all_genres: q.genre || undefined,
    year: years,
    sort: sortCfg.sort,
    order: sortCfg.order,
    with_material_data: 1,
  };
}

/* ------------------------------------------------------------------ */
/* Добор страниц под дедупликацию                                       */
/* ------------------------------------------------------------------ */

/**
 * Kodik возвращает один и тот же тайтл разными material-id (по записи на
 * каждую озвучку). При сортировке по рейтингу дубли идут подряд, поэтому
 * одной страницы мало: добираем страницы, пока не наберётся `want`
 * уникальных карточек (или не кончится курсор).
 *
 * Курсор всегда указывает на страницу ПОСЛЕ полностью потреблённой —
 * поэтому ни одна запись не теряется при «Показать ещё».
 */
const PAGE_LIMIT = 100; // Kodik отдаёт максимум 100 за запрос
const MAX_PAGES = 6;

interface Collected {
  cards: AnimeCard[];
  total: number;
  next: string | null;
}

async function collectUnique(
  params: Record<string, string | number | undefined | null>,
  cursor: string | undefined,
  want: number,
  maxPages = MAX_PAGES,
): Promise<Collected> {
  const seen = new Set<string>();
  const cards: AnimeCard[] = [];
  let total = 0;
  let next: string | null = null;
  let token = cursor;

  for (let page = 0; page < maxPages; page++) {
    const res = await list({ ...params, limit: PAGE_LIMIT, next: token });
    total = res.total;

    for (const r of res.results) {
      const card = toCard(r);
      const key = cardKey(card);
      if (seen.has(key)) continue;
      seen.add(key);
      cards.push(card);
    }

    // Страница потреблена целиком — следующий запрос начнётся после неё
    next = extractCursor(res.next_page);
    if (cards.length >= want || !next) break;
    token = next;
  }

  return { cards, total, next };
}

/**
 * Kodik считает `total` по сырым material-записям (один тайтл — до дюжины
 * записей). Когда выдача исчерпана целиком, число уникальных тайтлов уже у
 * нас в руках — подставляем его вместо завышенного счётчика. Пока страницы
 * остались, оставляем сырое число как верхнюю границу.
 */
function finalizeTotal(collected: Collected, isCursorPage: boolean): Collected {
  if (isCursorPage || collected.next !== null) return collected;
  return { ...collected, total: collected.cards.length };
}

/** Карточки каталога (первый экран или догрузка по курсору) */
export async function catalog(
  q: CatalogQuery,
): Promise<{ cards: AnimeCard[]; total: number; next: string | null }> {
  const params = catalogParams(q);
  const key = `catalog:${JSON.stringify(params)}:${q.cursor ?? ""}`;

  return withCache(key, 3 * MINUTE, async () => {
    // Поиск по названию работает только через /search: он отдаёт все
    // совпадения разом (курсора не имеет), зато честно фильтрует.
    if (q.q?.trim()) {
      const res = await search({ ...params, title: q.q.trim(), limit: 200 });
      const cards = dedupeCards(res.results.map(toCard));
      return {
        cards,
        // Kodik считает по material-id, а показываем мы уникальные тайтлы
        total: cards.length || res.total,
        next: null,
      };
    }

    try {
      return finalizeTotal(await collectUnique(params, q.cursor, 24), Boolean(q.cursor));
    } catch (error) {
      // Протухший или подделанный курсор — Kodik отвечает 400.
      // Вместо 502 отдаём первый экран каталога.
      if (q.cursor) return finalizeTotal(await collectUnique(params, undefined, 24), false);
      throw error;
    }
  });
}

/** В out-URL Kodik лежит готовый query — вытаскиваем из него курсор `next` */
function extractCursor(nextPage: string | null): string | null {
  if (!nextPage) return null;
  try {
    return new URL(nextPage).searchParams.get("next");
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Тайтл: детали, серии, озвучки                                        */
/* ------------------------------------------------------------------ */

/** Сырой материал по его id («serial-75224», «movie-116675») */
async function fetchResult(id: string): Promise<KodikResult | undefined> {
  const key = `result:${id}`;
  const res = await withCache(key, 5 * MINUTE, () =>
    search({ id, with_material_data: 1, with_seasons: 1, with_episodes: 1 }),
  );
  return res.results?.[0];
}

/** Превращает сезоны Kodik в удобный для плеера вид */
function parseSeasons(seasons?: KodikSeasonsMap): SeasonRef[] {
  if (!seasons) return [];
  return Object.entries(seasons)
    .map(([number, season]) => ({
      number: Number(number),
      title: season.title,
      episodes: Object.entries(season.episodes ?? {})
        .map(([epNumber, ep]) => ({
          number: Number(epNumber),
          link: typeof ep === "string" ? ep : ep.link,
          title: typeof ep === "string" ? undefined : ep.title,
        }))
        .sort((a, b) => a.number - b.number),
    }))
    .sort((a, b) => a.number - b.number);
}

/** Детали тайтла: карточка + сезоны с сериями */
export async function getTitleDetail(id: string): Promise<TitleDetail | null> {
  if (!/^(serial|movie)-\d+$/.test(id)) return null;

  const r = await fetchResult(id);
  if (!r) return null;

  const seasons = parseSeasons(r.seasons);
  const isSerial = r.type === "anime-serial" && seasons.length > 0;

  return {
    card: toCard(r),
    isSerial,
    seasons,
    playerLink: absoluteUrl(r.link),
  };
}

/* ----------------------------- Озвучки ---------------------------- */

const TRANSLATION_OPTION_RE = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;

/** Достаёт значение атрибута из разметки тега */
function attr(source: string, name: string): string | undefined {
  const m = source.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i"));
  return m?.[1];
}

/**
 * Список озвучек тайтла.
 *
 * В самой Kodik API отдельного «списка переводов тайтла» нет — он есть на
 * странице плеера в виде <select class="...-translations-box">, где каждый
 * option хранит id материала с этой озвучкой. Парсим её и строим ссылки.
 */
export async function getTranslations(id: string): Promise<TranslationOption[]> {
  if (!/^(serial|movie)-\d+$/.test(id)) return [];

  return withCache(`translations:${id}`, 30 * MINUTE, async () => {
    const r = await fetchResult(id);
    const fallback: TranslationOption[] = r?.translation
      ? [toOption(r.translation, id, r.episodes_count)]
      : [];
    if (!r?.link) return fallback;

    const pageUrl = absoluteUrl(r.link);
    if (!pageUrl) return fallback;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(pageUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          Referer: "https://www.google.com/",
          "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
        },
        signal: controller.signal,
        cache: "no-store",
      });
      const html = await res.text();
      clearTimeout(timer);

      const options: TranslationOption[] = [];
      for (const match of html.matchAll(TRANSLATION_OPTION_RE)) {
        const [tag, label] = match;
        const mediaId = attr(tag, "data-media-id");
        const mediaType = attr(tag, "data-media-type");
        const translationId = Number(attr(tag, "data-id") ?? attr(tag, "value"));
        const title = attr(tag, "data-title")?.trim() || label.replace(/<[^>]+>/g, "").trim();
        const count = Number(attr(tag, "data-episode-count") ?? 0);

        if (!mediaId || !mediaType || !title || Number.isNaN(translationId)) continue;

        options.push({
          id: translationId,
          title,
          type: attr(tag, "data-translation-type") === "subtitles" ? "subtitles" : "voice",
          mediaId: `${mediaType}-${mediaId}`,
          episodeCount: count || undefined,
          current: /\bselected\b/i.test(tag) || attr(tag, "selected") !== undefined,
        });
      }

      // Дедупликация по id + сначала выбранная
      const seen = new Set<number>();
      const unique = options.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));
      unique.sort((a, b) => Number(b.current) - Number(a.current));

      return unique.length ? unique : fallback;
    } catch {
      // Если страница плеера недоступна — отдаём хотя бы текущую озвучку
      return fallback;
    }
  });
}

function toOption(t: KodikTranslation, mediaId: string, episodeCount?: number): TranslationOption {
  return {
    id: t.id,
    title: t.title,
    type: t.type,
    mediaId,
    episodeCount,
    current: true,
  };
}

/* ------------------------------------------------------------------ */
/* Вспомогательные данные                                               */
/* ------------------------------------------------------------------ */

export interface MetaData {
  genres: { title: string; count: number }[];
  years: number[];
}

/** Жанры и годы для фильтров каталога */
export function getMeta(): Promise<MetaData> {
  return withCache("meta", 6 * 60 * MINUTE, async () => {
    const [genres, years] = await Promise.all([
      kodikPost<{ results: { title: string; count: number }[] }>("genres"),
      kodikPost<{ results: { year: number; count: number }[] }>("years"),
    ]);
    return {
      genres: genres.results ?? [],
      years: (years.results ?? []).map((y) => y.year),
    };
  });
}

/** Ряд на главной: добор страниц + дедупликация (Kodik любит дубли) */
export function row(
  label: string,
  params: Record<string, string | number | undefined | null>,
  ttlMs = 10 * MINUTE,
): Promise<AnimeCard[]> {
  const want = Number(params.limit) || 20;

  return withCache(`row:${label}`, ttlMs, async () => {
    const { cards } = await collectUnique(params, undefined, want, 4);
    return cards.filter((c) => c.poster || c.title).slice(0, want);
  });
}

/** Ряд «Смотреть затем»: похожие тайтлы по жанрам/году */
export function similar(card: AnimeCard, limit = 12): Promise<AnimeCard[]> {
  const genre = card.genres[0];
  const params: Record<string, string | number | undefined> = {
    types: card.kind === "movie" ? "anime" : "anime,anime-serial",
    all_genres: genre,
    sort: "shikimori_rating",
    order: "desc",
    with_material_data: 1,
  };

  return withCache(`similar:${card.id}`, 30 * MINUTE, async () => {
    const { cards } = await collectUnique(params, undefined, limit + 6, 4);
    return cards
      .filter((c) => c.id !== card.id && c.poster && cardKey(c) !== cardKey(card))
      .slice(0, limit);
  });
}

/* ------------------------------------------------------------------ */
/* Хронология франшизы                                                  */
/* ------------------------------------------------------------------ */

/**
 * Убирает у номера сезона хвост: «Блич [ТВ-1]» → «Блич»,
 * «Re:Zero … 4» → «Re:Zero …». По этой «базе» и ищем остальные части.
 */
function franchiseBase(value?: string): string | undefined {
  if (!value) return undefined;
  const base = value
    .replace(/\s*[\[(][^\])]*ТВ[^\])]*[\])]\s*$/i, "")
    .replace(/\s+(?:\d+|№\s*\d+)(?:\s*(?:сезон|сез|часть|part|season))?\.?$/i, "")
    .replace(/\s*[·:]\s*\d+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return base.length >= 3 ? base : undefined;
}

/** Токены названия длиной от 4 символов — для сравнения частей франшизы */
function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[«»"'.,!?;:·()[\]-]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 4),
  );
}

/** Число общих значимых токенов двух названий */
function overlap(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  return shared;
}

/**
 * Ключ записи франшизы — нормализованное название.
 *
 * Kodik держит один и тот же тайтл десятками material-id: с разными форматами,
 * разными годами (анонс 2024 против вышедшей в 2025) и вовсе без material-data
 * («serial-43889» — 2018 год, без формата и постера). Склеиваем всё по
 * названию, иначе в ленте один тайтл повторяется дважды с разными годами.
 */
function franchiseKey(value: { title: string }): string {
  return value.title
    .toLowerCase()
    .replace(/[\s«»"'.,!?;:·()[\]-]+/g, " ")
    .trim();
}

/**
 * Приоритет записи одного и того же тайтла: вышедшая важнее анонса,
 * дальше — более поздний год выхода и больше доступных серий.
 */
function franchiseRank(value: AnimeCard): [number, number, number] {
  return [value.status === "anons" ? 0 : 1, value.year ?? 0, value.lastEpisode ?? 0];
}

/** Подходит ли `candidate` вместо уже собранной записи того же тайтла */
function preferFranchiseEntry(known: AnimeCard, candidate: AnimeCard): boolean {
  const a = franchiseRank(known);
  const b = franchiseRank(candidate);
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    return b[i] > a[i];
  }
  return false;
}

/** Порядок следования форматов внутри одного года */
const KIND_RANK: Record<string, number> = {
  tv: 0,
  tv_13: 0,
  tv_24: 0,
  tv_special: 1,
  special: 1,
  ona: 2,
  ova: 3,
  movie: 4,
  music: 5,
};

/** Хронологический порядок: год, затем формат, затем название */
function byRelease(a: AnimeCard, b: AnimeCard): number {
  return (
    (a.year ?? 9999) - (b.year ?? 9999) ||
    (KIND_RANK[a.kind ?? "tv"] ?? 9) - (KIND_RANK[b.kind ?? "tv"] ?? 9) ||
    a.title.localeCompare(b.title, "ru")
  );
}

/**
 * Проходит ли кандидат по одному из поисковых запросов.
 *
 * Правила подобраны так, чтобы не терять настоящие части и не пускать мусор:
 * - «Блич: Тысячелетняя кровавая война» проходит по запросу из одного слова
 *   «Блич» (все слова запроса есть в названии);
 * - «Re:Petit …» проходит по запросу «Re:Zero. Жизнь с нуля…» — две трети
 *   совпавших слов;
 * - «Клуб игр по выживанию!», попавший в выдачу по альтернативному названию
 *   Re:Zero, содержит лишь одно общее слово из пяти — отсекается.
 */
function matchesFranchise(
  own: Set<string>,
  orig: Set<string> | null,
  probe: Set<string>,
): boolean {
  if (!probe.size) return false;

  // Все слова запроса есть в названии
  if (overlap(own, probe) >= probe.size) return true;
  // …или в оригинальном названии (Bleach, Solo Leveling, Re:Petit …)
  if (orig && overlap(orig, probe) >= probe.size) return true;
  // Длинный запрос: не меньше двух общих слов и хотя бы половина минус запас
  if (probe.size >= 3) {
    const shared = overlap(own, probe);
    if (shared >= 2 && shared * 2 >= probe.size - 2) return true;
  }
  return false;
}

/**
 * Хронология франшизы («1 сезон → OVA → 2 сезон → …»).
 *
 * Kodik не отдаёт связи между тайтлами, поэтому собираем её сами: берём базу
 * названия без номера сезона (русская и оригинальная версии, альтернативные
 * названия) и ищем по ней все части, отсекая случайные совпадения
 * `matchesFranchise`.
 */
export function franchise(card: AnimeCard, limit = 20): Promise<AnimeCard[]> {
  const bases = [
    ...new Set(
      [
        franchiseBase(card.title),
        franchiseBase(card.titleOrig),
        ...(card.otherTitles ?? []).slice(0, 4).map(franchiseBase),
      ].filter((v): v is string => Boolean(v)),
    ),
  ].slice(0, 3);

  if (!bases.length) return Promise.resolve([]);

  return withCache(`franchise:${bases.join("|")}`, 30 * MINUTE, async () => {
    const pages = await Promise.all(
      bases.map((query) =>
        search({
          title: query,
          types: "anime,anime-serial",
          limit: 100,
          with_material_data: 1,
        })
          .then((res) => res.results)
          .catch(() => [] as KodikResult[]),
      ),
    );

    const probes = bases.map(tokens);

    const matched = pages
      .flat()
      .map(toCard)
      // Рекламные коллабы («Re:Zero x He Wei Dao») — не часть франшизы
      .filter((candidate) => candidate.kind !== "cm")
      .filter((candidate) => {
        const own = tokens(candidate.title);
        const orig = candidate.titleOrig ? tokens(candidate.titleOrig) : null;
        return probes.some((probe) => matchesFranchise(own, orig, probe));
      });

    // Склеиваем записи одного тайтла («Поднятие уровня в одиночку» 2018 и
    // 2024) и отбрасываем записи без material-data — у них нет ни формата,
    // ни года, ни постера.
    const groups = new Map<string, AnimeCard>();
    for (const candidate of matched) {
      if (!candidate.kind) continue;
      const key = franchiseKey(candidate);
      const known = groups.get(key);
      if (!known) {
        groups.set(key, candidate);
      } else if (preferFranchiseEntry(known, candidate)) {
        groups.set(key, candidate);
      }
    }

    // Текущий тайтл обязан быть в списке ровно один раз — им и подсветим
    groups.set(franchiseKey(card), card);

    return [...groups.values()].sort(byRelease).slice(0, limit);
  });
}

export { KodikError };
