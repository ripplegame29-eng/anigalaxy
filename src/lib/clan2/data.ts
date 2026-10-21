/**
 * Клан v2 — статические данные: роли, боссы, территории, соперники.
 * Всё детерминированно (без Math.random в рендере): «случайность» берётся
 * из хэша строки, поэтому у всех игроков и во всех сессиях она одинаковая.
 */

export type Role = "leader" | "officer" | "elite" | "member" | "recruit";

export interface RoleInfo {
  id: Role;
  name: string;
  glyph: string;
  rank: number;
  color: string;
  perk: string;
}

export const ROLES: Record<Role, RoleInfo> = {
  leader: { id: "leader", name: "Глава", glyph: "👑", rank: 4, color: "#ffc65a", perk: "Полное управление кланом" },
  officer: { id: "officer", name: "Офицер", glyph: "⚔️", rank: 3, color: "#ff7a90", perk: "Заявки, исключение, казна, территории" },
  elite: { id: "elite", name: "Элита", glyph: "💠", rank: 2, color: "#7ecbff", perk: "Укрепление территорий" },
  member: { id: "member", name: "Боец", glyph: "🛡️", rank: 1, color: "#9db0d9", perk: "Вклады, бой с боссом, сундук" },
  recruit: { id: "recruit", name: "Новобранец", glyph: "🌱", rank: 0, color: "#8fd6a5", perk: "Вклады и бой с боссом" },
};
export const ROLE_ORDER: Role[] = ["leader", "officer", "elite", "member", "recruit"];

export const can = {
  invest: (r: Role) => ROLES[r].rank >= 2,
  manage: (r: Role) => ROLES[r].rank >= 3,
  lead: (r: Role) => r === "leader",
};

/* ------------------------------- Уровни -------------------------------- */

/** Опыт, с которого начинается уровень `level` (1 → 0) */
export function xpForLevel(level: number): number {
  return Math.round(600 * Math.pow(Math.max(0, level - 1), 1.7));
}
export function levelFromXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp && level < 50) level++;
  return level;
}
export function levelProgress(xp: number): { level: number; pct: number; into: number; need: number } {
  const level = levelFromXp(xp);
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  return { level, pct: Math.min(1, (xp - from) / Math.max(1, to - from)), into: xp - from, need: to - from };
}
export const memberCap = (level: number) => Math.min(50, 16 + level * 2);

/* ------------------------------- Боссы --------------------------------- */

export interface Boss {
  id: string;
  name: string;
  title: string;
  glyph: string;
  hue: string;
}
export const BOSSES: Boss[] = [
  { id: "oni", name: "Они Шутэн", title: "Король демонов гор", glyph: "👹", hue: "#ff5c6a" },
  { id: "kitsune", name: "Девятихвостая", title: "Лисица туманов", glyph: "🦊", hue: "#ffa74d" },
  { id: "leviathan", name: "Левиафан Бездны", title: "Хранитель разлома", glyph: "🐉", hue: "#4dc3ff" },
  { id: "tengu", name: "Тэнгу Ветров", title: "Повелитель бурь", glyph: "🦅", hue: "#8affc1" },
  { id: "lich", name: "Лич Ночного Храма", title: "Некромант забвения", glyph: "💀", hue: "#b98cff" },
  { id: "titan", name: "Титан Стены", title: "Страж последних врат", glyph: "🗿", hue: "#ffd36e" },
];

/* ----------------------------- Территории ------------------------------ */

export type TerritoryId = "gate" | "forest" | "academy" | "hunters" | "temple" | "rift" | "sky" | "throne";
export type BonusKind = "damage" | "income" | "xp" | "chest" | "influence";

export interface Territory {
  id: TerritoryId;
  name: string;
  glyph: string;
  cost: number;
  x: number;
  y: number;
  /** Соседи: захватывать можно только то, что граничит с занятым */
  near: TerritoryId[];
  /** Стартовая клетка рядом с цитаделью */
  start?: boolean;
  bonus: { kind: BonusKind; value: number; text: string };
  lore: string;
}

