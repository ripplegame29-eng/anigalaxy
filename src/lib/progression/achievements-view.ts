/**
 * Модель представления достижений для UI (§12.2).
 *
 * Чистые функции поверх конфига и документа: ступени семейств (I..X),
 * состояние locked/progress/unlocked, режим «???» для неполученных
 * секретов, ранг по трофейным очкам и сегментный прогресс до следующего
 * ранга, подбор «самое редкое» — по редкости/ступени, без выдуманных
 * процентов (в режиме local доли других пользователей неизвестны).
 */

import { PROGRESSION_CONFIG, type Config } from "./progression.config";
import { rarityWeight } from "./visual";
import type { AchievementDef, ProgressDoc } from "./types";

export type AchievementStatus = "locked" | "progress" | "unlocked";

/** Подписи семейств (в порядке появления в конфиге — порядок фильтров) */
export const FAMILY_LABEL: Record<string, string> = {
  start: "Старт",
  episodes: "Серии просмотра",
  titles: "Завершённые тайтлы",
  days: "Дни на сайте",
  streak: "Серии подряд",
  collection: "Коллекции",
  minutes: "Минуты у плеера",
  comments: "Комментарии",
  levels: "Уровни",
  ratings: "Оценки",
  night: "Ночные серии",
  genres: "Жанры",
  social: "Социальные",
  quests: "Квесты",
  tags: "Теги",
  secret: "Тайные знаки",
};

export interface AchievementItem {
  def: AchievementDef;
  family: string;
  familyLabel: string;
  /** Ступень внутри семейства: позиция записи в конфиге (1..N) */
  tier: number;
  status: AchievementStatus;
  /** Прогресс по метрике (≥ порога у полученных) */
  progress: number;
  percent: number;
  unlockedAt: number;
  /** Неполученный секрет показывается как «???» */
  disguised: boolean;
}

type Cfg = Config;

/** Семейства в порядке следования в конфиге (без дублей) */
export function familyIds(cfg: Cfg = PROGRESSION_CONFIG): string[] {
  const seen: string[] = [];
  for (const def of cfg.achievements) {
    if (!seen.includes(def.family)) seen.push(def.family);
  }
  return seen;
}

/** Ступень записи внутри своего семейства (1-based) */
export function tierOf(cfg: Cfg, def: AchievementDef): number {
  let tier = 0;
  for (const item of cfg.achievements) {
    if (item.family !== def.family) continue;
    tier += 1;
    if (item.id === def.id) return tier;
  }
  return 1;
}

/** Все достижения → модели UI: документ даёт состояние, метрики — прогресс */
export function buildAchievements(
  doc: ProgressDoc,
  metrics: Record<string, number>,
  cfg: Cfg = PROGRESSION_CONFIG,
): AchievementItem[] {
  return cfg.achievements.map((def) => {
    const state = doc.achievements[def.id];
    const unlockedAt = state?.unlockedAt ?? 0;
    const value = metrics[def.condition.metric] ?? 0;
    const progress = Math.min(value, def.condition.threshold);
    const status: AchievementStatus = unlockedAt
      ? "unlocked"
      : progress > 0
        ? "progress"
        : "locked";
    return {
      def,
      family: def.family,
      familyLabel: FAMILY_LABEL[def.family] ?? def.family,
      tier: tierOf(cfg, def),
      status,
      progress: status === "unlocked" ? def.condition.threshold : progress,
      percent:
        def.condition.threshold > 0
          ? Math.min(100, Math.round((progress / def.condition.threshold) * 100))
          : 100,
      unlockedAt,
      disguised: Boolean(def.hidden) && status !== "unlocked",
    };
  });
}

/** Фильтры-чипы: семейства, представленные в списке, в порядке конфига */
export function familyChips(
  items: AchievementItem[],
  includeSecret = false,
): { id: string; label: string; count: number }[] {
  const out: { id: string; label: string; count: number }[] = [];
  for (const item of items) {
    if (item.family === "secret" && !includeSecret) continue;
    const found = out.find((c) => c.id === item.family);
    if (found) found.count += 1;
    else out.push({ id: item.family, label: item.familyLabel, count: 1 });
  }
  return out;
}

/* --------------------------------- Ранги --------------------------------- */

export interface RankInfo {
  index: number;
  name: string;
  from: number;
  next: { name: string; from: number } | null;
}

/** Ранг по трофейным очкам (последний порог ≤ trophy) */
export function rankAt(trophy: number, cfg: Cfg = PROGRESSION_CONFIG): RankInfo {
  const ranks = cfg.ranks;
  let index = 0;
  for (let i = 0; i < ranks.length; i += 1) {
    if (trophy >= ranks[i].from) index = i;
    else break;
  }
  const rank = ranks[index];
  const next = index + 1 < ranks.length ? ranks[index + 1] : null;
  return {
    index,
    name: rank.name,
    from: rank.from,
    next: next ? { name: next.name, from: next.from } : null,
  };
}

/** Прогресс внутри сегмента до следующего ранга, % (100 — последний ранг) */
export function rankSegment(trophy: number, cfg: Cfg = PROGRESSION_CONFIG): number {
  const info = rankAt(trophy, cfg);
  if (!info.next) return 100;
  const span = info.next.from - info.from;
  if (span <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round(((trophy - info.from) / span) * 100)));
}

/** Сколько очков осталось до следующего ранга (0 — вершина) */
export function rankToNext(trophy: number, cfg: Cfg = PROGRESSION_CONFIG): number {
  const info = rankAt(trophy, cfg);
  return info.next ? Math.max(0, info.next.from - trophy) : 0;
}

/** 10 сегментов ранга: % заполнения каждого (сегментный прогресс §12.2) */
export function segmentFills(percent: number): number[] {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const out: number[] = [];
  for (let i = 0; i < 10; i += 1) {
    const from = i * 10;
    out.push(Math.max(0, Math.min(100, ((p - from) / 10) * 100)));
  }
  return out;
}

/** Дата получения достижения (русская локаль) */
export function unlockedLabel(at: number): string {
  if (!at) return "";
  return new Date(at).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/* ------------------------------ Самое редкое ----------------------------- */

/**
 * Самые редкие полученные достижения: сначала редкость, потом трофейные
 * очки, потом имя — без «процентов популярности» (§12.2).
 */
export function rarestUnlocked(
  items: AchievementItem[],
  limit = 4,
): AchievementItem[] {
  return items
    .filter((item) => item.status === "unlocked")
    .slice()
    .sort((a, b) => {
      const byRarity = rarityWeight(b.def.rarity) - rarityWeight(a.def.rarity);
      if (byRarity !== 0) return byRarity;
      const byTrophy = b.def.trophy - a.def.trophy;
      if (byTrophy !== 0) return byTrophy;
      return a.def.name.localeCompare(b.def.name, "ru");
    })
    .slice(0, limit);
}
