/**
 * Награды карточной игры на уровнях основного боевого пропуска.
 *
 * Сезонный пасс гачи (30 уровней) переехал в боевой пропуск сайта: уровень L
 * пасса гачи → уровень `3·L + 1` пропуска сайта (4, 7, 10 … 91), финал (30) → 100.
 * Эти уровни не входят в «пустые» (2, 3, 11, 42, 99), так что у каждой награды гачи
 * есть клетка с наградой сайта, к которой она прикрепляется.
 */

import type { Reward } from "../cards/progress";
import { PASS, passReward, type PassTrack } from "../cards/season";

/** Уровень боевого пропуска для уровня L пасса гачи */
export const bpLevelOfGacha = (l: number): number => (l >= PASS.levels ? 100 : l * 3 + 1);

const BY_LEVEL = new Map<number, Record<PassTrack, Reward>>();
for (let l = 1; l <= PASS.levels; l += 1) {
  BY_LEVEL.set(bpLevelOfGacha(l), { free: passReward(l, "free"), premium: passReward(l, "premium") });
}

/** Награда гачи на уровне боевого пропуска (или `null`) */
export function gachaRewardAt(level: number, line: PassTrack): Reward | null {
  return BY_LEVEL.get(level)?.[line] ?? null;
}

/** Уровни боевого пропуска, на которых лежат награды гачи */
export const GACHA_BP_LEVELS: number[] = [...BY_LEVEL.keys()].sort((a, b) => a - b);

/** Ключ забранной награды сайта, после которого сервер выдаёт часть гачи */
export const gachaClaimKey = (seasonId: string, line: PassTrack, level: number): string => `${seasonId}:${line}:${level}`;
