/**
 * Чистый детерминированный движок прогрессии (§2.1).
 *
 *   (doc, event, externalMetrics, ctx) → (doc, effects)
 *
 * Ни `Date.now()`, ни `localStorage`, ни DOM: время, пояс, userId и снапшот
 * метрик приходят аргументами. Награды считаются ТОЛЬКО по конфигу —
 * клиент шлёт событие («серия досмотрена»), а не «начисли 100 XP».
 *
 * Порядок обработки события:
 *   1. ротация суток/недель (счётчики, квесты);
 *   2. диспетчеризация типа события (правила XP/AC и побочные счётчики);
 *   3. settle-цикл: уровень → достижения → теги → квесты (пока нет новых).
 */

import {
  BATTLEPASS,
  bpFrameExists,
  bpFrameOwned,
  bpKey,
  bpLevelFromXp,
  bpPickFrame,
  bpRewards,
  type BpOwnedCtx,
} from "../battlepass/logic";
import type { BpExtras, BpReward } from "../battlepass/config";
import { eraFor, levelAcReward, levelFromXp, totalXpFor } from "./curve";
import { expectedPrice } from "./deals";
import { displayNameError, nickColorTotal, normalizeNickStyle } from "../nickname";
import { genreCount, trackGenre } from "./genres";
import { PROGRESSION_CONFIG } from "./progression.config";
import { appendEntry, confirmDue, entryKey, hasKey } from "./ledger";
import { dayIndexFromKey, dayKeyOf, timeParts, weekIndexOf } from "./time";
import type {
  Currency,
  DomainEvent,
  ProgressDoc,
  ProgressEffect,
  ProgressionConfig,
  QuestDef,
  QuestInstance,
  RuleClass,
  XpRule,
} from "./types";

export interface EngineCtx {
  /** Текущее время, мс (задаёт вызывающая сторона) */
  now: number;
  /** Часовой пояс пользователя (IANA) */
  tz: string;
  /** id пользователя — входит в ключи идемпотентности */
  userId: string;
  /**
   * Активна ли подписка. Кладёт вызывающая сторона (service.ts читает
   * аккаунт) — в само событие она не входит, чтобы клиент не мог объявить
   * себя подписчиком: движок сам решает, покрывает ли бонус услугу.
   */
  premium?: boolean;
}

/** Метрики, которые движок не знает сам (живут в сторах: профиль, списки) */
export type ExternalMetrics = Record<string, number>;

export interface EngineResult {
  doc: ProgressDoc;
  effects: ProgressEffect[];
  /** Событие отклонено (защита/валидация) — причина пишется в антиабьюз-лог */
  rejected?: { type: string; reason: string };
}

interface Env {
  doc: ProgressDoc;
  cfg: ProgressionConfig;
  ctx: EngineCtx;
  effects: ProgressEffect[];
  dayKey: string;
  todayIdx: number;
  weekIdx: number;
  /** Последняя отклонённая операция — для UI/dev-панели */
  rejected?: { type: string; reason: string };
  /** Внешний контекст выдачи пропуска (премиум, косметика профиля) */
  extras?: BpExtras;
  /**
   * Множитель начислений за «заслуженное»: квесты и бонус за вход.
   *
   * Приходит аргументом, а не читается из аккаунта: движок остаётся
   * чистым и детерминированным, подписку знает только вызывающая сторона.
   * Значение 1 у пользователя без подписки.
   */
  earnedMult?: number;
}

/**
 * Начисления, которые подписка ускоряет.
 *
 * Только то, что игрок не добудет долгой сессией: квесты и бонус за вход.
 * Просмотр серий сюда не входит намеренно — иначе подписка влияла бы на
 * основной источник прогресса и ломала потолок за активность (§2.5).
 */
const PREMIUM_SOURCES = new Set(["QUEST", "STREAK_BONUS"]);

const MAX_SETTLE_ROUNDS = 12;
const REJECTED_WINDOW = 50;
const SESSIONS_WINDOW = 40;
const COMMENT_CONFIRM_MS = 15 * 60_000;
/** Окно rate-limit: не больше N событий в минуту (§13) */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 90;
/** Допуск на откат часов (защита от «вернул время назад») */
const CLOCK_SKEW_MS = 5 * 60_000;

/** Документ — чистый JSON: клонируем через structuredClone с фолбэком */
function cloneDoc(doc: ProgressDoc): ProgressDoc {
  if (typeof structuredClone === "function") return structuredClone(doc);
  return JSON.parse(JSON.stringify(doc)) as ProgressDoc;
}

function logRejected(env: Env, type: string, reason: string): void {
  env.rejected = { type, reason };
  env.doc.rejected.push({ at: env.ctx.now, type, reason });
  if (env.doc.rejected.length > REJECTED_WINDOW) {
    env.doc.rejected.splice(0, env.doc.rejected.length - REJECTED_WINDOW);
  }
}

/* ----------------------------- Soft-cap -------------------------------- */

/** ACTIVITY-XP: 100% до предела, дальше доля, жёсткий потолок (§2.5) */
function applySoftCap(
  daily: ProgressDoc["daily"],
  raw: number,
  cap: ProgressionConfig["softCap"],
): number {
  const spent = daily.xpActivity;
  if (spent >= cap.hardCap) return 0;
  const full = Math.min(raw, Math.max(0, cap.dailyXp - spent));
  const rest = raw - full;
  const credited = full + rest * cap.overRate;
  return Math.max(0, Math.floor(Math.min(credited, cap.hardCap - spent)));
}

/* ------------------------------ Начисления ----------------------------- */

