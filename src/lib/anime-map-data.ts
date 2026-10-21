/**
 * Данные карты аниме: маршруты, узлы и награды. Чистый модуль без браузерных
 * зависимостей — его проверяет тест (все награды существуют в магазине).
 */

import { PROGRESSION_CONFIG } from "./progression/progression.config";
import { FRAMES } from "./cosmetics";

export type ItemKind = "tag" | "frame" | "title";

export interface MapNode {
  id: string;
  title: string;
  /** Запрос для поиска постера и страницы в каталоге */
  q: string;
  /** Подстроки (в нижнем регистре), по которым узнаём тайтл в истории просмотра */
  match: string[];
  kind: "ТВ Сериал" | "Фильм";
  year: number;
  /** Сколько серий посмотреть (у фильма — 1) */
  need: number;
  ac: number;
  xp: number;
  /** Предмет из магазина, который дают бесплатно */
  item?: string;
  requires: string[];
  x: number;
  y: number;
  tag?: "main" | "side" | "boss";
  blurb: string;
}

export interface MapRoute {
  id: string;
  title: string;
  subtitle: string;
  c1: string;
  c2: string;
  bonus: { ac: number; xp: number; label: string; item: string; items?: string[] };
  nodes: MapNode[];
}

/** [id, название, запрос, подстроки через |, год, x, y, требует через |, описание, предмет, метка] */
type Row = [string, string, string, string, number, number, number, string, string, string?, ("side" | "boss")?];

function build(rows: Row[], movies: string[] = []): MapNode[] {
  return rows.map((r, i) => {
    const boss = r[10] === "boss";
    const movie = movies.includes(r[0]);
    return {
      id: r[0],
      title: r[1],
      q: r[2],
      match: r[3].split("|"),
      kind: movie ? "Фильм" : "ТВ Сериал",
      year: r[4],
      need: movie ? 1 : boss ? 5 : 3,
      ac: boss ? 150 : 50 + i * 10,
      xp: boss ? 90 : 30 + i * 6,
      item: r[9] || undefined,
      requires: r[7] ? r[7].split("|") : [],
      x: r[5],
      y: r[6],
      tag: r[10] ?? (r[9] ? "main" : "main"),
      blurb: r[8],
    };
  });
}

