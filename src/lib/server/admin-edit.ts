/**
 * Админ-панель, редакторы: профиль, баланс, выдача предметов, награды,
 * рассылки, пароли и удаление аккаунтов. Вызывать только после проверки роли admin.
 *
 * Данные игрока (прогресс, профиль) лежат в серверных копиях локальных
 * хранилищ — `user_docs`. Правим их напрямую и поднимаем версию, поэтому
 * клиент игрока при следующей синхронизации принимает изменения администратора.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { randomBytes } from "node:crypto";

import { PROGRESS_DOC_KEY } from "../sync-keys";
import { levelFromXp, totalXpFor } from "../progression/curve";
import { adminWriteDoc, getDoc } from "./docs";
import { hashPassword } from "./passwords";
import { num, str, type Database } from "./sqlite";
import type { UserRow } from "./users";

export const PROFILE_DOC_KEY = "animehub:profile:v1";

export type EditResult<T = true> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const done = <T,>(value: T): { ok: true; value: T } => ({ ok: true, value });

const ID_RE = /^[A-Za-z0-9_:.-]{1,80}$/;

function userExists(db: Database, id: number): UserRowLite | null {
  const row = db.prepare("SELECT id, nickname, role FROM users WHERE id = ?").get(id);
  return row ? { id: num(row.id), nickname: str(row.nickname), role: str(row.role, "user") } : null;
}
interface UserRowLite {
  id: number;
  nickname: string;
  role: string;
}

/* ----------------------------- Документы ------------------------------- */

