/**
 * Клановые эмблемы — выгрузка из макета «Ожившие эмблемы кланов».
 *
 * Файлы изображений вынесены в `public/emblems/`: держать base64 внутри
 * исходника нельзя — он попал бы в бандл целиком при первом импорте.
 * Оригинальные пропорции и эффекты макета сохранены как есть.
 *
 * Поля `fx`, `heat`, `fd` описывают анимационный пресет из макета:
 * они управляют орбитами, свечением и вспышкой в компоненте ClanEmblemArt.
 */

export type ClanEmblemTier = "c" | "e" | "l";

export interface ClanEmblemArt {
  id: string;
  /** Путь к WebP относительно public/ */
  glyph: string;
  /** Название латиницей, как в макете */
  name: string;
  /** Название по-русски */
  ru: string;
  /** Девиз */
  motto: string;
  /** Редкость: common / epic / legendary */
  tier: ClanEmblemTier;
  /** Основной цвет свечения */
  color: string;
  /** Имя анимационного пресета */
  fx: string;
  /** Задержка вспышки, мс */
  fd: number | null;
  /** Тепловое искажение поверх картинки */
  heat: 0 | 1;
}

export const CLAN_EMBLEMS: ClanEmblemArt[] = [
  {
    "id": "clan-emblem-01",
    "glyph": "emblem-01.webp",
    "name": "Crimson Dragons",
    "ru": "Багровые Драконы",
    "motto": "Огонь не знает пощады",
    "tier": "l",
    "color": "#ff4a3a",
    "fx": "ember",
    "fd": 1000,
    "heat": 1
  },
  {
    "id": "clan-emblem-02",
    "glyph": "emblem-02.webp",
    "name": "Sun Covenant",
    "ru": "Солнечный Завет",
    "motto": "Рассвет принадлежит нам",
    "tier": "l",
    "color": "#ffcf6a",
    "fx": "rise",
    "fd": 4000,
    "heat": 1
  },
  {
    "id": "clan-emblem-03",
    "glyph": "emblem-03.webp",
    "name": "Lunar Order",
    "ru": "Лунный Орден",
    "motto": "Свет во тьме",
    "tier": "l",
    "color": "#4a8cff",
    "fx": "slow",
    "fd": 3000,
    "heat": 0
  },
  {
    "id": "clan-emblem-04",
    "glyph": "emblem-04.webp",
    "name": "Golden Pride",
    "ru": "Золотой Прайд",
    "motto": "Корона не склоняется",
    "tier": "l",
    "color": "#ffc04a",
    "fx": "rise",
    "fd": 2000,
    "heat": 0
  },
  {
    "id": "clan-emblem-05",
    "glyph": "emblem-05.webp",
    "name": "Azure Dragons",
    "ru": "Лазурные Драконы",
    "motto": "Глубина хранит бурю",
    "tier": "l",
    "color": "#4aa0ff",
    "fx": "slow",
    "fd": 5000,
    "heat": 0
  },
  {
    "id": "clan-emblem-06",
    "glyph": "emblem-06.webp",
    "name": "Chrono Wardens",
    "ru": "Хранители Времени",
    "motto": "Каждый миг на счету",
    "tier": "l",
    "color": "#ffbf4a",
    "fx": "slow",
    "fd": 1000,
    "heat": 0
  },
  {
    "id": "clan-emblem-07",
    "glyph": "emblem-07.webp",
    "name": "Scarlet Phoenix",
    "ru": "Алый Феникс",
    "motto": "Сгораем, чтобы возродиться",
    "tier": "l",
    "color": "#ff4a4a",
    "fx": "ember",
    "fd": 2000,
    "heat": 1
  },
  {
    "id": "clan-emblem-08",
    "glyph": "emblem-08.webp",
    "name": "Infernal Legion",
    "ru": "Инфернальный Легион",
    "motto": "Ад ждёт",
    "tier": "l",
    "color": "#ff3a2a",
    "fx": "ember",
    "fd": 3000,
    "heat": 1
  },
  {
    "id": "clan-emblem-09",
    "glyph": "emblem-09.webp",
    "name": "Frost Wardens",
    "ru": "Стражи Льда",
    "motto": "Холод не прощает",
    "tier": "e",
    "color": "#5fb4ff",
    "fx": "snow",
    "fd": 0,
    "heat": 0
  },
  {
    "id": "clan-emblem-10",
    "glyph": "emblem-10.webp",
    "name": "Void Reapers",
    "ru": "Жнецы Пустоты",
    "motto": "Тишина — наш приговор",
    "tier": "e",
    "color": "#b46bff",
    "fx": "slow",
    "fd": 2000,
    "heat": 0
  },
  {
    "id": "clan-emblem-11",
    "glyph": "emblem-11.webp",
    "name": "Storm Tigers",
    "ru": "Грозовые Тигры",
    "motto": "Гром идёт первым",
    "tier": "e",
    "color": "#4a9cff",
    "fx": "snow",
    "fd": 4000,
    "heat": 0
  },
  {
    "id": "clan-emblem-12",
    "glyph": "emblem-12.webp",
    "name": "Astral Circle",
    "ru": "Астральный Круг",
    "motto": "Звёзды ведут",
    "tier": "e",
    "color": "#b06bff",
    "fx": "slow",
    "fd": 1000,
    "heat": 0
  },
  {
    "id": "clan-emblem-13",
    "glyph": "emblem-13.webp",
    "name": "Thorn Saints",
    "ru": "Святые Шипов",
    "motto": "Боль очищает",
    "tier": "e",
    "color": "#ff4f9a",
    "fx": "slow",
    "fd": 2000,
    "heat": 0
  },
  {
    "id": "clan-emblem-14",
    "glyph": "emblem-14.webp",
    "name": "Kitsune Shrine",
    "ru": "Храм Кицунэ",
    "motto": "Тайна в улыбке",
    "tier": "e",
    "color": "#ff4a5a",
    "fx": "petal",
    "fd": 3000,
    "heat": 0
  },
  {
    "id": "clan-emblem-15",
    "glyph": "emblem-15.webp",
    "name": "Jade Serpents",
    "ru": "Нефритовые Змеи",
    "motto": "Яд — это терпение",
    "tier": "e",
    "color": "#3fe0b0",
    "fx": "slow",
    "fd": 0,
    "heat": 0
  },
  {
    "id": "clan-emblem-16",
    "glyph": "emblem-16.webp",
    "name": "Seraph Guard",
    "ru": "Стража Серафима",
    "motto": "Крылья над щитом",
    "tier": "e",
    "color": "#8fa8ff",
    "fx": "rise",
    "fd": 5000,
    "heat": 0
  },
  {
    "id": "clan-emblem-17",
    "glyph": "emblem-17.webp",
    "name": "Abyssal Maw",
    "ru": "Пасть Бездны",
    "motto": "Бездна голодна",
    "tier": "e",
    "color": "#c06bff",
    "fx": "slow",
    "fd": 4000,
    "heat": 0
  },
  {
    "id": "clan-emblem-18",
    "glyph": "emblem-18.webp",
    "name": "Glacier Crown",
    "ru": "Ледяная Корона",
    "motto": "Лёд помнит всё",
    "tier": "e",
    "color": "#6fd0ff",
    "fx": "snow",
    "fd": 2000,
    "heat": 0
  },
  {
    "id": "clan-emblem-19",
    "glyph": "emblem-19.webp",
    "name": "Shadow Thorn",
    "ru": "Теневой Шип",
    "motto": "Из тени — в бой",
    "tier": "c",
    "color": "#a860ff",
    "fx": "slow",
    "fd": 1000,
    "heat": 0
  },
  {
    "id": "clan-emblem-20",
    "glyph": "emblem-20.webp",
    "name": "Sakura Gate",
    "ru": "Врата Сакуры",
    "motto": "Путь начинается здесь",
    "tier": "c",
    "color": "#ff7ad0",
    "fx": "petal",
    "fd": 3000,
    "heat": 0
  },
  {
    "id": "clan-emblem-21",
    "glyph": "emblem-21.webp",
    "name": "Emerald Pact",
    "ru": "Изумрудный Пакт",
    "motto": "Корни глубже стен",
    "tier": "c",
    "color": "#5fe070",
    "fx": "snow",
    "fd": 0,
    "heat": 0
  },
  {
    "id": "clan-emblem-22",
    "glyph": "emblem-22.webp",
    "name": "Frostglass",
    "ru": "Морозное Стекло",
    "motto": "Хрупкие, но острые",
    "tier": "c",
    "color": "#9ab8ff",
    "fx": "snow",
    "fd": 4000,
    "heat": 0
  },
  {
    "id": "clan-emblem-23",
    "glyph": "emblem-23.webp",
    "name": "Silk Moths",
    "ru": "Шёлковые Мотыльки",
    "motto": "Лёгкие крылья",
    "tier": "c",
    "color": "#ff6fc4",
    "fx": "petal",
    "fd": 2000,
    "heat": 0
  }
];

/** Эмблема по id */
export function clanEmblem(id: string): ClanEmblemArt | undefined {
  return CLAN_EMBLEMS.find((e) => e.id === id);
}

/** Подпись редкости */
export const EMBLEM_TIER_LABEL: Record<ClanEmblemTier, string> = {
  c: "Обычная",
  e: "Эпическая",
  l: "Легендарная",
};
