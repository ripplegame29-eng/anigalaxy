/** Рейд-босс недели: общий запас здоровья, урон каждого игрока, награды за вклад. */

import { CATALOG } from "./catalog";
import type { Reward } from "./progress";

export const RAID = {
  /** Попыток в день */
  dailyHits: 3,
  /** Бой с боссом длится не дольше стольких раундов */
  rounds: 10,
  /** Запас здоровья: базовый плюс на каждого игрока с отрядом */
  baseHp: 300_000,
  perPlayerHp: 45_000,
  /** Здоровье босса в одном бою: урон за бой не больше этого, считается по потерянному */
  fightHp: 40_000,
  atkMul: 1.5,
  defMul: 1.3,
  hits: 21,
} as const;

export interface RaidTier {
  damage: number;
  reward: Reward;
}
/** Награды по личному урону за неделю */
export const RAID_TIERS: RaidTier[] = [
  { damage: 2_000, reward: { diamonds: 40, dust: 120 } },
  { damage: 10_000, reward: { diamonds: 90, dust: 300, scroll: 1, scrollRank: 2 } },
  { damage: 40_000, reward: { diamonds: 180, packs: 1, scroll: 1, scrollRank: 3 } },
  { damage: 120_000, reward: { diamonds: 360, packs: 2, scroll: 1, scrollRank: 4 } },
];
/** Бонус всем участникам, если босса добили */
export const RAID_DEFEAT_REWARD: Reward = { diamonds: 120, packs: 1 };

/** Босс недели: мифический герой по очереди */
export function raidBossId(week: number): string {
  const pool = CATALOG.filter((c) => c.rank === 4).sort((a, b) => a.id.localeCompare(b.id));
  return pool[((week % pool.length) + pool.length) % pool.length].id;
}

export interface RaidView {
  week: number;
  boss: string;
  maxHp: number;
  hp: number;
  defeated: boolean;
  endsAt: number;
  hitsLeft: number;
  mine: { damage: number; hits: number; claimed: number };
  fightHp: number;
  top: { nick: string; damage: number; hits: number }[];
  tiers: RaidTier[];
  defeatReward: Reward;
  defeatClaimed: boolean;
}
