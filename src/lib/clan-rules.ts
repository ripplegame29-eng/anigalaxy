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
  { id: 3, name: "Платина", color: "#8fd8ff", deep: "#134a7a" },
  { id: 4, name: "Алмаз", color: "#b89bff", deep: "#3d1f8a" },
  { id: 5, name: "Легенда", color: "#ff6a5a", deep: "#6e1022" },
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
/** Особый вид предмета: от него зависит рисунок и анимация */
export type ItemFx =
  | "star" | "wave" | "leaf" | "sakura" | "dragon" | "eclipse" | "galaxy"
  | "embers" | "frost" | "petals" | "storm" | "aurora" | "void" | "phoenix"
  | "studs" | "jade" | "laurel" | "royal" | "runes" | "prism" | "crown";
export interface ClanItem {
  id: string;
  slot: ItemSlot;
  name: string;
  rarity: ItemRarity;
  /** Основной и вспомогательный цвета */
  a: string;
  b: string;
  fx: ItemFx;
  /** Строка для витрины */
  desc: string;
  /** Рамка-картинка (как у рамок профиля): файл, масштаб к аватару и сдвиг «дыры» */
  img?: string;
  scale?: number;
  dx?: number;
  dy?: number;
  /** Анимация живой ауры (clan-aura.css) */
  /** Своя SVG-рамка: мотив и цвет камня */
  motif?: "laurel" | "wings" | "crystal" | "crown" | "thorns" | "moon" | "flame" | "sakura" | "galaxy";
  gem?: string;
  aura?: "corona" | "rays" | "orbit" | "nebula" | "eclipse" | "embers" | "storm" | "prism" | "frost";
}

export const RARITY_NAME: Record<ItemRarity, string> = { common: "Обычный", rare: "Редкий", epic: "Эпический", legendary: "Легендарный" };

/**
 * Оформление клана. id старых предметов не меняются — купленное остаётся у кланов.
 * Знамя висит за гербом в шапке клана, аура светится вокруг герба, рамка — оправа герба.
 */
