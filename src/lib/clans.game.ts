"use client";

/**
 * Фракции, специализации, экономика и сезон — конфигурация клановой
 * экосистемы AniGalaxy.
 *
 * Вынесено в отдельный файл не для порядка, а по существу: правила
 * (кто что может, сколько чего стоит, как растёт уровень) должны читаться
 * как одна таблица, а не быть размазаны по логике вкладов. Промт прямо
 * требует не смешивать показатели, поэтому каждый ресурс описан здесь же,
 * вместе с тем, на что он тратится.
 */

/* ------------------------------------------------------------------ */
/* Фракции                                                             */
/* ------------------------------------------------------------------ */

export type ClanFaction = "ninja" | "hunter" | "mage" | "demon" | "sword";

export interface ClanFactionInfo {
  id: ClanFaction;
  name: string;
  /** Символ-эмблема faction'а */
  glyph: string;
  /** Цвет канала */
  color: string;
  /** Короткий девиз на странице выбора */
  motto: string;
  /** Бонус фракции: что получает клан сверх базы */
  perk: string;
}

export const FACTIONS: ClanFactionInfo[] = [
  { id: "ninja", name: "Ниндзя", glyph: "🥷", color: "#3d7dff", motto: "Тише едешь — дальше будешь", perk: "+10% очков за скрытые события экспедиций" },
  { id: "hunter", name: "Охотники", glyph: "🏹", color: "#ffb020", motto: "Добыча сама не сдаётся", perk: "+15% ресурсов экспедиции за личные цели" },
  { id: "mage", name: "Маги", glyph: "🔮", color: "#b06bff", motto: "Сила — в знании", perk: "+10% к опыту за чтение манги" },
  { id: "demon", name: "Демоны", glyph: "😈", color: "#ff4d6d", motto: "Сила чувствуется сразу", perk: "+12% к урону на рейдах" },
  { id: "sword", name: "Мечники", glyph: "⚔️", color: "#00c2a8", motto: "Слово заменяет сталь", perk: "+8% очков клинка в клановых войнах" },
];

export function factionOf(id: string): ClanFactionInfo {
  return FACTIONS.find((f) => f.id === id) ?? FACTIONS[0];
}

/**
 * Бонусы фракций числами.
 *
 * Текст в `FACTIONS` читает игрок, а механики (рейд, поход, задания)
 * считают по этой таблице. Держать одно и другое в одном месте нельзя:
 * расхождение через месяц выглядело бы как «работает не так, как написано».
 */
export const FACTION_PERK: Record<
  ClanFaction,
  { damage: number; expedition: number; manga: number; tasks: number }
> = {
  ninja: { damage: 1.0, expedition: 1.1, manga: 1.0, tasks: 1.0 },
  hunter: { damage: 1.0, expedition: 1.15, manga: 1.0, tasks: 1.1 },
  mage: { damage: 1.0, expedition: 1.0, manga: 1.1, tasks: 1.05 },
  demon: { damage: 1.12, expedition: 1.0, manga: 1.0, tasks: 1.0 },
  sword: { damage: 1.08, expedition: 1.05, manga: 1.0, tasks: 1.0 },
};

/* ------------------------------------------------------------------ */
/* Специализации участников                                           */
/* ------------------------------------------------------------------ */

export type ClanSpecialization = "scout" | "strategist" | "farmer" | "guard" | "archivist" | "hunter";

export interface ClanSpecInfo {
  id: ClanSpecialization;
  name: string;
  glyph: string;
  /** Что даёт клану — ровно то, что описано в промте */
  perk: string;
  /** Ограничение: сколько раз в сутки можно сменить */
  switchesPerDay: number;
}

