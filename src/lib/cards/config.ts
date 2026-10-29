/** Правила и числа карточной системы. Единый источник для сервера и интерфейса. */

export type Rank = 0 | 1 | 2 | 3 | 4;
export type Element = "fire" | "water" | "wind" | "earth" | "light" | "dark";
export type CardClass = "warrior" | "mage" | "tank" | "assassin" | "support";

export const RANKS: { id: Rank; key: string; name: string; short: string; color: string }[] = [
  { id: 0, key: "common", name: "Обычная", short: "C", color: "#9aa7bd" },
  { id: 1, key: "rare", name: "Редкая", short: "B", color: "#3fa3ff" },
  { id: 2, key: "epic", name: "Эпическая", short: "A", color: "#b46bff" },
  { id: 3, key: "legendary", name: "Легендарная", short: "S", color: "#ffb020" },
  { id: 4, key: "mythic", name: "Мифическая", short: "SS", color: "#ff4d6d" },
];
export const MAX_RANK: Rank = 4;

export const ELEMENTS: Record<Element, { name: string; beats: Element }> = {
  fire: { name: "Огонь", beats: "wind" },
  wind: { name: "Ветер", beats: "earth" },
  earth: { name: "Земля", beats: "water" },
  water: { name: "Вода", beats: "fire" },
  light: { name: "Свет", beats: "dark" },
  dark: { name: "Тьма", beats: "light" },
};

export const CLASSES: Record<CardClass, { name: string; hint: string }> = {
  warrior: { name: "Воин", hint: "Бьёт ближайшего врага, +10% к урону" },
  mage: { name: "Маг", hint: "Бьёт врага с наименьшим здоровьем" },
  tank: { name: "Страж", hint: "Принимает на себя часть урона союзников" },
  assassin: { name: "Убийца", hint: "Атакует первым, шанс крита 20%" },
  support: { name: "Хилер", hint: "Лечит самого раненого союзника" },
};

/* ------------------------------- Экономика ------------------------------ */

export const MAX_LEVEL = 15;
export const MAX_ENERGY = 10;
export const ENERGY_REGEN_MS = 20 * 60 * 1000;
export const DECK_SIZE = 4;

/** Пыль за расщепление карты по рангу */
export const DUST_VALUE = [8, 30, 110, 400, 1500];
/** Свиток заточки нужного ранга: цена в пыли, если не хватает свитков */
export const SCROLL_DUST = [20, 60, 180, 600, 2000];

export const PACK = {
  diamonds: 60,
  dust: 240,
  /** Цена набора: ×1, ×6 (платим за 5), ×20 (платим за 15) */
  bundles: [
    { n: 1, pay: 1 },
    { n: 6, pay: 5 },
    { n: 20, pay: 15 },
  ],
  choices: 3,
  weights: [600, 270, 95, 30, 5],
  /** Гарантия: эпик и выше не позже чем через N паков, легенда — через M */
  pityEpic: 12,
  pityLegend: 60,
  premiumBonusLuck: 1.25,
} as const;

export const SPLIT = {
  freeDaily: 7,
  premiumFreeDaily: 15,
  maxDaily: 40,
  extraDiamonds: 12,
} as const;

export const UPGRADE = { need: 3 } as const;
export const MELT = { need: 3 } as const;

export const EXCHANGE = { acPerDiamond: 12, dailyDiamonds: 100 } as const;

export const STARTER = { diamonds: 300, dust: 200, packs: 5, energy: MAX_ENERGY };

/** Шанс заточки по текущему уровню карты (0.95 → 0.35) */
export function sharpenChance(level: number): number {
  return Math.max(0.35, 0.95 - 0.04 * (level - 1));
}
/** Каждая неудача копит 35% до гарантированного успеха */
export const SHARPEN_PITY_STEP = 35;
/** Прирост характеристик за уровень заточки */
export const LEVEL_BONUS = 0.06;
export const FOIL_BONUS = 0.2;

export const AUCTION = {
  minHours: 1,
  maxHours: 48,
  feePct: 5,
  minPrice: 10,
  maxPrice: 1_000_000,
  maxActive: 8,
  snipeExtendMs: 2 * 60 * 1000,
} as const;

export const LEAGUES = [
  { id: "bronze", name: "Бронза", from: 0, color: "#c98a56" },
  { id: "silver", name: "Серебро", from: 1100, color: "#c2cbd8" },
  { id: "gold", name: "Золото", from: 1300, color: "#ffc233" },
  { id: "platinum", name: "Платина", from: 1550, color: "#5ee0d0" },
  { id: "diamond", name: "Алмаз", from: 1850, color: "#6aa8ff" },
  { id: "legend", name: "Легенда", from: 2200, color: "#ff5c8a" },
] as const;

export function leagueOf(rating: number) {
  let cur: (typeof LEAGUES)[number] = LEAGUES[0];
  for (const l of LEAGUES) if (rating >= l.from) cur = l;
  return cur;
}

export const MISSIONS = [
  { id: "win3", text: "Выиграть 3 боя", goal: 3, reward: { diamonds: 20, dust: 30 } },
  { id: "pack1", text: "Открыть 1 пак", goal: 1, reward: { diamonds: 10, dust: 20 } },
  { id: "sharp3", text: "Заточить карты 3 раза", goal: 3, reward: { dust: 60, scroll: 1 } },
] as const;

export const BATTLE = {
  energyCost: 1,
  win: { diamonds: 4, dust: 25, rating: 24 },
  lose: { diamonds: 1, dust: 8, rating: -16 },
  maxRounds: 30,
} as const;

/** Недельный модификатор боёв: запрещённая и усиленная стихии */
export function weeklyMods(weekIndex: number): { ban: Element; buff: Element } {
  const els = Object.keys(ELEMENTS) as Element[];
  return { ban: els[(weekIndex * 5 + 1) % els.length], buff: els[(weekIndex * 3 + 2) % els.length] };
}

export const DAILY_LOGIN = { diamonds: 15, dust: 40 };
