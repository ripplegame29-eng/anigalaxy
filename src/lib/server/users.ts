/**
 * Аккаунты и сессии.
 *
 * Токен сессии отдаётся браузеру в httpOnly-cookie, а в базе хранится только
 * его SHA-256: утечка файла базы не даёт готовых входов.
 */

import { createHash, randomBytes } from "node:crypto";

import { hashPassword, verifyPassword } from "./passwords";
import { num, str, type Database } from "./sqlite";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = "ag_session";

const NICKNAME_RE = /^[A-Za-z0-9А-Яа-яЁё_-]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-zА-Яа-я]{2,}$/;

export interface UserRow {
  id: number;
  nickname: string;
  displayName: string;
  email: string;
  role: string;
  telegramId: string | null;
  premiumUntil: number;
  premiumSince: number;
  premiumTotalDays: number;
  createdAt: number;
  bannedUntil: number;
}

/** Что отдаём браузеру об аккаунте (без хэша пароля) */
export interface PublicAccount {
  id: number;
  nickname: string;
  displayName: string;
  email: string;
  role: string;
  premiumUntil: number;
  premiumSince: number;
  premiumTotalDays: number;
  createdAt: number;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string; code: string };

function fail<T>(error: string, code: string): Result<T> {
  return { ok: false, error, code };
}

function toUser(row: Record<string, unknown>): UserRow {
  return {
    id: num(row.id),
    nickname: str(row.nickname),
    displayName: str(row.display_name),
    email: str(row.email),
    role: str(row.role, "user"),
    telegramId: row.telegram_id === null || row.telegram_id === undefined ? null : str(row.telegram_id),
    premiumUntil: num(row.premium_until),
    premiumSince: num(row.premium_since),
    premiumTotalDays: num(row.premium_total_days),
    createdAt: num(row.created_at),
    bannedUntil: num(row.banned_until),
  };
}

export function toPublic(user: UserRow): PublicAccount {
  return {
    id: user.id,
    nickname: user.nickname,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    premiumUntil: user.premiumUntil,
    premiumSince: user.premiumSince,
    premiumTotalDays: user.premiumTotalDays,
    createdAt: user.createdAt,
  };
}

export function validateRegistration(nickname: string, email: string, password: string): string | null {
  if (!NICKNAME_RE.test(nickname)) {
    return "Никнейм: 3–32 символа — буквы, цифры, _ и -";
  }
  if (!EMAIL_RE.test(email)) return "Введите корректную почту";
  if (password.length < 6) return "Пароль — минимум 6 символов";
  if (password.length > 72) return "Пароль — не длиннее 72 символов";
  return null;
}

export function findUserById(db: Database, id: number): UserRow | null {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  return row ? toUser(row) : null;
}

export function findUserByLogin(db: Database, login: string): UserRow | null {
  const row = db
    .prepare("SELECT * FROM users WHERE nickname = ? OR email = ? LIMIT 1")
    .get(login.trim(), login.trim());
  return row ? toUser(row) : null;
}

export function findUserByNickname(db: Database, nickname: string): UserRow | null {
  const row = db.prepare("SELECT * FROM users WHERE nickname = ?").get(nickname.trim());
  return row ? toUser(row) : null;
}

export function registerUser(
  db: Database,
  input: { nickname: string; email: string; password: string; now?: number },
): Result<UserRow> {
  const nickname = input.nickname.trim();
  const email = input.email.trim();
  const problem = validateRegistration(nickname, email, input.password);
  if (problem) return fail(problem, "invalid");

  if (db.prepare("SELECT 1 FROM users WHERE nickname = ?").get(nickname)) {
    return fail("Это имя уже занято — попробуйте другое", "nickname_taken");
  }
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) {
    return fail("Эта почта уже зарегистрирована", "email_taken");
  }

  const now = input.now ?? Date.now();
  const info = db
    .prepare("INSERT INTO users (nickname, email, pass_hash, created_at) VALUES (?, ?, ?, ?)")
    .run(nickname, email, hashPassword(input.password), now);
  const user = findUserById(db, num(info.lastInsertRowid));
  return user ? { ok: true, value: user } : fail("Не удалось создать аккаунт", "internal");
}

