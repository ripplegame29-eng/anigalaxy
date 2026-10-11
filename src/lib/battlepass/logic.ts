/**
 * Чистая логика боевого пропуска: кривая уровней, состояния, описание наград.
 *
 * Ни React, ни DOM, ни хранилища — тем же кодом пользуются движок
 * (выдача наград), UI (состояния клеток) и юнит-тесты.
 */

import { FRAMES, type Rarity as CosmeticsRarity } from "../cosmetics";
import { PROGRESSION_CONFIG } from "../progression/progression.config";
import type { ProgressionConfig, TagDef } from "../progression/types";
import {
  BATTLEPASS,
  type BattlePassConfig,
  type BattlepassLine,
  type BpReward,
} from "./config";

export { BATTLEPASS };
export type { BattlepassLine, BpReward };

/* ------------------------------- Кривая --------------------------------- */

/** starts[L−1] = XP, чтобы достичь уровня L (уровень 1 доступен с 0 XP) */
const startsCache = new WeakMap<BattlePassConfig, number[]>();

function startsFor(cfg: BattlePassConfig): number[] {
  const cached = startsCache.get(cfg);
  if (cached) return cached;
  const starts: number[] = [0];
  for (let level = 1; level < cfg.maxLevel; level += 1) {
    starts.push(starts[starts.length - 1] + bpCost(level, cfg));
  }
  startsCache.set(cfg, starts);
  return starts;
}

/** Сколько XP нужно пройти уровень L (последний уровень — 0) */
export function bpCost(level: number, cfg: BattlePassConfig = BATTLEPASS): number {
  if (level < 1 || level >= cfg.maxLevel) return 0;
  return cfg.cost.base + cfg.cost.step * (level - 1);
}

/** Суммарный XP, чтобы достичь уровня (уровень 1 → 0) */
export function bpTotalFor(level: number, cfg: BattlePassConfig = BATTLEPASS): number {
  if (level <= 1) return 0;
  const starts = startsFor(cfg);
  return starts[Math.min(level, cfg.maxLevel) - 1];
}

/** Уровень пропуска для набранного XP (1 … maxLevel) */
export function bpLevelFromXp(xp: number, cfg: BattlePassConfig = BATTLEPASS): number {
  const total = Math.max(0, Math.floor(xp));
  const starts = startsFor(cfg);
  let level = 1;
  while (level < starts.length && total >= starts[level]) level += 1;
  return Math.min(level, cfg.maxLevel);
}

export interface BpProgress {
  level: number;
  /** XP внутри текущего уровня */
  into: number;
  /** Сколько нужно на этом уровне */
  need: number;
  percent: number;
  left: number;
  /** Сколько XP нужно всего, чтобы достичь 100-го уровня */
  totalMax: number;
  /** Сколько XP уже набрано к цели (с учётом текущего уровня) */
  totalDone: number;
}

/** Подробности прогресса для шкалы в герое */
export function bpProgress(xp: number, cfg: BattlePassConfig = BATTLEPASS): BpProgress {
  const total = Math.max(0, Math.floor(xp));
  const level = bpLevelFromXp(total, cfg);
  const start = bpTotalFor(level, cfg);
  const need = bpCost(level, cfg);
  const into = need > 0 ? total - start : 0;
  const totalMax = bpTotalFor(cfg.maxLevel, cfg);
  return {
    level,
    into,
    need,
    percent: need > 0 ? Math.min(100, Math.round((into / need) * 100)) : 100,
    left: Math.max(0, need - into),
    totalMax,
    totalDone: Math.min(total, totalMax),
  };
}

/** Ключ идемпотентности пакета наград: `<season>:<line>:<level>` */
export function bpKey(
  seasonId: string,
  line: BattlepassLine,
  level: number,
): string {
  return `${seasonId}:${line}:${level}`;
}

/* ---------------------------- Награды сезона ---------------------------- */

/** Определение уровня (пакеты обеих линий) */
export function bpLevelDef(
  level: number,
  cfg: BattlePassConfig = BATTLEPASS,
): { free?: BpReward[]; premium?: BpReward[] } | undefined {
  return cfg.levels.find((def) => def.level === level);
}