export const CLAN_ITEMS: readonly ClanItem[] = [
  { id: "banner-dawn", slot: "banner", name: "Рассвет", rarity: "common", a: "#ffb36b", b: "#ff6f91", fx: "star", desc: "Тёплое знамя первых побед" },
  { id: "banner-tide", slot: "banner", name: "Прилив", rarity: "common", a: "#5cc8ff", b: "#3b5bff", fx: "wave", desc: "Волна, что поднимает весь клан" },
  { id: "banner-moss", slot: "banner", name: "Лесной дозор", rarity: "rare", a: "#8be28b", b: "#1f7a4d", fx: "leaf", desc: "Знамя тех, кто держит оборону" },
  { id: "banner-sakura", slot: "banner", name: "Сакура", rarity: "rare", a: "#ffc2dd", b: "#e0457f", fx: "sakura", desc: "Лепестки падают с полотна" },
  { id: "banner-nova", slot: "banner", name: "Новая звезда", rarity: "epic", a: "#c58bff", b: "#ff5fa8", fx: "star", desc: "Сияющая звезда над гербом" },
  { id: "banner-dragon", slot: "banner", name: "Багровый дракон", rarity: "epic", a: "#ff5a4f", b: "#3a0612", fx: "dragon", desc: "Дракон обвивает древко" },
  { id: "banner-eclipse", slot: "banner", name: "Затмение", rarity: "legendary", a: "#ffd36b", b: "#3a1a7a", fx: "eclipse", desc: "Чёрное солнце в золотой короне" },
  { id: "banner-galaxy", slot: "banner", name: "Млечный путь", rarity: "legendary", a: "#8fd8ff", b: "#2a1460", fx: "galaxy", desc: "Живая галактика на полотне" },


  { id: "aura-x-embers", slot: "aura", name: "Пламя очага", rarity: "rare", a: "#ffb35c", b: "#ff3d1f", fx: "embers", aura: "embers", desc: "Угли поднимаются в тёплом свете" },
  { id: "aura-x-frost", slot: "aura", name: "Ледяной венец", rarity: "rare", a: "#dff6ff", b: "#4aa8ff", fx: "frost", aura: "frost", desc: "Колючий иней мерцает по кругу" },
  { id: "aura-x-orbit", slot: "aura", name: "Звёздная орбита", rarity: "epic", a: "#bfe6ff", b: "#3b6bff", fx: "aurora", aura: "orbit", desc: "Три спутника кружат по орбитам" },
  { id: "aura-x-rays", slot: "aura", name: "Сияние зенита", rarity: "epic", a: "#fff1b8", b: "#ffb020", fx: "aurora", aura: "rays", desc: "Медленные лучи золотого света" },
  { id: "aura-x-storm", slot: "aura", name: "Грозовое око", rarity: "epic", a: "#e8f1ff", b: "#7a5cff", fx: "storm", aura: "storm", desc: "Молнии вспыхивают в вихре" },
  { id: "aura-x-nebula", slot: "aura", name: "Туманность", rarity: "legendary", a: "#ff8ad8", b: "#5b3bff", fx: "aurora", aura: "nebula", desc: "Живое облако звёздной пыли" },
  { id: "aura-x-corona", slot: "aura", name: "Корона звезды", rarity: "legendary", a: "#fff4d6", b: "#ff7a1a", fx: "phoenix", aura: "corona", desc: "Вращающаяся солнечная корона" },
  { id: "aura-x-eclipse", slot: "aura", name: "Затмение", rarity: "legendary", a: "#ffd36b", b: "#1a0b33", fx: "void", aura: "eclipse", desc: "Чёрное солнце с золотым ободом" },
  { id: "aura-x-prism", slot: "aura", name: "Призма AniGalaxy", rarity: "legendary", a: "#7ee8ff", b: "#b46bff", fx: "aurora", aura: "prism", desc: "Радужный свет преломляется вокруг" },
  { id: "frame-f-ice", slot: "frame", name: "Ледяное оперение", rarity: "epic", a: "#e6f7ff", b: "#0a2f6a", fx: "prism", img: "/clans/frames/feather-ice.svg", scale: 1.95, desc: "Венок из ледяных перьев" },
  { id: "frame-f-emerald", slot: "frame", name: "Изумрудное оперение", rarity: "epic", a: "#e3fff1", b: "#0a4a32", fx: "jade", img: "/clans/frames/feather-emerald.svg", scale: 1.95, desc: "Перья цвета молодой листвы" },
  { id: "frame-f-rose", slot: "frame", name: "Розовое перо", rarity: "epic", a: "#ffeaf4", b: "#d0427f", fx: "jade", img: "/clans/frames/lunar-rose.svg", scale: 1.95, desc: "Нежный венок из розовых перьев" },
  { id: "frame-f-crimson", slot: "frame", name: "Багровое оперение", rarity: "legendary", a: "#ffe3e8", b: "#5a0618", fx: "crown", img: "/clans/frames/feather-crimson.svg", scale: 1.95, desc: "Алые перья воинов клана" },
  { id: "frame-f-gold", slot: "frame", name: "Золотое оперение", rarity: "legendary", a: "#fff3d1", b: "#6a3a05", fx: "crown", img: "/clans/frames/feather-gold.svg", scale: 1.95, desc: "Перья из чистого золота" },
  { id: "frame-f-galaxy", slot: "frame", name: "Звёздное оперение", rarity: "legendary", a: "#eaf0ff", b: "#160a4a", fx: "prism", img: "/clans/frames/feather-galaxy.svg", scale: 1.95, desc: "Перья цвета ночного неба AniGalaxy" },
  { id: "frame-l-onyx", slot: "frame", name: "Ониксовый лавр", rarity: "rare", a: "#f2f4f8", b: "#2a2d36", fx: "laurel", img: "/clans/frames/laurel-onyx.svg", scale: 1.95, desc: "Серебро и чёрная сталь, строго и дорого" },
  { id: "frame-l-rose", slot: "frame", name: "Розовый лавр", rarity: "rare", a: "#ffe6f0", b: "#a3245a", fx: "laurel", img: "/clans/frames/laurel-rose.svg", scale: 1.95, desc: "Венок цвета сакуры" },
  { id: "frame-l-frost", slot: "frame", name: "Морозный лавр", rarity: "epic", a: "#e8f8ff", b: "#1c5a9a", fx: "laurel", img: "/clans/frames/laurel-frost.svg", scale: 1.95, desc: "Листья, покрытые инеем" },
  { id: "frame-l-violet", slot: "frame", name: "Фиалковый лавр", rarity: "epic", a: "#efe4ff", b: "#2a0f6a", fx: "laurel", img: "/clans/frames/laurel-violet.svg", scale: 1.95, desc: "Пышный венок цвета аметиста" },
  { id: "frame-l-jade", slot: "frame", name: "Нефритовый лавр", rarity: "epic", a: "#e2fff3", b: "#063a28", fx: "jade", img: "/clans/frames/laurel-jade.svg", scale: 1.95, desc: "Резной нефрит с бликами" },
  { id: "frame-l-silver", slot: "frame", name: "Серебряная печать", rarity: "epic", a: "#f4f6fb", b: "#2a3044", fx: "crown", img: "/clans/frames/seal-silver.svg", scale: 1.95, desc: "Печать с серебряными лучами" },
  { id: "frame-l-blood", slot: "frame", name: "Кровавый лавр", rarity: "legendary", a: "#ffe3e3", b: "#3a0008", fx: "crown", img: "/clans/frames/laurel-blood.svg", scale: 1.95, desc: "Алый венок воинов клана" },
  { id: "frame-l-azure", slot: "frame", name: "Лазурная печать", rarity: "legendary", a: "#e6f3ff", b: "#0a2a6a", fx: "crown", img: "/clans/frames/seal-azure.svg", scale: 1.95, desc: "Синяя печать AniGalaxy" },
  { id: "frame-l-amethyst", slot: "frame", name: "Аметистовая печать", rarity: "legendary", a: "#f3e8ff", b: "#3a0f6a", fx: "crown", img: "/clans/frames/seal-amethyst.svg", scale: 1.95, desc: "Пурпурная печать с сиянием" },
];
export const clanItem = (id: string): ClanItem | undefined => CLAN_ITEMS.find((i) => i.id === id);
