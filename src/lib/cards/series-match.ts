import { CATALOG } from "./catalog";
/**
 * Связь «название тайтла на сайте → серия карточек гачи».
 * Названия на сайте приходят от Kodik/AniLiberty и редко совпадают с серией один в один,
 * поэтому у части серий есть запасные написания.
 */

/** Серия → все написания, по которым узнаём тайтл (первое — и поисковое для постера) */
export const SERIES_ALIASES: Record<string, string[]> = {
  "Убийца Акамэ": ["убийца акамэ", "akame ga kill"],
  "Детектив Конан": ["детектив конан", "detective conan", "meitantei conan"],
  "Сейлор Мун": ["сейлор мун", "sailor moon"],
  "Код Гиас": ["код гиас", "code geass"],
  "Киберпанк: Бегущие по краю": ["бегущие по краю", "edgerunners"],
  "Инуяся": ["инуяся", "inuyasha"],
  "Баскетбол Куроко": ["баскетбол куроко", "kuroko no basket"],
  "Сага о Винланде": ["сага о винланде", "vinland saga"],
  "Мадока Магика": ["мадока", "madoka magica"],
  "Слэм-данк": ["слэм-данк", "slam dunk"],
  "Подземелье вкусностей": ["подземелье вкусностей", "dungeon meshi", "delicious in dungeon"],
  "Одинокий рокер": ["одинокий рокер", "bocchi the rock"],
  "Моногатари": ["моногатари", "monogatari"],
  "Квинтэссенция квинтетов": ["квинтэссенция квинтетов", "5-toubun", "gotoubun"],
  "К-Он!": ["к-он", "k-on"],
  "Гуррен-Лаганн": ["гуррен-лаганн", "гуррен лаганн", "gurren lagann"],
  "Госпожа Кагуя": ["госпожа кагуя", "kaguya-sama"],
  "Бродяга Кэнсин": ["бродяга кэнсин", "rurouni kenshin"],
  "Дандадан": ["дандадан", "dandadan"],
  "Монолог фармацевта": ["монолог фармацевта", "kusuriya no hitorigoto"],
  "Обещанный Неверленд": ["обещанный неверленд", "promised neverland"],
  "Пожиратель душ": ["пожиратель душ", "soul eater"],
  "Психо-паспорт": ["психо-паспорт", "psycho-pass"],
  "Реинкарнация безработного": ["реинкарнация безработного", "mushoku tensei"],
  "Тёмный дворецкий": ["тёмный дворецкий", "темный дворецкий", "kuroshitsuji"],
  "Тень в диком мире": ["тень в диком мире", "kage no jitsuryokusha"],
  "Созданный в Бездне": ["созданный в бездне", "made in abyss"],
  "Кайдзю №8": ["кайдзю", "kaiju no. 8"],
  "Любимый во Франксе": ["любимый во франксе", "darling in the franxx"],
  "Бог башни": ["бог башни", "tower of god"],
  "Но гейм но лайф": ["но гейм но лайф", "no game no life"],
  "Наруто": ["наруто", "naruto"],
  "Ван-Пис": ["ван-пис", "ван пис", "one piece"],
  "Блич": ["блич", "bleach"],
  "Атака титанов": ["атака титанов", "shingeki no kyojin", "attack on titan"],
  "Истребитель демонов": ["истребитель демонов", "клинок, рассекающий демонов", "клинок рассекающий демонов", "kimetsu no yaiba"],
  "Магическая битва": ["магическая битва", "jujutsu kaisen"],
  "Тетрадь смерти": ["тетрадь смерти", "death note"],
  "Стальной алхимик": ["стальной алхимик", "fullmetal alchemist"],
  "Охотник х Охотник": ["охотник х охотник", "hunter x hunter", "hunter × hunter"],
  "Драгонболл": ["драгонболл", "драконий жемчуг", "dragon ball"],
  "Моя геройская академия": ["моя геройская академия", "my hero academia", "boku no hero"],
  "Ванпанчмен": ["ванпанчмен", "one punch man", "one-punch man"],
  "Мастера Меча Онлайн": ["мастера меча онлайн", "sword art online"],
  "Токийский гуль": ["токийский гуль", "tokyo ghoul"],
  "Семья шпиона": ["семья шпиона", "spy x family", "spy × family"],
  "Человек-бензопила": ["человек-бензопила", "chainsaw man"],
  "Провожающая в последний путь Фрирен": ["провожающая в последний путь фрирен", "фрирен", "frieren"],
  "Re:Zero": ["re:zero", "re: zero", "ре:зеро", "жизнь с нуля в альтернативном мире"],
  "Коносуба": ["коносуба", "этот замечательный мир", "konosuba"],
  "Хвост Феи": ["хвост феи", "fairy tail"],
  "Чёрный клевер": ["чёрный клевер", "черный клевер", "black clover"],
  "Евангелион": ["евангелион", "evangelion"],
  "Врата Штейна": ["врата штейна", "steins;gate", "steins gate"],
  "Волейбол!!": ["волейбол", "haikyuu"],
  "Доктор Стоун": ["доктор стоун", "dr. stone", "dr stone"],
  "Судьба": ["судьба/", "судьба:", "fate/", "fate zero", "судьба ночь схватки"],
  "Ковбой Бибоп": ["ковбой бибоп", "cowboy bebop"],
  "Моб Психо 100": ["моб психо", "mob psycho"],
  "Невероятные приключения ДжоДжо": ["джоджо", "jojo"],
  "Код Гиасс": ["код гиас", "code geass"],
  "Поднятие уровня в одиночку": ["поднятие уровня в одиночку", "solo leveling"],
  "Оши но Ко": ["оши но ко", "oshi no ko", "звёздное дитя", "звездное дитя"],
  "Оверлорд": ["оверлорд", "overlord"],
  "Гинтама": ["гинтама", "gintama"],
  "Семь смертных грехов": ["семь смертных грехов", "nanatsu no taizai", "seven deadly sins"],
  "Могущественнейший демон": ["могущественнейший демон", "сильнейший демон", "maou gakuin"],
  "О моём перерождении в слизь": ["перерождении в слизь", "перерождение в слизь", "slime"],
  "Хеллсинг": ["хеллсинг", "hellsing"],
  "Берсерк": ["берсерк", "berserk"],
  "Токийские мстители": ["токийские мстители", "tokyo revengers"],
  "Синяя тюрьма": ["синяя тюрьма", "blue lock"],
  "Пламенная бригада": ["пламенная бригада", "fire force", "enen no shouboutai"],
};