/** Награды конкретной линии; `null` — на этом уровне линии нет */
export function bpRewards(
  level: number,
  line: BattlepassLine,
  cfg: BattlePassConfig = BATTLEPASS,
): BpReward[] | null {
  const rewards = bpLevelDef(level, cfg)?.[line];
  return rewards && rewards.length > 0 ? rewards : null;
}

/** Все уровни сезона по порядку */
export function bpLevelNumbers(cfg: BattlePassConfig = BATTLEPASS): number[] {
  return Array.from({ length: cfg.maxLevel }, (_, index) => index + 1);
}

/* ------------------------------ Описание -------------------------------- */

export type BpRarity = CosmeticsRarity;

export type RewardView =
  | { kind: "ac"; amount: number; label: string }
  | { kind: "bpXp"; amount: number; label: string }
  | {
      kind: "tag";
      itemId: string;
      label: string;
      rarity: BpRarity;
      tag: TagDef;
    }
  | {
      kind: "frame";
      itemId: string;
      label: string;
      rarity: BpRarity;
      img: string;
      /** Кандидаты framePick — для подсказки «или аналог» */
      pick?: string[];
    };

/** Редкость тега → редкость косметики (для единой раскраски клеток) */
function tagRarity(rarity: string): BpRarity {
  switch (rarity) {
    case "EPIC":
      return "epic";
    case "RARE":
      return "rare";
    case "LEGENDARY":
    case "MYTHIC":
    case "SECRET":
      return "legendary";
    default:
      return "common";
  }
}

function frameOf(itemId: string) {
  return FRAMES.find((frame) => frame.id === itemId);
}

/** Рамка существует в каталоге проекта (валидация выдачи) */
export function bpFrameExists(itemId: string): boolean {
  return frameOf(itemId) !== undefined;
}

/** Человекочитаемое описание предмета (название — как в каталоге) */
export function describeItem(
  kind: "tag" | "frame",
  itemId: string,
  cfg: ProgressionConfig = PROGRESSION_CONFIG,
): RewardView | null {
  if (kind === "tag") {
    const tag = cfg.tags.find((item) => item.id === itemId);
    if (!tag) return null;
    return {
      kind: "tag",
      itemId,
      label: `Тег «${tag.name}»`,
      rarity: tagRarity(tag.rarity),
      tag,
    };
  }
  const frame = frameOf(itemId);
  if (!frame) return null;
  return {
    kind: "frame",
    itemId,
    label: `Рамка «${frame.name}»`,
    rarity: frame.rarity,
    img: frame.img ?? "",
  };
}

/** Описание награды конфига для клетки дорожки/диалога получения */
export function describeReward(
  reward: BpReward,
  cfg: ProgressionConfig = PROGRESSION_CONFIG,
): RewardView {
  switch (reward.kind) {
    case "ac":
      return { kind: "ac", amount: reward.amount, label: `${reward.amount} AC` };
    case "bpXp":
      return { kind: "bpXp", amount: reward.amount, label: `+${reward.amount} XP` };
    case "tag": {
      const view = describeItem("tag", reward.itemId, cfg);
      return view ?? { kind: "ac", amount: reward.dupeAc, label: `${reward.dupeAc} AC` };
    }
    case "frame": {
      const frame = frameOf(reward.itemId);
      if (!frame) {
        return { kind: "ac", amount: reward.dupeAc, label: `${reward.dupeAc} AC` };
      }
      const noun = reward.as === "mask" ? "Маска" : "Рамка";
      return {
        kind: "frame",
        itemId: reward.itemId,
        label: `${noun} «${frame.name}»`,
        rarity: frame.rarity,
        img: frame.img ?? "",
      };
    }
    case "framePick": {
      const frame = frameOf(reward.candidates[0] ?? "");
      return {
        kind: "frame",
        itemId: frame?.id ?? "",
        label: "Лучшая рамка магазина",
        rarity: frame?.rarity ?? "legendary",
        img: frame?.img ?? "",
        pick: reward.candidates,
      };
    }
  }
}

/* ------------------------------ Владение -------------------------------- */

export interface BpOwnedCtx {
  /** Уровень профиля (не пропуска) — рамки с `unlock.level` */
  siteLevel: number;
  /** Полученные достижения — рамки с `unlock.achievement` */
  achievements: string[];
  /** Купленная косметика профиля (`profile.purchased`) */
  purchased: string[];
}

