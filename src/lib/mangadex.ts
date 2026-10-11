/**
 * Манга: публичный API MangaDex (`api.mangadex.org`) — каталог, главы и
 * страницы для собственного ридера.
 *
 * Kodik мангу не отдаёт (`types=manga` → 400), поэтому источник отдельный.
 * MangaBuff закрыт для этого: страницы глав у него отдаёт защищённый
 * плеер (404 без полной сессии). MangaDex же отдаёт их официально —
 * `/at-home/server/{chapterId}` возвращает список файлов главы, а сами
 * картинки лежат на CDN и отдаются без referer.
 *
 * Что берём у MangaDex:
 *  - каталог: `/manga` + `/statistics/manga` (рейтинг и подписчики);
 *  - главы: `/manga/{id}/feed?translatedLanguage[]=ru`;
 *  - страницы: `/at-home/server/{chapterId}`.
 *
 * Ограничения: 18+ отсекаем (`contentRating`), берём только то, что
 * переведено на русский, кэшируем через общий `withCache`. Любая ошибка
 * гасится — страница не падает, а просто не показывает блок.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { withCache } from "./kodik";
import type { AnimeCard } from "./types";

const BASE = "https://api.mangadex.org";
const MINUTE = 60_000;

/** MangaDex жёстко лимитирует API, поэтому все ответы кэшируем */
const TTL_CATALOG = 10 * MINUTE;
/** Ряд требует проверки каждого тайтла фидом — кэшируем дольше */
const TTL_ROW = 15 * MINUTE;
/** Страница каталога с постраничным смещением */
const TTL_PAGE = 10 * MINUTE;
const TTL_TITLE = 15 * MINUTE;
/** at-home выдаёт временный `baseUrl` — он живёт считаные минуты */
const TTL_PAGES = 2 * MINUTE;

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

/** MangaDex отдаёт максимум 100 записей за запрос — больше даёт 400 */
const API_PAGE_LIMIT = 100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Кэш, который не запоминает неудачи, но помнит последний успех.
 *
 * Общий `withCache` кэширует и `null`: одна сетевая ошибка на 10 минут
 * оставила бы каталог пустым, причём даже после восстановления MangaDex.
 * Поэтому успех кладём в кэш, а провал каждый раз пробуем заново.
 *
 * Если источник не ответил — отдаём последнее удачное значение, даже
 * просроченное. MangaDex периодически рвёт соединения и блокирует IP за
 * частые запросы; раздел манги не должен исчезать из-за этого: лучше
 * показать вчерашний каталог, чем пустую страницу.
 */
const okCache = new Map<string, { expires: number; value: unknown }>();

/** Файловая «подложка»: переживает перезапуск процесса и деплоя */
const DISK_DIR = path.join(process.cwd(), ".cache", "mangadex");

function diskPath(key: string): string {
  // ключи содержат `[]` и `:` — заменяем на безопасные символы
  const safe = key.replace(/[^a-z0-9]+/gi, "_").slice(0, 120);
  return path.join(DISK_DIR, `${safe}.json`);
}

function readDisk<T>(key: string): T | null {
  try {
    return JSON.parse(readFileSync(diskPath(key), "utf8")) as T;
  } catch {
    return null;
  }
}

function writeDisk(key: string, value: unknown): void {
  try {
    mkdirSync(DISK_DIR, { recursive: true });
    writeFileSync(diskPath(key), JSON.stringify(value), "utf8");
  } catch {
    // нет прав на диск — работаем только на памяти
  }
}

async function cacheOnlyOk<T>(
  key: string,
  ttlMs: number,
  produce: () => Promise<T | null>,
): Promise<T | null> {
  const hit = okCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  if (hit) okCache.delete(key);

  const value = await produce();
  if (value !== null) {
    if (okCache.size > 500) okCache.clear();
    okCache.set(key, { expires: Date.now() + ttlMs, value });
    writeDisk(key, value);
    return value;
  }

  // Источник не ответил — отдаём последнее удачное значение
  return readDisk<T>(key);
}

/**
 * Запрос к MangaDex с одной повторной попыткой.
 *
 * MangaDex рвёт соединение при лавине запросов (`other side closed`), и
 * такой обрыв не означает «данных нет» — без повтора мы бы молча теряли
 * страницы каталога и показывали пользователю обрыв вместо пустоты.
 * HTTP-ошибки (404, 400) не повторяем — там повтор не поможет.
 */
async function apiGet<T>(path: string, init?: RequestInit): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(250 * attempt);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
        ...init,
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      // Обрыв соединения или таймаут — пробуем ещё раз
      continue;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/** id MangaDex — uuid; в URL попадает только он */
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/* ------------------------------------------------------------------ */
/* Типы ответа                                                         */
/* ------------------------------------------------------------------ */