const norm = (s: string): string => s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();

/** Какой серии карточек соответствует тайтл (null — карточек у него нет) */
export function seriesForTitle(title: string, extra: string[] = []): string | null {
  const hay = [title, ...extra].filter(Boolean).map(norm);
  let best: { s: string; at: number } | null = null;
  for (const [series, list] of Object.entries(SERIES_ALIASES)) {
    for (const a of list) {
      const key = norm(a);
      for (const h of hay) {
        const at = h.indexOf(key);
        // побеждает написание, которое стоит в названии раньше («Боруто: …Наруто» не должен стать Наруто, но и «Блич: …» стать Бличем)
        if (at >= 0 && (!best || at < best.at)) best = { s: series, at };
      }
    }
  }
  if (best) return best.s;
  // Запасной путь: любая серия каталога, чьё название (от 4 символов) встречается в названии тайтла
  for (const series of catalogSeries()) {
    const key = norm(series);
    if (key.length < 4) continue;
    for (const h of hay) {
      const at = h.indexOf(key);
      if (at >= 0 && (!best || at < best.at || (at === best.at && key.length > norm(best.s).length))) best = { s: series, at };
    }
  }
  return best?.s ?? null;
}

let seriesCache: string[] | null = null;
function catalogSeries(): string[] {
  if (!seriesCache) seriesCache = [...new Set(CATALOG.map((c) => c.series))].filter((x) => x && x !== "тайтл");
  return seriesCache;
}