export const SPECIALIZATIONS: ClanSpecInfo[] = [
  { id: "scout", name: "Следопыт", glyph: "🧭", perk: "Открывает дополнительные маршруты и скрытые события", switchesPerDay: 1 },
  { id: "strategist", name: "Стратег", glyph: "♟️", perk: "Бонус к очкам за выполнение командных целей", switchesPerDay: 1 },
  { id: "farmer", name: "Фармер", glyph: "🌾", perk: "Больше ресурсов экспедиции в установленных пределах", switchesPerDay: 1 },
  { id: "guard", name: "Защитник", glyph: "🛡️", perk: "Сохраняет прогресс при неудачном событии", switchesPerDay: 1 },
  { id: "archivist", name: "Архивариус", glyph: "📜", perk: "Открывает дополнительные задания и коллекционные записи", switchesPerDay: 1 },
  { id: "hunter", name: "Охотник", glyph: "🎯", perk: "Получает персональные цели на боссов", switchesPerDay: 1 },
];

export function specOf(id: string): ClanSpecInfo {
  return SPECIALIZATIONS.find((s) => s.id === id) ?? SPECIALIZATIONS[0];
}

/* ------------------------------------------------------------------ */
/* Экономика: четыре несмешиваемых ресурса                             */
/* ------------------------------------------------------------------ */

/**
 * Промт требует не давать свободный обмен валют между игроками: обмен
 * ломает баланс (фермы, передача ресурсов). Поэтому ресурс нельзя тратить
 * на другой — только на свою ветку.
 */
export type ClanResource = "xp" | "influence" | "materials" | "prestige";

export const RESOURCE_LABEL: Record<ClanResource, string> = {
  xp: "Клановый опыт",
  influence: "Влияние",
  materials: "Материалы",
  prestige: "Престиж",
};

/** Откуда берётся и на что тратится — как в описании механик */
export const RESOURCE_INFO: Record<
  ClanResource,
  { from: string; spend: string; glyph: string }
> = {
  xp: { from: "Задания, рейды, экспедиции", spend: "Повышение уровня клана", glyph: "⚡" },
  influence: { from: "Сезонные задания и войны", spend: "Территории и события", glyph: "🔷" },
  materials: { from: "Экспедиции, боссы, квесты", spend: "Улучшение базы", glyph: "🧱" },
  prestige: { from: "Победы и сезонные достижения", spend: "Ранг, титулы, трофеи", glyph: "👑" },
};

export type ClanPurse = Record<ClanResource, number>;

/** Нулевой кошелёк */
export const EMPTY_PURSE: ClanPurse = { xp: 0, influence: 0, materials: 0, prestige: 0 };

/* ------------------------------------------------------------------ */
/* База клана: здания                                                  */
/* ------------------------------------------------------------------ */

export type ClanBuilding = "library" | "archive" | "dojo" | "vault" | "portal" | "throne";

export interface ClanBuildingInfo {
  id: ClanBuilding;
  name: string;
  glyph: string;
  /** Что даёт здание */
  perk: string;
  /** На чём строится: только материалы */
  cost: ClanResource;
  /** Базовая цена уровня */
  base: number;
  /** Максимальный уровень */
  max: number;
}

export const BUILDINGS: ClanBuildingInfo[] = [
  { id: "library", name: "Библиотека", glyph: "📚", perk: "Бонус к опыту за чтение манги", cost: "materials", base: 300, max: 10 },
  { id: "archive", name: "Архив", glyph: "🗄️", perk: "Дополнительные задания и история клана", cost: "materials", base: 260, max: 10 },
  { id: "dojo", name: "Тренировочный зал", glyph: "🥋", perk: "Бонусы к сезонным соревнованиям", cost: "materials", base: 340, max: 10 },
  { id: "vault", name: "Сокровищница", glyph: "🏛️", perk: "Хранилище клановых ресурсов", cost: "materials", base: 400, max: 10 },
  { id: "portal", name: "Портал", glyph: "🌀", perk: "Доступ к специальным событиям", cost: "materials", base: 520, max: 10 },
  { id: "throne", name: "Тронный зал", glyph: "👑", perk: "Престиж, эффекты и демонстрация трофеев", cost: "materials", base: 600, max: 10 },
];

