/**
 * Миграция старых ключей в документ прогрессии (§16, этап 3).
 *
 * Чистый модуль: читает через переданную функцию `read`, ничего не пишет
 * и ничего не знает про DOM — поэтому полностью покрывается юнит-тестами.
 *
 * Переносим (без потерь):
 *   profile.xp → xpTotal (+ уровень пересчитывается по новой кривой §5);
 *   profile.coins → acBalance (курс 1:1 — это и есть AC);
 *   profile.streak → streakCurrent/Best;
 *   profile.claimed → по карте legacyIds новых достижений (migrated, без
 *                     повторной награды); id без соответствия остаются в
 *                     profile.claimed — косметика продолжает открываться;
 *   history → счётчики «открыто»/«проведено у плеера» (досмотр задним
 *             числом не накручивается — iframe не хранит прогресс);
 *   последняя активность истории → lastActiveDate (секрет «Вернулся из
 *             бездны» срабатывает при настоящем возвращении).
 *
 * Косметика (purchased/frameId/titleId/backgroundId) и подписи не трогаются:
 * они продолжают жить в профиле.
 */

import { levelFromXp } from "./curve";
import { EMPTY_DOC, PROGRESS_SCHEMA } from "./doc";
import { PROGRESSION_CONFIG } from "./progression.config";
import { dayKeyOf } from "./time";
import type { ProgressDoc, ProgressionConfig } from "./types";

/* Ключи старых сторов — зеркалят `lib/*.ts` (строки зафиксированы :v1) */
export const LEGACY_KEYS = {
  profile: "animehub:profile:v1",
  history: "animehub:history:v1",
  account: "animehub:account:v1",
  favorites: "animehub:favorites:v1",
  collections: "animehub:collections:v1",
} as const;

export interface MigrateInput {
  /** Чтение ключа (в тестах — Map, в проде — localStorage) */
  read: (key: string) => string | null;
  now: number;
  tz: string;
}

function safeJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as T;
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Нужна ли миграция: флаг ещё не выставлен */
export function needsMigration(doc: ProgressDoc): boolean {
  return doc.schema < PROGRESS_SCHEMA || doc.meta.migrated !== true;
}

/** Построить документ из старых данных (или null, если мигрировать нечего) */
export function migrateLegacy(input: MigrateInput, cfg: ProgressionConfig = PROGRESSION_CONFIG): ProgressDoc | null {
  const profile = safeJson<Record<string, unknown>>(input.read(LEGACY_KEYS.profile));
  const history = safeJson<Record<string, unknown>>(input.read(LEGACY_KEYS.history));
  const account = safeJson<Record<string, unknown>>(input.read(LEGACY_KEYS.account));
  const favorites = safeJson<string[]>(input.read(LEGACY_KEYS.favorites));

  if (!profile && !history && !account && !favorites) return null;

  const { now, tz } = input;
  const doc = structuredClone(EMPTY_DOC) as ProgressDoc;
  doc.schema = PROGRESS_SCHEMA;

  /* --------------------------- XP и уровень --------------------------- */
  const xp = Math.max(0, Math.floor(num(profile?.xp)));
  doc.progress.xpTotal = xp;
  doc.progress.acBalance = Math.max(0, Math.floor(num(profile?.coins)));
  doc.progress.level = levelFromXp(xp, cfg);

  /* ------------------------------ Серия ------------------------------- */
  const streak = Math.max(0, Math.floor(num(profile?.streak)));
  doc.progress.streakCurrent = streak;
  doc.progress.streakBest = streak;

  /* --------------------------- Пользователь --------------------------- */
  const nickname = typeof account?.nickname === "string" ? account.nickname : "";
  doc.progress.userId = nickname || "local";
  doc.progress.tz = tz;
  doc.progress.createdAt = num(account?.createdAt) || now;

  /* --------------------- Последняя активность ------------------------- */
  const records = Array.isArray(history?.records)
    ? (history.records as Array<Record<string, unknown>>)
    : [];
  let lastAt = 0;
  const distinctEpisodes = new Set<string>();
  const distinctDays = new Set<string>();

  for (const rec of records) {
    const at = num(rec.at);
    if (at > lastAt) lastAt = at;
    if (rec.id !== null && rec.id !== undefined && rec.id !== "") {
      distinctEpisodes.add(`${String(rec.id)}:${num(rec.season)}:${num(rec.episode)}`);
    }
    if (at > 0) distinctDays.add(dayKeyOf(at, tz));
  }

  const todayKey = dayKeyOf(now, tz);
  // Если истории нет — считаем активность сегодняшней (первый визит);
  // если есть — ставим последний реальный день, чтобы разрыв ≥30 дней
  // обнаруживался по-настоящему.
  doc.progress.lastActiveDate = lastAt > 0 ? dayKeyOf(lastAt, tz) : todayKey;

  /* --------------------------- Счётчики ------------------------------- */
  doc.counters.SECONDS_WATCHED = Math.max(0, Math.floor(num(history?.seconds)));
  doc.counters.EPISODES_OPENED = distinctEpisodes.size;
  doc.counters.DISTINCT_DAYS = Math.max(distinctDays.size, streak);

  /* --------------------- Достижения прошлой эры ----------------------- */
  const claimed = Array.isArray(profile?.claimed)
    ? (profile.claimed as string[]).filter((v) => typeof v === "string")
    : [];

  for (const a of cfg.achievements) {
    if (!a.legacyIds || a.legacyIds.length === 0) continue;
    if (!a.legacyIds.some((id) => claimed.includes(id))) continue;

    doc.achievements[a.id] = {
      progress: a.condition.threshold,
      unlockedAt: now,
      migrated: true,
    };
    doc.progress.trophyPoints += a.trophy;
    if (a.reward.tagId && !doc.tags[a.reward.tagId]) {
      doc.tags[a.reward.tagId] = { acquiredAt: now, source: "migration" };
    }
  }

  /* --------------------- Теги за уровень (экип.) ----------------------- */
  for (const lt of cfg.levelTags) {
    if (lt.level <= doc.progress.level && !doc.tags[lt.tagId]) {
      doc.tags[lt.tagId] = { acquiredAt: now, source: "level" };
    }
  }
  if (doc.progress.level >= cfg.levelTags[0]?.level) {
    // первый доступный уровень-тег остаётся активным, если он есть
    const first = cfg.levelTags.find((lt) => lt.level <= doc.progress.level);
    doc.progress.equippedTagId = first ? first.tagId : null;
  }

  doc.meta.migrated = true;
  doc.meta.events = 0;
  doc.meta.lastEventAt = 0;
  doc.meta.configVersion = cfg.version;
  // Высокие отметки legacy-профиля: дальнейшие приросты старых addXp/addCoins
  // переносятся дельтой относительно них (а не заново при каждой загрузке).
  doc.meta.legacy = {
    xp: doc.progress.xpTotal,
    ac: doc.progress.acBalance,
    streak: doc.progress.streakCurrent,
  };

  return doc;
}

/** Отметить документ мигрированным (когда мигрировать нечего) */
export function markMigrated(doc: ProgressDoc): ProgressDoc {
  if (doc.meta.migrated === true) return doc;
  return { ...doc, meta: { ...doc.meta, migrated: true } };
}