interface MdxItem {
  id: string;
  attributes: {
    title?: Record<string, string>;
    /** Алиасы: русское название лежит здесь, в `title` — оригинал */
    altTitles?: Record<string, string>[];
    description?: Record<string, string>;
    year?: number;
    status?: string;
    tags?: { id: string; attributes?: { name?: Record<string, string>; group?: string } }[];
  };
  relationships?: { type: string; attributes?: { fileName?: string } }[];
}

interface MdxListResponse {
  data?: MdxItem[];
  total?: number;
}

interface MdxFeedResponse {
  data?: {
    id: string;
    attributes: {
      volume?: string | null;
      chapter?: string | null;
      title?: string | null;
      pages?: number;
      translatedLanguage?: string;
      publishAt?: string;
      /** Дата перевода главы — по ней сортируется «свежесть» русского */
      readableAt?: string;
      isUnavailable?: boolean;
    };
  }[];
  total?: number;
  offset?: number;
  limit?: number;
}

interface MdxStatsResponse {
  statistics?: Record<string, { rating?: { average?: number | null }; follows?: number }>;
}

/** Ответ `/at-home/server/{chapterId}` */
interface MdxAtHome {
  baseUrl?: string;
  chapter?: { hash?: string; data?: string[]; dataSaver?: string[] };
}

/* ------------------------------------------------------------------ */
/* Разбор карточки                                                     */
/* ------------------------------------------------------------------ */

/**
 * Название: русский алиас важнее всего, дальше оригинал. Английское
 * уходит в `titleOrig`.
 */
function titleOf(attrs: MdxItem["attributes"]): { title: string; alt?: string } {
  const main = attrs.title ?? {};
  const alts = attrs.altTitles ?? [];

  const ru = alts.map((a) => a?.ru || a?.["ru-ro"]).find(Boolean);
  const en = main.en || alts.map((a) => a?.en).find(Boolean);
  const original = Object.values(main).find(Boolean);

  const title = ru || en || original || "Без названия";
  const orig = original ?? en;
  return { title, alt: title === orig ? undefined : orig };
}

/** Обложка: путь приходит в `relationships[].attributes.fileName`.
 *  Размерные суффиксы (`.512.jpg`) этот хост не отдаёт — 404. */
function coverUrl(id: string, item: MdxItem): string | undefined {
  const cover = item.relationships?.find((rel) => rel.type === "cover_art");
  const file = cover?.attributes?.fileName;
  return file ? `https://uploads.mangadex.org/covers/${id}/${file}` : undefined;
}

/**
 * MangaDex отдаёт жанры только по-английски (`/manga/tag` не содержит
 * русских имён), поэтому переводим их сами — справочник жанров у MangaDex
 * стабилен и содержит ровно 25 значений.
 */
const GENRE_RU: Record<string, string> = {
  Action: "Боевик",
  Adventure: "Приключения",
  "Boys' Love": "БЛ",
  Comedy: "Комедия",
  Crime: "Криминал",
  "Dark Fantasy": "Тёмное фэнтези",
  Doujinshi: "Додзинси",
  Drama: "Драма",
  Fantasy: "Фэнтези",
  Historical: "История",
  Horror: "Ужасы",
  "Isekai": "Из мира в мир",
  Josei: "Сёдзё",
  "Magic": "Магия",
  "Martial Arts": "Боевые искусства",
  Mecha: "Меха",
  "Medical": "Медицина",
  Military: "Военное",
  Music: "Музыка",
  Mystery: "Детектив",
  Psychological: "Психология",
  Romance: "Романтика",
  "Sci-Fi": "Фантастика",
  Shounen: "Сёнэн",
  "Slice of Life": "Повседневность",
  Sports: "Спорт",
  Superhero: "Супергероика",
  "Supernatural": "Сверхъестественное",
  Thriller: "Триллер",
};

function genresOf(tags: MdxItem["attributes"]["tags"]): string[] {
  return (tags ?? [])
    .filter((tag) => tag.attributes?.group === "genre")
    .map((tag) => {
      const name = tag.attributes?.name?.ru || tag.attributes?.name?.en;
      return name ? (GENRE_RU[name] ?? name) : undefined;
    })
    .filter((name): name is string => Boolean(name))
    .slice(0, 4);
}

function statusOf(status?: string): AnimeCard["status"] {
  switch (status) {
    case "ongoing":
      return "ongoing";
    case "completed":
      return "completed";
    case "hiatus":
      return "paused";
    case "cancelled":
      return "cancelled";
    default:
      return undefined;
  }
}

