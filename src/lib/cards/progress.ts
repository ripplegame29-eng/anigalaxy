/**
 * Прогресс коллекционера: достижения, награды за сеты, серия входа, недельные задания.
 * Определения общие для сервера и интерфейса.
 */

export interface Reward {
  diamonds?: number;
  dust?: number;
  /** Свитки заточки: сколько и какого ранга (по умолчанию ранг 1) */
  scroll?: number;
  scrollRank?: number;
  packs?: number;
}

export type StatKey =
  | "distinct"
  | "legend"
  | "mythic"
  | "foil"
  | "packs"
  | "wins"
  | "streak"
  | "maxLevel"
  | "skillUps"
  | "trades"
  | "auctions"
  | "login"
  | "stars"
  | "raid";

export interface AchTier {
  goal: number;
  reward: Reward;
}

export interface AchDef {
  id: string;
  name: string;
  desc: string;
  /** Имя иконки интерфейса */
  icon: string;
  stat: StatKey;
  tiers: AchTier[];
}

const T = (goals: number[], diamonds: number[], extra?: (i: number) => Reward): AchTier[] =>
  goals.map((goal, i) => ({ goal, reward: { diamonds: diamonds[i], dust: diamonds[i] * 2, ...(extra?.(i) ?? {}) } }));

export const ACHIEVEMENTS: AchDef[] = [
  { id: "collector", name: "Коллекционер", desc: "Собрать разных героев", icon: "grid", stat: "distinct", tiers: T([10, 25, 50, 100, 180], [30, 60, 120, 250, 500], (i) => (i >= 3 ? { packs: 1 } : {})) },
  { id: "legend", name: "Охотник за легендами", desc: "Собрать разных героев ранга S и SS", icon: "crown", stat: "legend", tiers: T([1, 4, 10, 20], [60, 120, 260, 520], (i) => ({ scroll: 1, scrollRank: Math.min(4, 2 + (i >> 1)) })) },
  { id: "mythic", name: "Мифический след", desc: "Собрать разных мифических героев (SS)", icon: "star", stat: "mythic", tiers: T([1, 3, 8], [150, 400, 1000], () => ({ scroll: 1, scrollRank: 4 })) },
  { id: "foil", name: "Блеск фольги", desc: "Иметь карт с фольгой", icon: "dust", stat: "foil", tiers: T([1, 5, 15], [40, 120, 300]) },
  { id: "opener", name: "Распечатыватель", desc: "Открыть паков", icon: "pack", stat: "packs", tiers: T([10, 50, 150, 400], [25, 80, 200, 500], (i) => (i >= 2 ? { packs: 2 } : {})) },
  { id: "winner", name: "Победитель", desc: "Выиграть боёв", icon: "swords", stat: "wins", tiers: T([5, 25, 100, 300], [30, 100, 300, 800]) },
  { id: "streak", name: "Неудержимый", desc: "Победная серия подряд", icon: "bolt", stat: "streak", tiers: T([3, 5, 8, 12], [30, 80, 180, 400]) },
  { id: "sharp", name: "Закалённая сталь", desc: "Максимальный уровень заточки карты", icon: "anvil", stat: "maxLevel", tiers: T([5, 8, 12, 15], [25, 70, 180, 450], () => ({ scroll: 1 })) },
  { id: "skills", name: "Мастер умений", desc: "Прокачать умения (всего уровней)", icon: "scroll", stat: "skillUps", tiers: T([5, 20, 60], [40, 150, 400]) },
  { id: "trader", name: "Торговец", desc: "Совершить обменов с игроками", icon: "swap", stat: "trades", tiers: T([1, 5, 20], [20, 80, 250]) },
  { id: "auctioneer", name: "Аукционист", desc: "Продать или купить лотов на аукционе", icon: "tag", stat: "auctions", tiers: T([1, 5, 20], [20, 90, 280]) },
  { id: "loyal", name: "Верность галактике", desc: "Серия ежедневных входов (лучшая)", icon: "calendar", stat: "login", tiers: T([3, 7, 14, 30], [20, 60, 150, 400], (i) => (i >= 2 ? { packs: 1 } : {})) },
  { id: "stars", name: "Звёздный путь", desc: "Собрать звёзды в кампании", icon: "flag", stat: "stars", tiers: T([10, 40, 90, 150], [40, 140, 340, 700]) },
  { id: "raid", name: "Бич гигантов", desc: "Нанести урона рейд-боссам", icon: "target", stat: "raid", tiers: T([20_000, 150_000, 800_000], [60, 220, 650]) },
];

