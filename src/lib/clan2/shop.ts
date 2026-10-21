import { CLAN_EMBLEMS, EMBLEM_TIER_LABEL } from "../emblems.data";

/**
 * Клановая лавка и сокровищница (перенос из прежней системы).
 *
 * Покупка разовая и навсегда, установка бесплатная; редкость — только
 * визуальная ценность. Оплата идёт из общей казны клана (AC) или из
 * престижа — ресурса, который клан получает за боссов, войны и захват земель.
 */

export type ShopRarity = "common" | "rare" | "epic" | "legendary";
export type ShopCategory = "background" | "emblem" | "decoration";
export type Currency = "vault" | "prestige";

export const RARITY_LABEL: Record<ShopRarity, string> = { common: "Обычный", rare: "Редкий", epic: "Эпический", legendary: "Легендарный" };
export const RARITY_COLOR: Record<ShopRarity, string> = { common: "#9db0d9", rare: "#7ecbff", epic: "#c58bff", legendary: "#ffc65a" };

/** Цена по редкости: дешёвое за AC казны, дорогое — за престиж */
export const PRICE: Record<ShopRarity, { currency: Currency; price: number }> = {
  common: { currency: "vault", price: 300 },
  rare: { currency: "vault", price: 700 },
  epic: { currency: "prestige", price: 180 },
  legendary: { currency: "prestige", price: 450 },
};

export interface ShopItem {
  id: string;
  category: ShopCategory;
  name: string;
  rarity: ShopRarity;
  description: string;
  css?: string;
  backgroundSize?: string;
  veil?: string;
  deco?: string;
  price?: { currency: Currency; price: number };
}