function descriptionOf(desc?: Record<string, string>): string | undefined {
  const text = (desc?.ru || desc?.en || "").trim();
  return text ? text.slice(0, 900) : undefined;
}

/* ------------------------------------------------------------------ */
/* Каталог: ряды для главной                                           */
/* ------------------------------------------------------------------ */

/** Срез каталога */
export type MangaSort = "hot" | "best";

const SORTS: Record<MangaSort, string[]> = {
  /* MangaDex отсортирует по свежей главе на любом языке — это грубая
     отборка кандидатов. Настоящую свежесть для русской манги ставит уже
     пул, по дате свежей русской главы (см. russianFresh), а подписчики
     остаются как вторичный ключ: иначе в выдаче много мелких проектов
     с одной переведённой главой. */
  hot: ["order[latestUploadedChapter]=desc", "order[followedCount]=desc"],
  // Рейтинг сообщества, при равенстве — популярность
  best: ["order[rating]=desc", "order[followedCount]=desc"],
};

/**
 * Сколько русских глав у тайтла. Отдельный кэш: одна и та же проверка
 * нужна и ряду, и каталогу, а MangaDex не любит частые повторы фида.
 */
async function russianChapters(id: string): Promise<number> {
  return withCache(`mdx:ch:${id}`, TTL_ROW, async () => {
    const feed = await apiGet<MdxFeedResponse>(
      `/manga/${id}/feed?translatedLanguage[]=ru&limit=1`,
    );
    return feed?.total ?? 0;
  });
}

/**
 * Пул запросов с ограничением параллелизма. MangaDex душит лавину, поэтому
 * 100 проверок фида гоняем волнами по 25 — это ~1 с против 8 с при
 * последовательном обходе.
 */
async function pooled<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runner = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, runner),
  );
  return results;
}

/** Параллелизм к MangaDex. Выше 15 сайт начинает рвать соединения,
 *  поэтому держимся вежливого уровня — скорость там упирается не в него */
const MDX_CONCURRENCY = 12;

/* ------------------------------------------------------------------ */
/* Множество тайтлов с русскими главами                                */
/* ------------------------------------------------------------------ */

/**
 * Какие тайтлы точно переведены на русский — собираем из фида глав.
 *
 * Проверять каждый кандидат фидом дорого: один тайтл — один запрос, и на
 * 300 кандидатов MangaDex рвал соединения и в итоге заблокировал нас.
 * `/chapter?translatedLanguage[]=ru` отдаёт сразу 100 глав, каждая из них
 * ссылается на свою мангу: один запрос подтверждает читаемость ~50 тайтлов.
 * То есть в десять раз дешевле, а отсев всё так же честный — в множество
 * попадают только те, у кого русские главы действительно есть.
 */
const russianTitles = new Map<string, number>();
let russianTitlesExhausted = false;

/**
 * Дата свежей русской главы по каждому тайтлу.
 *
 * MangaDex сортирует каталог по `order[latestUploadedChapter]` — это свежая
 * глава на ЛЮБОМ языке. Для русской манги это не то: «Pani Poni Dash» с
 * русским переводом от 2021 года попадал в «Горячие новинки» из-за свежих
 * глав на других языках. А фид русских глав мы и так листаем — там уже есть
 * точный ответ, когда у тайтла появилась свежая русская глава.
 */
const russianFresh = new Map<string, number>();

/** Дособираем множество до `want` тайтлов */
async function growRussianTitles(want: number): Promise<Map<string, number>> {
  const pageSize = 100;
  while (russianTitles.size < want && !russianTitlesExhausted) {
    const res = await apiGet<{
      data?: {
        attributes?: { readableAt?: string };
        relationships?: { type: string; id: string }[];
      }[];
    }>(
      `/chapter?translatedLanguage[]=ru&order[readableAt]=desc&limit=${pageSize}` +
        `&offset=${russianTitles.size === 0 ? russianTitles.size : russianTitlesOffset}` +
        `&includes[]=manga&contentRating[]=safe&contentRating[]=suggestive`,
    ).catch(() => null);

    if (!res) break; // источник не ответил — попробуем в следующий раз
    const entries = res.data ?? [];
    if (entries.length === 0) {
      russianTitlesExhausted = true;
      break;
    }

    for (const entry of entries) {
      const id = entry.relationships?.find((rel) => rel.type === "manga")?.id;
      if (!id) continue;
      russianTitles.set(id, (russianTitles.get(id) ?? 0) + 1);
      // Лента идёт по убыванию readableAt, поэтому первое упоминание тайтла —
      // его самая свежая глава; последующие перезаписывать не надо
      const at = Date.parse(entry.attributes?.readableAt ?? "");
      if (Number.isFinite(at) && !russianFresh.has(id)) russianFresh.set(id, at);
    }
    russianTitlesOffset += pageSize;
  }
  return russianTitles;
}

