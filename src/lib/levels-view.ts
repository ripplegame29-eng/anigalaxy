/**
 * Модель представления страницы «Уровни» — чистые функции поверх конфига
 * и документа прогрессии. UI ничего не считает сам (§3/§5 конфига).
 *
 * Зеркалит визуал animeon.cc/levels, но числа — настоящие:
 *   - кривая уровней и эры из progression.config
 *   - награда AC за уровень из economy (levelAcReward)
 *   - источники XP из rules, с их реальными дневными лимитами
 */

import { levelAcReward, totalXpFor, xpToNext } from "./progression/curve";
import { PROGRESSION_CONFIG, type Config } from "./progression/progression.config";
import type { ProgressDoc, Rarity, XpRule, XpTomeDef } from "./progression/types";
import type { LevelInfo } from "./levels";

type Cfg = Config;

/** XP за одну досмотренную серию — база для пересчёта «≈ N серий просмотра» */
const XP_PER_EPISODE = 10;

/** Вехи дорожки наград: уровни с крупными шагами (как 10/20/30/… у референса) */
export const MILESTONES = [10, 20, 30, 40, 50, 60, 75, 100];

/** Быстрые фильтры дорожки: «Сейчас» показывает вехи вокруг текущего уровня */
export const TRACK_FILTERS = [
  { id: "now", label: "Сейчас" },
  ...MILESTONES.map((level) => ({ id: String(level), label: String(level) })),
] as const;

/* ------------------------------- Награды -------------------------------- */

export interface LevelRewardItem {
  level: number;
  /** AC за этот уровень (economy: base + perLevel + бонус за каждый 10-й) */
  ac: number;
  /** Тег, который открывается на этом уровне (levelTags) */
  tagId?: string;
  era: string;
}

export interface LevelRewardTrack {
  items: LevelRewardItem[];
  /** Сколько вех пройдено */
  claimed: number;
  /** Всего вех */
  total: number;
  /** Сумма AC, уже полученная за пройденные вехи */
  earnedAc: number;
  /** Сумма AC по всем вехам */
  totalAc: number;
  /** Уровень, ближайшая следующая веха (или последняя, если пройдены все) */
  nextLevel: number;
}

/** Дорожка наград по конфигу и текущему уровню */
export function levelRewardTrack(
  info: LevelInfo,
  cfg: Cfg = PROGRESSION_CONFIG,
): LevelRewardTrack {
  const items: LevelRewardItem[] = MILESTONES.map((level) => ({
    level,
    ac: levelAcReward(level, cfg),
    tagId: cfg.levelTags.find((t) => t.level === level)?.tagId,
    era: eraOfLevel(level, cfg),
  }));

  const done = items.filter((item) => info.level >= item.level);
  const next = items.find((item) => info.level < item.level);

  return {
    items,
    claimed: done.length,
    total: items.length,
    earnedAc: done.reduce((sum, item) => sum + item.ac, 0),
    totalAc: items.reduce((sum, item) => sum + item.ac, 0),
    nextLevel: next ? next.level : items[items.length - 1].level,
  };
}

/** Подбор вех под фильтр: «now» — окно вокруг уровня, иначе одна веха */
export function filterTrack(
  track: LevelRewardTrack,
  filterId: string,
  info: LevelInfo,
): LevelRewardItem[] {
  if (filterId !== "now") {
    const found = track.items.find((item) => String(item.level) === filterId);
    return found ? [found] : [];
  }

  // Окно вокруг уровня: от самой нижней вехи до следующей за текущим.
  // На низких уровнях видна одна веха — это ожидаемо, пустая сетка не нужна.
  const upcoming = track.items.filter((item) => item.level >= info.level);
  const upcomingIds = new Set(upcoming.map((i) => i.level));
  const recent = track.items.filter(
    (item) => item.level < info.level && !upcomingIds.has(item.level) && item.level > info.level - 60,
  );
  return [...recent, ...upcoming];
}

/* ------------------------------ Путь к пределу --------------------------- */

export interface PathStats {
  /** Сколько XP до 100 уровня (абсолютное число) */
  toPeak: number;
  /** Доля пройденного пути 0–100 % */
  percent: number;
  /** AC, которые капают за каждый следующий уровень */
  acPerLevel: number;
  /** Насколько выгоден текущий уровень: AC за уровень + база */
  nextAc: number;
}

/** Цифры «пути к пределу» для трёх плиток под XP-баром */
export function pathStats(
  info: LevelInfo,
  cfg: Cfg = PROGRESSION_CONFIG,
): PathStats {
  const peak = totalXpFor(cfg.levels.maxLevel, cfg);
  const next = Math.min(info.level + 1, cfg.levels.maxLevel);
  return {
    toPeak: Math.max(0, peak - (info.start + info.into)),
    percent: peak > 0 ? Math.round(((info.start + info.into) / peak) * 10000) / 100 : 0,
    acPerLevel: levelAcReward(next, cfg),
    nextAc: xpToNext(next, cfg),
  };
}

/* ----------------------------- Источники XP ------------------------------ */

export interface XpSourceItem {
  id: string;
  label: string;
  xp: number;
  /** Суточный лимит правила (0 = без лимита) */
  perDay: number;
  /** Бейдж «раз в день» */
  oncePerDay: boolean;
  /** Сколько серий просмотра равносильно этому XP */
  episodes: number;
  /** Сколько раз уже выполнено сегодня */
  doneToday: number;
  /** Прогресс дневного лимита 0–100 */
  percent: number;
  /** Потолок достигнут */
  capped: boolean;
}