export const BACKGROUNDS: ShopItem[] = [
  {
    id: "clan-bg-standard",
    category: "background",
    name: "Стандартный",
    rarity: "common",
    description: "Базовое оформление гильдии. Доступно бесплатно и всегда.",
    css: "radial-gradient(120% 100% at 50% 0%,rgb(28 32 48) 0%,rgb(10 12 20) 70%)",
    veil: "rgb(8 10 18 / 0.72)",
  },
  {
    id: "clan-bg-fantasy",
    category: "background",
    name: "Тёмное фэнтези",
    rarity: "common",
    description: "Сумеречный замок на холме. Спокойный фон, на котором хорошо читается текст.",
    css: "radial-gradient(90% 70% at 50% 8%,#3a2a5c 0%,transparent 60%),linear-gradient(180deg,#1b1430 0%,#0a0812 70%)",
    veil: "rgb(10 8 18 / 0.7)",
  },
  {
    id: "clan-bg-void",
    category: "background",
    name: "Космическая бездна",
    rarity: "rare",
    description: "Чёрный фон с тусклыми звёздами и туманностью по краям.",
    css: "radial-gradient(1px 1px at 20% 30%,#fff 50%,transparent 51%),radial-gradient(1px 1px at 70% 60%,#cfe3ff 50%,transparent 51%),radial-gradient(1px 1px at 45% 80%,#fff 50%,transparent 51%),radial-gradient(120% 90% at 50% 0%,#101c3f 0%,#04060f 70%)",
    backgroundSize: "160px 160px,220px 220px,300px 300px,cover",
    veil: "rgb(4 6 15 / 0.68)",
  },
  {
    id: "clan-bg-cyber",
    category: "background",
    name: "Неоновый киберпанк",
    rarity: "rare",
    description: "Сетка линий и холодное свечение. Резкие углы, высокий контраст.",
    css: "linear-gradient(rgb(34 211 238 / .12) 1px,transparent 1px),linear-gradient(90deg,rgb(34 211 238 / .12) 1px,transparent 1px),radial-gradient(120% 100% at 50% 0%,#0d2b4a 0%,#050810 72%)",
    backgroundSize: "38px 38px,38px 38px,cover",
    veil: "rgb(5 8 16 / 0.66)",
  },
  {
    id: "clan-bg-sakura",
    category: "background",
    name: "Сакура и храм",
    rarity: "rare",
    description: "Тёплый закат над силуэтами ворот тории. Тёплый тон, мягкий свет.",
    css: "radial-gradient(70% 50% at 50% 96%,#fbcfe8 0%,transparent 70%),linear-gradient(180deg,#5b1030 0%,#2a0a1c 60%,#160714 100%)",
    veil: "rgb(30 8 22 / 0.6)",
  },
  {
    id: "clan-bg-ember",
    category: "background",
    name: "Огненная энергия",
    rarity: "epic",
    description: "Тлеющие угли снизу и жар мастерской. Тёплый, но читаемый.",
    css: "radial-gradient(90% 60% at 50% 108%,#ff7a18 0%,transparent 65%),radial-gradient(60% 40% at 20% 0%,#b3341a 0%,transparent 70%),linear-gradient(180deg,#2a0d08 0%,#120604 100%)",
    veil: "rgb(24 8 5 / 0.58)",
  },
  {
    id: "clan-bg-frost",
    category: "background",
    name: "Ледяная магия",
    rarity: "epic",
    description: "Стужащий туман и кристаллические блики. Холодная палитра.",
    css: "radial-gradient(80% 60% at 70% 10%,#7dd3fc 0%,transparent 60%),radial-gradient(70% 50% at 20% 90%,#1e3a5f 0%,transparent 70%),linear-gradient(180deg,#0b1a2e 0%,#060c16 100%)",
    veil: "rgb(8 16 28 / 0.6)",
  },
  {
    id: "clan-bg-mist",
    category: "background",
    name: "Туманный лес",
    rarity: "epic",
    description: "Слоистый туман между стволами. Ровный свет, хорош для длинных текстов.",
    css: "linear-gradient(180deg,transparent 0%,rgb(148 163 184 / .14) 40%,transparent 70%),radial-gradient(60% 80% at 30% 20%,#334155 0%,transparent 70%),linear-gradient(180deg,#10151f 0%,#080b12 100%)",
    veil: "rgb(9 12 19 / 0.64)",
  },
  {
    id: "clan-bg-ruins",
    category: "background",
    name: "Руины древней цивилизации",
    rarity: "epic",
    description: "Песчаник, обломки колонн и пыль в воздухе. Приглушённая гамма.",
    css: "radial-gradient(70% 50% at 50% 100%,#b08d57 0%,transparent 70%),linear-gradient(180deg,#2d2418 0%,#14100a 100%)",
    veil: "rgb(24 18 10 / 0.6)",
  },
  {
    id: "clan-bg-moon",
    category: "background",
    name: "Мистическая луна",
    rarity: "legendary",
    description: "Луна за облаками и холодное сияние. Самый спокойный фон коллекции.",
    css: "radial-gradient(circle at 62% 26%,#e8ecff 0%,#9aa6d8 18%,transparent 34%),radial-gradient(90% 70% at 50% 0%,#1b2350 0%,transparent 70%),linear-gradient(180deg,#0a0f24 0%,#05060e 100%)",
    veil: "rgb(6 8 20 / 0.62)",
  },
  {
    id: "clan-bg-dragon",
    category: "background",
    name: "Драконья бездна",
    rarity: "legendary",
    description: "Тёмно-красная magma и силуэт чешуи. Насыщенный, но с затемнением по центру.",
    css: "radial-gradient(80% 60% at 50% 106%,#ff3d2e 0%,transparent 60%),radial-gradient(60% 40% at 80% 0%,#7a1410 0%,transparent 70%),linear-gradient(180deg,#20070a 0%,#0b0304 100%)",
    veil: "rgb(20 5 8 / 0.58)",
  },
  {
    id: "clan-bg-academy",
    category: "background",
    name: "Магическая академия",
    rarity: "legendary",
    description: "Фиолетовые круги рун и плавающие огни. Фирменная палитра магов.",
    css: "radial-gradient(circle at 50% 42%,transparent 0%,transparent 22%,rgb(176 107 255 / .3) 22%,rgb(176 107 255 / .3) 24%,transparent 24%,transparent 30%,rgb(176 107 255 / .2) 30%,rgb(176 107 255 / .2) 32%,transparent 32%),radial-gradient(90% 70% at 50% 0%,#2a1450 0%,transparent 70%),linear-gradient(180deg,#120a24 0%,#07040f 100%)",
    veil: "rgb(12 7 26 / 0.6)",
  },
  {
    id: "clan-bg-gold",
    category: "background",
    name: "Золотое измерение",
    rarity: "legendary",
    description: "Тёплое золото с блеском частиц. Самая дорогая покупка раздела.",
    css: "radial-gradient(1px 1px at 30% 40%,#ffe9a8 50%,transparent 51%),radial-gradient(1px 1px at 75% 25%,#fff 50%,transparent 51%),radial-gradient(90% 70% at 50% 0%,#5c3d05 0%,transparent 65%),linear-gradient(180deg,#241703 0%,#0d0802 100%)",
    backgroundSize: "180px 180px,260px 260px,cover,cover",
    veil: "rgb(20 13 3 / 0.58)",
  },
];

