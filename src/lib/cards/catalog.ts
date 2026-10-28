/**
 * Каталог карт AniGalaxy: персонажи популярных аниме.
 *
 * Строка: ранг | имя | поисковое имя для AniList | тайтл | стихия | класс
 * Ранг: 0 обычная, 1 редкая, 2 эпическая, 3 легендарная, 4 мифическая.
 * Арт подтягивает `tools/cards-sync.mjs`; пока файла нет, рисуется заглушка.
 */

import type { CardClass, Element, Rank } from "./config";

export interface CardDef {
  id: string;
  rank: Rank;
  name: string;
  /** Имя для поиска на AniList */
  search: string;
  series: string;
  element: Element;
  cls: CardClass;
  atk: number;
  def: number;
  hp: number;
  spd: number;
  /** Короткая цитата/описание */
  blurb: string;
}

const T = (el: string): Element => ({ f: "fire", w: "water", a: "wind", e: "earth", l: "light", d: "dark" } as const)[el as "f"];
const C = (c: string): CardClass => ({ w: "warrior", m: "mage", t: "tank", a: "assassin", s: "support" } as const)[c as "w"];

const RAW = `
0|Сакура Харуно|Sakura Haruno|Наруто|e|s
0|Рок Ли|Rock Lee|Наруто|w|w
0|Шикамару Нара|Shikamaru Nara|Наруто|d|m
0|Усопп|Usopp|Ван-Пис|a|a
0|Тони Тони Чоппер|Tony Tony Chopper|Ван-Пис|e|s
0|Нами|Nami|Ван-Пис|a|m
0|Рукия Кучики|Rukia Kuchiki|Блич|w|m
0|Армин Арлерт|Armin Arlert|Атака титанов|w|s
0|Зеницу Агацума|Zenitsu Agatsuma|Истребитель демонов|a|a
0|Иноске Хашибира|Inosuke Hashibira|Истребитель демонов|e|w
0|Нэдзуко Камадо|Nezuko Kamado|Истребитель демонов|f|t
0|Нобара Кугисаки|Nobara Kugisaki|Магическая битва|e|m
0|Тоге Инумаки|Toge Inumaki|Магическая битва|a|s
0|Мису Амане|Misa Amane|Тетрадь смерти|l|s
0|Рюк|Ryuk|Тетрадь смерти|d|m
0|Альфонс Элрик|Alphonse Elric|Стальной алхимик|e|t
0|Риза Хоукай|Riza Hawkeye|Стальной алхимик|f|a
0|Гон Фрикс|Gon Freecss|Охотник х Охотник|e|w
0|Пикколо|Piccolo|Драгонболл|e|t
0|Очако Урарака|Ochaco Uraraka|Моя геройская академия|l|s
0|Генос|Genos|Ванпанчмен|f|m
0|Асуна Юки|Asuna Yuuki|Мастера Меча Онлайн|w|w
0|Тока Кирисима|Touka Kirishima|Токийский гуль|w|a
0|Аня Форджер|Anya Forger|Семья шпиона|l|s
0|Пауэр|Power|Человек-бензопила|f|w
0|Аки Хаякава|Aki Hayakawa|Человек-бензопила|d|a
0|Фрирен|Frieren|Провожающая в последний путь Фрирен|l|m
0|Ферн|Fern|Провожающая в последний путь Фрирен|a|m
0|Рем|Rem|Re:Zero|w|t
0|Эмилия|Emilia|Re:Zero|w|m
0|Мэгумин|Megumin|Коносуба|f|m
0|Аква|Aqua|Коносуба|w|s
0|Люси Хартфилия|Lucy Heartfilia|Хвост Феи|l|s
0|Грей Фуллбастер|Gray Fullbuster|Хвост Феи|w|m
0|Аста|Asta|Чёрный клевер|d|w
0|Юно|Yuno|Чёрный клевер|a|m
0|Синдзи Икари|Shinji Ikari|Евангелион|d|t
0|Курису Макисэ|Kurisu Makise|Врата Штейна|l|s
0|Сёё Хината|Shoyo Hinata|Волейбол!!|f|a
0|Сэнку Исигами|Senku Ishigami|Доктор Стоун|e|s
1|Саске Утиха|Sasuke Uchiha|Наруто|f|a
1|Хината Хьюга|Hinata Hyuga|Наруто|l|s
1|Гаара|Gaara|Наруто|e|t
1|Джирайя|Jiraiya|Наруто|f|m
1|Ророноа Зоро|Roronoa Zoro|Ван-Пис|a|w
1|Санджи|Sanji|Ван-Пис|f|w
1|Нико Робин|Nico Robin|Ван-Пис|d|m
1|Трафальгар Ло|Trafalgar Law|Ван-Пис|d|m
1|Тосиро Хицугая|Toshiro Hitsugaya|Блич|w|m
1|Йоруичи Шихоин|Yoruichi Shihoin|Блич|d|a
1|Микаса Аккерман|Mikasa Ackerman|Атака титанов|a|a
1|Эрвин Смит|Erwin Smith|Атака титанов|l|s
1|Гию Томиока|Giyu Tomioka|Истребитель демонов|w|w
1|Синобу Кочо|Shinobu Kocho|Истребитель демонов|a|a
1|Тэнгэн Узуй|Tengen Uzui|Истребитель демонов|l|w
1|Мэгуми Фусигуро|Megumi Fushiguro|Магическая битва|d|m
1|Маки Дзенин|Maki Zenin|Магическая битва|e|w
1|Эдвард Элрик|Edward Elric|Стальной алхимик|e|w
1|Курапика|Kurapika|Охотник х Охотник|l|m
1|Вегета|Vegeta|Драгонболл|l|w
1|Сёто Тодороки|Shoto Todoroki|Моя геройская академия|w|m
1|Кацуки Бакуго|Katsuki Bakugo|Моя геройская академия|f|w
1|Кирито|Kirito|Мастера Меча Онлайн|d|w
1|Кэн Канэки|Ken Kaneki|Токийский гуль|d|a
1|Йор Форджер|Yor Forger|Семья шпиона|d|a
1|Лойд Форджер|Loid Forger|Семья шпиона|l|a
1|Денджи|Denji|Человек-бензопила|f|w
1|Рин Тосака|Rin Tohsaka|Судьба|f|m
1|Рэй Аянами|Rei Ayanami|Евангелион|w|s
1|Аска Лэнгли Сорю|Asuka Langley Soryu|Евангелион|f|w
1|Спайк Шпигель|Spike Spiegel|Ковбой Бибоп|d|a
1|Ринтаро Окабэ|Rintaro Okabe|Врата Штейна|l|m
1|Нацу Драгнил|Natsu Dragneel|Хвост Феи|f|w
1|Сигэо Кагеяма|Shigeo Kageyama|Моб Психо 100|l|m
1|Субару Нацуки|Subaru Natsuki|Re:Zero|d|s
1|Дзётаро Кудзё|Jotaro Kujo|Невероятные приключения ДжоДжо|w|w
2|Наруто Удзумаки|Naruto Uzumaki|Наруто|f|w
2|Какаши Хатаке|Kakashi Hatake|Наруто|l|a
2|Итачи Утиха|Itachi Uchiha|Наруто|d|a
2|Минато Намиказе|Minato Namikaze|Наруто|l|a
2|Монки Д. Луффи|Monkey D. Luffy|Ван-Пис|f|w
2|Портгас Д. Эйс|Portgas D. Ace|Ван-Пис|f|w
2|Боа Хэнкок|Boa Hancock|Ван-Пис|d|a
2|Ичиго Куросаки|Ichigo Kurosaki|Блич|l|w
2|Бьякуя Кучики|Byakuya Kuchiki|Блич|w|m
2|Леви Аккерман|Levi|Атака титанов|a|a
2|Танджиро Камадо|Tanjiro Kamado|Истребитель демонов|w|w
2|Кёджуро Ренгоку|Kyojuro Rengoku|Истребитель демонов|f|w
2|Юдзи Итадори|Yuji Itadori|Магическая битва|f|w
2|Лайт Ягами|Light Yagami|Тетрадь смерти|d|m
2|Эл Лоулайт|L|Тетрадь смерти|l|m
2|Киллуа Золдик|Killua Zoldyck|Охотник х Охотник|a|a
2|Хисока Морроу|Hisoka Morow|Охотник х Охотник|d|a
2|Сон Гоку|Son Goku|Драгонболл|l|w
2|Изуку Мидория|Izuku Midoriya|Моя геройская академия|a|w
2|Сайтама|Saitama|Ванпанчмен|l|w
2|Эндевор|Endeavor|Моя геройская академия|f|t
2|Тацумаки|Tatsumaki|Ванпанчмен|a|m
2|Лелуш Ламперуж|Lelouch Lamperouge|Код Гиасс|d|m
2|Эрза Скарлет|Erza Scarlet|Хвост Феи|f|w
2|Эрен Йегер|Eren Yeager|Атака титанов|f|w
2|Дио Брандо|Dio Brando|Невероятные приключения ДжоДжо|d|a
2|Химмель|Himmel the Hero|Провожающая в последний путь Фрирен|l|w
2|Мэкима|Makima|Человек-бензопила|d|m
3|Всемогущий|All Might|Моя геройская академия|l|w
3|Сатору Годжо|Satoru Gojo|Магическая битва|l|m
3|Мадара Утиха|Madara Uchiha|Наруто|f|m
3|Шанкс|Shanks|Ван-Пис|f|w
3|Соскэ Айзен|Sosuke Aizen|Блич|d|m
3|Кенпачи Зараки|Kenpachi Zaraki|Блич|e|w
3|Кайдо|Kaido|Ван-Пис|w|t
3|Музан Кибуцудзи|Muzan Kibutsuji|Истребитель демонов|d|m
3|Ёрихити Цугикуни|Yoriichi Tsugikuni|Истребитель демонов|f|w
3|Сон Джин-У|Sung Jinwoo|Поднятие уровня в одиночку|d|a
3|Фризер|Frieza|Драгонболл|d|m
3|Гильгамеш|Gilgamesh|Судьба|l|w
3|Артурия Пендрагон|Artoria Pendragon|Судьба|l|w
3|Гароу|Garou|Ванпанчмен|e|w
3|Джорно Джованна|Giorno Giovanna|Невероятные приключения ДжоДжо|l|s
3|Хролло Люцифер|Chrollo Lucilfer|Охотник х Охотник|d|a
4|Рёмэн Сукуна|Ryomen Sukuna|Магическая битва|d|m
4|Гол Д. Роджер|Gol D. Roger|Ван-Пис|d|w
4|Ай Хоси|Ai Hoshino|Оши но Ко|l|s
4|Хагоромо Оцуцуки|Hagoromo Otsutsuki|Наруто|l|m
4|Ихваш|Yhwach|Блич|d|m
4|Меруэм|Meruem|Охотник х Охотник|d|w
4|Айнз Оал Гоун|Ainz Ooal Gown|Оверлорд|d|m
4|Эдвард Ньюгейт|Edward Newgate|Ван-Пис|w|t
`;