/**
 * Принадлежит ли рамка пользователю (для компенсации за дубль).
 * Условия «пока премиум» и «доступно всем» владением не считаются:
 * постоянным предметом делает его покупка, уровень или достижение.
 */
export function bpFrameOwned(frameId: string, ctx: BpOwnedCtx): boolean {
  const frame = frameOf(frameId);
  if (!frame) return false;
  if (ctx.purchased.includes(frameId)) return true;
  const unlock = frame.unlock;
  if (unlock.price) return false;
  if (unlock.premium) return false;
  if (unlock.achievement) return ctx.achievements.includes(unlock.achievement);
  if (unlock.level) return ctx.siteLevel >= unlock.level;
  return true;
}

/** Первая невыданная рамка из списка кандидатов (null — все уже есть) */
export function bpPickFrame(candidates: string[], ctx: BpOwnedCtx): string | null {
  for (const id of candidates) {
    if (!bpFrameOwned(id, ctx)) return id;
  }
  return null;
}

/* ------------------------------- Состояния ------------------------------ */

export type BpRewardStatus = "locked" | "claimable" | "claimed";
export type BpLevelStatus = "LOCKED" | "CURRENT" | "CLAIMABLE" | "REACHED" | "COMPLETED";

/** Минимум данных, нужный UI для состояний (без владения предметами) */
export interface BpStatusCtx {
  xp: number;
  premium: boolean;
  claimed: ReadonlySet<string>;
}

/** Состояние одной награды: можно ли забрать прямо сейчас */
export function bpRewardStatus(
  level: number,
  line: BattlepassLine,
  ctx: BpStatusCtx,
  cfg: BattlePassConfig = BATTLEPASS,
): BpRewardStatus | null {
  const rewards = bpRewards(level, line, cfg);
  if (!rewards) return null;
  if (ctx.claimed.has(bpKey(cfg.seasonId, line, level))) return "claimed";
  if (level > bpLevelFromXp(ctx.xp, cfg)) return "locked";
  if (line === "premium" && !ctx.premium) return "locked";
  return "claimable";
}

/**
 * Состояние уровня (§4 ТЗ). Приоритет: LOCKED → CLAIMABLE → REACHED →
 * CURRENT («вы здесь» даже если всё забрано) → COMPLETED (позади текущего
 * и все доступные награды получены).
 */
export function bpLevelStatus(
  level: number,
  ctx: BpStatusCtx,
  cfg: BattlePassConfig = BATTLEPASS,
): BpLevelStatus {
  const current = bpLevelFromXp(ctx.xp, cfg);
  if (level > current) return "LOCKED";

  let hasUnavailable = false;
  for (const line of ["free", "premium"] as const) {
    const status = bpRewardStatus(level, line, ctx, cfg);
    if (status === "claimable") return "CLAIMABLE";
    if (status === "locked") hasUnavailable = true;
  }
  if (hasUnavailable) return "REACHED";
  if (level === current) return "CURRENT";
  return "COMPLETED";
}

/** Все пакеты, которые можно забрать прямо сейчас */
export function bpClaimables(
  ctx: BpStatusCtx,
  cfg: BattlePassConfig = BATTLEPASS,
): Array<{ level: number; line: BattlepassLine }> {
  const out: Array<{ level: number; line: BattlepassLine }> = [];
  for (const def of cfg.levels) {
    for (const line of ["free", "premium"] as const) {
      if (bpRewardStatus(def.level, line, ctx, cfg) === "claimable") {
        out.push({ level: def.level, line });
      }
    }
  }
  return out;
}

/* -------------------------------- Итоги --------------------------------- */

export interface BpLineTotals {
  ac: number;
  bpXp: number;
  items: number;
  levels: number;
}

/** Суммы линии (для карточек «что даёт линия» и балансового теста) */
export function bpLineTotals(
  line: BattlepassLine,
  cfg: BattlePassConfig = BATTLEPASS,
): BpLineTotals {
  const totals: BpLineTotals = { ac: 0, bpXp: 0, items: 0, levels: 0 };
  for (const def of cfg.levels) {
    const rewards = def[line];
    if (!rewards || rewards.length === 0) continue;
    totals.levels += 1;
    for (const reward of rewards) {
      if (reward.kind === "ac") totals.ac += reward.amount;
      else if (reward.kind === "bpXp") totals.bpXp += reward.amount;
      else totals.items += 1;
    }
  }
  return totals;
}
