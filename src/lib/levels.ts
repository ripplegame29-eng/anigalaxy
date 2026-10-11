/**
 * Уровни и «эры» профиля — тонкая обёртка над кривой из конфига прогрессии.
 *
 * Единственный источник истины — `progression.config` (§3/§5 PROMPT):
 * кривая `xpToNext(L) = base × L^exponent` (50 × L^1.2) и список эр.
 * Старая локальная шкала (28 XP за 2-й уровень) удалена, чтобы карточка
 * уровня, награды движка и миграция считали одно и то же.
 */

import { eraFor, levelProgress } from "./progression/curve";
import { PROGRESSION_CONFIG } from "./progression/progression.config";

export interface Era {
  /** С какого уровня действует */
  from: number;
  name: string;
}

/** Эры профиля (конфиг: «с какого уровня» + название) */
export const ERAS: Era[] = PROGRESSION_CONFIG.eras.map((era) => ({ from: era.from, name: era.name }));

export interface LevelInfo {
  /** Текущий уровень, минимум 1 */
  level: number;
  /** Сколько XP набрано внутри текущего уровня */
  into: number;
  /** Сколько XP нужно на этом уровне до следующего */
  need: number;
  /** Прогресс уровня в процентах 0–100 */
  percent: number;
  /** Сколько XP осталось до следующего уровня */
  left: number;
  /** Название «эры» для текущего уровня */
  era: string;
  /** Общий порог текущего уровня */
  start: number;
}

export function levelInfo(xp: number): LevelInfo {
  const info = levelProgress(xp);
  return {
    level: info.level,
    into: info.into,
    need: info.need,
    percent: info.percent,
    left: info.left,
    era: info.era,
    start: info.start,
  };
}

/** Эра для уровня (конфиг) */
export function eraName(level: number): string {
  return eraFor(level).name;
}