/** Сколько глав уже пролистали в фиде (смещение для следующей страницы) */
let russianTitlesOffset = 0;

/**
 * Рейтинги и подписчики пачками: `/statistics/manga?manga[]=…`.
 *
 * Эндпоинт медленный на больших батчах: 100 id одним запросом — 1.8 с,
 * десять запросов по 10 подряд — 6 с. Помогает параллелизм: десять батчей
 * по 10 одновременно укладываются в 0.7 с.
 */
async function fetchStats(ids: string[]): Promise<MdxStatsResponse["statistics"]> {
  if (ids.length === 0) return {};
  const BATCH = 10;
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));

  const results = await pooled(batches, 10, async (batch) => {
    const params = new URLSearchParams();
    for (const id of batch) params.append("manga[]", id);
    const res = await apiGet<MdxStatsResponse>(`/statistics/manga?${params.toString()}`);
    return res?.statistics ?? {};
  });

  return Object.assign({}, ...results);
}

/** Собираем карточку тайтла в общую форму */
function toCard(item: MdxItem, stats?: { rating?: { average?: number | null }; follows?: number }, chapterCount?: number): AnimeCard | null {
  const poster = coverUrl(item.id, item);
  if (!poster) return null;
  const attrs = item.attributes ?? {};
  const { title, alt } = titleOf(attrs);
  const rating = stats?.rating?.average ?? null;
  return {
    id: item.id,
    title,
    titleOrig: alt,
    year: typeof attrs.year === "number" ? attrs.year : undefined,
    poster,
    rating: typeof rating === "number" ? rating : undefined,
    ratingSource: "shikimori",
    kind: "tv",
    status: statusOf(attrs.status),
    genres: genresOf(attrs.tags),
    description: descriptionOf(attrs.description),
    chapterCount,
  };
}

/**
 * Ряд манги для главной. Берётся из того же накопительного пула, что и
 * каталог, — иначе главная и каталог показывали бы разное.
 *
 * При недоступности MangaDex отдаём последний удачный ряд с диска: раздел
 * манги не должен исчезать из-за сетевого сбоя источника.
 */
/**
 * Ряд манги для главной. Берётся из того же накопительного пула, что и
 * каталог, — иначе главная и каталог показывали бы разное.
 *
 * Запасного источника нет намеренно: MangaBuff отдаёт страницы глав через
 * защищённый плеер, поэтому манга оттуда всё равно не читается на сайте.
 * Лучше раздел не показать, чем предложить уход на чужой ресурс.
 */
export function mangaRow(sort: MangaSort, limit = 30): Promise<AnimeCard[]> {
  return cacheOnlyOk(`mdx:row:${sort}:${limit}`, TTL_ROW, async () => {
    const pool = await ensurePool(sort, limit + 30).catch(() => null);
    if (pool && pool.cards.length > 0) {
      const cards = await refineChapterCounts(pool.cards.slice(0, limit)).catch(() =>
        pool.cards.slice(0, limit),
      );
      if (cards.length > 0) return cards;
    }
    return null;
  }).then((cards) => cards ?? []);
}

/**
 * Накопительный пул тайтлов для каталога.
 *
 * MangaDex отдаёт максимум 100 тайтлов за запрос, а сортировку по рейтингу
 * листает без дренажа (5376 тайтлов, и на глубине 500 русские главы есть
 * почти у трёх из четырёх). Поэтому пул растёт по мере надобности: очередная
 * страница каталога досыпается и доливается уже проверенными карточками.
 *
 * Так страницы не перекрываются и не повторяют друг друга: смещение берётся
 * из одного накопительного списка, а не из каждой страницы заново.
 */
interface Pool {
  /** Уже проверенные тайтлы с русскими главами, в порядке сортировки */
  cards: AnimeCard[];
  /**
   * Когда пул собран.
   *
   * Без метки пул «жил» до перезапуска процесса: сортировка по свежести
   * замирала на том, что попало в пул при первом обращении, и новые главы
   * в «Горячие новинки» не попадали никогда.
   */
  builtAt: number;
  /** Сколько сырых кандидатов из каталога уже смотрели — от него идёт offset */
  scanned: number;
  /** Источник исчерпан */
  exhausted: boolean;
  /** Метка времени, после которой пул сбрасывается */
  stale: boolean;
}

