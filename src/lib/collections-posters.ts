import { list, withCache } from "./kodik";
import { toCard } from "./anime";
import { normalizeTitle } from "./collections-catalog";

/**
 * Постеры для плиток подборок.
 *
 * В макете вместо картинок стояли цветные градиенты-заглушки. Настоящие
 * обложки берём у Kodik — тем же `/list`, что и карточки каталога, с
 * той же схемой разбора (`toCard`), — и складываем в индекс
 * «название тайтла → постер».
 *
 * Почему индекс, а не поиск по каждому названию. Название из подборки мы
 * берём у Kodik, а он у каждого тайтла свой (Overlord у него «Повелитель»,
 * а Hunter x Hunter — «Охотник х Охотник»), и поиск по названию находит
 * не всегда: подстрока даёт чужие тайтлы, а лишние совпадения в выдаче
 * означали бы чужие постеры. Здесь обратный порядок: сначала настоящие
 * тайтлы из выборок Kodik, потом точное совпадение по названию.
 *
 * Если тайтла в индексе нет (например, Kodik временно недоступен), плитка
 * остаётся градиентной — ровно то, что рисует макет без картинки.
 */

/** Обложки не меняются годами, а выборки Kodik — тем более: шесть часов */
const MINUTE = 60_000;

const TTL = 6 * MINUTE;

/**
 * Жанры Kodik, из которых собраны тайтлы подборок. Названия подборок
 * придуманы, тайтлы внутри — настоящие и взяты из этих выборок, поэтому
 * индекс закроет все плитки.
 */
const SOURCES: (string | undefined)[] = [
  undefined, // общий топ по рейтингу
  "исэкай",
  "фэнтези",
  "драма",
  "мелодрама",
  "детектив",
  "фантастика",
  "спорт",
  "семейный",
  "короткометражка",
  "боевик",
  "ужасы",
];

/** Сколько уникальных тайтлов набираем с одного жанра */
const WANT = 26;

/**
 * Kodik отдаёт по 100 material-записей на страницу, а на один тайтл их
 * приходится до дюжины (по записи на озвучку) — ради 26 названий приходится
 * брать несколько страниц подряд.
 */
const MAX_PAGES = 4;

/** Сколько жанров тянем одновременно */
const CONCURRENCY = 6;

/** В out-URL Kodik лежит готовый query — вытаскиваем из него курсор `next` */
function extractCursor(nextPage: string | null): string | undefined {
  if (!nextPage) return undefined;
  try {
    return new URL(nextPage, "https://kodik-api.com").searchParams.get("next") ?? undefined;
  } catch {
    return undefined;
  }
}

/** Индекс обложек одной выборки Kodik: «название → постер» */
async function sourceIndex(genre: string | undefined): Promise<Record<string, string>> {
  const index: Record<string, string> = {};
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await list({
      types: "anime,anime-serial",
      all_genres: genre,
      limit: 100,
      sort: "shikimori_rating",
      order: "desc",
      with_material_data: 1,
      next: cursor,
    });

    for (const raw of res.results ?? []) {
      const card = toCard(raw);
      const title = normalizeTitle(card.title);
      if (title && card.poster && !index[title]) index[title] = card.poster;
    }

    cursor = extractCursor(res.next_page);
    if (!cursor || Object.keys(index).length >= WANT) break;
  }

  return index;
}

/** Жанры по очереди, по несколько сразу — Kodik не любит лавину запросов */
async function collectSources(): Promise<Record<string, string>> {
  const merged: Record<string, string> = {};

  const chunks: (string | undefined)[][] = Array.from({ length: CONCURRENCY }, () => []);
  SOURCES.forEach((genre, i) => chunks[i % CONCURRENCY].push(genre));

  await Promise.all(
    chunks.map(async (chunk) => {
      for (const genre of chunk) {
        try {
          const part = await sourceIndex(genre);
          for (const [title, poster] of Object.entries(part)) {
            if (!merged[title]) merged[title] = poster;
          }
        } catch {
          /* Один жанр не пришёл — подборки на него останутся без обложек,
             остальные соберутся как обычно. */
        }
      }
    }),
  );

  return merged;
}

/**
 * Индекс обложек подборок: «название тайтла в нормализованном виде → постер».
 *
 * Один раз на процесс (кэш в памяти), дальше отдаётся мгновенно.
 */
export function collectionPosters(): Promise<Record<string, string>> {
  return withCache("collections:posters:v3", TTL, collectSources);
}