/** Человеческие названия источников XP (порядок — порядок блока на странице) */
const SOURCE_LABEL: Record<string, string> = {
  SESSION_START: "Первый вход",
  TITLE_COMPLETED: "Тайтл полностью",
  TITLE_WATCHED: "Первый просмотр",
  EP_COMPLETE: "Досмотренная серия",
  COMMENT_FIRST: "Первый комментарий",
  COMMENT_NEXT: "Комментарий",
  COMMENT_REPLY: "Ответ на комментарий",
  LIST_FAVORITE: "Любимое в список",
  LIST_WATCHED: "Отметка «смотрю»",
  LIST_PLANNED: "Запланировано",
  TITLE_RATED: "Оценка тайтла",
  PROFILE_COMPLETE: "Профиль заполнен",
};

const SOURCE_ORDER = [
  "SESSION_START",
  "TITLE_COMPLETED",
  "EP_COMPLETE",
  "TITLE_WATCHED",
  "COMMENT_FIRST",
  "LIST_FAVORITE",
  "LIST_WATCHED",
  "TITLE_RATED",
];

/**
 * Источники XP для блока «Где брать XP».
 *
 * У референса здесь том с оплатой AC — такого продукта в проекте нет,
 * поэтому блок показывает реальные правила движка: сколько XP даёт
 * действие, сколько раз в сутки и сколько уже набрано сегодня.
 */
export function xpSources(
  doc: ProgressDoc,
  cfg: Cfg = PROGRESSION_CONFIG,
): XpSourceItem[] {
  return SOURCE_ORDER.flatMap((id) => {
    // rules типизирован поэлементно, поэтому для общих полей приводим к XpRule
    const rule = cfg.rules[id as keyof typeof cfg.rules] as XpRule | undefined;
    if (!rule || rule.enabled === false) return [];

    const bucket = rule.bucket ?? id;
    const doneToday = doc.daily.counts[bucket] ?? 0;
    const perDay = rule.perDay ?? 0;
    const uncapped = perDay <= 0;

    return [
      {
        id,
        label: SOURCE_LABEL[id] ?? id,
        xp: rule.xp,
        perDay,
        oncePerDay: perDay === 1,
        episodes: Math.ceil(rule.xp / XP_PER_EPISODE),
        doneToday,
        percent: uncapped ? 0 : Math.min(100, Math.round((doneToday / perDay) * 100)),
        capped: !uncapped && doneToday >= perDay,
      },
    ];
  });
}

/** Сколько ACTIVITY-XP ещё можно получить сегодня (soft-cap) */
export function xpHeadroom(doc: ProgressDoc, cfg: Cfg = PROGRESSION_CONFIG): number {
  return Math.max(0, cfg.softCap.hardCap - doc.daily.xpActivity);
}

/* --------------------------------- Тома ---------------------------------- */

export interface TomeItem {
  id: string;
  name: string;
  xp: number;
  price: number;
  rarity: Rarity;
  accent: string;
  /** Сколько серий просмотра равносильно */
  episodes: number;
  /** Порог уровня (0 = доступен сразу) */
  fromLevel: number;
  /** Открыт ли по уровню */
  unlocked: boolean;
  /** Сколько раз куплен сегодня */
  boughtToday: number;
  /** Суточный лимит этого тома */
  perDay: number;
  /** Уже выбран сегодня — кнопка disabled */
  usedToday: boolean;
  /** Хватает ли AC на цену */
  affordable: boolean;
  /** Сколько AC не хватает */
  shortBy: number;
}

/**
 * Тома опыта для блока «Тома опыта».
 *
 * Подобран по цене и эффекту, состояние — из документа: что уже куплено
 * сегодня, хватает ли баланса и открыт ли том по уровню.
 */
export function tomes(
  doc: ProgressDoc,
  info: LevelInfo,
  cfg: Cfg = PROGRESSION_CONFIG,
): TomeItem[] {
  const balance = doc.progress.acBalance;
  // tomes выводится в литеральный тип — приводим к XpTomeDef ради общих полей
  const defs = cfg.tomes as XpTomeDef[];
  return defs
    .filter((tome) => tome.enabled !== false)
    .map((tome) => {
      const boughtToday = doc.daily.counts[`TOME:${tome.id}`] ?? 0;
      const perDay = tome.perDay ?? 1;
      return {
        id: tome.id,
        name: tome.name,
        xp: tome.xp,
        price: tome.price,
        rarity: tome.rarity,
        accent: tome.accent,
        episodes: Math.ceil(tome.xp / XP_PER_EPISODE),
        fromLevel: tome.fromLevel ?? 0,
        unlocked: info.level >= (tome.fromLevel ?? 0),
        boughtToday,
        perDay,
        usedToday: boughtToday >= perDay,
        affordable: balance >= tome.price,
        shortBy: Math.max(0, tome.price - balance),
      };
    });
}

/** Сколько томов куплено сегодня и сколько их всего (бейдж «Сегодня N/M») */
export function tomeProgress(
  doc: ProgressDoc,
  cfg: Cfg = PROGRESSION_CONFIG,
): { bought: number; total: number } {
  const list = (cfg.tomes as XpTomeDef[]).filter((t) => t.enabled !== false);
  const bought = list.filter(
    (t) => (doc.daily.counts[`TOME:${t.id}`] ?? 0) >= (t.perDay ?? 1),
  ).length;
  return { bought, total: list.length };
}

/* --------------------------------- Эры ----------------------------------- */

function eraOfLevel(level: number, cfg: Cfg): string {
  let name = cfg.eras[0].name;
  for (const era of cfg.eras) if (level >= era.from) name = era.name;
  return name;
}