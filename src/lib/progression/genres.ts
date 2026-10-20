/**
 * Сопоставление жанров из API с игровыми понятиями.
 *
 * Подписи жанров приходят от Kodik/AniLibria и не фиксированы: одно и то же
 * встречается и по-русски, и по-английски, и с разной транслитерацией
 * («Сёнэн», «Сенен», «Shounen», «Shonen»). Привязывать достижение к одной
 * строке означало бы либо неработающее достижение, либо срабатывание от
 * первого попавшегося значения.
 *
 * Поэтому здесь набор синонимов, а `genreCount` считает по совпадению с
 * любым из них. Новый жанр добавляется одной строкой в `ALIASES`.
 */

/** Ключи, под которые сходятся разные написания одного жанра */
export type GenreKey = "shonen" | "fantasy";

const ALIASES: Record<GenreKey, string[]> = {
  shonen: ["сенэн", "сенен", "сеньэн", "shounen", "shonen"],
  fantasy: ["фантастика", "фэнтези", "фентези", "fantasy"],
};

/**
 * Приводит подпись к сравнимому виду: нижний регистр, trimmed, «ё» → «е».
 *
 * Про NFKC: он НЕ разбирает кириллическую «ё» на «е» + диакритику — это
 * единственная русская буква, для которой разложение не применяется. Проверено
 * на Node: `normalize("NFKC")` оставляет ё в виде U+0451, и снятие
 * U+0300–U+036F не даёт ничего. Поэтому «ё» заменяется явно, а алиасы
 * записываются уже с «е»: иначе «Сёнэн» не нашёл бы сам себя.
 */
function normalize(genre: string): string {
  return genre
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/ё/g, "е");
}

/**
 * К какому игровому жанру относится подпись, или undefined.
 * Сравнение по вхождению: «Сёнэн» содержит «сенен», но не наоборот.
 */
export function genreKeyOf(genre: string): GenreKey | undefined {
  const g = normalize(genre);
  if (!g) return undefined;
  for (const key of Object.keys(ALIASES) as GenreKey[]) {
    if (ALIASES[key].some((alias) => g.includes(alias))) return key;
  }
  return undefined;
}

/** Сколько тайтлов досмотрено в указанном жанре */
export function genreCount(
  genreTitles: Record<string, string[]>,
  key: GenreKey,
): number {
  const aliases = ALIASES[key];
  // Один id может встретиться под двумя подписями жанра («Сёнэн» и
  // «Shounen» в одном документе), поэтому считаем множество, а не сумму.
  const seen = new Set<string>();
  for (const [genre, ids] of Object.entries(genreTitles)) {
    const g = normalize(genre);
    if (!aliases.some((alias) => g.includes(alias))) continue;
    for (const id of ids) seen.add(id);
  }
  return seen.size;
}

/**
 * Записывает тайтл в счётчики жанров.
 *
 * Один тайттл с несколькими жанрами попадает в каждый из них, но повторное
 * событие по тому же тайтлу ничего не добавляет — иначе пересмотр серии
 * задваивал бы прогресс.
 */
export function trackGenre(
  genreTitles: Record<string, string[]>,
  titleId: string,
  genres: string[] | undefined,
): void {
  if (!genres?.length) return;
  for (const genre of genres) {
    const g = genre?.trim();
    if (!g) continue;
    const list = genreTitles[g] ?? (genreTitles[g] = []);
    if (!list.includes(titleId)) list.push(titleId);
  }
}