/** Сколько живёт собранный пул. Рейтинг меняется медленно, а свежесть
 *  глав — быстро, поэтому у «новинок» пул протухает намного раньше. */
const POOL_TTL: Record<MangaSort, number> = {
  hot: 15 * MINUTE,
  best: 2 * 60 * MINUTE,
};

const pools = new Map<MangaSort, Pool>();
/** Пул не даёт двум параллельным запросам доливать список одновременно */
const poolLocks = new Map<MangaSort, Promise<unknown>>();
/** Сколько сырых кандидатов максимум просматриваем.
 *
 * MangaDex отдаёт 5376 тайтлов с русским переводом, но каждый кандидат
 * требует запроса к фиду. При потолке в 900 сайт рвал соединения и в итоге
 * заблокировал нас, поэтому держим примерно 300 кандидатов (~200 читаемых
 * тайтлов, 7 страниц каталога) — этого хватает с запасом, а нагрузка на
 * чужой API остаётся умеренной. */
const POOL_MAX = 300;

/** Каталог по сортировке. `null` — источник не ответил (не «данных нет»). */
async function fetchCatalogPage(
  sort: MangaSort,
  offset: number,
  limit: number,
): Promise<AnimeCard[] | null> {
  return cacheOnlyOk(`mdx:cat:${sort}:${offset}:${limit}`, TTL_CATALOG, async () => {
    const params = new URLSearchParams();
    params.set("limit", String(Math.min(limit, API_PAGE_LIMIT)));
    params.set("offset", String(offset));
    params.append("includes[]", "cover_art");
    params.append("includes[]", "tags");
    params.append("contentRating[]", "safe");
    params.append("contentRating[]", "suggestive");
    params.append("availableTranslatedLanguage[]", "ru");
    for (const part of SORTS[sort]) {
      const [key, value] = part.split("=");
      params.set(key, value);
    }

    const list = await apiGet<MdxListResponse>(`/manga?${params.toString()}`);
    // Список пришёл, но пустой — это честный конец выдачи
    if (!list) return null;
    const items = (list.data ?? []).slice(0, limit);
    if (items.length === 0) return [];

    const stats = await fetchStats(items.map((item) => item.id));
    return items
      .map((item) => toCard(item, stats?.[item.id]))
      .filter((card): card is AnimeCard => card !== null);
  });
}

/**
 * Долить пул до `want` читаемых тайтлов.
 *
 * Каталог сортировки даёт кандидатов, а множество из фида глав отсеивает
 * те, где перевода нет — без единого запроса к фиду на тайтл.
 */
async function growPool(sort: MangaSort, want: number): Promise<Pool> {
  const now = Date.now();
  const existing = pools.get(sort);
  const expired = existing !== undefined && now - existing.builtAt > POOL_TTL[sort];
  // Протухший пул собираем заново: иначе «новинки» навсегда застревают
  const pool: Pool = !existing || expired
    ? { cards: [], scanned: 0, exhausted: false, stale: false, builtAt: now }
    : existing;
  const seen = new Set(pool.cards.map((card) => card.id));

  while (pool.cards.length < want && !pool.exhausted && pool.scanned < POOL_MAX) {
    // Столько тайтлов-кандидатов нам понадобится, чтобы набрать `want`
    // читаемых: в среднем читаемых двое из трёх
    const expected = Math.ceil((want - pool.cards.length) * 1.6);
    await growRussianTitles(Math.min(russianTitles.size + expected + 40, 800)).catch(() => null);

    // Множество читаемых не наполнилось — источник недоступен. Отдаём
    // последний удачный пул с диска, если он есть: лучше вчерашний каталог,
    // чем пустая страница
    if (russianTitles.size === 0) {
      const saved = readDisk<Pool>(`mdx:pool:${sort}`);
      // Подложка с диска годится только пока не протухла: иначе после
      // перезапуска «новинки» надолго показывали бы вчерашний список
      if (saved?.cards?.length && Date.now() - (saved.builtAt ?? 0) <= POOL_TTL[sort]) {
        pools.set(sort, { ...saved, stale: true });
        return saved;
      }
      break;
    }

    const batch = Math.min(API_PAGE_LIMIT, POOL_MAX - pool.scanned);
    const candidates = await fetchCatalogPage(sort, pool.scanned, batch).catch(() => null);
    // Источник не ответил — помечать пул исчерпанным нельзя, иначе каталог
    // навсегда покажет «дальше нет» после одного сетевого сбоя
    if (candidates === null) break;
    if (candidates.length === 0) {
      pool.exhausted = true;
      break;
    }
    pool.scanned += candidates.length;

    for (const card of candidates) {
      if (pool.cards.length >= want) break;
      if (seen.has(card.id)) continue;
      // Число глав в выборке фида — верхняя оценка, точную уточняем ниже
      const known = russianTitles.get(card.id);
      if (!known) continue;
      seen.add(card.id);
      pool.cards.push({ ...card, chapterCount: known });
    }

    // «Новинки» — это когда у тайтла свежая РУССКАЯ глава, а не когда он
    // обновился на любом языке. Сортируем уже принятые карточки: порядок
    // MangaDex по latestUploadedChapter для русской манги врёт.
    if (sort === "hot") {
      pool.cards.sort((a, b) => (russianFresh.get(b.id) ?? 0) - (russianFresh.get(a.id) ?? 0));
    }
  }
  pool.builtAt = Date.now();
  pools.set(sort, pool);
  // Путь к диску: переживёт и блокировку MangaDex, и перезапуск процесса
  if (pool.cards.length > 0) writeDisk(`mdx:pool:${sort}`, pool);
  return pool;
}

