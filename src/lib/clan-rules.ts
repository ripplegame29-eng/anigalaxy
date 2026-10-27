/**
 * Правила кланов — единый источник для сервера и интерфейса.
 * Без "use client": файл читают и серверные маршруты.
 *
 * Принцип честности: очки клана считает сервер из реального опыта
 * игроков, а реальные деньги покупают только косметику и места в составе —
 * победить за деньги нельзя.
 */

/* ------------------------------- Лиги ---------------------------------- */

export interface League {
  id: number;
  name: string;
  color: string;
  /** Тёмный оттенок для градиентов значка */
  deep: string;
}

export const LEAGUES: readonly League[] = [
  { id: 0, name: "Бронза", color: "#e0955a", deep: "#6b3414" },
  { id: 1, name: "Серебро", color: "#cfd8ec", deep: "#4a5570" },
  { id: 2, name: "Золото", color: "#ffc65a", deep: "#7a4d06" },
  { id: 3, name: "Платина", color: "#7ee8d6", deep: "#0f5a52" },
  { id: 4, name: "Алмаз", color: "#7ecbff", deep: "#14478a" },
  { id: 5, name: "Легенда", color: "#ff6fb0", deep: "#6a1655" },
];
export const MAX_LEAGUE = LEAGUES.length - 1;
export const leagueOf = (id: number): League => LEAGUES[Math.min(Math.max(0, id | 0), MAX_LEAGUE)];

/* ------------------------------- Сезон --------------------------------- */

/** В рейтинге участвуют кланы минимум с таким числом игроков */
export const MIN_RANKED_MEMBERS = 3;
/** Больше этого опыта за неделю от одного игрока клану не засчитывается — важен весь состав */
export const MEMBER_WEEK_CAP = 6000;
/** Игрок получает награды сезона и сундуки, если принёс клану не меньше */
export const MIN_MEMBER_GAIN = 150;
/** Доля кланов лиги, которая поднимается/опускается по итогам недели */
export const MOVE_FRACTION = 0.25;
/** Лига меняется только если в ней достаточно кланов */
export const MIN_CLANS_TO_MOVE = 4;

export interface SeasonReward {
  /** Места от и до включительно */
  from: number;
  to: number;
  label: string;
  /** Монеты каждому активному игроку клана */
  memberAc: number;
  /** Монеты в казну клана */
  treasuryAc: number;
  /** Кубки клана (копятся навсегда) */
  trophies: number;
}

export const SEASON_REWARDS: readonly SeasonReward[] = [
  { from: 1, to: 1, label: "1 место", memberAc: 600, treasuryAc: 1500, trophies: 5 },
  { from: 2, to: 2, label: "2 место", memberAc: 400, treasuryAc: 1000, trophies: 3 },
  { from: 3, to: 3, label: "3 место", memberAc: 250, treasuryAc: 600, trophies: 2 },
  { from: 4, to: 10, label: "4–10", memberAc: 120, treasuryAc: 300, trophies: 1 },
  { from: 11, to: 9999, label: "Участие", memberAc: 50, treasuryAc: 0, trophies: 0 },
];
export const rewardForRank = (rank: number): SeasonReward | undefined =>
  SEASON_REWARDS.find((r) => rank >= r.from && rank <= r.to);

/** Недельные цели клана: сколько очков нужно на каждую ступень (растёт с лигой) */
export const GOAL_BASE = [3000, 8000, 16000] as const;
export const goalTargets = (league: number): number[] => GOAL_BASE.map((v) => Math.round(v * (1 + league * 0.45)));

export const GOAL_TIERS = [
  { id: 1, name: "Бронзовый сундук", ac: 120, color: "#e0955a" },
  { id: 2, name: "Серебряный сундук", ac: 320, color: "#cfd8ec" },
  { id: 3, name: "Золотой сундук", ac: 700, color: "#ffc65a" },
] as const;

/* ------------------------------ Состав --------------------------------- */

export type ClanRole = "leader" | "officer" | "member";
export const ROLE_NAME: Record<ClanRole, string> = { leader: "Глава", officer: "Офицер", member: "Боец" };

/** Уровень клана по накопленному опыту сезонов */
export function clanLevelFromXp(xp: number): number {
  let level = 1;
  while (Math.round(600 * Math.pow(level, 1.7)) <= xp && level < 50) level += 1;
  return level;
}
export const clanXpForLevel = (level: number): number => Math.round(600 * Math.pow(Math.max(0, level - 1), 1.7));
/** Мест в клане: растёт с уровнем, плюс купленные */
export const memberCap = (level: number, extra = 0): number => Math.min(50, 14 + level * 2) + extra;