/** Награды за сеты: по числу собранных героев аниме (половина и полный набор) */
export const SET_REWARDS: Reward[] = [
  { diamonds: 40, dust: 100 },
  { diamonds: 150, dust: 400, packs: 1, scroll: 1, scrollRank: 2 },
];
export const SET_MIN_SIZE = 4;

/** Серия ежедневных входов */
export const STREAK = {
  /** Прибавка к ежедневному подарку за каждый день серии и её потолок */
  bonusPerDay: 0.05,
  maxBonus: 0.5,
  milestones: [
    { day: 3, reward: { dust: 120 } as Reward },
    { day: 7, reward: { diamonds: 60, packs: 1 } as Reward },
    { day: 14, reward: { diamonds: 120, scroll: 1, scrollRank: 2 } as Reward },
    { day: 30, reward: { diamonds: 300, packs: 2, scroll: 1, scrollRank: 3 } as Reward },
  ],
} as const;

export interface WeeklyDef {
  id: string;
  text: string;
  /** Какая статистика двигает задание */
  stat: "wins" | "packs" | "sharpen" | "skillUps" | "stars" | "raid" | "trades";
  goal: number;
  reward: Reward;
}

export const WEEKLY: WeeklyDef[] = [
  { id: "wk-win", text: "Выиграть 15 боёв", stat: "wins", goal: 15, reward: { diamonds: 90, dust: 160 } },
  { id: "wk-pack", text: "Открыть 10 паков", stat: "packs", goal: 10, reward: { diamonds: 60, scroll: 1, scrollRank: 1 } },
  { id: "wk-sharp", text: "Заточить карты 12 раз", stat: "sharpen", goal: 12, reward: { dust: 300, scroll: 1, scrollRank: 2 } },
  { id: "wk-skill", text: "Прокачать умения на 4 уровня", stat: "skillUps", goal: 4, reward: { diamonds: 70, dust: 120 } },
  { id: "wk-stars", text: "Собрать 12 звёзд в кампании", stat: "stars", goal: 12, reward: { diamonds: 120, packs: 1 } },
  { id: "wk-raid", text: "Нанести 30 000 урона рейд-боссу", stat: "raid", goal: 30_000, reward: { diamonds: 100, scroll: 1, scrollRank: 3 } },
];

/** Лимит витрины профиля */
export const SHOWCASE_MAX = 5;

export const rewardText = (r: Reward): string =>
  [r.diamonds && `${r.diamonds} алм.`, r.dust && `${r.dust} пыли`, r.scroll && `${r.scroll} свиток`, r.packs && `${r.packs} пак${r.packs > 1 ? "а" : ""}`].filter(Boolean).join(" · ");

export interface AchView {
  id: string;
  value: number;
  /** Сколько ступеней уже забрано */
  claimed: number;
  /** Сколько ступеней выполнено */
  done: number;
}
export interface SetView {
  series: string;
  size: number;
  owned: number;
  /** Забраны ли награды: половина и полный набор */
  claimed: boolean[];
  need: number[];
}
export interface ProgressState {
  achievements: AchView[];
  sets: SetView[];
  streak: { n: number; best: number; claimedToday: boolean; milestones: { day: number; reward: Reward; claimed: boolean }[]; bonusPct: number };
  weekly: { id: string; text: string; goal: number; progress: number; claimed: boolean; reward: Reward }[];
  weekEndsAt: number;
  showcase: number[];
  stats: Record<string, number>;
}