/** Точное число русских глав для видимых карточек (для бейджа на карточке) */
async function refineChapterCounts(cards: AnimeCard[]): Promise<AnimeCard[]> {
  if (cards.length === 0) return cards;
  const exact = await pooled(cards, MDX_CONCURRENCY, (card) => russianChapters(card.id));
  return cards.map((card, i) => ({ ...card, chapterCount: exact[i] }));
}

/** Пул для среза, сериализуя конкурентные доливы.
 *
 * Доливаем с запасом на пару страниц вперёд: докачивать пул стоит ~3 с, и
 * без запаса каждая вторая страница каталога платила бы за это снова.
 */
async function ensurePool(sort: MangaSort, want: number): Promise<Pool> {
  const run = poolLocks.get(sort);
  if (run) await run.catch(() => undefined);

  const cached = pools.get(sort);
  if (cached && Date.now() - cached.builtAt <= POOL_TTL[sort]) return cached;

  const target = Math.min(want + 60, POOL_MAX);
  const lock = growPool(sort, target);
  poolLocks.set(sort, lock);
  try {
    return await lock;
  } finally {
    poolLocks.delete(sort);
  }
}

/**
 * Сколько кандидатов проверяем фидом на один поисковый запрос.
 *
 * MangaDex отдаёт по названию десятки тайтлов, но читаемых среди них
 * единицы: русский перевод есть у большинства, а загруженных глав — нет.
 * Поэтому список всегда проверяется фидом, как и пул каталога.
 */
const SEARCH_CANDIDATES = 40;

/**
 * Поиск по каталогу.
 *
 * Ищет не по локальному пулу, а напрямую у MangaDex. Пул — это ~200 тайтлов
 * из 5 тысяч, и popularные («Берсерк», «One Piece») в него попадают
 * случайно: поиск по пулу на «Берсерк» отвечал «ничего не нашлось» — то
 * есть хуже, чем поиска нет.
 *
 * Читаемость решает фид, как и в каталоге: тайтл с русским переводом, но без
 * загруженных глав читать нечего.
 */
export async function mangaSearch(
  query: string,
  offset: number,
  limit: number,
): Promise<{ cards: AnimeCard[]; hasMore: boolean; total: number }> {
  const q = query.trim().toLowerCase();
  if (!q) return { cards: [], hasMore: false, total: 0 };

  return cacheOnlyOk(`mdx:search:${q}:${offset}:${limit}`, TTL_PAGE, async () => {
    const params = new URLSearchParams();
    params.set("title", q);
    params.set("limit", String(Math.min(SEARCH_CANDIDATES, API_PAGE_LIMIT)));
    params.set("offset", String(offset));
    params.append("order[relevance]", "desc");
    params.append("includes[]", "cover_art");
    params.append("includes[]", "tags");
    params.append("contentRating[]", "safe");
    params.append("contentRating[]", "suggestive");
    params.append("availableTranslatedLanguage[]", "ru");

    const list = await apiGet<MdxListResponse>(`/manga?${params.toString()}`);
    if (!list) return null;
    const items = list.data ?? [];
    if (items.length === 0) return { cards: [], hasMore: false, total: 0 };

    const stats = await fetchStats(items.map((item) => item.id));
    const candidates = items
      .map((item) => toCard(item, stats?.[item.id]))
      .filter((card): card is AnimeCard => card !== null);

    const counts = await pooled(candidates, MDX_CONCURRENCY, (card) => russianChapters(card.id));
    const readable = candidates
      .map((card, i) => ({ ...card, chapterCount: counts[i] }))
      .filter((card) => (card.chapterCount ?? 0) > 0);

    /* MangaDex ищет ещё и по описанию: на «берсерк» первым приходил
       «Моя безумная прокачка», где это слово встречалось лишь в аннотации.
       Свой порядок надёжнее: сперва названия, где запрос — часть названия,
       потом то, что совпало только косвенно. */
    const needle = q.toLowerCase();
    const inTitle = (card: AnimeCard) =>
      [card.title, card.titleOrig, ...(card.otherTitles ?? [])]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(needle));
    const ranked = [
      ...readable.filter(inTitle),
      ...readable.filter((card) => !inTitle(card)),
    ];

    const slice = ranked.slice(0, limit);
    const reached = items.length >= Math.min(SEARCH_CANDIDATES, API_PAGE_LIMIT);
    return {
      cards: slice,
      // Дальше есть, если MangaDex отдал полный батч или на этой странице
      // остались не показанные читаемые
      hasMore: reached || ranked.length > limit,
      total: ranked.length + offset,
    };
  }).then((res) => res ?? { cards: [], hasMore: false, total: 0 });
}

