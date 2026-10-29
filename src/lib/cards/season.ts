/**
 * Сезонный пасс, баннер недели и пробуждение карт.
 * Определения общие для сервера и интерфейса.
 */

import { CATALOG } from "./catalog";
import type { Reward } from "./progress";

/* ------------------------------- Сезонный пасс ----------------------------- */

export const PASS = {
  levels: 30,
  xpPerLevel: 120,
  seasonMs: 28 * 86_400_000,
  /** Цена премиум-ветки в алмазах */
  price: 600,
} as const;

/** Сколько очков пасса даёт единица статистики (см. `track`) */
export const PASS_XP: Record<string, number> = {
  wins: 25,
  packs: 8,
  sharpen: 6,
  stars: 12,
  raidHits: 40,
  trades: 15,
  auctions: 15,
  skillUps: 10,
  evo: 60,
};
export const PASS_XP_DAILY = 20;
export const PASS_XP_MISSION = 30;

export const seasonOf = (ms: number): number => Math.floor(ms / PASS.seasonMs);
export const seasonEnd = (season: number): number => (season + 1) * PASS.seasonMs;

export type PassTrack = "free" | "premium";

/** Награда за уровень пасса */
export function passReward(level: number, track: PassTrack): Reward {
  const five = level % 5 === 0;
  if (track === "free") {
    if (level === PASS.levels) return { diamonds: 100, scroll: 1, scrollRank: 3 };
    if (five) return { packs: 1, dust: 60 + level * 4 };
    return level % 2 === 1 ? { diamonds: 8 + level } : { dust: 40 + level * 3 };
  }
  if (level === PASS.levels) return { packs: 3, scroll: 2, scrollRank: 4, diamonds: 250 };
  if (level % 10 === 0) return { packs: 2, scroll: 1, scrollRank: 3, diamonds: 60 };
  if (five) return { packs: 1, scroll: 1, scrollRank: 2, dust: 120 };
  return level % 2 === 1 ? { diamonds: 16 + level * 2 } : { dust: 90 + level * 5, scroll: level % 4 === 0 ? 1 : undefined };
}

export interface PassView {
  season: number;
  endsAt: number;
  xp: number;
  level: number;
  /** Очки внутри текущего уровня */
  into: number;
  bought: boolean;
  price: number;
  free: number[];
  premium: number[];
}

/* -------------------------------- Баннер недели ---------------------------- */

export const BANNER = {
  /** Шанс, что в паке баннера один из вариантов заменится на героя недели */
  boost: 0.08,
  /** Гарантия: герой недели выпадет не позже чем через N паков баннера */
  guarantee: 20,
} as const;

/** Герой недели: чаще S, каждую четвёртую неделю — SS */
export function bannerFeatured(week: number): string {
  const rank = ((week % 4) + 4) % 4 === 3 ? 4 : 3;
  const pool = CATALOG.filter((c) => c.rank === rank).sort((a, b) => a.id.localeCompare(b.id));
  return pool[((week % pool.length) + pool.length) % pool.length].id;
}

export interface BannerView {
  week: number;
  featured: string;
  endsAt: number;
  /** Паков баннера без героя недели */
  counter: number;
  guarantee: number;
  boost: number;
}

/* ------------------------------- Пробуждение ------------------------------- */

export const EVO = {
  maxTier: 2,
  /** Сколько копий того же героя нужно на ступень */
  copies: [2, 3],
  /** Пыль за ступень по рангу героя */
  dust: [150, 500, 1500, 4000, 9000],
  /** Прирост характеристик по ступеням */
  bonus: [0, 0.25, 0.55],
  names: ["", "Пробуждение I", "Пробуждение II"],
} as const;

export const evoCost = (rank: number, tier: number): number => EVO.dust[rank] * (tier + 1);

export interface NoticesView {
  /** Новых нападений на вашу защиту */
  defenses: number;
  /** Новых итогов аукциона */
  auctions: number;
  /** Входящие предложения обмена */
  trades: number;
}

export interface EventsState {
  banner: BannerView;
  pass: PassView;
  notices: NoticesView;
}