export function buildingOf(id: string): ClanBuildingInfo {
  return BUILDINGS.find((b) => b.id === id) ?? BUILDINGS[0];
}

/** Цена следующего уровня здания: растёт по геометрии, а не линейно */
export function buildingCost(info: ClanBuildingInfo, currentLevel: number): number {
  return Math.round(info.base * 1.55 ** currentLevel / 10) * 10;
}

/* ------------------------------------------------------------------ */
/* Сезон и лиги                                                        */
/* ------------------------------------------------------------------ */

export type ClanLeague = "bronze" | "silver" | "gold" | "diamond" | "legend";

export interface ClanLeagueInfo {
  id: ClanLeague;
  name: string;
  color: string;
  /** Порог очков сезона для лиги */
  at: number;
  perk: string;
}

export const LEAGUES: ClanLeagueInfo[] = [
  { id: "bronze", name: "Бронза", color: "#c08457", at: 0, perk: "Начинающие кланы" },
  { id: "silver", name: "Серебро", color: "#c0c6d4", at: 20_000, perk: "Стабильные коллективы" },
  { id: "gold", name: "Золото", color: "#ffb020", at: 60_000, perk: "Опытные гильдии" },
  { id: "diamond", name: "Алмаз", color: "#7dd3fc", at: 140_000, perk: "Сильнейшие команды" },
  { id: "legend", name: "Легенды", color: "#ff4d6d", at: 300_000, perk: "Элита сезона" },
];

export function leagueOf(points: number): ClanLeagueInfo {
  let league = LEAGUES[0];
  for (const item of LEAGUES) if (points >= item.at) league = item;
  return league;
}

/** Длительность сезона и сколько осталось */
export const SEASON_DAYS = 35;
export const SEASON_NUMBER = 1;
export const SEASON_NAME = "Великая война гильдий";

/** Дни сезона: 0 — последний */
export function seasonDaysLeft(now = Date.now()): number {
  // Сезон привязан к календарю: начинается 1-го числа месяца
  const start = new Date(now);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + SEASON_DAYS);
  return Math.max(0, Math.ceil((end.getTime() - now) / 86_400_000));
}

/* ------------------------------------------------------------------ */
/* Территории                                                          */
/* ------------------------------------------------------------------ */

export type ClanRegion = "spiritForest" | "magicAcademy" | "hunterCity" | "abyssRift";

export interface ClanRegionInfo {
  id: ClanRegion;
  name: string;
  glyph: string;
  /** Влияние, которое нужно накопить за сезон */
  required: number;
  reward: string;
}

export const REGIONS: ClanRegionInfo[] = [
  { id: "spiritForest", name: "Лес духов", glyph: "🌲", required: 12_000, reward: "Престиж сезона и доступ к квестам духов" },
  { id: "magicAcademy", name: "Академия магов", glyph: "🏰", required: 20_000, reward: "Косметические эффекты и архивы" },
  { id: "hunterCity", name: "Город охотников", glyph: "🏹", required: 28_000, reward: "Особые задания охотникам" },
  { id: "abyssRift", name: "Бездонный разлом", glyph: "🕳️", required: 40_000, reward: "Редкие реликвии и трофеи" },
];

export function regionOf(id: string): ClanRegionInfo {
  return REGIONS.find((r) => r.id === id) ?? REGIONS[0];
}

/* ------------------------------------------------------------------ */
/* Задания клана                                                       */
/* ------------------------------------------------------------------ */

export type ClanQuestKind = "manga" | "anime" | "unique" | "achievements";

export interface ClanQuestInfo {
  id: string;
  name: string;
  kind: ClanQuestKind;
  /** Что нужно сделать за период: глав, серий, достижений или разных действий */
  goal: number;
  reward: ClanResource;
  /** Сколько даёт награда за выполнение */
  amount: number;
  /** Частота: ежедневное обновляется в полночь, еженедельное — в понедельник */
  period: "daily" | "weekly";
  /** Единица прогресса для интерфейса */
  unit: string;
}