/**
 * Совпадение запроса с тайтлом.
 *
 * Проверяем не только основное название: у карточки хранятся все варианты
 * из MangaDex (оригинал, альтернативные), и искать по одному названию —
 * значит терять половину совпадений, потому что русский перевод часто
 * отличается от оригинала.
 */

/**
 * Страница каталога. `offset` считается по накопительному пулу, поэтому
 * страницы не перекрываются и не дублируют друг друга. Если пул ещё не
 * добран до нужной глубины, он дорастает здесь же.
 *
 * С запросом (`query`) каталог сначала фильтрует весь пул и только потом
 * режет на страницы: иначе по странице 3 выдачи поиск выглядел бы пустым,
 * хотя совпадения есть дальше.
 */
export async function mangaCatalogPage(
  sort: MangaSort,
  offset: number,
  limit: number,
  query = "",
): Promise<{ cards: AnimeCard[]; hasMore: boolean; total: number }> {
  const q = query.trim();
  // С запросом идём к MangaDex: в локальном пуле поисковые запросы вроде
  // «Берсерк» или «One Piece» не находятся — пул это ~200 тайтлов из 5 тысяч
  if (q) return mangaSearch(q, offset, limit);

  return cacheOnlyOk(`mdx:page:${sort}:${offset}:${limit}`, TTL_PAGE, async () => {
    const want = Math.min(offset + limit + 60, POOL_MAX);
    const pool = await ensurePool(sort, want).catch(() => null);
    if (!pool) return null;

    const total = pool.cards.length;
    if (total <= offset) return { cards: [], hasMore: false, total };

    const slice = pool.cards.slice(offset, offset + limit);
    // Счётчик глав на бейдже показываем точный — но только для видимых
    // карточек, чтобы не просматривать весь пул фидом
    const cards = await refineChapterCounts(slice).catch(() => slice);
    if (cards.length === 0) return null;

    const end = offset + limit;
    return { cards, hasMore: !pool.exhausted && total > end, total };
  }).then((page) => page ?? { cards: [], hasMore: false, total: 0 });
}

/* ------------------------------------------------------------------ */
/* Тайтл и главы                                                       */
/* ------------------------------------------------------------------ */

export interface MangaChapter {
  id: string;
  /** Номер главы: «12», «7.5», «-» если не пронумерована */
  chapter: string;
  volume?: string;
  title?: string;
  pages?: number;
  /** Дата публикации ISO */
  publishedAt?: string;
}

export interface MangaDetail extends AnimeCard {
  follows?: number;
  chapters: MangaChapter[];
  /** Всего глав на русском (feed отдаёт постранично) */
  chaptersTotal: number;
  /** Число глав, которое реально удалось получить (< chaptersTotal для длинных тайтлов) */
  chaptersLoaded: number;
  /** Страницы глав отдаёт только MangaDex — признак для выбора источника */
  readable: true;
}

/**
 * Главы по порядку чтения — по номеру главы, том лишь как tie-breaker.
 *
 * Нумерация у MangaDex сквозная по всему тайтлу: у «Берсерка» том 1 — это
 * главы 0.01–0.03, том 2 — 0.04 и дальше. Если сортировать сначала по
 * тому, порядок чтения ломается (главы 22, 17, 9 подряд).
 */
