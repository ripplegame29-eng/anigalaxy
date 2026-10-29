/**
 * Выбор правильного персонажа среди результатов AniList.
 * Поиск «Haku» находит десяток героев с таким именем; чтобы на карточке не оказался
 * герой другого аниме, сверяем ещё и тайтл, в котором он снимается.
 */

/** Серия в каталоге → фрагменты названий тайтла на AniList (нижний регистр) */
export const SERIES_KEYS: Record<string, string[]> = {
  "Наруто": ["naruto"],
  "Ван-Пис": ["one piece"],
  "Блич": ["bleach"],
  "Атака титанов": ["shingeki", "attack on titan"],
  "Истребитель демонов": ["kimetsu", "demon slayer"],
  "Магическая битва": ["jujutsu"],
  "Тетрадь смерти": ["death note"],
  "Стальной алхимик": ["fullmetal", "hagane"],
  "Охотник х Охотник": ["hunter x hunter"],
  "Драгонболл": ["dragon ball"],
  "Моя геройская академия": ["boku no hero", "my hero"],
  "Ванпанчмен": ["one punch", "one-punch"],
  "Мастера Меча Онлайн": ["sword art"],
  "Токийский гуль": ["tokyo ghoul"],
  "Семья шпиона": ["spy x family", "spy×family"],
  "Человек-бензопила": ["chainsaw"],
  "Провожающая в последний путь Фрирен": ["frieren", "sousou"],
  "Re:Zero": ["re:zero"],
  "Коносуба": ["kono subarashii", "konosuba"],
  "Хвост Феи": ["fairy tail"],
  "Чёрный клевер": ["black clover"],
  "Евангелион": ["evangelion"],
  "Врата Штейна": ["steins"],
  "Волейбол!!": ["haikyuu"],
  "Доктор Стоун": ["dr. stone", "dr stone"],
  "Судьба": ["fate"],
  "Ковбой Бибоп": ["cowboy bebop"],
  "Моб Психо 100": ["mob psycho"],
  "Невероятные приключения ДжоДжо": ["jojo"],
  "Код Гиасс": ["code geass"],
  "Поднятие уровня в одиночку": ["solo leveling", "ore dake"],
  "Оши но Ко": ["oshi no ko"],
  "Оверлорд": ["overlord"],
  "Гинтама": ["gintama"],
  "Семь смертных грехов": ["nanatsu", "seven deadly"],
  "О моём перерождении в слизь": ["slime", "tensei shitara"],
  "Хеллсинг": ["hellsing"],
  "Берсерк": ["berserk"],
  "Токийские мстители": ["tokyo revengers"],
  "Синяя тюрьма": ["blue lock"],
  "Пламенная бригада": ["fire force", "enen no shouboutai"],
};

export const ART_QUERY = `query ($q: String) { Page(page: 1, perPage: 15) { characters(search: $q, sort: FAVOURITES_DESC) { image { large } name { full alternative } media(perPage: 6, sort: POPULARITY_DESC) { nodes { title { romaji english } } } } } }`;

export interface RawChar {
  image?: { large?: string | null } | null;
  name?: { full?: string | null; alternative?: (string | null)[] | null } | null;
  media?: { nodes?: { title?: { romaji?: string | null; english?: string | null } | null }[] | null } | null;
}

/** Адрес арта нужного персонажа или null, если подходящего нет */
export function pickImage(search: string, series: string, chars: RawChar[]): string | null {
  const q = search.toLowerCase().trim();
  const keys = SERIES_KEYS[series];
  let best: { url: string; score: number } | null = null;
  for (const c of chars) {
    const url = c.image?.large;
    if (!url || url.includes("default")) continue;
    const names = [c.name?.full, ...(c.name?.alternative ?? [])].filter((n): n is string => !!n).map((n) => n.toLowerCase());
    const nameScore = names.some((n) => n === q) ? 3 : names.some((n) => n.split(/\s+/).includes(q) || n.startsWith(q) || q.startsWith(n)) ? 2 : names.some((n) => n.includes(q)) ? 1 : 0;
    const titles = (c.media?.nodes ?? []).flatMap((m) => [m.title?.romaji, m.title?.english]).filter((t): t is string => !!t).map((t) => t.toLowerCase());
    const seriesOk = !keys || titles.some((t) => keys.some((k) => t.includes(k)));
    if (!seriesOk || nameScore === 0) continue;
    const score = nameScore + (keys ? 3 : 0);
    if (!best || score > best.score) best = { url, score };
  }
  return best ? best.url : null;
}