function readDoc(db: Database, userId: number, key: string): any | null {
  const doc = getDoc(db, userId, key);
  if (!doc) return null;
  try {
    const parsed = JSON.parse(doc.value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function freshProgress(userId: number, now: number): any {
  return {
    schema: 1,
    progress: {
      userId: String(userId),
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
      createdAt: now,
    },
    counters: {},
    sets: { genres: [], genreTitles: {} },
    tags: {},
    achievements: {},
    purchases: [],
    ledger: [],
    flags: {},
    rate: { windowStart: 0, count: 0 },
    rejected: [],
  };
}

/** Изменить документ прогресса; создаёт пустой, если игрок ещё не синхронизировался */
export function editProgress(db: Database, userId: number, fn: (doc: any) => void, now = Date.now()): void {
  const doc = readDoc(db, userId, PROGRESS_DOC_KEY) ?? freshProgress(userId, now);
  doc.progress = doc.progress && typeof doc.progress === "object" ? doc.progress : freshProgress(userId, now).progress;
  doc.tags = doc.tags && typeof doc.tags === "object" ? doc.tags : {};
  doc.achievements = doc.achievements && typeof doc.achievements === "object" ? doc.achievements : {};
  doc.ledger = Array.isArray(doc.ledger) ? doc.ledger : [];
  fn(doc);
  adminWriteDoc(db, userId, PROGRESS_DOC_KEY, JSON.stringify(doc), now);
}

export function editProfile(db: Database, userId: number, fn: (profile: any) => void, now = Date.now()): void {
  const profile = readDoc(db, userId, PROFILE_DOC_KEY) ?? {};
  profile.purchased = Array.isArray(profile.purchased) ? profile.purchased : [];
  profile.claimed = Array.isArray(profile.claimed) ? profile.claimed : [];
  profile.notices = Array.isArray(profile.notices) ? profile.notices : [];
  fn(profile);
  adminWriteDoc(db, userId, PROFILE_DOC_KEY, JSON.stringify(profile), now);
}

function addLedger(doc: any, currency: "XP" | "AC", amount: number, admin: UserRow, note: string, now: number): void {
  if (!amount) return;
  const rand = randomBytes(4).toString("hex");
  doc.ledger.push({
    id: `admin-${now}-${rand}`,
    currency,
    type: "admin",
    source: "ADMIN",
    amount,
    status: "confirmed",
    idempotencyKey: `admin:${doc.progress.userId}:${now}:${rand}`,
    createdAt: now,
    metadata: { by: admin.nickname, note: note.slice(0, 120) },
  });
  if (doc.ledger.length > 400) doc.ledger.splice(0, doc.ledger.length - 400);
}

/** Уведомление в колокольчик игрока (хранится в документе профиля) */
export function pushNotice(profile: any, text: string, now: number): void {
  profile.notices.unshift({ id: `adm-${now}-${randomBytes(3).toString("hex")}`, text: text.slice(0, 300), at: now, read: false });
  if (profile.notices.length > 100) profile.notices.length = 100;
}

/* ------------------------------ Баланс --------------------------------- */

export interface BalanceInput {
  /** Прибавить (может быть отрицательным) */
  ac?: number;
  xp?: number;
  trophy?: number;
  freezes?: number;
  battlepassXp?: number;
  /** Задать точное значение вместо прибавки */
  setAc?: number;
  setXp?: number;
  setLevel?: number;
  setStreak?: number;
  setTrophy?: number;
  setFreezes?: number;
  note?: string;
  notify?: boolean;
}

const clampInt = (v: unknown, lo: number, hi: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : 0;
};
const has = (v: unknown): boolean => v !== undefined && v !== null && v !== "" && Number.isFinite(Number(v));

export function adjustBalance(db: Database, admin: UserRow, userId: number, input: BalanceInput, now = Date.now()): EditResult<string> {
  if (!userExists(db, userId)) return fail("Пользователь не найден");
  const parts: string[] = [];
  const note = (input.note ?? "").trim();
  editProgress(
    db,
    userId,
    (doc) => {
      const p = doc.progress;
      if (has(input.setLevel)) {
        const level = clampInt(input.setLevel, 1, 1000);
        p.xpTotal = totalXpFor(level);
        parts.push(`уровень → ${level}`);
      } else if (has(input.setXp)) {
        const before = num(p.xpTotal);
        p.xpTotal = clampInt(input.setXp, 0, 1_000_000_000);
        addLedger(doc, "XP", p.xpTotal - before, admin, note || "установка XP", now);
        parts.push(`XP → ${p.xpTotal}`);
      } else if (has(input.xp)) {
        const d = clampInt(input.xp, -1_000_000_000, 1_000_000_000);
        p.xpTotal = Math.max(0, num(p.xpTotal) + d);
        addLedger(doc, "XP", d, admin, note || "начисление XP", now);
        parts.push(`XP ${d > 0 ? "+" : ""}${d}`);
      }
      p.level = levelFromXp(num(p.xpTotal));

      if (has(input.setAc)) {
        const before = num(p.acBalance);
        p.acBalance = clampInt(input.setAc, 0, 1_000_000_000);
        addLedger(doc, "AC", p.acBalance - before, admin, note || "установка баланса", now);
        parts.push(`AC → ${p.acBalance}`);
      } else if (has(input.ac)) {
        const d = clampInt(input.ac, -1_000_000_000, 1_000_000_000);
        p.acBalance = Math.max(0, num(p.acBalance) + d);
        addLedger(doc, "AC", d, admin, note || "начисление AC", now);
        parts.push(`AC ${d > 0 ? "+" : ""}${d}`);
      }
      if (has(input.setTrophy)) {
        p.trophyPoints = clampInt(input.setTrophy, 0, 1_000_000_000);
        parts.push(`очки славы → ${p.trophyPoints}`);
      } else if (has(input.trophy)) {
        const d = clampInt(input.trophy, -1_000_000_000, 1_000_000_000);
        p.trophyPoints = Math.max(0, num(p.trophyPoints) + d);
        parts.push(`очки славы ${d > 0 ? "+" : ""}${d}`);
      }
      if (has(input.setFreezes)) {
        p.streakFreezes = clampInt(input.setFreezes, 0, 1000);
        parts.push(`заморозки → ${p.streakFreezes}`);
      } else if (has(input.freezes)) {
        p.streakFreezes = Math.max(0, num(p.streakFreezes) + clampInt(input.freezes, -1000, 1000));
        parts.push(`заморозки ${input.freezes}`);
      }
      if (has(input.setStreak)) {
        p.streakCurrent = clampInt(input.setStreak, 0, 100_000);
        p.streakBest = Math.max(num(p.streakBest), p.streakCurrent);
        parts.push(`серия → ${p.streakCurrent}`);
      }
      if (has(input.battlepassXp)) {
        doc.battlepass = doc.battlepass && typeof doc.battlepass === "object" ? doc.battlepass : { xp: 0, claimed: [], missions: [] };
        doc.battlepass.xp = Math.max(0, num(doc.battlepass.xp) + clampInt(input.battlepassXp, -10_000_000, 10_000_000));
        parts.push(`боевой пропуск ${input.battlepassXp}`);
      }
    },
    now,
  );
  if (!parts.length) return fail("Нечего менять");
  if (input.notify) {
    const gain = [has(input.ac) && Number(input.ac) > 0 ? `+${Math.round(Number(input.ac))} AC` : "", has(input.xp) && Number(input.xp) > 0 ? `+${Math.round(Number(input.xp))} XP` : ""]
      .filter(Boolean)
      .join(" ");
    if (gain) editProfile(db, userId, (profile) => pushNotice(profile, `Администрация начислила ${gain}${note ? `. ${note}` : ""}`, now), now);
  }
  return done(parts.join(", "));
}

/* ----------------------------- Предметы -------------------------------- */

export type ItemKind = "frame" | "background" | "title" | "effect" | "decor" | "tag" | "achievement" | "claimed";
const OWNED_KINDS: ItemKind[] = ["frame", "background", "title", "effect", "decor"];

export function setItem(
  db: Database,
  admin: UserRow,
  userId: number,
  kind: string,
  itemId: string,
  grant: boolean,
  opts: { equip?: boolean; progress?: number; notify?: boolean; label?: string } = {},
  now = Date.now(),
): EditResult<string> {
  if (!userExists(db, userId)) return fail("Пользователь не найден");
  if (!ID_RE.test(itemId)) return fail("Некорректный id предмета");
  const label = (opts.label ?? itemId).slice(0, 80);

  if (OWNED_KINDS.includes(kind as ItemKind)) {
    editProfile(
      db,
      userId,
      (profile) => {
        const set = new Set<string>(profile.purchased);
        if (grant) set.add(itemId);
        else set.delete(itemId);
        profile.purchased = [...set];
        if (kind === "frame") {
          if (grant && opts.equip) profile.frameId = itemId;
          if (!grant && profile.frameId === itemId) profile.frameId = "";
        }
        if (kind === "title") {
          if (grant && opts.equip) profile.titleId = itemId;
          if (!grant && profile.titleId === itemId) profile.titleId = "";
        }
        if (kind === "background") {
          if (grant && opts.equip) profile.backgroundId = itemId;
          if (!grant && profile.backgroundId === itemId) profile.backgroundId = "preset-dusk";
        }
        if (kind === "effect" && !grant && profile.particleFx === itemId) profile.particleFx = "";
        if (kind === "decor" && !grant && profile.decorFx === itemId) profile.decorFx = "";
        if (grant && opts.notify) pushNotice(profile, `Администрация выдала вам «${label}»`, now);
      },
      now,
    );
    return done(`${grant ? "выдан" : "отозван"}: ${label}`);
  }

  if (kind === "claimed") {
    editProfile(
      db,
      userId,
      (profile) => {
        const set = new Set<string>(profile.claimed);
        if (grant) set.add(itemId);
        else set.delete(itemId);
        profile.claimed = [...set];
        if (grant && opts.notify) pushNotice(profile, `Достижение «${label}» получено`, now);
      },
      now,
    );
    return done(`${grant ? "засчитано" : "снято"} достижение: ${label}`);
  }

  if (kind === "tag") {
    editProgress(
      db,
      userId,
      (doc) => {
        if (grant) {
          doc.tags[itemId] = { acquiredAt: now, source: "admin" };
          if (opts.equip) doc.progress.equippedTagId = itemId;
        } else {
          delete doc.tags[itemId];
          if (doc.progress.equippedTagId === itemId) doc.progress.equippedTagId = null;
        }
      },
      now,
    );
    if (grant && opts.notify) editProfile(db, userId, (profile) => pushNotice(profile, `Открыт тег «${label}»`, now), now);
    return done(`${grant ? "выдан" : "отозван"} тег: ${label}`);
  }

  if (kind === "achievement") {
    editProgress(
      db,
      userId,
      (doc) => {
        if (grant) {
          const prev = doc.achievements[itemId];
          doc.achievements[itemId] = {
            progress: has(opts.progress) ? clampInt(opts.progress, 0, 1_000_000_000) : num(prev?.progress, 1),
            unlockedAt: now,
            migrated: true,
          };
        } else delete doc.achievements[itemId];
      },
      now,
    );
    if (grant && opts.notify) editProfile(db, userId, (profile) => pushNotice(profile, `Достижение «${label}» получено`, now), now);
    return done(`${grant ? "выдано" : "снято"} достижение: ${label}`);
  }

  void admin;
  return fail("Неизвестный тип предмета");
}

/** Что сейчас надето: рамка, титул, фон, основной тег */
export function equipItem(db: Database, userId: number, kind: string, itemId: string, now = Date.now()): EditResult<string> {
  if (!userExists(db, userId)) return fail("Пользователь не найден");
  if (itemId && !ID_RE.test(itemId)) return fail("Некорректный id");
  if (kind === "tag") {
    editProgress(db, userId, (doc) => void (doc.progress.equippedTagId = itemId || null), now);
    return done("основной тег изменён");
  }
  const field = ({ frame: "frameId", title: "titleId", background: "backgroundId", effect: "particleFx", decor: "decorFx" } as Record<string, string>)[kind];
  if (!field) return fail("Неизвестный тип");
  editProfile(db, userId, (profile) => void (profile[field] = itemId), now);
  return done("изменено");
}

/* ------------------------------ Профиль -------------------------------- */

export interface AccountPatch {
  nickname?: string;
  displayName?: string;
  email?: string;
  bio?: string;
  signature?: string;
  resetAvatar?: boolean;
  clearBackground?: boolean;
}

export function updateAccount(db: Database, admin: UserRow, userId: number, patch: AccountPatch, now = Date.now()): EditResult<string> {
  const target = userExists(db, userId);
  if (!target) return fail("Пользователь не найден");
  if (target.role === "admin" && userId !== admin.id) return fail("Профиль другого администратора менять нельзя");
  const changed: string[] = [];

  if (typeof patch.nickname === "string" && patch.nickname.trim() && patch.nickname.trim() !== target.nickname) {
    const nick = patch.nickname.trim();
    if (!/^[\p{L}\p{N}_.-]{3,24}$/u.test(nick)) return fail("Ник: 3–24 символа — буквы, цифры, _ . -");
    const taken = db.prepare("SELECT id FROM users WHERE nickname = ? AND id != ?").get(nick, userId);
    if (taken) return fail("Такой ник уже занят");
    db.prepare("UPDATE users SET nickname = ? WHERE id = ?").run(nick, userId);
    changed.push(`ник → ${nick}`);
  }
  if (typeof patch.displayName === "string") {
    db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(patch.displayName.trim().slice(0, 40), userId);
    changed.push("отображаемое имя");
  }
  if (typeof patch.email === "string" && patch.email.trim()) {
    const email = patch.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return fail("Некорректная почта");
    const taken = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(email, userId);
    if (taken) return fail("Эта почта уже используется");
    db.prepare("UPDATE users SET email = ? WHERE id = ?").run(email, userId);
    changed.push("почта");
  }
  if (patch.bio !== undefined || patch.signature !== undefined || patch.resetAvatar || patch.clearBackground) {
    editProfile(
      db,
      userId,
      (profile) => {
        if (typeof patch.bio === "string") profile.bio = patch.bio.slice(0, 500);
        if (typeof patch.signature === "string") profile.signature = patch.signature.slice(0, 80);
        if (patch.resetAvatar) {
          profile.avatar = "";
          profile.avatarHistory = [];
        }
        if (patch.clearBackground) profile.backgroundCustom = "";
      },
      now,
    );
    if (patch.bio !== undefined) changed.push("описание");
    if (patch.signature !== undefined) changed.push("подпись");
    if (patch.resetAvatar) changed.push("аватар сброшен");
    if (patch.clearBackground) changed.push("свой фон убран");
  }
  if (!changed.length) return fail("Нечего менять");
  return done(changed.join(", "));
}

/* ------------------------ Безопасность и удаление ---------------------- */

export function resetPassword(db: Database, admin: UserRow, userId: number, password?: string): EditResult<string> {
  const target = userExists(db, userId);
  if (!target) return fail("Пользователь не найден");
  if (target.role === "admin" && userId !== admin.id) return fail("Пароль администратора менять нельзя");
  const next = password && password.length >= 6 ? password : randomBytes(6).toString("base64url");
  if (next.length > 72) return fail("Пароль — до 72 символов");
  db.prepare("UPDATE users SET pass_hash = ? WHERE id = ?").run(hashPassword(next), userId);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  return done(next);
}

export function killSessions(db: Database, userId: number): EditResult<number> {
  if (!userExists(db, userId)) return fail("Пользователь не найден");
  return done(num(db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId).changes));
}

export function deleteUser(db: Database, admin: UserRow, userId: number): EditResult<string> {
  if (userId === admin.id) return fail("Нельзя удалить себя");
  const target = userExists(db, userId);
  if (!target) return fail("Пользователь не найден");
  if (target.role === "admin") return fail("Администратора удалить нельзя");
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  return done(target.nickname);
}

/* ------------------------ Рассылки и массовые выдачи ------------------- */

export type Audience = "all" | "premium" | "online" | "active7" | "new7" | "free";

export function audienceIds(db: Database, audience: string, now = Date.now()): number[] {
  const base = "SELECT id FROM users WHERE banned_until <= ?";
  const day = 86_400_000;
  const where: Record<string, [string, number[]]> = {
    all: ["", []],
    premium: [" AND premium_until > ?", [now]],
    free: [" AND premium_until <= ?", [now]],
    online: [" AND last_seen_at > ?", [now - 5 * 60_000]],
    active7: [" AND last_seen_at > ?", [now - 7 * day]],
    new7: [" AND created_at > ?", [now - 7 * day]],
  };
  const [clause, args] = where[audience] ?? where.all;
  return db
    .prepare(`${base}${clause} LIMIT 5000`)
    .all(now, ...args)
    .map((row) => num(row.id));
}

export function broadcast(db: Database, audience: string, text: string, now = Date.now()): EditResult<number> {
  const body = text.trim();
  if (body.length < 2) return fail("Введите текст сообщения");
  const ids = audienceIds(db, audience, now);
  for (const id of ids) editProfile(db, id, (profile) => pushNotice(profile, body, now), now);
  return done(ids.length);
}

export function massGrant(
  db: Database,
  admin: UserRow,
  audience: string,
  input: { ac?: number; xp?: number; premiumDays?: number; note?: string; notify?: boolean },
  now = Date.now(),
): EditResult<number> {
  const ids = audienceIds(db, audience, now);
  if (!ids.length) return fail("В этой аудитории никого нет");
  if (!has(input.ac) && !has(input.xp) && !has(input.premiumDays)) return fail("Укажите, что выдать");
  const days = has(input.premiumDays) ? clampInt(input.premiumDays, 0, 3650) : 0;
  for (const id of ids) {
    if (has(input.ac) || has(input.xp)) {
      adjustBalance(db, admin, id, { ac: input.ac, xp: input.xp, note: input.note || "массовая выдача", notify: input.notify }, now);
    }
    if (days > 0) {
      const row = db.prepare("SELECT premium_until, premium_since, premium_total_days FROM users WHERE id = ?").get(id);
      if (row) {
        db.prepare("UPDATE users SET premium_until = ?, premium_since = ?, premium_total_days = ? WHERE id = ?").run(
          Math.max(num(row.premium_until), now) + days * 86_400_000,
          num(row.premium_since) || now,
          num(row.premium_total_days) + days,
          id,
        );
      }
    }
  }
  return done(ids.length);
}

/** Отправить одному игроку личное сообщение от администрации */
export function notifyUser(db: Database, userId: number, text: string, now = Date.now()): EditResult {
  if (!userExists(db, userId)) return fail("Пользователь не найден");
  if (text.trim().length < 2) return fail("Введите текст сообщения");
  editProfile(db, userId, (profile) => pushNotice(profile, text.trim(), now), now);
  return done(true);
}