function sortChapters(chapters: MangaChapter[]): MangaChapter[] {
  // Главы без числового номера (бонус, пролог) уходят в конец списка
  const num = (value?: string) => {
    const parsed = parseFloat(value ?? "");
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
  };
  const compare = (a?: string, b?: string) => {
    const av = num(a);
    const bv = num(b);
    // Infinity − Infinity даёт NaN, а компаратор с NaN сортирует произвольно
    if (av === bv) return 0;
    return av < bv ? -1 : 1;
  };
  return [...chapters].sort((a, b) => {
    const byChapter = compare(a.chapter, b.chapter);
    if (byChapter !== 0) return byChapter;
    return compare(a.volume, b.volume);
  });
}

/**
 * Тайтл с главами. MangaDex отдаёт фид по 100 глав за раз; длинные тайтлы
 * (One Piece — 800+) подтягиваем ещё одним запросом со смещением, чтобы
 * список глав не обрывался на сотне.
 */
export async function mangaDetail(id: string): Promise<MangaDetail | null> {
  if (!isUuid(id)) return null;

  return cacheOnlyOk(`mdx:title:${id}`, TTL_TITLE, async () => {
    // Один тайтл берём по `ids[]`: `/manga?id=` MangaDex не принимает
    const list = await apiGet<MdxListResponse>(
      `/manga?ids[]=${id}&includes[]=cover_art&includes[]=tags`,
    );
    const item = list?.data?.[0];
    if (!item) return null;

    const poster = coverUrl(id, item);
    if (!poster) return null;

    const feedPath =
      `/manga/${id}/feed?translatedLanguage[]=ru&limit=100&order[chapter]=asc`;
    const feed = await apiGet<MdxFeedResponse>(feedPath);
    const total = feed?.total ?? 0;

    const entries = [...(feed?.data ?? [])];
    // Вторая страница фида — если глав больше сотни
    if (total > entries.length) {
      const next = await apiGet<MdxFeedResponse>(`${feedPath}&offset=${entries.length}`);
      entries.push(...(next?.data ?? []));
    }
    const chapters: MangaChapter[] = [];
    for (const entry of entries) {
      // Главы, помеченные недоступными, отдавать нечего — пропускаем
      if (entry.attributes.isUnavailable) continue;
      chapters.push({
        id: entry.id,
        chapter: entry.attributes.chapter ?? "",
        volume: entry.attributes.volume ?? undefined,
        title: entry.attributes.title || undefined,
        pages: entry.attributes.pages,
        publishedAt: entry.attributes.publishAt,
      });
    }

    const attrs = item.attributes ?? {};
    const { title, alt } = titleOf(attrs);
    const statsParams = new URLSearchParams();
    statsParams.append("manga[]", id);
    const stats = (await fetchStats([id]))?.[id];

    return {
      id,
      title,
      titleOrig: alt,
      year: typeof attrs.year === "number" ? attrs.year : undefined,
      poster,
      rating: stats?.rating?.average ?? undefined,
      ratingSource: "shikimori",
      kind: "tv",
      status: statusOf(attrs.status),
      genres: genresOf(attrs.tags),
      description: descriptionOf(attrs.description),
      follows: stats?.follows,
      chapters: sortChapters(chapters),
      chaptersTotal: total,
      chaptersLoaded: chapters.length,
      readable: true,
    } satisfies MangaDetail;
  });
}

/* ------------------------------------------------------------------ */
/* Страницы главы для ридера                                           */
/* ------------------------------------------------------------------ */

export interface ChapterPages {
  /** id главы */
  chapterId: string;
  /** Прямые URL страниц по порядку чтения */
  urls: string[];
  /** Всего страниц по данным MangaDex (может отличаться от urls.length) */
  total?: number;
}

/**
 * Страницы главы. MangaDex отдаёт временный `baseUrl` — он действует
 * несколько минут, поэтому ответ держим в кэше всего на пару минут и
 * каждый раз заново запрашиваем при заходе в главу.
 *
 * Главы без файлов (перевод ещё не выложен) дают пустой список — ридер
 * покажет заглушку.
 */
export async function chapterPages(chapterId: string): Promise<ChapterPages | null> {
  if (!isUuid(chapterId)) return null;

  return withCache(`mdx:pages:${chapterId}`, TTL_PAGES, async () => {
    const home = await apiGet<MdxAtHome>(`/at-home/server/${chapterId}`);
    const baseUrl = home?.baseUrl;
    const hash = home?.chapter?.hash;
    const files = home?.chapter?.data;
    if (!baseUrl || !hash || !files?.length) {
      return { chapterId, urls: [] };
    }
    return {
      chapterId,
      urls: files.map((file) => `${baseUrl}/data/${hash}/${file}`),
    };
  });
}