/** Проверка входа (никнейм или почта + пароль) */
export function verifyLogin(db: Database, login: string, password: string, now = Date.now()): Result<UserRow> {
  const trimmed = login.trim();
  if (!trimmed || !password) return fail("Введите никнейм или почту и пароль", "invalid");
  const row = db
    .prepare("SELECT * FROM users WHERE nickname = ? OR email = ? LIMIT 1")
    .get(trimmed, trimmed);
  if (!row) return fail("Неверный никнейм или пароль", "no_user");
  const user = toUser(row);
  if (!verifyPassword(password, str(row.pass_hash))) {
    return fail("Неверный никнейм или пароль", "bad_password");
  }
  if (user.bannedUntil > now) return fail("Аккаунт заблокирован", "banned");
  return { ok: true, value: user };
}

/** Сменить пароль (старый обязателен) */
export function changeUserPassword(
  db: Database,
  userId: number,
  current: string,
  next: string,
): Result<true> {
  const row = db.prepare("SELECT pass_hash FROM users WHERE id = ?").get(userId);
  if (!row || !verifyPassword(current, str(row.pass_hash))) {
    return fail("Текущий пароль неверный", "bad_password");
  }
  if (next.length < 6 || next.length > 72) return fail("Пароль — от 6 до 72 символов", "invalid");
  db.prepare("UPDATE users SET pass_hash = ? WHERE id = ?").run(hashPassword(next), userId);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  return { ok: true, value: true };
}

/** Вход через Telegram: найти по telegram_id или создать аккаунт */
export function upsertTelegramUser(
  db: Database,
  input: { telegramId: string; nickname: string; now?: number },
): Result<UserRow> {
  const existing = db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(input.telegramId);
  if (existing) return { ok: true, value: toUser(existing) };

  const base = input.nickname.replace(/[^A-Za-z0-9А-Яа-яЁё_-]/g, "_").slice(0, 28) || "tg";
  let nickname = base.length >= 3 ? base : `${base}_tg`;
  for (let i = 0; i < 20; i += 1) {
    if (!db.prepare("SELECT 1 FROM users WHERE nickname = ?").get(nickname)) break;
    nickname = `${base.slice(0, 24)}_${Math.floor(Math.random() * 9000 + 1000)}`;
  }
  const email = `${input.telegramId}@t.me`;
  const now = input.now ?? Date.now();
  const info = db
    .prepare(
      "INSERT INTO users (nickname, email, pass_hash, telegram_id, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(nickname, email, hashPassword(randomBytes(24).toString("hex")), input.telegramId, now);
  const user = findUserById(db, num(info.lastInsertRowid));
  return user ? { ok: true, value: user } : fail("Не удалось создать аккаунт", "internal");
}

/* ------------------------------ Сессии -------------------------------- */

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSession(
  db: Database,
  userId: number,
  meta: { userAgent?: string; ip?: string; now?: number } = {},
): { token: string; expiresAt: number } {
  const now = meta.now ?? Date.now();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = now + SESSION_TTL_MS;
  db.prepare(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at, user_agent, ip) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(tokenHash(token), userId, now, expiresAt, (meta.userAgent ?? "").slice(0, 200), (meta.ip ?? "").slice(0, 64));
  db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").run(now, userId);
  // Просроченные сессии чистим по пути — отдельная задача не нужна
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
  return { token, expiresAt };
}

/** Пользователь по токену сессии (или null, если токен неверный/просрочен) */
export function sessionUser(db: Database, token: string | undefined | null, now = Date.now()): UserRow | null {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(tokenHash(token), now);
  if (!row) return null;
  const user = toUser(row);
  return user.bannedUntil > now ? null : user;
}

export function destroySession(db: Database, token: string | undefined | null): void {
  if (!token) return;
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
}

/* ---------------------- Ограничение попыток входа --------------------- */

const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

/** Можно ли пробовать войти (не больше 10 неудач за 10 минут на ключ) */
export function loginAllowed(db: Database, key: string, now = Date.now()): boolean {
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM login_attempts WHERE key = ? AND at > ?")
    .get(key, now - ATTEMPT_WINDOW_MS);
  return num(row?.c) < MAX_ATTEMPTS;
}

export function recordLoginFailure(db: Database, key: string, now = Date.now()): void {
  db.prepare("INSERT INTO login_attempts (key, at) VALUES (?, ?)").run(key, now);
  db.prepare("DELETE FROM login_attempts WHERE at < ?").run(now - ATTEMPT_WINDOW_MS);
}

export function clearLoginFailures(db: Database, key: string): void {
  db.prepare("DELETE FROM login_attempts WHERE key = ?").run(key);
}
