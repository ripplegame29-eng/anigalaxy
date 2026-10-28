/**
 * Кампания: главы по популярным аниме, в каждой пять этапов, последний — босс.
 * Звёзды: победа, быстрая победа, победа без потерь.
 */

import { CATALOG } from "./catalog";
import type { Reward } from "./progress";

/** Порядок глав: от простых к сложным (показываются только аниме с достаточным числом героев) */
const ORDER = ["Наруто", "Ван-Пис", "Истребитель демонов", "Моя геройская академия", "Блич", "Магическая битва", "Атака титанов", "Драгонболл", "Охотник х Охотник", "Ванпанчмен", "Стальной алхимик"];

export const STAGES = 5;
export const MIN_SERIES_CARDS = 9;
/** Победа за этот срок (раундов) даёт вторую звезду */
export const FAST_ROUNDS = 8;

export interface Chapter {
  id: number;
  series: string;
  name: string;
  /** Сколько героев серии в каталоге */
  size: number;
}

export const CHAPTERS: Chapter[] = ORDER.filter((s) => CATALOG.filter((c) => c.series === s).length >= MIN_SERIES_CARDS).map((series, id) => ({
  id,
  series,
  name: series,
  size: CATALOG.filter((c) => c.series === series).length,
}));

export const isBoss = (stage: number) => stage === STAGES - 1;

/** Награда за первое прохождение этапа */
export function stageReward(ch: number, st: number): Reward {
  const boss = isBoss(st);
  return { diamonds: (10 + 4 * st + 3 * ch) * (boss ? 2 : 1), dust: (20 + 10 * ch) * (boss ? 2 : 1) };
}
/** За каждую впервые полученную звезду сверх первой */
export const EXTRA_STAR_REWARD: Reward = { diamonds: 5 };
/** Глава пройдена / собрано 15 звёзд */
export const chapterReward = (ch: number, tier: 0 | 1): Reward =>
  tier === 0 ? { diamonds: 60 + 20 * ch, dust: 150, packs: 1 } : { diamonds: 150 + 30 * ch, scroll: 1, scrollRank: Math.min(4, 1 + Math.floor(ch / 3)), packs: 1 };

export interface StageView {
  stage: number;
  boss: boolean;
  stars: number;
  unlocked: boolean;
  /** Герои противника (первый — босс на последнем этапе) */
  enemy: { cardId: string; level: number }[];
  /** Ориентир по силе противника и вашего отряда считает интерфейс */
  power: number;
}
export interface ChapterView {
  id: number;
  series: string;
  unlocked: boolean;
  stars: number;
  maxStars: number;
  cleared: boolean;
  claimed: [boolean, boolean];
  stages: StageView[];
}

export const STAR_TEXT = ["Победа", `Победа не позже ${FAST_ROUNDS}-го раунда`, "Победа без потерь"];