export const TERRITORIES: Territory[] = [
  { id: "gate", name: "Врата Столицы", glyph: "🏯", cost: 300, x: 30, y: 22, near: ["academy"], start: true, bonus: { kind: "damage", value: 10, text: "+10% урона по боссу" }, lore: "Первая застава у стен. С неё начинает любой клан." },
  { id: "forest", name: "Лес Духов", glyph: "🌲", cost: 450, x: 30, y: 74, near: ["hunters"], start: true, bonus: { kind: "income", value: 6, text: "+6 AC в казну каждый день" }, lore: "Духи леса платят дань тем, кто их не тревожит." },
  { id: "academy", name: "Академия Магов", glyph: "🔮", cost: 600, x: 50, y: 12, near: ["gate", "temple"], bonus: { kind: "xp", value: 8, text: "+8% опыта клана" }, lore: "Архивы заклинаний и редких свитков." },
  { id: "hunters", name: "Город Охотников", glyph: "🏹", cost: 750, x: 50, y: 86, near: ["forest", "temple"], bonus: { kind: "chest", value: 10, text: "+10% к награде сундука" }, lore: "Гильдия, где хорошая добыча — вопрос чести." },
  { id: "temple", name: "Храм Ветров", glyph: "⛩️", cost: 900, x: 58, y: 50, near: ["academy", "hunters", "rift", "sky"], bonus: { kind: "influence", value: 10, text: "+10 влияния каждый день" }, lore: "Перекрёсток дорог. Кто держит храм, тот держит карту." },
  { id: "rift", name: "Бездонный Разлом", glyph: "🕳️", cost: 1200, x: 78, y: 24, near: ["temple", "throne"], bonus: { kind: "damage", value: 15, text: "+15% урона по боссу" }, lore: "Из разлома выходят боссы. И сила, чтобы их остановить." },
  { id: "sky", name: "Небесная Крепость", glyph: "☁️", cost: 1500, x: 78, y: 76, near: ["temple", "throne"], bonus: { kind: "income", value: 20, text: "+20 AC в казну каждый день" }, lore: "Парящая цитадель древних небожителей." },
  { id: "throne", name: "Трон Небожителей", glyph: "🌌", cost: 2000, x: 90, y: 50, near: ["rift", "sky"], bonus: { kind: "chest", value: 15, text: "+15% к награде сундука" }, lore: "Конец карты. Только лучшие кланы доходят сюда." },
];
export const territoryOf = (id: TerritoryId): Territory => TERRITORIES.find((t) => t.id === id) ?? TERRITORIES[0];

/* ------------------------- Люди, соперники, хэш ------------------------ */

export const NAMES = [
  "Рэн", "Саку", "Хината", "Кайто", "Мика", "Ёрути", "Тора", "Юна", "Сора", "Ринка", "Акира", "Нана",
  "Масару", "Эйко", "Дайки", "Сэйя", "Лиза", "Тимур", "Алиса", "Ярик", "Кира", "Ронин", "Мирай", "Шиори",
  "Гаара", "Юки", "Харуто", "Асуна", "Леви", "Рику", "Тамаки", "Нацу", "Иоши", "Вэй", "Мэй", "Кодзи",
];
export const NOTES = [
  "Смотрю по 3 серии в день, хочу в сильный клан",
  "Играю каждый вечер, готов участвовать в событиях",
  "Люблю экшен и исэкай, в клане ищу компанию",
  "Недавно на сайте, но уже на 20 уровне",
  "Рейды — моё. Могу бить босса каждый день",
];

export function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function rng(seed: string): () => number {
  let a = hash(seed) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rival {
  id: string;
  name: string;
  tag: string;
  emblem: string;
  color: string;
  motto: string;
  level: number;
  members: number;
  minLevel: number;
}
export const RIVALS: Rival[] = [
  { id: "r1", name: "Клинки Рассвета", tag: "КРС", emblem: "⚔️", color: "#ff7a90", motto: "Каждый день — бой", level: 14, members: 34, minLevel: 10 },
  { id: "r2", name: "Лунные Лисы", tag: "ЛЛС", emblem: "🌙", color: "#b98cff", motto: "Тихо, но метко", level: 11, members: 27, minLevel: 5 },
  { id: "r3", name: "Дом Небожителей", tag: "ДНБ", emblem: "👑", color: "#ffc65a", motto: "Только к вершине", level: 19, members: 44, minLevel: 25 },
  { id: "r4", name: "Тени Сакуры", tag: "ТСК", emblem: "🌸", color: "#ff8fc6", motto: "Красота в деталях", level: 8, members: 19, minLevel: 1 },
  { id: "r5", name: "Громовой Легион", tag: "ГЛГ", emblem: "⚡", color: "#7ecbff", motto: "Быстро и громко", level: 16, members: 38, minLevel: 15 },
  { id: "r6", name: "Тихие Монахи", tag: "ТМН", emblem: "🍃", color: "#8fd6a5", motto: "Смотрим до конца", level: 6, members: 15, minLevel: 1 },
  { id: "r7", name: "Алая Гвардия", tag: "АГД", emblem: "🔥", color: "#ff6a3d", motto: "Огонь не гаснет", level: 12, members: 30, minLevel: 8 },
  { id: "r8", name: "Хранители Манги", tag: "ХМГ", emblem: "📖", color: "#ffd27a", motto: "Глава за главой", level: 9, members: 22, minLevel: 3 },
];

/* ------------------------------ Время ---------------------------------- */

/** Ключ недели: понедельник по местному времени, `2026-10-19` */
export function weekKey(now: number): string {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function weekEndsAt(now: number): number {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day + 7);
  return d.getTime();
}

/** Награда личного сундука за ступень (AC) */
export const CHEST_TIERS = [
  { id: "bronze", name: "Бронзовый", need: 1, ac: 120, color: "#d58a52" },
  { id: "silver", name: "Серебряный", need: 2, ac: 320, color: "#cfd8ec" },
  { id: "gold", name: "Золотой", need: 3, ac: 700, color: "#ffc65a" },
] as const;
export type ChestTier = (typeof CHEST_TIERS)[number]["id"];