/* ------------------------- Казна и кристаллы --------------------------- */

/** Минимальный и максимальный взнос монет в казну за раз */
export const DONATE_MIN = 10;
export const DONATE_MAX = 20_000;

/** Наборы кристаллов — единственный способ получить их за деньги */
export interface CrystalPack {
  id: string;
  name: string;
  rub: number;
  crystals: number;
  /** Подпись выгоды */
  note?: string;
}
export const CRYSTAL_PACKS: readonly CrystalPack[] = [
  { id: "spark", name: "Искра", rub: 99, crystals: 100 },
  { id: "crystal", name: "Кристалл", rub: 299, crystals: 340, note: "+13%" },
  { id: "constellation", name: "Созвездие", rub: 799, crystals: 950, note: "+19%" },
  { id: "galaxy", name: "Галактика", rub: 1990, crystals: 2600, note: "+31%" },
];

/** Цена предмета в кристаллах по редкости */
export const CRYSTAL_PRICE = { common: 60, rare: 140, epic: 350, legendary: 800 } as const;
/** Цена в монетах казны: только для обычных и редких предметов */
export const TREASURY_PRICE = { common: 300, rare: 700 } as const;

/** Улучшения клана */
export const SLOT_PACK = { id: "slots5", name: "+5 мест в составе", crystals: 250, slots: 5, max: 20 } as const;
export const RENAME_PRICE = 120;

/** Титулы спонсоров по сумме пожертвований (в рублях) */
export const DONOR_TIERS = [
  { id: "patron", name: "Меценат", from: 1990, color: "#ffc65a" },
  { id: "benefactor", name: "Покровитель", from: 499, color: "#c58bff" },
  { id: "sponsor", name: "Спонсор", from: 99, color: "#7ecbff" },
] as const;
export const donorTier = (rub: number) => DONOR_TIERS.find((t) => rub >= t.from) ?? null;

/* ----------------------------- Косметика клана -------------------------- */

export type ItemRarity = "common" | "rare" | "epic" | "legendary";
export type ItemSlot = "banner" | "aura" | "frame";
export interface ClanItem {
  id: string;
  slot: ItemSlot;
  name: string;
  rarity: ItemRarity;
  /** Основной и вспомогательный цвета для SVG */
  a: string;
  b: string;
}

export const RARITY_NAME: Record<ItemRarity, string> = { common: "Обычный", rare: "Редкий", epic: "Эпический", legendary: "Легендарный" };

export const CLAN_ITEMS: readonly ClanItem[] = [
  { id: "banner-dawn", slot: "banner", name: "Рассвет", rarity: "common", a: "#ffb36b", b: "#ff6f91" },
  { id: "banner-tide", slot: "banner", name: "Прилив", rarity: "common", a: "#5cc8ff", b: "#3b5bff" },
  { id: "banner-moss", slot: "banner", name: "Мох", rarity: "rare", a: "#8be28b", b: "#1f7a4d" },
  { id: "banner-nova", slot: "banner", name: "Новая звезда", rarity: "epic", a: "#c58bff", b: "#ff5fa8" },
  { id: "banner-eclipse", slot: "banner", name: "Затмение", rarity: "legendary", a: "#ffd36b", b: "#7a2cff" },
  { id: "aura-ember", slot: "aura", name: "Тлеющие угли", rarity: "common", a: "#ff9a4d", b: "#ff3a2a" },
  { id: "aura-frost", slot: "aura", name: "Иней", rarity: "rare", a: "#bfe9ff", b: "#5aa8ff" },
  { id: "aura-storm", slot: "aura", name: "Грозовой разряд", rarity: "epic", a: "#fff27a", b: "#7a5cff" },
  { id: "aura-void", slot: "aura", name: "Пустота", rarity: "legendary", a: "#b36bff", b: "#12031f" },
  { id: "frame-bronze", slot: "frame", name: "Бронзовая оправа", rarity: "common", a: "#e0955a", b: "#6b3414" },
  { id: "frame-jade", slot: "frame", name: "Нефрит", rarity: "rare", a: "#7ee8b0", b: "#0f5a3a" },
  { id: "frame-royal", slot: "frame", name: "Королевская", rarity: "epic", a: "#ffd36b", b: "#8a1c4a" },
  { id: "frame-prism", slot: "frame", name: "Призма", rarity: "legendary", a: "#7ee8ff", b: "#ff6fb0" },
];
export const clanItem = (id: string): ClanItem | undefined => CLAN_ITEMS.find((i) => i.id === id);
