/**
 * Админ-панель: сводка, пользователи, жалобы и модерация чата.
 * Вызывать только после проверки роли `admin` (см. `requireAdmin`).
 */

import { num, str, type Database } from "./sqlite";
import type { UserRow } from "./users";

export const isAdmin = (user: UserRow | null): user is UserRow => user?.role === "admin";

export function stats(db: Database, now = Date.now()) {
  const count = (sql: string, ...args: (string | number)[]) => num(db.prepare(sql).get(...args)?.c);
  return {
    users: count("SELECT COUNT(*) AS c FROM users"),
    newToday: count("SELECT COUNT(*) AS c FROM users WHERE created_at > ?", now - 86_400_000),
    newWeek: count("SELECT COUNT(*) AS c FROM users WHERE created_at > ?", now - 7 * 86_400_000),
    online: count("SELECT COUNT(*) AS c FROM users WHERE last_seen_at > ?", now - 5 * 60_000),
    premium: count("SELECT COUNT(*) AS c FROM users WHERE premium_until > ?", now),
    banned: count("SELECT COUNT(*) AS c FROM users WHERE banned_until > ?", now),
    comments: count("SELECT COUNT(*) AS c FROM comments"),
    chatMessages: count("SELECT COUNT(*) AS c FROM chat_messages"),
    openReports: count("SELECT COUNT(*) AS c FROM reports WHERE status = 'open'"),
    rooms: count("SELECT COUNT(*) AS c FROM watch_rooms"),
  };
}

export interface AdminUser {
  id: number;
  nickname: string;
  email: string;
  role: string;
  premiumUntil: number;
  bannedUntil: number;
  createdAt: number;
  lastSeenAt: number;
  level: number;
  xp: number;
}

export function listUsers(db: Database, query: string, limit = 50): AdminUser[] {
  const q = `%${query.trim().replace(/[%_]/g, "")}%`;
  return db
    .prepare(
      `SELECT u.id, u.nickname, u.email, u.role, u.premium_until, u.banned_until, u.created_at, u.last_seen_at,
              COALESCE(ps.level, 1) AS level, COALESCE(ps.xp_total, 0) AS xp
       FROM users u LEFT JOIN player_stats ps ON ps.user_id = u.id
       WHERE u.nickname LIKE ? OR u.email LIKE ?
       ORDER BY u.id DESC LIMIT ?`,
    )
    .all(q, q, Math.min(Math.max(limit, 1), 100))
    .map((row) => ({
      id: num(row.id),
      nickname: str(row.nickname),
      email: str(row.email),
      role: str(row.role, "user"),
      premiumUntil: num(row.premium_until),
      bannedUntil: num(row.banned_until),
      createdAt: num(row.created_at),
      lastSeenAt: num(row.last_seen_at),
      level: num(row.level, 1),
      xp: num(row.xp),
    }));
}

export type AdminResult = { ok: true } | { ok: false; error: string };

export function setBan(db: Database, admin: UserRow, userId: number, days: number, now = Date.now()): AdminResult {
  if (userId === admin.id) return { ok: false, error: "Нельзя заблокировать себя" };
  const target = db.prepare("SELECT role FROM users WHERE id = ?").get(userId);
  if (!target) return { ok: false, error: "Пользователь не найден" };
  if (str(target.role) === "admin") return { ok: false, error: "Администратора заблокировать нельзя" };
  const until = days > 0 ? now + Math.min(days, 3650) * 86_400_000 : 0;
  db.prepare("UPDATE users SET banned_until = ? WHERE id = ?").run(until, userId);
  if (until > 0) db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  return { ok: true };
}

/** Выдать (days > 0) или снять (days = 0) Premium */
export function setPremiumDays(db: Database, userId: number, days: number, now = Date.now()): AdminResult {
  const row = db.prepare("SELECT premium_until, premium_since, premium_total_days FROM users WHERE id = ?").get(userId);
  if (!row) return { ok: false, error: "Пользователь не найден" };
  if (days <= 0) {
    db.prepare("UPDATE users SET premium_until = 0 WHERE id = ?").run(userId);
    return { ok: true };
  }
  const add = Math.min(Math.round(days), 3650);
  const base = Math.max(num(row.premium_until), now);
  db.prepare("UPDATE users SET premium_until = ?, premium_since = ?, premium_total_days = ? WHERE id = ?").run(
    base + add * 86_400_000,
    num(row.premium_since) || now,
    num(row.premium_total_days) + add,
    userId,
  );
  return { ok: true };
}

export function setRole(db: Database, admin: UserRow, userId: number, role: string): AdminResult {
  if (!["user", "moderator"].includes(role)) return { ok: false, error: "Допустимы роли user и moderator" };
  if (userId === admin.id) return { ok: false, error: "Свою роль менять нельзя" };
  const target = db.prepare("SELECT role FROM users WHERE id = ?").get(userId);
  if (!target) return { ok: false, error: "Пользователь не найден" };
  if (str(target.role) === "admin") return { ok: false, error: "Роль администратора менять нельзя" };
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
  return { ok: true };
}

export function recentChat(db: Database, limit = 60) {
  return db
    .prepare("SELECT id, user_id, nickname, body, created_at FROM chat_messages ORDER BY id DESC LIMIT ?")
    .all(Math.min(Math.max(limit, 1), 200))
    .map((row) => ({
      id: num(row.id),
      userId: num(row.user_id),
      nickname: str(row.nickname),
      body: str(row.body),
      createdAt: num(row.created_at),
    }));
}

export function deleteChatMessage(db: Database, id: number): AdminResult {
  const info = db.prepare("DELETE FROM chat_messages WHERE id = ?").run(id);
  return num(info.changes) > 0 ? { ok: true } : { ok: false, error: "Сообщение не найдено" };
}