export const DECORATIONS: ShopItem[] = [
  {
    id: "clan-deco-frame-gilded",
    category: "decoration",
    name: "Золотая рамка карточки",
    rarity: "rare",
    description: "Тонкая золотая оправа по краю карточки гильдии. Заметна на тёмном фоне.",
    deco: "gilded-frame",
  },
  {
    id: "clan-deco-frame-runic",
    category: "decoration",
    name: "Рунная рамка",
    rarity: "epic",
    description: "Медленно вращающееся рунное кольцо вокруг карточки.",
    deco: "runic-frame",
  },
  {
    id: "clan-deco-emblem-halo",
    category: "decoration",
    name: "Нимб эмблемы",
    rarity: "rare",
    description: "Мягкий ореол вокруг эмблемы в шапке. Не перекрывает сам знак.",
    deco: "emblem-halo",
  },
  {
    id: "clan-deco-emblem-trail",
    category: "decoration",
    name: "След кометы",
    rarity: "epic",
    description: "Мерцающий хвост за эмблемой, как от движения.",
    deco: "emblem-trail",
  },
  {
    id: "clan-deco-divider-rune",
    category: "decoration",
    name: "Орнамент-разделитель",
    rarity: "common",
    description: "Тонкая рунная линия между шапкой и содержимым страницы.",
    deco: "rune-divider",
  },
  {
    id: "clan-deco-header-glow",
    category: "decoration",
    name: "Свечение шапки",
    rarity: "legendary",
    description: "Цветное зарево по верхней кромке шапки в тон эмблемы.",
    deco: "header-glow",
  },
  {
    id: "clan-deco-spark-drift",
    category: "decoration",
    name: "Медленный дрейф искр",
    rarity: "rare",
    description: "Редкие искры, поднимающиеся снизу. Отключается вместе с анимациями.",
    deco: "spark-drift",
  },
  {
    id: "clan-deco-corner-ornament",
    category: "decoration",
    name: "Угловые завитки",
    rarity: "epic",
    description: "Асимметричные завитки в двух углах карточки.",
    deco: "corner-ornament",
  },
];


export const EMBLEM_ITEMS: ShopItem[] = CLAN_EMBLEMS.map((e) => {
  const rarity: ShopRarity = e.tier === "l" ? "legendary" : e.tier === "e" ? "epic" : "rare";
  return { id: e.id, category: "emblem", name: e.ru, rarity, description: `${e.name} — «${e.motto}». ${EMBLEM_TIER_LABEL[e.tier]}.` };
});
export const ALL_ITEMS: ShopItem[] = [...BACKGROUNDS, ...EMBLEM_ITEMS, ...DECORATIONS];
export const itemOf = (id: string): ShopItem | undefined => ALL_ITEMS.find((i) => i.id === id);
export const emblemOf = (id: string) => CLAN_EMBLEMS.find((e) => e.id === id);
export const priceOf = (item: ShopItem) => item.price ?? PRICE[item.rarity];

