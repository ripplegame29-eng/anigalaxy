"use client";

/**
 * Сервис прогрессии — единственная точка входа для UI (§2.1).
 *
 *   emit(event)
 *     → валидация, нужныая сторам (качество комментария)
 *     → applyEvent (чистый движок: правила, уровни, достижения, квесты)
 *     → атомарная запись документа
 *     → рассылка эффектов подписчикам (тосты, журнал XP/AC)
 *
 * Плюс обязанности на границе:
 *  - миграция старых ключей один раз при старте (+ gain-only дельта из
 *    профиля: старые пути addXp/spendCoins продолжают работать до этапа 4,
 *    и их прибавки не теряются — дельта применяется только если профиль
 *    больше документа, т.е. потраченное деньгами не возвращается);
 *  - снапшот внешних метрик (профиль, аккаунт, списки) — движок их сам
 *    не читает;
 *  - побочные эффекты наград (рамка за достижение → косметика профиля).
 */

import { loadCollections, loadFavorites } from "../collections";
import { addNotice, profileStore, pushGift, updateProfile } from "../profile";
import { MIN_REWARD_TEXT, mergeRecent, titleCommentsRecent } from "../comments";
import { isPremiumActive, readAccount } from "../auth";
import { PREMIUM_QUEST_MULT } from "../premium-perks";
import type { BpExtras } from "../battlepass/config";
import { systemTz } from "./doc";
import {
  applyEvent,
  noteRejection,
  resolveMetrics,
  type EngineCtx,
  type EngineResult,
  type ExternalMetrics,
} from "./engine";
import { appendEntry } from "./ledger";
import { LEGACY_KEYS, markMigrated, migrateLegacy, needsMigration } from "./migrate";
import { PROGRESSION_CONFIG } from "./progression.config";
import { getProgressStore, type ProgressStore } from "./store";
import type { DomainEvent, ProgressDoc, ProgressEffect } from "./types";

export interface EmitResult {
  effects: ProgressEffect[];
  rejected?: { type: string; reason: string };
  doc: ProgressDoc;
}

type EffectListener = (effects: ProgressEffect[], event: DomainEvent) => void;

const effectListeners = new Set<EffectListener>();

let store: ProgressStore | null = null;
let inited = false;

/* ------------------------------- Инициализация -------------------------- */