export const ROUTES: MapRoute[] = [
  {
    id: "classic",
    title: "Золотая классика",
    subtitle: "Тайтлы, с которых начинали все",
    c1: "#ffb347",
    c2: "#ff5d8f",
    bonus: { ac: 400, xp: 200, label: "Знаток классики", item: "tag_izbrannyy" },
    nodes: build([
      ["bebop", "Ковбой Бибоп", "Ковбой Бибоп", "ковбой бибоп|cowboy bebop", 1998, 0, 120, "", "Джаз, космос и охотники за головами — эталон стиля.", "gt-wanderer"],
      ["champloo", "Самурай Чамплу", "Самурай Чамплу", "самурай чамплу|champloo", 2004, 220, 0, "bebop", "Хип-хоп и катаны от тех же авторов.", "tag_ronin", "side"],
      ["eva", "Евангелион", "Евангелион", "евангелион|evangelion", 1995, 220, 240, "bebop", "Мехи, психология и конец света.", "frame-13"],
      ["fma", "Стальной алхимик: Братство", "Стальной алхимик Братство", "стальной алхимик|fullmetal", 2009, 440, 240, "eva", "Равноценный обмен и путь двух братьев.", "gt-blade-master"],
      ["deathnote", "Тетрадь смерти", "Тетрадь смерти", "тетрадь смерти|death note", 2006, 660, 120, "fma", "Дуэль двух гениев с тетрадью в руках.", "tag_bezumnyygeniy"],
      ["hxh", "Хантер х Хантер", "Хантер х Хантер 2011", "хантер|hunter x hunter", 2011, 880, 120, "deathnote", "Финал маршрута: большое приключение.", "frame-golden-laurel", "boss"],
    ]),
  },
  {
    id: "shonen",
    title: "Путь шонена",
    subtitle: "Драки, дружба и характер",
    c1: "#2b9bff",
    c2: "#22d3ee",
    bonus: { ac: 450, xp: 220, label: "Герой шонена", item: "tag_bossfinala" },
    nodes: build([
      ["naruto", "Наруто", "Наруто", "наруто", 2002, 0, 140, "", "Мальчик-изгой мечтает стать Хокаге.", "gt-recruit"],
      ["shippuden", "Наруто: Ураганные хроники", "Наруто Ураганные хроники", "ураганные хроники|shippuden", 2007, 220, 140, "naruto", "Продолжение: взросление и большая война.", "tag_shinobi"],
      ["boruto", "Боруто", "Боруто", "боруто|boruto", 2017, 440, 20, "shippuden", "Новое поколение шиноби.", "tag_outcast", "side"],
      ["bleach", "Блич", "Блич", "блич|bleach", 2004, 440, 260, "shippuden", "Синигами, пустые и громкий стиль.", "gt-moon-reaper"],
      ["mha", "Моя геройская академия", "Моя геройская академия", "геройская академия|my hero academia", 2016, 660, 140, "shippuden", "Супергерои в школьной форме.", "frame-24"],
      ["aot", "Атака титанов", "Атака титанов", "атака титанов|attack on titan", 2013, 880, 140, "mha|bleach", "Финал маршрута: стены падут.", "frame-golden-moths", "boss"],
    ]),
  },
  {
    id: "dark",
    title: "Тёмное фэнтези",
    subtitle: "Кровь, мрак и сильные истории",
    c1: "#a78bfa",
    c2: "#ff4d6d",
    bonus: { ac: 450, xp: 220, label: "Ночной охотник", item: "tag_curse_king" },
    nodes: build([
      ["berserk", "Берсерк", "Берсерк 1997", "берсерк|berserk", 1997, 0, 130, "", "Гатс и меч размером с человека.", "gt-cursed"],
      ["hellsing", "Хеллсинг", "Хеллсинг", "хеллсинг|hellsing", 2006, 220, 20, "berserk", "Вампиры против вампиров.", "tag_demon", "side"],
      ["ghoul", "Токийский гуль", "Токийский гуль", "токийский гуль|tokyo ghoul", 2014, 220, 250, "berserk", "Студент, ставший наполовину гулем.", "tag_cursed"],
      ["jjk", "Магическая битва", "Магическая битва", "магическая битва|jujutsu", 2020, 440, 250, "ghoul", "Проклятия и экзорцисты.", "frame-ghost-flame"],
      ["csm", "Человек-бензопила", "Человек-бензопила", "бензопила|chainsaw", 2022, 660, 130, "jjk", "Безумный и стильный боевик.", "frame-30"],
      ["kny", "Клинок, рассекающий демонов", "Клинок рассекающий демонов", "клинок|demon slayer|kimetsu", 2019, 880, 130, "csm", "Финал маршрута: красота и боль.", "frame-crimson-seal", "boss"],
    ]),
  },
  {
    id: "soft",
    title: "Уют и чувства",
    subtitle: "Когда хочется тепла и мурашек",
    c1: "#ff8fb1",
    c2: "#8bd3ff",
    bonus: { ac: 400, xp: 200, label: "Тёплое сердце", item: "tag_tsundere" },
    nodes: build(
      [
        ["toradora", "Торадора!", "Торадора", "торадора|toradora", 2008, 0, 130, "", "Две колючки и одна большая симпатия.", "gt-wayfarer"],
        ["yourname", "Твоё имя", "Твоё имя", "твоё имя|твое имя|kimi no na wa|your name", 2016, 220, 20, "toradora", "Двое меняются телами и находят друг друга.", "frame-lunar-feather", "side"],
        ["voice", "Форма голоса", "Форма голоса", "форма голоса|koe no katachi", 2016, 220, 250, "toradora", "История о прощении и том, как услышать другого.", "gt-adventurer"],
        ["howl", "Ходячий замок Хаула", "Ходячий замок Хаула", "ходячий замок|howl", 2004, 440, 130, "yourname|voice", "Магия, война и самый красивый замок.", "frame-sakura"],
        ["spirited", "Унесённые призраками", "Унесённые призраками", "унесённые призраками|унесенные призраками|spirited away", 2001, 660, 130, "howl", "Финал маршрута: шедевр Миядзаки.", "frame-platinum", "boss"],
      ],
      ["yourname", "voice", "howl", "spirited"],
    ),
  },
  {
    id: "cyber",
    title: "Киберпанк и фантастика",
    subtitle: "Будущее, в котором всё сложно",
    c1: "#22d3ee",
    c2: "#8b5cf6",
    bonus: { ac: 500, xp: 250, label: "Хронопутешественник", item: "tag_regressor" },
    nodes: build(
      [
        ["lain", "Эксперименты Лэйн", "Эксперименты Лэйн", "эксперименты лэйн|serial experiments lain", 1998, 0, 130, "", "Сеть, одиночество и странная реальность.", "gt-seal-keeper"],
        ["ghost", "Призрак в доспехах", "Призрак в доспехах", "призрак в доспехах|ghost in the shell", 1995, 220, 20, "lain", "Что делает нас людьми, если тело — протез?", "frame-sapphire-night", "side"],
        ["akira", "Акира", "Акира", "акира|akira", 1988, 220, 250, "lain", "Неон, байки и взрыв воображения.", "gt-archmage"],
        ["psycho", "Психопаспорт", "Психопаспорт", "психопаспорт|psycho-pass", 2012, 440, 130, "ghost|akira", "Система знает, кто преступник, ещё до преступления.", "frame-obsidian"],
        ["edge", "Киберпанк: Бегущие по краю", "Киберпанк Бегущие по краю", "бегущие по краю|edgerunners", 2022, 660, 20, "psycho", "Короткая и яркая история о цене мечты.", "frame-blue-flame"],
        ["steins", "Врата Штейна", "Врата Штейна", "врата штейна|steins", 2011, 660, 250, "psycho", "Письма в прошлое и цена каждого изменения.", "tag_mehapilot"],
        ["geass", "Код Гиас", "Код Гиас Восставший Лелуш", "код гиас|code geass", 2006, 880, 130, "edge|steins", "Финал маршрута: мехи и шахматы с империей.", "frame-royal-purple", "boss"],
      ],
      ["ghost", "akira"],
    ),
  },
  {
    id: "sport",
    title: "Спорт и командный дух",
    subtitle: "Мяч, вода, поле и характер",
    c1: "#34e0a1",
    c2: "#ffd166",
    bonus: { ac: 400, xp: 200, label: "Капитан команды", item: "tag_yasilneyshiy" },
    nodes: build([
      ["haikyuu", "Волейбол!!", "Волейбол", "волейбол|haikyuu", 2014, 0, 130, "", "Два новичка и мечта выйти на большую сцену.", "gt-demon-hunter"],
      ["kuroko", "Баскетбол Куроко", "Баскетбол Куроко", "баскетбол куроко|kuroko", 2012, 220, 20, "haikyuu", "Поколение чудес и невидимый пас.", "tag_sempay", "side"],
      ["free", "Вольный стиль!", "Вольный стиль", "вольный стиль|free!", 2013, 220, 250, "haikyuu", "Плавание, дружба и очень много воды.", "frame-turquoise-laurel"],
      ["ace", "Алмазный туз", "Алмазный туз", "алмазный туз|ace of diamond|daiya", 2013, 440, 130, "kuroko|free", "Питчер, который не сдаётся.", "gt-flame-heir"],
      ["bluelock", "Синяя тюрьма", "Синяя тюрьма", "синяя тюрьма|blue lock", 2022, 660, 130, "ace", "Футбол без команды: выживает лучший нападающий.", "frame-sunset"],
      ["prince", "Принц тенниса", "Принц тенниса", "принц тенниса|prince of tennis", 2001, 880, 130, "bluelock", "Финал маршрута: ракетки, мячи и спецудары.", "tag_otakulegenda", "boss"],
    ]),
  },
  {
    id: "isekai",
    title: "Исекай и фэнтези",
    subtitle: "Другой мир, новые правила",
    c1: "#ff9f1c",
    c2: "#a78bfa",
    bonus: { ac: 500, xp: 250, label: "Король иных миров", item: "tag_tenmonarha" },
    nodes: build([
      ["sao", "Мастера меча онлайн", "Мастера меча онлайн", "мастера меча|sword art online", 2012, 0, 130, "", "Игра, из которой нельзя выйти.", "frame-emerald-laurel"],
      ["konosuba", "Коносуба", "Коносуба", "коносуба|konosuba", 2016, 220, 20, "sao", "Лучший фэнтези-отряд неудачников.", "frame-amethyst", "side"],
      ["rezero", "Re:Zero", "Re Zero", "re:zero|ре:зеро|re zero", 2016, 220, 250, "sao", "Смерть — не конец, а откат к чекпойнту.", "gt-abyss-lord"],
      ["overlord", "Оверлорд", "Оверлорд", "оверлорд|overlord", 2015, 440, 130, "konosuba|rezero", "Игрок остался в игре — и стал королём нежити.", "frame-ruby-laurel"],
      ["mushoku", "Реинкарнация безработного", "Реинкарнация безработного", "реинкарнация безработного|mushoku tensei", 2021, 660, 130, "overlord", "Вторая жизнь без прежних ошибок.", "tag_korolsceny"],
      ["solo", "Поднятие уровня в одиночку", "Поднятие уровня в одиночку", "поднятие уровня|solo leveling", 2024, 880, 130, "mushoku", "Финал маршрута: самый слабый охотник становится сильнейшим.", "frame-18", "boss"],
    ]),
  },
  {
    id: "comedy",
    title: "Комедия и абсурд",
    subtitle: "Смех сквозь слёзы и пафос",
    c1: "#ffe66d",
    c2: "#ff6b9d",
    bonus: { ac: 400, xp: 200, label: "Мастер шутки", item: "tag_skryvayusilu" },
    nodes: build([
      ["gintama", "Гинтама", "Гинтама", "гинтама|gintama", 2006, 0, 130, "", "Самураи, долги и очень много абсурда.", "gt-fate-breaker"],
      ["saiki", "Ох уж этот экстрасенс Сайки Кусуо", "Сайки Кусуо", "сайки|saiki", 2016, 220, 20, "gintama", "Всемогущий школьник мечтает о покое.", "tag_narciss", "side"],
      ["nichijou", "Повседневность", "Повседневность", "повседневность|nichijou", 2011, 220, 250, "gintama", "Обычная жизнь в необычной подаче.", "frame-golden-seal"],
      ["kaguya", "Госпожа Кагуя: в любви как на войне", "Госпожа Кагуя", "кагуя|kaguya", 2019, 440, 130, "saiki|nichijou", "Кто признаётся первым — тот проиграл.", "tag_yandere"],
      ["ouran", "Школа Оранъ", "Хост-клуб старшей школы Оранъ", "оран|ouran", 2006, 660, 130, "kaguya", "Хост-клуб, где всё не так, как кажется.", "frame-lunar-moths"],
      ["opm", "Ванпанчмен", "Ванпанчмен", "ванпанчмен|one punch man|one-punch", 2015, 880, 130, "ouran", "Финал маршрута: герой, который побеждает одним ударом.", "gt-eternity-ruler", "boss"],
    ]),
  },
];