/* ------------------------------ Сундуки -------------------------------- */

export type LootTo = "vault" | "influence" | "prestige" | "xp" | "self" | "unlock";
export interface LootEntry {
  id: string;
  label: string;
  /** Шанс в процентах; сумма по сундуку ровно 100 */
  chance: number;
  to: LootTo;
  amount?: number;
  itemId?: string;
}
export interface Chest {
  tier: 0 | 1 | 2 | 3;
  name: string;
  rarity: ShopRarity;
  color: string;
  currency: Currency;
  price: number;
  needLevel: number;
  loot: LootEntry[];
}

export const CHESTS: Chest[] = [
  {
    tier: 0, name: "Обычный сундук", rarity: "common", color: "#9db0d9", currency: "vault", price: 250, needLevel: 1,
    loot: [
      { id: "a1", label: "AC в казну", chance: 40, to: "vault", amount: 320 },
      { id: "a2", label: "Влияние", chance: 28, to: "influence", amount: 180 },
      { id: "a3", label: "Опыт клана", chance: 22, to: "xp", amount: 260 },
      { id: "a4", label: "Личные AC", chance: 10, to: "self", amount: 90 },
    ],
  },
  {
    tier: 1, name: "Редкий сундук", rarity: "rare", color: "#7ecbff", currency: "vault", price: 600, needLevel: 3,
    loot: [
      { id: "b1", label: "AC в казну", chance: 30, to: "vault", amount: 700 },
      { id: "b2", label: "Влияние", chance: 22, to: "influence", amount: 320 },
      { id: "b3", label: "Престиж", chance: 18, to: "prestige", amount: 50 },
      { id: "b4", label: "Личные AC", chance: 14, to: "self", amount: 220 },
      { id: "b5", label: "Орнамент-разделитель", chance: 10, to: "unlock", itemId: "clan-deco-divider-rune" },
      { id: "b6", label: "Фон «Туманный лес»", chance: 6, to: "unlock", itemId: "clan-bg-mist" },
    ],
  },
  {
    tier: 2, name: "Эпический сундук", rarity: "epic", color: "#c58bff", currency: "prestige", price: 120, needLevel: 6,
    loot: [
      { id: "c1", label: "AC в казну", chance: 24, to: "vault", amount: 1200 },
      { id: "c2", label: "Влияние", chance: 20, to: "influence", amount: 650 },
      { id: "c3", label: "Престиж", chance: 20, to: "prestige", amount: 140 },
      { id: "c4", label: "Личные AC", chance: 14, to: "self", amount: 480 },
      { id: "c5", label: "Рунная рамка", chance: 10, to: "unlock", itemId: "clan-deco-frame-runic" },
      { id: "c6", label: "Эмблема «Лунный орден»", chance: 8, to: "unlock", itemId: "clan-emblem-05" },
      { id: "c7", label: "Фон «Драконья бездна»", chance: 4, to: "unlock", itemId: "clan-bg-dragon" },
    ],
  },
  {
    tier: 3, name: "Легендарный сундук", rarity: "legendary", color: "#ffc65a", currency: "prestige", price: 300, needLevel: 10,
    loot: [
      { id: "d1", label: "AC в казну", chance: 22, to: "vault", amount: 2600 },
      { id: "d2", label: "Престиж", chance: 24, to: "prestige", amount: 320 },
      { id: "d3", label: "Влияние", chance: 18, to: "influence", amount: 1200 },
      { id: "d4", label: "Личные AC", chance: 14, to: "self", amount: 1200 },
      { id: "d5", label: "Свечение шапки", chance: 10, to: "unlock", itemId: "clan-deco-header-glow" },
      { id: "d6", label: "Эмблема «Багровые Драконы»", chance: 7, to: "unlock", itemId: "clan-emblem-01" },
      { id: "d7", label: "Фон «Золотое измерение»", chance: 5, to: "unlock", itemId: "clan-bg-gold" },
    ],
  },
];