interface GrantOptions {
  currency: Currency;
  raw: number;
  ruleClass: RuleClass;
  /** Тип операции в журнале (ruleId / reward id) */
  type: string;
  /** Читаемый источник для UI */
  source: string;
  /** Ключ идемпотентности (без суффикса валюты) */
  baseKey: string;
  status?: "confirmed" | "pending";
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Единственная точка изменения XP/AC. Пишет журнал (append-only),
 * обновляет дневные счётчики и возвращает эффект для UI.
 */
function grant(env: Env, opts: GrantOptions): { credited: number; already: boolean } {
  const { doc, cfg, ctx } = env;
  if (hasKey(doc, opts.baseKey, opts.currency)) return { credited: 0, already: true };

  let credited = opts.raw;
  if (opts.currency === "XP" && opts.ruleClass === "ACTIVITY") {
    credited = applySoftCap(doc.daily, opts.raw, cfg.softCap);
  }

  // Подписка ускоряет только «заслуженное» и только в бою: множитель
  // применяется к уже посчитанному soft-cap, иначе ×2 тихо обошёл бы
  // потолок за активность — ровно то, ради чего он и стоит
  if (PREMIUM_SOURCES.has(opts.source) && (env.earnedMult ?? 1) > 1) {
    credited = Math.round(credited * (env.earnedMult ?? 1));
  }

  if (opts.currency === "XP") {
    doc.progress.xpTotal = Math.max(0, doc.progress.xpTotal + credited);
    doc.daily.xpTotal += credited;
    if (opts.ruleClass === "ACTIVITY") doc.daily.xpActivity += credited;
    if (doc.daily.xpTotal > (doc.counters.MAX_XP_IN_DAY ?? 0)) {
      doc.counters.MAX_XP_IN_DAY = doc.daily.xpTotal;
    }
    // XP боевого пропуска: каждый зачисленный XP сайта продвигает сезон
    // один в один (§4 ТЗ) — свой XP не трогаем, это две разные сущности.
    const bp = doc.battlepass;
    if (bp.season === BATTLEPASS.seasonId && BATTLEPASS.xpPerSiteXp > 0) {
      bp.xp += Math.round(credited * BATTLEPASS.xpPerSiteXp);
    }
    env.effects.push({
      type: "XP_GAINED",
      raw: opts.raw,
      credited,
      source: opts.source,
      ruleClass: opts.ruleClass,
      reduced: credited < opts.raw,
    });
  } else {
    doc.progress.acBalance = Math.max(0, doc.progress.acBalance + credited);
    env.effects.push({ type: "AC_GAINED", amount: credited, source: opts.source });
  }

  appendEntry(doc, {
    id: `${entryKey(opts.baseKey, opts.currency)}@${ctx.now}`,
    currency: opts.currency,
    type: opts.type,
    source: opts.source,
    amount: credited,
    status: opts.status ?? "confirmed",
    idempotencyKey: entryKey(opts.baseKey, opts.currency),
    createdAt: ctx.now,
    metadata: opts.metadata,
  });

  return { credited, already: false };
}

/* ------------------------------- Правила -------------------------------- */

function makeRuleKey(
  ruleId: string,
  userId: string,
  repeat: XpRule["repeat"],
  entity: string | undefined,
  dayKey: string,
): string {
  const ent = entity ?? dayKey;
  if (repeat === "day") return `${ruleId}:${userId}:${dayKey}`;
  if (repeat === "none") return `${ruleId}:${userId}:${ent}:${dayKey}`;
  return `${ruleId}:${userId}:${ent}`;
}

export interface RuleResult {
  /** Ключ был новым (событие реально произошло — сюда писать счётчики) */
  isNew: boolean;
  /** Награда выдана (не выключено правило и не упёрлись в дневной лимит) */
  granted: boolean;
  creditedXp: number;
}

interface FireOptions {
  status?: "pending";
  metadata?: Record<string, string | number | boolean>;
}

/** Срабатывание правила из конфига: лимиты, идемпотентность, soft-cap, журнал */
function fireRule(env: Env, ruleId: string, entity?: string, opts?: FireOptions): RuleResult {
  const rule = env.cfg.rules[ruleId];
  if (!rule || rule.enabled === false) return { isNew: false, granted: false, creditedXp: 0 };

  const baseKey = makeRuleKey(ruleId, env.ctx.userId, rule.repeat, entity, env.dayKey);
  if (hasKey(env.doc, baseKey, "XP")) return { isNew: false, granted: false, creditedXp: 0 };

  const bucket = rule.bucket ?? ruleId;
  const prev = env.doc.daily.counts[ruleId] ?? 0;
  env.doc.daily.counts[ruleId] = prev + 1;
  if (bucket !== ruleId) {
    env.doc.daily.counts[bucket] = (env.doc.daily.counts[bucket] ?? 0) + 1;
  }
  env.doc.daily.weekCounts[ruleId] = (env.doc.daily.weekCounts[ruleId] ?? 0) + 1;
  if (bucket !== ruleId) {
    env.doc.daily.weekCounts[bucket] = (env.doc.daily.weekCounts[bucket] ?? 0) + 1;
  }

  if (rule.perDay !== undefined && prev + 1 > rule.perDay) {
    return { isNew: true, granted: false, creditedXp: 0 };
  }

  let creditedXp = 0;
  if (rule.xp > 0) {
    let raw = rule.xp * (rule.multiplier ?? 1);
    if (rule.xpPerDay !== undefined) {
      raw = Math.min(raw, Math.max(0, rule.xpPerDay - prev * rule.xp));
    }
    const res = grant(env, {
      currency: "XP",
      raw,
      ruleClass: rule.ruleClass,
      type: ruleId,
      source: ruleId,
      baseKey,
      status: opts?.status,
      metadata: opts?.metadata,
    });
    creditedXp = res.credited;
  }
  if (rule.ac && rule.ac > 0) {
    grant(env, {
      currency: "AC",
      raw: rule.ac,
      ruleClass: rule.ruleClass,
      type: ruleId,
      source: ruleId,
      baseKey,
      metadata: opts?.metadata,
    });
  }

  return { isNew: true, granted: true, creditedXp };
}

/** Ключ идемпотентности правила (для проверок снаружи) */
export function ruleKey(
  cfg: ProgressionConfig,
  userId: string,
  ruleId: string,
  entity: string | undefined,
  dayKey: string,
): string {
  const rule = cfg.rules[ruleId];
  const repeat = rule?.repeat ?? "entity";
  return makeRuleKey(ruleId, userId, repeat, entity, dayKey);
}

/* ------------------------------- Уровень -------------------------------- */

function grantTag(env: Env, tagId: string, source: string): boolean {
  if (env.doc.tags[tagId]) return false;
  const tag = env.cfg.tags.find((t) => t.id === tagId);
  if (!tag || tag.enabled === false) return false;
  env.doc.tags[tagId] = { acquiredAt: env.ctx.now, source };
  env.effects.push({ type: "TAG_UNLOCKED", tagId, source });
  return true;
}

/**
 * Сколько друзей приглашено по документу прогрессии.
 *
 * Считаем по журналу: у каждой зарегистрированной по ссылке учётки там есть
 * своя строка REFERRAL_REGISTERED с ключом `REF:<код>:<ник>`, поэтому
 * повторная регистрация одного и того же ника не завышает счёт.
 */
function referralsInDoc(doc: ProgressDoc): number {
  let n = 0;
  for (const entry of doc.ledger) {
    if (entry.type === "REFERRAL_REGISTERED") n += 1;
  }
  return n;
}

/**
 * Выдаёт теги, за которые дают рубежи реферальной программы.
 *
 * Условие проверяется здесь, а не в интерфейсе: иначе предмет числился бы
 * открытым в каталоге и пропадал бы из коллекции. Считает от фактического
 * числа приглашений, поэтому рубеж, пройденный до правки, тоже засчитан.
 */
function grantReferralTags(env: Env): void {
  const friends = referralsInDoc(env.doc);
  for (const tag of env.cfg.tags) {
    if (tag.source !== "referral") continue;
    if (!tag.friends || friends < tag.friends) continue;
    grantTag(env, tag.id, "referral");
  }
}

/** Смена/снятие тега: счётчик дня + рекорд (секрет «Смена облика») */
function noteTagSwap(env: Env): void {
  env.doc.daily.counts.TAG_EQUIPPED = (env.doc.daily.counts.TAG_EQUIPPED ?? 0) + 1;
  env.doc.counters.MAX_TAG_SWAPS_IN_DAY = Math.max(
    env.doc.counters.MAX_TAG_SWAPS_IN_DAY ?? 0,
    env.doc.daily.counts.TAG_EQUIPPED,
  );
}

/** Пересчёт уровня после изменения XP (уровень никогда не понижается) */
function recalcLevel(env: Env): void {
  const { doc, cfg, ctx } = env;
  const newLevel = levelFromXp(doc.progress.xpTotal, cfg);
  const oldLevel = doc.progress.level;

  if (newLevel <= oldLevel) return;

  let acTotal = 0;
  for (let level = oldLevel + 1; level <= newLevel; level += 1) {
    const ac = levelAcReward(level, cfg);
    acTotal += ac;
    grant(env, {
      currency: "AC",
      raw: ac,
      ruleClass: "EXEMPT",
      type: "LEVEL_UP",
      source: `LEVEL_${level}`,
      baseKey: `LEVEL_AC:${ctx.userId}:${level}`,
    });
  }

  const eraBefore = eraFor(oldLevel, cfg).name;
  const eraAfter = eraFor(newLevel, cfg);
  env.effects.push({
    type: "LEVEL_UP",
    level: newLevel,
    era: eraAfter.name,
    eraChanged: eraBefore !== eraAfter.name,
    acReward: acTotal,
  });

  for (const lt of cfg.levelTags) {
    if (lt.level > oldLevel && lt.level <= newLevel) grantTag(env, lt.tagId, "level");
  }

  doc.progress.level = newLevel;
}

/* ----------------------------- Достижения ------------------------------ */

function unlockedCount(doc: ProgressDoc): number {
  let n = 0;
  for (const id of Object.keys(doc.achievements)) {
    if (doc.achievements[id].unlockedAt) n += 1;
  }
  return n;
}

function checkAchievements(env: Env, external: ExternalMetrics): void {
  const { doc, cfg } = env;
  const metrics = resolveMetrics(doc, external, cfg);

  for (const a of cfg.achievements) {
    if (a.enabled === false) continue;
    const state = doc.achievements[a.id];
    if (state?.unlockedAt) continue;

    const value = metrics[a.condition.metric] ?? 0;
    const progress = Math.min(value, a.condition.threshold);

    if (state) {
      if (progress > state.progress) state.progress = progress;
    } else if (progress > 0 || value > 0) {
      doc.achievements[a.id] = { progress, unlockedAt: 0 };
    }

    if (value < a.condition.threshold) continue;

    const unlocked = doc.achievements[a.id] ?? { progress, unlockedAt: 0 };
    unlocked.progress = a.condition.threshold;
    unlocked.unlockedAt = env.ctx.now;
    doc.achievements[a.id] = unlocked;
    doc.progress.trophyPoints += a.trophy;

    grant(env, {
      currency: "XP",
      raw: a.reward.xp,
      ruleClass: "EXEMPT",
      type: a.id,
      source: "ACHIEVEMENT",
      baseKey: `ACH:${env.ctx.userId}:${a.id}`,
    });
    if (a.reward.ac > 0) {
      grant(env, {
        currency: "AC",
        raw: a.reward.ac,
        ruleClass: "EXEMPT",
        type: a.id,
        source: "ACHIEVEMENT",
        baseKey: `ACH:${env.ctx.userId}:${a.id}`,
      });
    }
    if (a.reward.tagId) grantTag(env, a.reward.tagId, "achievement");

    env.effects.push({
      type: "ACHIEVEMENT_UNLOCKED",
      id: a.id,
      xp: a.reward.xp,
      ac: a.reward.ac,
      tagId: a.reward.tagId,
      frameId: a.reward.frameId,
      trophy: a.trophy,
      secret: a.rarity === "SECRET",
    });
  }
}

/* ------------------------------- Метрики -------------------------------- */

const TODAY_METRICS: Record<string, string> = {
  EPISODES_TODAY: "EP_COMPLETE",
  MINUTES_TODAY: "@WATCH_SECONDS",
  RATINGS_TODAY: "TITLE_RATED",
  COMMENTS_TODAY: "COMMENT",
  LIST_ADDS_TODAY: "LIST_ADD",
  FAVORITES_TODAY: "LIST_FAVORITE",
  TITLES_COMPLETED_TODAY: "TITLE_COMPLETED",
  PROFILE_FIELDS_TODAY: "PROFILE_FIELD",
};

const WEEK_METRICS: Record<string, string> = {
  EPISODES_WEEK: "EP_COMPLETE",
  MINUTES_WEEK: "@WATCH_SECONDS",
  RATINGS_WEEK: "TITLE_RATED",
  COMMENTS_WEEK: "COMMENT",
  TITLES_COMPLETED_WEEK: "TITLE_COMPLETED",
};

function fromBuckets(
  target: Record<string, number>,
  map: Record<string, number>,
  table: Record<string, string>,
): void {
  for (const [metric, bucket] of Object.entries(table)) {
    const raw = map[bucket] ?? 0;
    target[metric] = bucket.startsWith("@") ? Math.floor(raw / 60) : raw;
  }
}

/** Снапшот всех метрик: документ + внешние (сторы) */
export function resolveMetrics(
  doc: ProgressDoc,
  external: ExternalMetrics,
  cfg: ProgressionConfig,
): Record<string, number> {
  const c = doc.counters;
  const tagsOwned = Object.keys(doc.tags);
  const rarities = new Set<string>();
  for (const id of tagsOwned) {
    const tag = cfg.tags.find((t) => t.id === id);
    if (tag) rarities.add(tag.rarity);
  }

  /* Мета-достижения считаются по состоянию документа, а не по счётчикам:
     «все тайные» и «все достижения» по определению зависят от того, что уже
     открыто. Они обновляются на следующей же переоценке после последнего
     открытия — это задержка в один проход, а не цикл: само «все достижения»
     считает только то, что открыто, и себя открыть не может. */
  const unlockedIds = Object.keys(doc.achievements).filter(
    (id) => doc.achievements[id]?.unlockedAt,
  );
  const hiddenDefs = new Set(cfg.achievements.filter((a) => a.hidden).map((a) => a.id));
  const openedHidden = unlockedIds.filter((id) => hiddenDefs.has(id)).length;
  const openedAll = unlockedIds.length;

  const metrics: Record<string, number> = {
    ...external,
    LEVEL: doc.progress.level,
    STREAK_BEST: doc.progress.streakBest,
    EPISODES_COMPLETED: c.EPISODES_COMPLETED ?? 0,
    EPISODES_STARTED: c.EPISODES_OPENED ?? 0,
    TITLES_COMPLETED: c.TITLES_COMPLETED ?? 0,
    DISTINCT_DAYS: c.DISTINCT_DAYS ?? 0,
    NIGHT_EPISODES: c.NIGHT_EPISODES ?? 0,
    MINUTES_WATCHED: Math.floor((c.SECONDS_WATCHED ?? 0) / 60),
    RATINGS: c.RATINGS ?? 0,
    COMMENTS_VALID: c.COMMENTS_VALID ?? 0,
    LIKES_RECEIVED: c.LIKES_RECEIVED ?? 0,
    LIKES_GIVEN: c.LIKES_GIVEN ?? 0,
    QUESTS_DONE: c.QUESTS_DONE ?? 0,
    DISTINCT_GENRES_COMPLETED: doc.sets.genres.length,
    TAGS_OWNED: tagsOwned.length,
    TAGS_RARITIES: rarities.size,
    MAX_XP_IN_DAY: c.MAX_XP_IN_DAY ?? 0,
    MAX_TITLES_IN_DAY: c.MAX_TITLES_IN_DAY ?? 0,
    MAX_TAG_SWAPS_IN_DAY: c.MAX_TAG_SWAPS_IN_DAY ?? 0,
    // рекорд суток в минутах — «24 часа аниме за одни сутки» это ровно 1440
    MAX_MINUTES_IN_DAY: Math.floor((c.MAX_SECONDS_IN_DAY ?? 0) / 60),
    GENRE_SHONEN: genreCount(doc.sets.genreTitles, "shonen"),
    GENRE_FANTASY: genreCount(doc.sets.genreTitles, "fantasy"),
    SECRETS_DONE: openedHidden,
    ACHIEVEMENTS_DONE: openedAll,
    // «Пройти все сезонные события»: сезон пройден, когда пропуск доведён
    // до последнего уровня. Сейчас сезон один, поэтому это 0 или 1 — и
    // счётчик останется верным, когда сезонов станет больше.
    SEASONS_DONE:
      bpLevelFromXp(doc.battlepass.xp) >= BATTLEPASS.maxLevel ? 1 : 0,
    SECRET_0404: doc.flags.secret0404 ?? 0,
    SECRET_ABYSS: doc.flags.abyss ?? 0,
    FLAGS_LOGO: doc.flags["egg:logo"] ?? 0,
    FLAGS_EARLY_BIRD: doc.flags.earlyStreak ?? 0,
  };
  fromBuckets(metrics, doc.daily.counts, TODAY_METRICS);
  fromBuckets(metrics, doc.daily.weekCounts, WEEK_METRICS);
  return metrics;
}

/* -------------------------------- Квесты -------------------------------- */

function pickQuests(pool: QuestDef[], count: number, seed: number): QuestInstance[] {
  const enabled = pool.filter((q) => q.enabled !== false);
  const idx = enabled.map((_, i) => i);
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  for (let i = idx.length - 1; i > 0; i -= 1) {
    s = (s * 48271) % 2147483647;
    const j = s % (i + 1);
    const tmp = idx[i];
    idx[i] = idx[j];
    idx[j] = tmp;
  }
  return idx.slice(0, count).map((i) => ({
    questId: enabled[i].id,
    progress: 0,
    done: false,
    claimed: false,
  }));
}

function questDef(cfg: ProgressionConfig, questId: string): QuestDef | undefined {
  return (
    cfg.quests.dailyPool.find((q) => q.id === questId) ??
    cfg.quests.weeklyPool.find((q) => q.id === questId)
  );
}

function syncQuests(env: Env, external: ExternalMetrics): void {
  const metrics = resolveMetrics(env.doc, external, env.cfg);
  const instances = [...env.doc.quests.daily, ...env.doc.quests.weekly];
  for (const inst of instances) {
    const def = questDef(env.cfg, inst.questId);
    if (!def) continue;
    const value = metrics[def.metric] ?? 0;
    inst.progress = Math.min(def.target, Math.max(inst.progress, value));
    inst.done = inst.progress >= def.target;
  }
}

/* ------------------------------ Ротация дня ----------------------------- */

function rollover(env: Env): void {
  const { doc, cfg } = env;

  if (doc.daily.date !== env.todayIdx || doc.daily.week !== env.weekIdx) {
    const freshWeek = doc.daily.week !== env.weekIdx;
    doc.daily = {
      date: env.todayIdx,
      week: env.weekIdx,
      xpActivity: 0,
      xpTotal: 0,
      secondsWatched: 0,
      counts: {},
      weekCounts: freshWeek ? {} : doc.daily.weekCounts,
    };
  }

  if (doc.quests.week !== env.weekIdx) {
    doc.quests.week = env.weekIdx;
    doc.quests.weekly = pickQuests(cfg.quests.weeklyPool, cfg.quests.weeklyPick, env.weekIdx);
  }
  if (doc.quests.day !== env.todayIdx) {
    doc.quests.day = env.todayIdx;
    doc.quests.daily = pickQuests(cfg.quests.dailyPool, cfg.quests.dailyPick, env.todayIdx);
  }
}

/* ------------------------------- Серия дней ----------------------------- */

function startSession(env: Env): void {
  const { doc, cfg } = env;
  const todayKey = env.dayKey;
  const lastKey = doc.progress.lastActiveDate;
  const hadLast = /^\d{4}-\d{2}-\d{2}$/.test(lastKey);

  let diff: number;
  if (hadLast) {
    const lastIdx = dayIndexFromKey(lastKey);
    diff = Number.isNaN(lastIdx) ? 0 : Math.max(0, env.todayIdx - lastIdx);
  } else {
    // самый первый запуск — засчитываем день; после миграции без даты — нет
    diff = (doc.counters.DISTINCT_DAYS ?? 0) === 0 ? 1 : 0;
  }

  let freezeUsed = false;

  if (diff > 0) {
    doc.counters.DISTINCT_DAYS = (doc.counters.DISTINCT_DAYS ?? 0) + 1;

    if (diff === 1) {
      doc.progress.streakCurrent += 1;
    } else if (diff === 2 && doc.progress.streakFreezes > 0 && doc.progress.streakCurrent > 0) {
      // «Заморозка» спасает ровно один пропущенный день (§6)
      doc.progress.streakFreezes -= 1;
      doc.progress.streakCurrent += 1;
      freezeUsed = true;
    } else {
      doc.progress.streakCurrent = 1;
    }

    doc.progress.streakBest = Math.max(doc.progress.streakBest, doc.progress.streakCurrent);

    const every = cfg.economy.streakEveryDays;
    if (doc.progress.streakCurrent > 0 && doc.progress.streakCurrent % every === 0) {
      grant(env, {
        currency: "AC",
        raw: cfg.economy.streakBonusAc,
        ruleClass: "EXEMPT",
        type: "STREAK_BONUS",
        source: "STREAK_BONUS",
        baseKey: `STREAK:${env.ctx.userId}:${todayKey}`,
      });
    }

    if (diff >= 30) {
      doc.flags.abyssPending = 1;
      doc.flags.absenceDays = diff;
    }
  }

  doc.progress.lastActiveDate = todayKey;

  const { hour, minute } = timeParts(env.ctx.now, env.ctx.tz);
  if (hour === 4 && minute === 4) doc.flags.secret0404 = 1;

  if (diff > 0 || !hadLast) {
    env.effects.push({
      type: "STREAK_CHANGED",
      current: doc.progress.streakCurrent,
      best: doc.progress.streakBest,
      freezeUsed,
    });
  }

  fireRule(env, "SESSION_START");
}

function updateEarlyBird(env: Env): void {
  const flags = env.doc.flags;
  const lastEarlyDay = flags.lastEarlyDay ?? -1;
  if (env.todayIdx === lastEarlyDay) return;
  flags.earlyStreak = lastEarlyDay >= 0 && env.todayIdx - lastEarlyDay === 1
    ? (flags.earlyStreak ?? 0) + 1
    : 1;
  flags.lastEarlyDay = env.todayIdx;
}

/* --------------------------- Просмотр серии ---------------------------- */

function pruneSessions(doc: ProgressDoc): void {
  if (doc.sessions.length <= SESSIONS_WINDOW) return;
  const sorted = [...doc.sessions].sort((a, b) => b.firstAt - a.firstAt);
  doc.sessions = sorted.slice(0, SESSIONS_WINDOW);
}

function watchTick(env: Env, event: Extract<DomainEvent, { type: "EPISODE_TICK" | "EPISODE_OPENED" }>): void {
  const { doc, cfg } = env;
  const key = `${event.titleId}:${event.episodeKey}`;
  let session = doc.sessions.find((s) => s.key === key);

  if (!session) {
    session = {
      key,
      titleId: event.titleId,
      episodeKey: event.episodeKey,
      watchedSeconds: 0,
      firstAt: env.ctx.now,
      lastAt: 0,
      maxSpeed: 1,
    };
    doc.sessions.push(session);
    doc.counters.EPISODES_OPENED = (doc.counters.EPISODES_OPENED ?? 0) + 1;
    pruneSessions(doc);
  }

  if (event.type === "EPISODE_OPENED") return;

  session.maxSpeed = Math.max(session.maxSpeed, event.speed);

  const watch = cfg.watch;
  const visible = event.visible;
  const speedOk = event.speed > 0 && event.speed <= watch.maxSpeed;

  if (visible && speedOk && event.seconds > 0) {
    // зазор в секундах (метаданные времени — мс, лимит — сек)
    const gapSec = session.lastAt > 0 ? (env.ctx.now - session.lastAt) / 1000 : 0;
    const paused = session.lastAt > 0 && gapSec > watch.gapPauseSec;
    if (!paused) {
      const inc = Math.min(event.seconds, watch.heartbeatSec * 2);
      session.watchedSeconds += inc;
      doc.counters.SECONDS_WATCHED = (doc.counters.SECONDS_WATCHED ?? 0) + inc;
      doc.daily.counts.WATCH_SECONDS = (doc.daily.counts.WATCH_SECONDS ?? 0) + inc;
      doc.daily.weekCounts.WATCH_SECONDS = (doc.daily.weekCounts.WATCH_SECONDS ?? 0) + inc;
      // Рекорд суток для «Хроноритма»: держим максимум прямо по ходу дня,
      // а не на смену даты — иначе достижение открывалось бы на следующий день
      doc.daily.secondsWatched = (doc.daily.secondsWatched ?? 0) + inc;
      doc.counters.MAX_SECONDS_IN_DAY = Math.max(
        doc.counters.MAX_SECONDS_IN_DAY ?? 0,
        doc.daily.secondsWatched,
      );
    }
  }
  session.lastAt = env.ctx.now;

  if (session.completedAt) return;

  const durationSec =
    event.durationSec && event.durationSec >= watch.minEpisodeSec ? event.durationSec : 0;
  const required = Math.round((durationSec || watch.nominalEpisodeSec) * watch.requiredFraction);

  // первая осмысленная серия тайтла — 20% от требуемого присутствия (§4.1)
  if (session.watchedSeconds >= required * 0.2) {
    fireRule(env, "TITLE_WATCHED", event.titleId);
  }

  if (session.watchedSeconds < required) return;

  // серия засчитана
  session.completedAt = env.ctx.now;
  doc.counters.EPISODES_COMPLETED = (doc.counters.EPISODES_COMPLETED ?? 0) + 1;

  const { hour } = timeParts(env.ctx.now, env.ctx.tz);
  if (hour < 5) doc.counters.NIGHT_EPISODES = (doc.counters.NIGHT_EPISODES ?? 0) + 1;
  if (hour < 7) updateEarlyBird(env);

  if (doc.flags.abyssPending) {
    doc.flags.abyss = 1;
    doc.flags.abyssPending = 0;
  }

  fireRule(env, "EP_COMPLETE", key);

  if (event.isFinal) {
    const res = fireRule(env, "TITLE_COMPLETED", event.titleId);
    if (res.isNew) {
      doc.counters.TITLES_COMPLETED = (doc.counters.TITLES_COMPLETED ?? 0) + 1;
      doc.counters.MAX_TITLES_IN_DAY = Math.max(
        doc.counters.MAX_TITLES_IN_DAY ?? 0,
        doc.daily.counts.TITLE_COMPLETED ?? 1,
      );
      if (event.genres) {
        for (const genre of event.genres) {
          if (genre && !doc.sets.genres.includes(genre)) doc.sets.genres.push(genre);
        }
      }
    }
  }
}

/* --------------------------- Боевой пропуск ----------------------------- */

/** Смена сезона: XP и отметки прошлого сезона обнуляются один раз */
function syncSeason(env: Env): void {
  if (env.doc.battlepass.season === BATTLEPASS.seasonId) return;
  env.doc.battlepass = { season: BATTLEPASS.seasonId, xp: 0, claimed: [] };
}

/** Одна операция плана выдачи пакета наград */
type BpOp =
  | { type: "ac"; amount: number }
  | { type: "bpXp"; amount: number }
  | { type: "item"; id: string; kind: "tag" | "frame"; duplicate: boolean; dupeAc: number };

/**
 * План выдачи одной награды: предметы валидируются ДО первого начисления,
 * чтобы пакет применялся целиком или не применялся вовсе. `null` —
 * отклонение (причина уже записана в антиабьюз-лог).
 */
function planReward(
  env: Env,
  reward: BpReward,
  owned: BpOwnedCtx,
  event: Extract<DomainEvent, { type: "BATTLEPASS_CLAIMED" }>,
): BpOp | null {
  const { doc, cfg } = env;

  if (reward.kind === "ac") return { type: "ac", amount: reward.amount };
  if (reward.kind === "bpXp") return { type: "bpXp", amount: reward.amount };

  if (reward.kind === "tag") {
    const tag = cfg.tags.find((item) => item.id === reward.itemId);
    if (!tag || tag.enabled === false) {
      logRejected(env, event.type, "bp_item_missing");
      return null;
    }
    return {
      type: "item",
      id: reward.itemId,
      kind: "tag",
      duplicate: Boolean(doc.tags[reward.itemId]),
      dupeAc: reward.dupeAc,
    };
  }

  if (reward.kind === "frame") {
    if (!bpFrameExists(reward.itemId)) {
      logRejected(env, event.type, "bp_item_missing");
      return null;
    }
    return {
      type: "item",
      id: reward.itemId,
      kind: "frame",
      duplicate: bpFrameOwned(reward.itemId, owned),
      dupeAc: reward.dupeAc,
    };
  }

  // framePick: первая невыданная кандидатка; все заняты — компенсация
  const picked = bpPickFrame(reward.candidates, owned);
  if (picked) {
    return { type: "item", id: picked, kind: "frame", duplicate: false, dupeAc: reward.dupeAc };
  }
  return {
    type: "item",
    id: reward.candidates[0] ?? "",
    kind: "frame",
    duplicate: true,
    dupeAc: reward.dupeAc,
  };
}

/**
 * Выдача пакета наград уровня боевого пропуска.
 *
 * Клиент шлёт только линию и номер уровня: суммы, предметы и право выдачи
 * считаются по конфигу сезона (§10 ТЗ). Идемпотентность — ключ пакета
 * `<season>:<line>:<level>` в `battlepass.claimed` плюс отдельные ключи
 * в журнале на каждую валютную операцию: повторный запрос ничего не меняет.
 */
function claimBundle(env: Env, event: Extract<DomainEvent, { type: "BATTLEPASS_CLAIMED" }>): void {
  const { doc, extras } = env;
  const season = BATTLEPASS;

  if (!Number.isInteger(event.level) || event.level < 1 || event.level > season.maxLevel) {
    logRejected(env, event.type, "bp_level_locked");
    return;
  }
  const rewards = bpRewards(event.level, event.line, season);
  if (!rewards) {
    logRejected(env, event.type, "bp_reward_missing");
    return;
  }

  const key = bpKey(season.seasonId, event.line, event.level);
  if (doc.battlepass.claimed.includes(key)) {
    logRejected(env, event.type, "bp_already_claimed");
    return;
  }
  if (event.level > bpLevelFromXp(doc.battlepass.xp, season)) {
    logRejected(env, event.type, "bp_level_locked");
    return;
  }
  if (event.line === "premium" && !extras?.premium) {
    logRejected(env, event.type, "bp_premium_required");
    return;
  }

  // Владение косметикой — признак компенсации за дубль (§9 ТЗ)
  const owned: BpOwnedCtx = {
    siteLevel: doc.progress.level,
    achievements: Object.keys(doc.achievements).filter(
      (id) => doc.achievements[id].unlockedAt > 0,
    ),
    purchased: extras?.purchased ?? [],
  };

  // 1. План: валидация всех предметов до первого начисления
  const plan: BpOp[] = [];
  for (const reward of rewards) {
    const op = planReward(env, reward, owned, event);
    if (!op) return;
    plan.push(op);
  }

  // 2. Выдача
  const source = `BP_${event.line.toUpperCase()}_L${event.level}`;
  let ac = 0;
  let bpXp = 0;
  const items: Array<{ id: string; kind: "tag" | "frame"; duplicate: boolean }> = [];

  plan.forEach((op, index) => {
    const baseKey = `${key}:${index}`;
    if (op.type === "ac") {
      ac += op.amount;
      grant(env, {
        currency: "AC",
        raw: op.amount,
        ruleClass: "EXEMPT",
        type: "BATTLEPASS",
        source,
        baseKey,
      });
      return;
    }
    if (op.type === "bpXp") {
      if (hasKey(doc, baseKey, "XP")) return;
      bpXp += op.amount;
      doc.battlepass.xp += op.amount;
      appendEntry(doc, {
        id: `${baseKey}@${env.ctx.now}`,
        currency: "XP",
        type: "BATTLEPASS",
        source,
        amount: op.amount,
        status: "confirmed",
        idempotencyKey: entryKey(baseKey, "XP"),
        createdAt: env.ctx.now,
        metadata: { season: season.seasonId, line: event.line, level: event.level },
      });
      return;
    }
    items.push({ id: op.id, kind: op.kind, duplicate: op.duplicate });
    if (op.duplicate) {
      // дубль → компенсация AC вместо предмета (§5 ТЗ)
      ac += op.dupeAc;
      grant(env, {
        currency: "AC",
        raw: op.dupeAc,
        ruleClass: "EXEMPT",
        type: "BATTLEPASS_DUP",
        source,
        baseKey,
      });
      return;
    }
    if (op.kind === "tag") grantTag(env, op.id, "battlepass");
    else env.effects.push({ type: "ITEM_GRANTED", itemId: op.id, kind: "frame" });
  });

  doc.battlepass.claimed.push(key);
  doc.counters.BATTLEPASS_CLAIMED = (doc.counters.BATTLEPASS_CLAIMED ?? 0) + 1;

  env.effects.push({
    type: "BATTLEPASS_CLAIMED",
    line: event.line,
    level: event.level,
    ac,
    bpXp,
    items,
    xpAfter: doc.battlepass.xp,
    levelAfter: bpLevelFromXp(doc.battlepass.xp, season),
  });
}

/* ------------------------------- Диспетчер ------------------------------ */

function dispatch(env: Env, event: DomainEvent): void {
  const { doc, cfg } = env;

  switch (event.type) {
    case "SESSION_START": {
      startSession(env);
      return;
    }

    case "EPISODE_OPENED":
    case "EPISODE_TICK": {
      watchTick(env, event);
      return;
    }

    case "TITLE_WATCHED": {
      fireRule(env, "TITLE_WATCHED", event.titleId);
      if (event.genres) {
        for (const genre of event.genres) {
          if (genre && !doc.sets.genres.includes(genre)) doc.sets.genres.push(genre);
        }
      }
      return;
    }

    case "TITLE_COMPLETED": {
      const res = fireRule(env, "TITLE_COMPLETED", event.titleId);
      if (res.isNew) {
        doc.counters.TITLES_COMPLETED = (doc.counters.TITLES_COMPLETED ?? 0) + 1;
        doc.counters.MAX_TITLES_IN_DAY = Math.max(
          doc.counters.MAX_TITLES_IN_DAY ?? 0,
          doc.daily.counts.TITLE_COMPLETED ?? 1,
        );
      }
      if (event.genres) {
        for (const genre of event.genres) {
          if (genre && !doc.sets.genres.includes(genre)) doc.sets.genres.push(genre);
        }
        // Счётчик по конкретным жанрам («досмотреть 50 сёнэнов»). Список id
        // защищён от повторов внутри `trackGenre`.
        trackGenre(doc.sets.genreTitles, event.titleId, event.genres);
      }
      return;
    }

    case "LIST_ADD": {
      const ruleId =
        event.list === "favorite"
          ? "LIST_FAVORITE"
          : event.list === "planned"
            ? "LIST_PLANNED"
            : "LIST_WATCHED";
      fireRule(env, ruleId, event.titleId);
      return;
    }

    case "TITLE_RATED": {
      if (!Number.isFinite(event.score) || event.score < 1 || event.score > 10) {
        logRejected(env, event.type, "score_out_of_range");
        return;
      }
      const res = fireRule(env, "TITLE_RATED", event.titleId);
      if (res.isNew) doc.counters.RATINGS = (doc.counters.RATINGS ?? 0) + 1;
      return;
    }

    case "COMMENT_ADDED": {
      doc.counters.COMMENTS_VALID = (doc.counters.COMMENTS_VALID ?? 0) + 1;
      const meta = {
        commentId: event.commentId,
        confirmAt: env.ctx.now + COMMENT_CONFIRM_MS,
      };
      const first = fireRule(env, "COMMENT_FIRST", undefined, {
        status: "pending",
        metadata: meta,
      });
      if (!first.isNew) {
        fireRule(env, "COMMENT_NEXT", event.commentId, {
          status: "pending",
          metadata: meta,
        });
      }
      return;
    }

    case "COMMENT_REPLIED": {
      // Ответ — тоже комментарий: счётчик идёт в пару к реверсу
      // COMMENT_REMOVED (reverseComment уменьшает его), иначе удаление
      // ответа занижало бы прогресс достижений за комментарии.
      doc.counters.COMMENTS_VALID = (doc.counters.COMMENTS_VALID ?? 0) + 1;
      fireRule(env, "COMMENT_REPLY", event.commentId, {
        status: "pending",
        metadata: {
          commentId: event.commentId,
          confirmAt: env.ctx.now + COMMENT_CONFIRM_MS,
        },
      });
      return;
    }

    case "COMMENT_REMOVED": {
      reverseComment(env, event.commentId);
      return;
    }

    case "LIKE_GIVEN": {
      // Правила выключены в режиме local — движок их просто пропустит
      const res = fireRule(env, "LIKE_GIVEN", event.commentId);
      if (res.isNew) doc.counters.LIKES_GIVEN = (doc.counters.LIKES_GIVEN ?? 0) + 1;
      return;
    }

    case "LIKE_RECEIVED": {
      const res = fireRule(env, "LIKE_RECEIVED", `${event.fromId}:${event.commentId}`);
      if (res.isNew) doc.counters.LIKES_RECEIVED = (doc.counters.LIKES_RECEIVED ?? 0) + 1;
      return;
    }

    case "PROFILE_FIELD": {
      const ruleId = `PROFILE_${event.field.toUpperCase()}`;
      fireRule(env, ruleId, event.field);
      return;
    }

    case "PROFILE_COMPLETED": {
      fireRule(env, "PROFILE_COMPLETE", "all");
      return;
    }

    case "QUEST_CLAIMED": {
      claimQuest(env, event.questId);
      return;
    }

    case "SHOP_PURCHASED": {
      purchase(env, event);
      return;
    }

    case "NICKNAME_RENAMED": {
      renameNick(env, event);
      return;
    }

    case "NICK_COLOR_SET": {
      applyNickColor(env, event);
      return;
    }

    case "TOME_PURCHASED": {
      purchaseTome(env, event);
      return;
    }

    case "TAG_EQUIPPED": {
      const tag = cfg.tags.find((t) => t.id === event.tagId);
      if (!tag) {
        logRejected(env, event.type, "unknown_tag");
        return;
      }
      doc.progress.equippedTagId = tag.id;
      noteTagSwap(env);
      return;
    }

    case "UNEQUIP_TAG": {
      doc.progress.equippedTagId = null;
      noteTagSwap(env);
      return;
    }

    case "PREMIUM_ACTIVATED": {
      // Premium не даёт XP/AC (§1) — только фиксируем факт
      doc.counters.PREMIUM_ACTIVATED = (doc.counters.PREMIUM_ACTIVATED ?? 0) + 1;
      return;
    }

    case "CLAN_CONTRIBUTED": {
      const amount = Math.floor(event.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        logRejected(env, event.type, "invalid_amount");
        return;
      }
      if (doc.progress.acBalance < amount) {
        logRejected(env, event.type, "insufficient_ac");
        return;
      }
      doc.progress.acBalance -= amount;
      appendEntry(doc, {
        id: `CLAN_CONTRIBUTED:${env.ctx.now}:${doc.ledger.length}`,
        currency: "AC",
        type: "CLAN_CONTRIBUTED",
        source: "CLAN",
        amount: -amount,
        status: "confirmed",
        idempotencyKey: `CLAN_CONTRIBUTED:${env.ctx.now}:${doc.ledger.length}:ac`,
        createdAt: env.ctx.now,
      });
      env.effects.push({
        type: "AC_SPENT",
        amount,
        source: "CLAN",
        balance: doc.progress.acBalance,
      });
      return;
    }

    case "CLAN_REWARD_CLAIMED": {
      // Через общий grant: журнал и защита от повторной выдачи уровня
      grant(env, {
        currency: "AC",
        raw: Math.max(0, Math.floor(event.amount)),
        ruleClass: "EXEMPT",
        type: "CLAN_LEVEL",
        source: "CLAN",
        baseKey: `CLAN_LEVEL:${event.level}`,
        metadata: { level: event.level },
      });
      return;
    }

    case "CLAN_CHEST_REWARD": {
      grant(env, {
        currency: "AC",
        raw: Math.max(0, Math.floor(event.amount)),
        ruleClass: "EXEMPT",
        type: "CLAN_CHEST",
        source: "CLAN",
        baseKey: `CLAN_CHEST:${event.key}`,
        metadata: { key: event.key },
      });
      return;
    }

    case "EASTER_EGG": {
      const target = event.target.replace(/[^a-z0-9_-]/gi, "").slice(0, 32);
      if (!target) return;
      doc.flags[`egg:${target}`] = (doc.flags[`egg:${target}`] ?? 0) + 1;
      return;
    }

    case "ADMIN_GRANT": {
      const amount = Math.floor(event.amount);
      if (!Number.isFinite(amount) || amount === 0) return;
      if (event.currency === "XP") {
        doc.progress.xpTotal = Math.max(0, doc.progress.xpTotal + amount);
        doc.daily.xpTotal = Math.max(0, doc.daily.xpTotal + Math.max(0, amount));
        if (doc.daily.xpTotal > (doc.counters.MAX_XP_IN_DAY ?? 0)) {
          doc.counters.MAX_XP_IN_DAY = doc.daily.xpTotal;
        }
      } else {
        doc.progress.acBalance = Math.max(0, doc.progress.acBalance + amount);
      }
      appendEntry(doc, {
        id: `ADMIN:${env.ctx.userId}:${amount}:${env.ctx.now}`,
        currency: event.currency,
        type: "ADMIN_GRANT",
        source: "ADMIN",
        amount,
        status: "confirmed",
        idempotencyKey: `ADMIN:${env.ctx.userId}:${event.reason}:${env.ctx.now}`,
        createdAt: env.ctx.now,
        metadata: { reason: event.reason },
      });
      env.effects.push(
        event.currency === "XP"
          ? {
              type: "XP_GAINED",
              raw: amount,
              credited: amount,
              source: "ADMIN",
              ruleClass: "EXEMPT",
              reduced: false,
            }
          : { type: "AC_GAINED", amount, source: "ADMIN" },
      );
      return;
    }

    case "DEV_ADJUST": {
      if (!(event.metric in doc.counters) && !(event.metric in doc.flags)) {
        doc.counters[event.metric] = 0;
      }
      if (event.metric in doc.flags) {
        doc.flags[event.metric] = Math.max(0, (doc.flags[event.metric] ?? 0) + event.delta);
      } else {
        doc.counters[event.metric] = Math.max(0, (doc.counters[event.metric] ?? 0) + event.delta);
      }
      return;
    }

    case "DEV_TAG_GRANTED": {
      // Выдача тега вручную (админ/дев-панель): та же дорога grantTag,
      // что у уровней и достижений, — эффект TAG_UNLOCKED и запись в
      // собрание происходят как при обычной выдаче, без покупки за AC.
      if (!grantTag(env, event.tagId, "admin")) {
        logRejected(env, "DEV_TAG_GRANTED", "tag_not_grantable");
      }
      return;
    }

    case "REFERRAL_REGISTERED": {
      // Ключ идемпотентности включает ник новичка: повторная регистрация
      // с того же аккаунта не должна начислять награду дважды
      const key = `REF:${event.refCode}:${event.newNick}`;
      if (hasKey(doc, key, "AC")) {
        logRejected(env, event.type, "already_referred");
        return;
      }
      if (!event.refCode || !event.newNick) {
        logRejected(env, event.type, "missing_field");
        return;
      }

      const xp = cfg.economy.referralXp;
      const ac = cfg.economy.referralAc;
      doc.progress.xpTotal += xp;
      doc.daily.xpTotal += xp;
      doc.progress.acBalance += ac;

      appendEntry(doc, {
        id: `${key}@${env.ctx.now}`,
        currency: "AC",
        type: "REFERRAL_REGISTERED",
        source: "REFERRAL",
        amount: ac,
        status: "confirmed",
        idempotencyKey: entryKey(key, "AC"),
        createdAt: env.ctx.now,
        metadata: { refCode: event.refCode, newNick: event.newNick, xp },
      });

      env.effects.push(
        { type: "AC_GAINED", amount: ac, source: "REFERRAL" },
        { type: "XP_GAINED", raw: xp, credited: xp, source: "REFERRAL", ruleClass: "EXEMPT", reduced: false },
      );

      // Новый рубеж мог открыть тег за приглашение — выдаём сразу.
      grantReferralTags(env);
      return;
    }

    case "BATTLEPASS_CLAIMED": {
      claimBundle(env, event);
      return;
    }
  }
}

/* ------------------------------- Квесты --------------------------------- */

function claimQuest(env: Env, questId: string): void {
  const { doc, cfg } = env;
  const inst =
    doc.quests.daily.find((q) => q.questId === questId) ??
    doc.quests.weekly.find((q) => q.questId === questId);
  const def = questDef(cfg, questId);

  if (!inst || !def) {
    logRejected(env, "QUEST_CLAIMED", "quest_not_found");
    return;
  }
  if (!inst.done) {
    logRejected(env, "QUEST_CLAIMED", "quest_not_done");
    return;
  }
  if (inst.claimed) {
    logRejected(env, "QUEST_CLAIMED", "quest_already_claimed");
    return;
  }

  inst.claimed = true;
  doc.counters.QUESTS_DONE = (doc.counters.QUESTS_DONE ?? 0) + 1;

  const isDaily = doc.quests.daily.some((q) => q.questId === questId);
  const baseKey = `QUEST:${env.ctx.userId}:${questId}:${isDaily ? env.dayKey : `w${env.weekIdx}`}`;
  const res = grant(env, {
    currency: "XP",
    raw: def.xp,
    ruleClass: "EXEMPT",
    type: questId,
    source: "QUEST",
    baseKey,
    metadata: { questId },
  });
  grant(env, {
    currency: "AC",
    raw: def.ac,
    ruleClass: "EXEMPT",
    type: questId,
    source: "QUEST",
    baseKey,
    metadata: { questId },
  });
  env.effects.push({ type: "QUEST_DONE", questId, xp: res.credited, ac: def.ac });
}

/* ------------------------------- Магазин -------------------------------- */

/**
 * Предметы, которые нельзя купить повторно.
 *
 * Исключения — расходники (`svc_freeze`, смена ника): там у каждого
 * предмета есть `maxOwned`, и лимит считается в общей ветке проверки.
 * `custom` — постоянные настройки профиля (сейчас блок уровня в
 * предпросмотре): покупается один раз и навсегда.
 */
const COSMETIC_ONCE = new Set(["title", "frame", "background", "effect", "custom"]);

/**
 * Покупка тома опыта.
 *
 * Отдельная ветка, а не позиция магазина: у тома нет предмета в гардеробе,
 * есть срок в сутки и порог уровня. XP идёт мимо soft-cap (оплачено),
 * но AC списывается строго по цене из конфига — клиент цену не диктует.
 */
function purchaseTome(
  env: Env,
  event: Extract<DomainEvent, { type: "TOME_PURCHASED" }>,
): void {
  const { doc, cfg } = env;
  const tome = cfg.tomes.find((t) => t.id === event.tomeId);
  if (!tome || tome.enabled === false) {
    logRejected(env, event.type, "unknown_tome");
    return;
  }

  const price = Math.floor(event.price);
  if (price !== tome.price) {
    logRejected(env, event.type, "price_mismatch");
    return;
  }

  if (tome.fromLevel !== undefined) {
    const level = levelFromXp(doc.progress.xpTotal, cfg);
    if (level < tome.fromLevel) {
      logRejected(env, event.type, "tome_locked");
      return;
    }
  }

  const countKey = `TOME:${tome.id}`;
  const boughtToday = doc.daily.counts[countKey] ?? 0;
  if (boughtToday >= (tome.perDay ?? 1)) {
    logRejected(env, event.type, "tome_daily_limit");
    return;
  }

  if (price < 0 || doc.progress.acBalance < price) {
    logRejected(env, event.type, "insufficient_ac");
    return;
  }

  // Ключ включает номер покупки: при perDay > 1 одна база на сутки
  // заблокировала бы вторую покупку как «уже выдано».
  const baseKey = `${countKey}:${env.ctx.userId}:${env.dayKey}:${boughtToday}`;

  grant(env, {
    currency: "AC",
    raw: -price,
    ruleClass: "EXEMPT",
    type: "TOME_PURCHASED",
    source: countKey,
    baseKey,
  });

  const res = grant(env, {
    currency: "XP",
    raw: tome.xp,
    ruleClass: "EXEMPT",
    type: "TOME_PURCHASED",
    source: countKey,
    baseKey,
    metadata: { tomeId: tome.id, price },
  });

  if (res.already) return;

  doc.daily.counts[countKey] = boughtToday + 1;
  doc.purchases.push({ itemId: tome.id, kind: "custom", price, at: env.ctx.now });
  env.effects.push({
    type: "AC_SPENT",
    amount: price,
    source: tome.id,
    balance: doc.progress.acBalance,
  });
}

function purchase(
  env: Env,
  event: Extract<DomainEvent, { type: "SHOP_PURCHASED" }>,
): void {
  const { doc, cfg } = env;
  const item = cfg.shop.find((i) => i.id === event.itemId);
  if (!item) {
    logRejected(env, event.type, "unknown_item");
    return;
  }
  const price = Math.floor(event.price);
  /* Цену сверяем не с конфигом, а с тем, что движок считает правильным
   * сейчас: у витрины дня предмет стоит со скидкой. Клиент не может прислать
   * «свою» скидку — она выводится здесь из того же числа, что и на плашке. */
  const expected = expectedPrice(cfg.shop, item.id, env.ctx.now);
  if (price !== expected) {
    logRejected(env, event.type, "price_mismatch");
    return;
  }
  // Тег — единственный предмет: повторная покупка не имеет смысла
  if (item.kind === "tag" && doc.tags[item.id]) {
    logRejected(env, event.type, "already_owned");
    return;
  }
  // Косметика тоже покупается один раз: титул, рамка, фон или эффект не
  // могут числиться в коллекции дважды. Без этой проверки клиент мог бы
  // отправить N одинаковых запросов и списать N цен — цена была бы
  // уплачена, а предмет остался бы один.
  if (COSMETIC_ONCE.has(item.kind) && doc.purchases.some((p) => p.itemId === item.id)) {
    logRejected(env, event.type, "already_owned");
    return;
  }
  if (price < 0 || doc.progress.acBalance < price) {
    logRejected(env, event.type, "insufficient_ac");
    return;
  }
  if (item.maxOwned !== undefined) {
    const held =
      item.id === "svc_freeze"
        ? doc.progress.streakFreezes
        : doc.purchases.filter((p) => p.itemId === item.id).length;
    if (held + 1 > item.maxOwned) {
      logRejected(env, event.type, "limit_reached");
      return;
    }
  }

  doc.progress.acBalance -= price;
  doc.purchases.push({ itemId: item.id, kind: item.kind, price, at: env.ctx.now });

  appendEntry(doc, {
    id: `SHOP:${env.ctx.userId}:${item.id}:${env.ctx.now}`,
    currency: "AC",
    type: "SHOP_PURCHASED",
    source: "SHOP",
    amount: -price,
    status: "confirmed",
    idempotencyKey: `SHOP:${env.ctx.userId}:${item.id}:${env.ctx.now}`,
    createdAt: env.ctx.now,
    metadata: { itemId: item.id, kind: item.kind },
  });

  if (item.id === "svc_freeze") {
    doc.progress.streakFreezes = Math.min(
      cfg.economy.freezeMax,
      doc.progress.streakFreezes + 1,
    );
  }

  env.effects.push({
    type: "AC_SPENT",
    amount: price,
    source: item.id,
    balance: doc.progress.acBalance,
  });
  env.effects.push({ type: "ITEM_GRANTED", itemId: item.id, kind: item.kind });
  // Тег из магазина попадает в собрание: без этого списание AC «висело» бы
  // в воздухе — предмет должен появиться в документе (один атомарный шаг).
  if (item.kind === "tag") grantTag(env, item.id, "shop");
}

/* ------------------- Отображаемое имя и его оформление ------------------ */

/** Флаги документа: бонус подписки на каждую из услуг одноразовый */
const NICK_BONUS_FLAG: Record<string, string> = {
  svc_nick: "bonus:svc_nick",
  svc_color: "bonus:svc_color",
};

/** Подписка покрывает услугу, пока бонус не потрачен */
function nickBonusLeft(env: Env, itemId: string): boolean {
  if (!env.ctx.premium) return false;
  const flag = NICK_BONUS_FLAG[itemId];
  return (env.doc.flags[flag] ?? 0) < env.cfg.nickname.freeUses;
}

/**
 * Цена услуги глазами движка: магазинная (с учётом витрины дня) плюс
 * наценки за опции, минус бонус подписки. Клиент присылает «сколько он
 * насчитал» — и движок сверяет со своим ответом, иначе оформление было бы
 * бесплатным просто потому, что клиент так сказал.
 */
function nickServicePrice(env: Env, itemId: string, addons = 0): number {
  const item = env.cfg.shop.find((i) => i.id === itemId);
  if (!item) return -1;
  if (nickBonusLeft(env, itemId)) return 0;
  return expectedPrice(env.cfg.shop, itemId, env.ctx.now) + addons;
}

/**
 * Общая часть обеих услуг: списание AC, запись в покупки и журнал, бонус.
 * Само имя/оформление движок не хранит — это делает UI в аккаунте и профиле.
 */
function chargeNickService(
  env: Env,
  itemId: string,
  price: number,
  freeUsed: boolean,
): void {
  const { doc, cfg } = env;
  const item = cfg.shop.find((i) => i.id === itemId);
  if (!item) {
    logRejected(env, "NICK_SERVICE", "unknown_item");
    return;
  }
  if (price > 0 && doc.progress.acBalance < price) {
    logRejected(env, "NICK_SERVICE", "insufficient_ac");
    return;
  }
  if (item.maxOwned !== undefined) {
    const held = doc.purchases.filter((p) => p.itemId === itemId).length;
    if (held + 1 > item.maxOwned) {
      logRejected(env, "NICK_SERVICE", "limit_reached");
      return;
    }
  }

  doc.progress.acBalance -= price;
  doc.purchases.push({ itemId, kind: item.kind, price, at: env.ctx.now });
  if (freeUsed) {
    const flag = NICK_BONUS_FLAG[itemId];
    doc.flags[flag] = (doc.flags[flag] ?? 0) + 1;
  }
  if (price > 0) {
    appendEntry(doc, {
      id: `SHOP:${env.ctx.userId}:${itemId}:${env.ctx.now}`,
      currency: "AC",
      type: "SHOP_PURCHASED",
      source: "SHOP",
      amount: -price,
      status: "confirmed",
      idempotencyKey: `SHOP:${env.ctx.userId}:${itemId}:${env.ctx.now}`,
      createdAt: env.ctx.now,
      metadata: { itemId, kind: item.kind },
    });
    env.effects.push({
      type: "AC_SPENT",
      amount: price,
      source: itemId,
      balance: doc.progress.acBalance,
    });
  }
  env.effects.push({ type: "ITEM_GRANTED", itemId, kind: item.kind });
}

/** «Смена ника»: правила имени проверяет движок, цену — по конфигу */
function renameNick(
  env: Env,
  event: Extract<DomainEvent, { type: "NICKNAME_RENAMED" }>,
): void {
  const name = event.nickname.trim();
  if (displayNameError(name)) {
    logRejected(env, event.type, "invalid_nickname");
    return;
  }
  const price = nickServicePrice(env, "svc_nick");
  if (price < 0) {
    logRejected(env, event.type, "unknown_item");
    return;
  }
  if (price !== Math.floor(event.price)) {
    logRejected(env, event.type, "price_mismatch");
    return;
  }
  chargeNickService(env, "svc_nick", price, price === 0);
}

/**
 * «Цвет ника»: оформление нормализуется движком, иначе в профиль попал бы
 * мусор из хранилища (кривой цвет или скорость 0 — и сломанный градиент).
 */
function applyNickColor(
  env: Env,
  event: Extract<DomainEvent, { type: "NICK_COLOR_SET" }>,
): void {
  const style = normalizeNickStyle(event.style);
  if (style.mode === "def") {
    logRejected(env, event.type, "empty_style");
    return;
  }
  const price = nickServicePrice(env, "svc_color", nickColorTotal(0, env.cfg.nickname.addons, style));
  if (price < 0) {
    logRejected(env, event.type, "unknown_item");
    return;
  }
  if (price !== Math.floor(event.price)) {
    logRejected(env, event.type, "price_mismatch");
    return;
  }
  chargeNickService(env, "svc_color", price, price === 0);
}

/* ---------------------------- Реверс награды ---------------------------- */

/**
 * Удаление комментария откатывает его награду (§2.3): новая запись-реверс,
 * XP уменьшается, но не ниже текущего уровня (уровень — функция XP).
 */
function reverseComment(env: Env, commentId: string): void {
  const { doc, cfg } = env;
  doc.counters.COMMENTS_VALID = Math.max(0, (doc.counters.COMMENTS_VALID ?? 0) - 1);

  for (const entry of doc.ledger) {
    if (entry.status === "reversed") continue;
    if (entry.status !== "confirmed" && entry.status !== "pending") continue;
    if (entry.metadata?.commentId !== commentId) continue;
    if (entry.currency !== "XP" && entry.currency !== "AC") continue;
    if (entry.amount <= 0) continue;

    const floor = entry.currency === "XP" ? totalXpFor(doc.progress.level, cfg) : 0;
    if (entry.currency === "XP") {
      doc.progress.xpTotal = Math.max(floor, doc.progress.xpTotal - entry.amount);
      doc.daily.xpTotal = Math.max(0, doc.daily.xpTotal - entry.amount);
      doc.daily.xpActivity = Math.max(0, doc.daily.xpActivity - entry.amount);
    } else {
      doc.progress.acBalance = Math.max(0, doc.progress.acBalance - entry.amount);
    }

    appendEntry(doc, {
      id: `${entry.id}:rev`,
      currency: entry.currency,
      type: entry.type,
      source: "REVERSAL",
      amount: -entry.amount,
      status: "confirmed",
      reversesId: entry.id,
      idempotencyKey: `${entry.idempotencyKey}:rev`,
      createdAt: env.ctx.now,
      metadata: { commentId, reason: "comment_removed" },
    });

    env.effects.push({
      type: "REWARD_REVERSED",
      entryId: entry.id,
      currency: entry.currency,
      amount: entry.amount,
      reason: "comment_removed",
    });
    entry.status = "reversed";
  }
}

/* ------------------------------- Public API ----------------------------- */

/**
 * Обработать одно событие. Чистая функция: на входе документ, на выходе —
 * новый документ и список эффектов (UI делает из них тосты).
 */
export function applyEvent(
  input: ProgressDoc,
  event: DomainEvent,
  external: ExternalMetrics,
  ctx: EngineCtx,
  cfg: ProgressionConfig = PROGRESSION_CONFIG,
  extras?: BpExtras,
  earnedMult = 1,
): EngineResult {
  const doc = cloneDoc(input);
  const dayKey = dayKeyOf(ctx.now, ctx.tz);
  const todayIdx = dayIndexFromKey(dayKey);

  const env: Env = {
    doc,
    cfg,
    ctx,
    effects: [],
    dayKey,
    todayIdx,
    weekIdx: weekIndexOf(todayIdx),
    extras,
    earnedMult,
  };

  confirmDue(doc, ctx.now);

  // антиабьюз: откат часов и поток событий (§13) — до ротации,
  // чтобы отклонённое событие не трогало дневные счётчики
  if (doc.meta.lastEventAt > 0 && ctx.now + CLOCK_SKEW_MS < doc.meta.lastEventAt) {
    logRejected(env, event.type, "clock_rollback");
    return { doc, effects: [], rejected: env.rejected };
  }
  if (ctx.now - doc.rate.windowStart > RATE_WINDOW_MS) {
    doc.rate.windowStart = ctx.now;
    doc.rate.count = 0;
  }
  doc.rate.count += 1;
  if (doc.rate.count > RATE_MAX) {
    logRejected(env, event.type, "rate_limited");
    return { doc, effects: [], rejected: env.rejected };
  }

  rollover(env);
  syncSeason(env);
  dispatch(env, event);

  // settle: уровень → достижения → теги → квесты, пока не стабилизируется
  for (let round = 0; round < MAX_SETTLE_ROUNDS; round += 1) {
    const before = unlockedCount(doc);
    recalcLevel(env);
    checkAchievements(env, external);
    // Теги за рубежи рефералки не зависят от круга — проверка идемпотентна
    // (выданный тег повторно не выдаётся) и нужна для тех, кто прошёл рубеж
    // до появления этого правила.
    grantReferralTags(env);
    syncQuests(env, external);
    if (unlockedCount(doc) === before) break;
  }

  doc.meta.configVersion = cfg.version;
  doc.meta.lastEventAt = Math.max(doc.meta.lastEventAt, ctx.now);
  doc.meta.events += 1;

  return { doc, effects: env.effects, rejected: env.rejected };
}

/** Только зафиксировать отклонённое событие в антиабьюз-логе (§13) */
export function noteRejection(
  input: ProgressDoc,
  type: string,
  reason: string,
  ctx: EngineCtx,
  cfg: ProgressionConfig = PROGRESSION_CONFIG,
): EngineResult {
  const doc = cloneDoc(input);
  const dayKey = dayKeyOf(ctx.now, ctx.tz);
  const env: Env = {
    doc,
    cfg,
    ctx,
    effects: [],
    dayKey,
    todayIdx: dayIndexFromKey(dayKey),
    weekIdx: weekIndexOf(dayIndexFromKey(dayKey)),
  };
  logRejected(env, type, reason);
  return { doc, effects: [], rejected: { type, reason } };
}
