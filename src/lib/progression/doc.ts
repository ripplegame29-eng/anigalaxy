/**
 * Документ прогрессии: схема, пустое состояние, разбор.
 *
 * Модуль чистый (без React и DOM) — его же используют юнит-тесты и миграция.
 */

import { BATTLEPASS } from "../battlepass/config";
import { PROGRESSION_CONFIG } from "./progression.config";
import type { ProgressDoc } from "./types";

export const PROGRESS_KEY = "animehub:progress:v1";
export const PROGRESS_SCHEMA = 1;

export function systemTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Пустой документ — стабильная ссылка для SSR-фолбэка */
export const EMPTY_DOC: ProgressDoc = Object.freeze({
  schema: PROGRESS_SCHEMA,
  progress: {
    userId: "local",
    xpTotal: 0,
    level: 1,
    acBalance: 0,
    streakCurrent: 0,
    streakBest: 0,
    streakFreezes: 0,
    lastActiveDate: "",
    tz: "UTC",
    equippedTagId: null,
    trophyPoints: 0,
    createdAt: 0,
  },
  counters: {},
  sets: { genres: [], genreTitles: {} },
  daily: { date: -1, week: -1, xpActivity: 0, xpTotal: 0, secondsWatched: 0, counts: {}, weekCounts: {} },
  quests: { day: -1, daily: [], week: -1, weekly: [] },
  battlepass: { season: BATTLEPASS.seasonId, xp: 0, claimed: [] },
  sessions: [],
  achievements: {},
  tags: {},
  purchases: [],
  ledger: [],
  flags: {},
  rate: { windowStart: 0, count: 0 },
  rejected: [],
  meta: { configVersion: PROGRESSION_CONFIG.version, lastEventAt: 0, events: 0 },
}) as ProgressDoc;

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Разбор и «доводка» документа: старые/частичные записи не теряются */
export function parseDoc(raw: string): ProgressDoc | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ProgressDoc>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.schema !== "number") return null;

    const p = obj(parsed.progress);
    const daily = obj(parsed.daily);
    const quests = obj(parsed.quests);
    const meta = obj(parsed.meta);
    const rate = obj(parsed.rate);
    const sets = obj(parsed.sets);
    const empty = EMPTY_DOC;

    return {
      schema: Math.max(parsed.schema, PROGRESS_SCHEMA),
      progress: {
        userId: str(p.userId, empty.progress.userId),
        xpTotal: Math.max(0, num(p.xpTotal)),
        level: Math.max(1, num(p.level, 1)),
        acBalance: Math.max(0, num(p.acBalance)),
        streakCurrent: Math.max(0, num(p.streakCurrent)),
        streakBest: Math.max(0, num(p.streakBest)),
        streakFreezes: Math.max(0, num(p.streakFreezes)),
        lastActiveDate: str(p.lastActiveDate),
        tz: str(p.tz, systemTz()),
        equippedTagId: typeof p.equippedTagId === "string" ? p.equippedTagId : null,
        trophyPoints: Math.max(0, num(p.trophyPoints)),
        createdAt: num(p.createdAt),
      },
      counters: (obj(parsed.counters) as Record<string, number>) ?? {},
      sets: {
        genres: Array.isArray(sets.genres) ? (sets.genres as string[]) : [],
        // документы, сохранённые до появления счётчика по жанрам, отдадут
        // сюда undefined — это нормально, а не поломка
        genreTitles: (obj(sets.genreTitles) as Record<string, string[]>) ?? {},
      },
      daily: {
        date: num(daily.date, -1),
        week: num(daily.week, -1),
        xpActivity: Math.max(0, num(daily.xpActivity)),
        xpTotal: Math.max(0, num(daily.xpTotal)),
        secondsWatched: Math.max(0, num(daily.secondsWatched)),
        counts: (obj(daily.counts) as Record<string, number>) ?? {},
        weekCounts: (obj(daily.weekCounts) as Record<string, number>) ?? {},
      },
      quests: {
        day: num(quests.day, -1),
        daily: Array.isArray(quests.daily) ? quests.daily : [],
        week: num(quests.week, -1),
        weekly: Array.isArray(quests.weekly) ? quests.weekly : [],
      },
      battlepass: (() => {
        const bp = obj(parsed.battlepass);
        return {
          season: str(bp.season, BATTLEPASS.seasonId),
          xp: Math.max(0, num(bp.xp)),
          claimed: Array.isArray(bp.claimed)
            ? (bp.claimed as unknown[]).filter((key): key is string => typeof key === "string")
            : [],
        };
      })(),
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      achievements: (obj(parsed.achievements) as ProgressDoc["achievements"]) ?? {},
      tags: (obj(parsed.tags) as ProgressDoc["tags"]) ?? {},
      purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
      ledger: Array.isArray(parsed.ledger) ? parsed.ledger : [],
      flags: (obj(parsed.flags) as Record<string, number>) ?? {},
      rate: { windowStart: num(rate.windowStart), count: num(rate.count) },
      rejected: Array.isArray(parsed.rejected) ? parsed.rejected : [],
      meta: {
        configVersion: num(meta.configVersion, PROGRESSION_CONFIG.version),
        lastEventAt: num(meta.lastEventAt),
        events: num(meta.events),
        migrated: meta.migrated === true,
      },
    };
  } catch {
    return null;
  }
}