export const QUESTS: ClanQuestInfo[] = [
  { id: "library-keeper", name: "Смотритель библиотеки", kind: "manga", goal: 10, reward: "influence", amount: 500, period: "daily", unit: "глав" },
  { id: "anime-marathon", name: "Аниме-марафон", kind: "anime", goal: 6, reward: "influence", amount: 300, period: "daily", unit: "серий" },
  { id: "unity", name: "Сила единства", kind: "unique", goal: 5, reward: "influence", amount: 800, period: "daily", unit: "видов активности" },
  { id: "trophy-hunt", name: "Охотники за трофеями", kind: "achievements", goal: 5, reward: "materials", amount: 240, period: "weekly", unit: "достижений" },
  { id: "long-read", name: "Большая глава", kind: "manga", goal: 50, reward: "materials", amount: 420, period: "weekly", unit: "глав" },
  { id: "company", name: "Ничего в одиночку", kind: "unique", goal: 25, reward: "xp", amount: 600, period: "weekly", unit: "видов активности" },
];

/**
 * Насколько прогресс может перевыполнить цель.
 *
 * Основная защита от накрутки — уникальность источника (одна глава, одна
 * серия считается один раз) и выдача награды один раз за период. Потолок
 * нужен для другого: чтобы длинная сессия не превращалась в «закрыл всё
 * задания разом», шкала физически не уходит далеко за цель.
 */
export const QUEST_CAP = { daily: 2, weekly: 3 } as const;

/* ------------------------------------------------------------------ */
/* Рейд на босса                                                       */
/* ------------------------------------------------------------------ */

export interface ClanBossInfo {
  id: string;
  name: string;
  glyph: string;
  /** Порог урона для первой фазы */
  phase: number;
  /** Всего фаз у босса */
  phases: number;
  reward: string;
}

/** Босс меняется по дням недели: воскресенье — рейд */
export const BOSS: ClanBossInfo = {
  id: "demon-king",
  name: "Король демонов",
  glyph: "👹",
  // Порог фазы подобран под недельный темп реальной активности: порог из описания менее (50 000 на фазу) при 10 сериях в день недостижим, и босс остался бы живым весь сезон
  phase: 25_000,
  phases: 3,
  reward: "Редкий фрагмент эмблемы и клановый престиж",
};

/** День недели, когда открывается рейд (0 — воскресенье) */
export const RAID_DAY = 0;

/* ------------------------------------------------------------------ */
/* Экспедиции                                                          */
/* ------------------------------------------------------------------ */

export type ExpeditionRoute = "safe" | "hunter" | "abyss";

export interface ExpeditionRouteInfo {
  id: ExpeditionRoute;
  name: string;
  glyph: string;
  /** Дней на прохождение */
  days: number;
  /** Шанс завершить (процент) — заложен в конфиг, а не бросается кубиком */
  success: number;
  rewardMul: number;
  desc: string;
}

export const ROUTES: ExpeditionRouteInfo[] = [
  { id: "safe", name: "Безопасный путь", glyph: "🛡️", days: 5, success: 90, rewardMul: 1, desc: "Небольшие награды, высокая вероятность завершить экспедицию" },
  { id: "hunter", name: "Путь охотника", glyph: "🏹", days: 6, success: 65, rewardMul: 1.6, desc: "Сбалансированная сложность и награды" },
  { id: "abyss", name: "Путь бездны", glyph: "🕳️", days: 7, success: 40, rewardMul: 2.6, desc: "Больше этапов и редкие награды, но сложнее задания" },
];

export function routeOf(id: string): ExpeditionRouteInfo {
  return ROUTES.find((r) => r.id === id) ?? ROUTES[0];
}