const BASE: Record<number, [number, number, number, number]> = {
  0: [50, 40, 300, 40],
  1: [75, 60, 420, 50],
  2: [110, 85, 600, 60],
  3: [160, 120, 880, 72],
  4: [230, 170, 1250, 85],
};

/** Склонность стихии/класса к статам (множители в процентах) */
const CLS_MUL: Record<CardClass, [number, number, number, number]> = {
  warrior: [112, 100, 105, 100],
  mage: [118, 85, 90, 105],
  tank: [85, 130, 125, 85],
  assassin: [120, 85, 85, 125],
  support: [90, 105, 110, 108],
};

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function build(): CardDef[] {
  const out: CardDef[] = [];
  const seen = new Set<string>();
  for (const line of RAW.trim().split("\n")) {
    const [r, name, search, series, el, c] = line.split("|");
    const rank = Number(r) as Rank;
    let id = slug(search);
    while (seen.has(id)) id += "-x";
    seen.add(id);
    const cls = C(c);
    const mul = CLS_MUL[cls];
    const b = BASE[rank];
    const h = hash(id);
    const jit = (n: number) => 96 + ((h >>> n) % 9); // 96..104
    out.push({
      id,
      rank,
      name,
      search,
      series,
      element: T(el),
      cls,
      atk: Math.round((b[0] * mul[0] * jit(1)) / 10000),
      def: Math.round((b[1] * mul[1] * jit(5)) / 10000),
      hp: Math.round((b[2] * mul[2] * jit(9)) / 10000),
      spd: Math.round((b[3] * mul[3] * jit(13)) / 10000),
      blurb: "",
    });
  }
  return out;
}

export const CATALOG: CardDef[] = build();
const BY_ID = new Map(CATALOG.map((c) => [c.id, c]));

export const cardDef = (id: string): CardDef | undefined => BY_ID.get(id);
export const cardsOfRank = (rank: Rank): CardDef[] => CATALOG.filter((c) => c.rank === rank);