export const NODE_W = 112;
export const NODE_H = 168;

/* Одна награда на маршрут: выдаётся за финальный тайтл */
for (const route of ROUTES) {
  const boss = route.nodes.find((n) => n.tag === "boss");
  const id = boss?.item ?? route.bonus.item;
  route.bonus.items = [id];
  for (const n of route.nodes) delete n.item;
  if (boss) boss.item = id;
}

export function bonusItems(route: MapRoute): string[] {
  return route.bonus.items ?? [route.bonus.item];
}

/* ------------------------------ Предметы -------------------------------- */

export interface ItemInfo {
  id: string;
  kind: ItemKind;
  name: string;
  /** Обычная цена в магазине, AC */
  price: number;
  rarity: "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC" | string;
  description: string;
  /** Для рамки — картинка и масштаб */
  img?: string;
  scale?: number;
}

export function itemInfo(id: string): ItemInfo | null {
  const tag = PROGRESSION_CONFIG.tags.find((t) => t.id === id);
  if (tag && tag.source === "shop" && tag.price) {
    return { id, kind: "tag", name: tag.name, price: tag.price, rarity: tag.rarity, description: tag.description };
  }
  const shop = PROGRESSION_CONFIG.shop.find((s) => s.id === id);
  if (shop && (shop.kind === "frame" || shop.kind === "title")) {
    const frame = shop.kind === "frame" ? FRAMES.find((f) => f.id === id) : undefined;
    return {
      id,
      kind: shop.kind,
      name: shop.name,
      price: shop.price,
      rarity: shop.rarity,
      description: shop.description,
      img: frame?.img,
      scale: frame?.scale,
    };
  }
  return null;
}

export const RARITY_LABEL: Record<string, string> = {
  COMMON: "Обычный",
  UNCOMMON: "Необычный",
  RARE: "Редкий",
  EPIC: "Эпический",
  LEGENDARY: "Легендарный",
  MYTHIC: "Мифический",
};
export const RARITY_COLOR: Record<string, string> = {
  COMMON: "#9fb0d6",
  UNCOMMON: "#5cf0b8",
  RARE: "#4fb4ff",
  EPIC: "#c084fc",
  LEGENDARY: "#ffb347",
  MYTHIC: "#ff5d8f",
};

/** Все предметы-награды карты в порядке маршрутов */
export function allRewardItems(): { route: MapRoute; node?: MapNode; id: string }[] {
  const out: { route: MapRoute; node?: MapNode; id: string }[] = [];
  for (const route of ROUTES) {
    for (const id of bonusItems(route)) out.push({ route, id });
  }
  return out;
}
