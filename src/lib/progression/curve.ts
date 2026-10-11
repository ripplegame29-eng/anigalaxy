/**
 * Кривая уровней и эры — всё из конфига (§3, §5).
 *
 *   xpToNext(L)   = round(base × L^exponent)
 *   levelFromXp  = бинарный поиск по накопленным порогам
 *
 * Пороги мемоизируются по объекту конфига: тесты и симулятор могут передавать
 * свои конфиги, а обычный рендер получает кэш.
 */

import { PROGRESSION_CONFIG } from "./progression.config";
import type { EraDef, ProgressionConfig } from "./types";

const startsCache = new Map<ProgressionConfig, number[]>();

/** starts[L-1] = суммарный XP, чтобы быть уровнем L (уровень 1 = 0) */
function startsFor(cfg: ProgressionConfig): number[] {
  const cached = startsCache.get(cfg);
  if (cached) return cached;
  const starts: number[] = [0];
  for (let level = 1; level < cfg.levels.maxLevel; level += 1) {
    const prev = starts[level - 1];
    starts.push(prev + xpToNext(level, cfg));
  }
  startsCache.set(cfg, starts);
  return starts;
}

/** Сколько XP нужно, чтобы пройти уровень L (L = текущий уровень) */
export function xpToNext(level: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): number {
  if (level < 1 || level >= cfg.levels.maxLevel) return 0;
  return Math.round(cfg.levels.base * Math.pow(level, cfg.levels.exponent));
}

/** Суммарный XP порог уровня (level 1 → 0) */
export function totalXpFor(level: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): number {
  if (level <= 1) return 0;
  const starts = startsFor(cfg);
  const idx = Math.min(level, cfg.levels.maxLevel) - 1;
  return starts[idx];
}

/** Уровень для набранного XP (1 … maxLevel) */
export function levelFromXp(xp: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): number {
  const total = Math.max(0, Math.floor(xp));
  const starts = startsFor(cfg);
  let level = 1;
  while (level < starts.length && total >= starts[level]) level += 1;
  return Math.min(level, cfg.levels.maxLevel);
}

export interface LevelProgress {
  level: number;
  /** XP внутри текущего уровня */
  into: number;
  /** Сколько нужно на этом уровне */
  need: number;
  percent: number;
  /** Осталось до следующего уровня */
  left: number;
  start: number;
  era: string;
}

/** Подробности уровня для карточки и XP-бара */
export function levelProgress(xp: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): LevelProgress {
  const total = Math.max(0, Math.floor(xp));
  const level = levelFromXp(total, cfg);
  const start = totalXpFor(level, cfg);
  const need = xpToNext(level, cfg);
  const into = total - start;
  const percent = need > 0 ? Math.min(100, Math.round((into / need) * 100)) : 100;
  return {
    level,
    into,
    need,
    percent,
    left: Math.max(0, need - into),
    start,
    era: eraFor(level, cfg).name,
  };
}

/** Эра уровня (последняя, чей порог не выше уровня) */
export function eraFor(level: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): EraDef {
  let era = cfg.eras[0];
  for (const item of cfg.eras) {
    if (level >= item.from) era = item;
  }
  return era;
}

/** AC за каждый пройденный уровень (§6): база + за уровень + бонус каждый 10-й */
export function levelAcReward(level: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): number {
  const e = cfg.economy;
  let ac = e.levelAcBase + e.levelAcPerLevel * level;
  if (level % 10 === 0) ac += e.levelAcEvery10 * (level / 10);
  return ac;
}