function readLegacy(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
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

/**
 * Дельта старого профиля (gain-only), пока UI не переключён на новый
 * источник (этапы 4–6): старые addXp/addCoins добавляют в профиль больше,
 * чем есть в документе — прибавку переносим, потраченное нет.
 *
 * За эталон берутся высокие отметки `doc.meta.legacy` (что уже перенесено):
 * иначе трата AC в магазине «воскресила» бы старые монеты при следующей
 * загрузке, а уменьшение легаси-профиля считалось бы новым приростом.
 */
function mergeLegacyDelta(doc: ProgressDoc, now: number): ProgressDoc {
  const profile = safeJson<Record<string, unknown>>(readLegacy(LEGACY_KEYS.profile));
  if (!profile) return doc;

  const legacyXp = Math.max(0, Math.floor(num(profile.xp)));
  const legacyAc = Math.max(0, Math.floor(num(profile.coins)));
  const legacyStreak = Math.max(0, Math.floor(num(profile.streak)));
  const base = doc.meta.legacy;
  const baseXp = base?.xp ?? 0;
  const baseAc = base?.ac ?? 0;
  const baseStreak = base?.streak ?? 0;

  const xpGain = Math.max(0, legacyXp - baseXp);
  const acGain = Math.max(0, legacyAc - baseAc);
  const streakGain = Math.max(0, legacyStreak - baseStreak);

  // Нечего переносить — но high-water отметки не должны откатиться,
  // если легаси-профиль уменьшился (старые траты монет).
  if (!xpGain && !acGain && !streakGain) {
    const nextXp = Math.max(baseXp, legacyXp);
    const nextAc = Math.max(baseAc, legacyAc);
    const nextStreak = Math.max(baseStreak, legacyStreak);
    if (base && (nextXp !== baseXp || nextAc !== baseAc || nextStreak !== baseStreak)) {
      const cooled = structuredClone(doc) as ProgressDoc;
      cooled.meta.legacy = { xp: nextXp, ac: nextAc, streak: nextStreak };
      return cooled;
    }
    return doc;
  }

  const next = structuredClone(doc) as ProgressDoc;
  const userId = next.progress.userId;

  if (xpGain) {
    next.progress.xpTotal += xpGain;
    appendEntry(next, {
      id: `LEGACY_X:${userId}:${now}`,
      currency: "XP",
      type: "LEGACY_DELTA",
      source: "MIGRATION",
      amount: xpGain,
      status: "confirmed",
      idempotencyKey: `LEGACY_X:${userId}:${now}`,
      createdAt: now,
      metadata: { reason: "legacy_profile" },
    });
  }
  if (acGain) {
    next.progress.acBalance += acGain;
    appendEntry(next, {
      id: `LEGACY_A:${userId}:${now}`,
      currency: "AC",
      type: "LEGACY_DELTA",
      source: "MIGRATION",
      amount: acGain,
      status: "confirmed",
      idempotencyKey: `LEGACY_A:${userId}:${now}`,
      createdAt: now,
      metadata: { reason: "legacy_profile" },
    });
  }
  if (streakGain) {
    next.progress.streakCurrent = Math.max(next.progress.streakCurrent, legacyStreak);
    next.progress.streakBest = Math.max(next.progress.streakBest, legacyStreak);
  }

  next.meta.legacy = {
    xp: Math.max(baseXp, legacyXp),
    ac: Math.max(baseAc, legacyAc),
    streak: Math.max(baseStreak, legacyStreak),
  };

  // уровень намеренно НЕ пересчитываем: следующий applyEvent выдаст
  // LEVEL_UP (AC за уровни, теги за уровень) ровно один раз.
  return next;
}

function initStore(): ProgressStore {
  if (!store) store = getProgressStore(PROGRESSION_CONFIG);
  return store;
}

function ensureInit(): ProgressStore {
  const st = initStore();
  if (inited) return st;
  inited = true;

  const tz = systemTz();
  const now = Date.now();
  let doc = st.get();
  let dirty = false;

  if (needsMigration(doc)) {
    // Документ уже с данными (события были) — просто отмечаем флаг,
    // чтобы не затирать новые награды пересборкой из старых ключей.
    const fresh = doc.meta.events === 0 && doc.progress.xpTotal === 0;
    const migrated = fresh ? migrateLegacy({ read: readLegacy, now, tz }) : null;
    doc = migrated ?? doc;
    doc = markMigrated(doc);
    if (doc.progress.tz !== tz && fresh) {
      doc = { ...doc, progress: { ...doc.progress, tz } };
    }
    dirty = true;
  }

  // Отметок ещё нет (документ из старой сборки или профиль появился позже):
  // база = текущие значения легаси-профиля — приростов «из ничего» не будет,
  // а дальнейшие addXp/addCoins перенесутся штатной дельтой.
  if (!doc.meta.legacy) {
    const profile = safeJson<Record<string, unknown>>(readLegacy(LEGACY_KEYS.profile));
    const seeded = {
      xp: profile ? Math.max(0, Math.floor(num(profile.xp))) : 0,
      ac: profile ? Math.max(0, Math.floor(num(profile.coins))) : 0,
      streak: profile ? Math.max(0, Math.floor(num(profile.streak))) : 0,
    };
    doc = { ...doc, meta: { ...doc.meta, legacy: seeded } };
    dirty = true;
  }

  // Дельта легаси-профиля — на каждой загрузке (gain-only, high-water
  // отметки в meta.legacy): UI ещё частично пишет в старый профиль.
  const merged = mergeLegacyDelta(doc, now);
  if (merged !== doc) dirty = true;
  doc = merged;

  if (dirty) st.set(doc);
  return st;
}

/** Первый запуск/хард-ресет — только для тестов */
export function resetService(): void {
  inited = false;
  store = null;
}

/* ------------------------------- Метрики -------------------------------- */

/** Метрики, которые движок не считает сам: читаются из других сторов */
function externalMetrics(): ExternalMetrics {
  const profile = profileStore.get();
  const account = readAccount();
  const favorites = loadFavorites();
  const collections = loadCollections();

  const criteria = [
    Boolean(profile.avatar),
    profile.bio.trim().length >= 20,
    profile.signature.trim().length >= 5,
    profile.showcase.length >= 3,
  ];
  const filled = criteria.filter(Boolean).length;

  return {
    ACCOUNT_CREATED: account ? 1 : 0,
    PROFILE_PERCENT: Math.round((filled / criteria.length) * 100),
    DISTINCT_TITLES_IN_LISTS: new Set(favorites).size,
    FAVORITES_TOTAL: favorites.length,
    COLLECTIONS_TOTAL: collections.length,
  };
}

/* ------------------------------- Валидация ------------------------------ */

function prevalidate(event: DomainEvent): string | null {
  if (event.type === "COMMENT_ADDED") {
    // Комментарий попадает в стор ДО emit (иначе нет id для сверки с
    // движком): нормализованный текст берём из стора по id. Проверки
    // идут по обоим хранилищам (стена профиля + комментарии тайтла),
    // чтобы кулдаун и дубли не расходились между разделами.
    const profile = profileStore.get();
    const merged = mergeRecent([profile.comments, titleCommentsRecent(12)]);
    const stored = merged.find((c) => c.id === event.commentId);
    const text = (stored?.text ?? event.text).trim();
    if (text.length < MIN_REWARD_TEXT) return "comment_too_short";

    const recent = merged.filter((c) => c.id !== event.commentId).slice(0, 5);
    if (recent.some((c) => c.text.trim() === text)) return "comment_duplicate";

    const newest = merged[0];
    const ownNewest = newest?.id === event.commentId;
    if (!ownNewest && newest && Date.now() - newest.at < 60_000) return "comment_cooldown";

    return null;
  }

  if (event.type === "COMMENT_REPLIED") {
    // Ответ награждается по правилу COMMENT_REPLY — качество текста
    // проверяем тем же порогом; кулдаун на ответы не распространяем
    // (разговор отвечает быстро, а дубль-проверка здесь неприменима).
    if (event.text.trim().length < MIN_REWARD_TEXT) return "comment_too_short";
  }

  return null;
}

/* ------------------------------ Побочные связи -------------------------- */

/**
 * Контекст выдачи боевого пропуска: премиум и купленная косметика читаются
 * из сторов на каждой отправке события — движок их сам не открывает,
 * а клиент в событие их не передаёт (§10 ТЗ: не доверять данным клиента).
 */
function battlepassExtras(): BpExtras {
  return {
    premium: isPremiumActive(readAccount()),
    purchased: [...profileStore.get().purchased],
  };
}

/**
 * Побочные эффекты наград за границей движка:
 *  - рамка из достижения → предмет в `profile.purchased`;
 *  - купленный в магазине фон/рамка/эффект → туда же (гардероб открывает
 *    их тем же условием «куплено»), теги и сервисы живут в самом документе;
 *  - записи в раздел «Уведомления» (§12.6) и подарок за новый уровень —
 *    их показывает легаси-профиль, движок про него ничего не знает.
 */
function applySideEffects(effects: ProgressEffect[]): void {
  for (const effect of effects) {
    if (effect.type === "LEVEL_UP") {
      const level = effect.level;
      const era = effect.era;
      addNotice(`Новый уровень ${level}! Открыта «эра: ${era}».`);
      pushGift({
        name: PROGRESSION_CONFIG.economy.levelGiftName,
        hint: PROGRESSION_CONFIG.economy.levelGiftHint,
        coins: PROGRESSION_CONFIG.economy.levelGiftAc,
      });
      continue;
    }
    if (effect.type === "ACHIEVEMENT_UNLOCKED") {
      if (effect.frameId) {
        const frameId = effect.frameId;
        const profile = profileStore.get();
        if (!profile.purchased.includes(frameId)) {
          updateProfile({ purchased: [...profile.purchased, frameId] });
        }
      }
      const id = effect.id;
      const def = PROGRESSION_CONFIG.achievements.find((item) => item.id === id);
      const xp = effect.xp;
      const ac = effect.ac;
      if (def) {
        addNotice(`Достижение «${def.name}» получено${rewardText(xp, ac)}.`);
      }
      continue;
    }
    if (effect.type === "TAG_UNLOCKED") {
      const tagId = effect.tagId;
      const def = PROGRESSION_CONFIG.tags.find((item) => item.id === tagId);
      if (def) addNotice(`Открыт тег «${def.name}».`);
      continue;
    }
    if (effect.type !== "ITEM_GRANTED") continue;
    if (effect.kind === "tag" || effect.kind === "service") continue;
    const itemId = effect.itemId;
    const profile = profileStore.get();
    if (!profile.purchased.includes(itemId)) {
      updateProfile({ purchased: [...profile.purchased, itemId] });
    }
  }
}

/** « (+25 XP, +10 AC)» — хвост для текста уведомления */
function rewardText(xp: number, ac: number): string {
  const parts: string[] = [];
  if (xp > 0) parts.push(`+${xp} XP`);
  if (ac > 0) parts.push(`+${ac} AC`);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

function notify(effects: ProgressEffect[], event: DomainEvent): void {
  for (const listener of effectListeners) {
    try {
      listener(effects, event);
    } catch {
      // слушатель не должен ломать обработку события
    }
  }
}

/** Подписка на эффекты движка (тосты, журнал) */
export function subscribeEffects(listener: EffectListener): () => void {
  effectListeners.add(listener);
  return () => {
    effectListeners.delete(listener);
  };
}

/* -------------------------------- emit ---------------------------------- */

/** Обработать одно событие: валидация → движок → запись → эффекты */
export function emit(event: DomainEvent): EmitResult {
  const st = ensureInit();
  const cfg = PROGRESSION_CONFIG;
  const now = Date.now();
  const current = st.get();
  const tz = current.progress.tz || systemTz();
  const invalid = prevalidate(event);
  const extras = event.type === "BATTLEPASS_CLAIMED" ? battlepassExtras() : undefined;
  // Подписка ускоряет квесты и бонус за вход, а ещё покрывает одну смену
  // ника и одну смену цвета. Аккаунт читается на границе, а не внутри
  // движка: клиент это значение в событие не передаёт
  const premium = isPremiumActive(readAccount());
  const earnedMult = premium ? PREMIUM_QUEST_MULT : 1;
  const ctx: EngineCtx = { now, tz, userId: current.progress.userId, premium };
  let result: EngineResult = invalid
    ? noteRejection(current, event.type, invalid, ctx, cfg)
    : applyEvent(current, event, externalMetrics(), ctx, cfg, extras, earnedMult);

  // Заполнение профиля: как только выполнены все внешние критерии,
  // сервис сам добирает событие PROFILE_COMPLETED (разовое правило
  // заполняющего бакета), не заставляя UI считать проценты.
  if (
    event.type === "PROFILE_FIELD" &&
    !invalid &&
    externalMetrics().PROFILE_PERCENT >= 100
  ) {
    const chain = applyEvent(
      result.doc,
      { type: "PROFILE_COMPLETED" },
      externalMetrics(),
      ctx,
      cfg,
      extras,
    );
    result = {
      doc: chain.doc,
      effects: [...result.effects, ...chain.effects],
      rejected: chain.rejected ?? result.rejected,
    };
  }

  st.set(result.doc);
  applySideEffects(result.effects);
  if (result.effects.length) notify(result.effects, event);

  return { effects: result.effects, rejected: result.rejected, doc: result.doc };
}

/** Ежедневный вход/серия (идемпотентно внутри движка: один раз в сутки) */
export function startProgression(): EmitResult {
  return emit({ type: "SESSION_START" });
}

/** Синхронный доступ к документу (вне React: dev-панель, тесты) */
export function getProgress(): ProgressDoc {
  return ensureInit().get();
}

/**
 * Перенос легаси-прироста без перезагрузки: забирание подарка за уровень
 * пишет `profile.coins` (это и есть AC старой системы), и баланс обновляется
 * той же gain-only дельтой `meta.legacy`, что и при следующем визите —
 * второго начисления не будет, baseline сдвигается той же записью.
 */
export function syncLegacyDelta(): void {
  const st = ensureInit();
  const current = st.get();
  const merged = mergeLegacyDelta(current, Date.now());
  if (merged !== current) st.set(merged);
}

/**
 * Снапшот метрик для UI (прогресс достижений §12.2): та же функция
 * `resolveMetrics`, что у движка, — раздел «Достижения» показывает ровно
 * те цифры, по которым будет разблокировано.
 */
export function collectMetrics(): Record<string, number> {
  const st = ensureInit();
  return resolveMetrics(st.get(), externalMetrics(), PROGRESSION_CONFIG);
}
