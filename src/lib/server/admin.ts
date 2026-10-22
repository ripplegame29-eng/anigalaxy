/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Админ-панель: сводка, пользователи, жалобы и модерация чата.
 * Вызывать только после проверки роли `admin` (см. `requireAdmin`).
 */

import { num, str, type Database } from "./sqlite";
import { errorCounts } from "./errors";
import { PROFILE_DOC_KEY } from "./admin-edit";
import { getDoc } from "./docs";
import { PROGRESS_DOC_KEY } from "../sync-keys";
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

/* ------------------------- Поиск и карточка игрока --------------------- */

export interface UserQuery {
  q?: string;
  /** all | premium | banned | online | staff | new */
  filter?: string;
  /** new | xp | seen | ac */
  sort?: string;
  offset?: number;
  limit?: number;
}

export function searchUsers(db: Database, query: UserQuery, now = Date.now()): { users: AdminUser[]; total: number } {
  const q = `%${(query.q ?? "").trim().replace(/[%_]/g, "")}%`;
  const where = ["(u.nickname LIKE ? OR u.email LIKE ? OR CAST(u.id AS TEXT) = ?)"];
  const args: (string | number)[] = [q, q, (query.q ?? "").trim()];
  switch (query.filter) {
    case "premium":
      where.push("u.premium_until > ?");
      args.push(now);
      break;
    case "banned":
      where.push("u.banned_until > ?");
      args.push(now);
      break;
    case "online":
      where.push("u.last_seen_at > ?");
      args.push(now - 5 * 60_000);
      break;
    case "staff":
      where.push("u.role IN ('admin','moderator')");
      break;
    case "new":
      where.push("u.created_at > ?");
      args.push(now - 7 * 86_400_000);
      break;
  }
  const order =
    ({ xp: "COALESCE(ps.xp_total,0) DESC", seen: "u.last_seen_at DESC", ac: "COALESCE(ps.ac_balance,0) DESC", new: "u.id DESC" } as Record<string, string>)[
      query.sort ?? "new"
    ] ?? "u.id DESC";
  const clause = where.join(" AND ");
  const total = num(
    db.prepare(`SELECT COUNT(*) AS c FROM users u WHERE ${clause}`).get(...args)?.c,
  );
  const limit = Math.min(Math.max(query.limit ?? 30, 1), 100);
  const offset = Math.max(query.offset ?? 0, 0);
  const users = db
    .prepare(
      `SELECT u.id, u.nickname, u.email, u.role, u.premium_until, u.banned_until, u.created_at, u.last_seen_at,
              COALESCE(ps.level, 1) AS level, COALESCE(ps.xp_total, 0) AS xp
       FROM users u LEFT JOIN player_stats ps ON ps.user_id = u.id
       WHERE ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`,
    )
    .all(...args, limit, offset)
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
  return { users, total };
}

function parseDocValue(db: Database, userId: number, key: string): Record<string, any> {
  const doc = getDoc(db, userId, key);
  if (!doc) return {};
  try {
    const v = JSON.parse(doc.value);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

/** Всё о игроке для редактора: аккаунт, баланс, косметика, достижения, журнал наград */
export function userDetail(db: Database, id: number) {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!row) return null;
  const progress = parseDocValue(db, id, PROGRESS_DOC_KEY);
  const profile = parseDocValue(db, id, PROFILE_DOC_KEY);
  const p = (progress.progress ?? {}) as Record<string, unknown>;
  const count = (sql: string) => num(db.prepare(sql).get(id)?.c);
  const ledger = Array.isArray(progress.ledger) ? (progress.ledger as Record<string, unknown>[]).slice(-25).reverse() : [];
  return {
    user: {
      id,
      nickname: str(row.nickname),
      displayName: str(row.display_name),
      email: str(row.email),
      role: str(row.role, "user"),
      telegram: str(row.telegram_id),
      premiumUntil: num(row.premium_until),
      premiumTotalDays: num(row.premium_total_days),
      bannedUntil: num(row.banned_until),
      createdAt: num(row.created_at),
      lastSeenAt: num(row.last_seen_at),
    },
    balance: {
      xp: num(p.xpTotal),
      level: num(p.level, 1),
      ac: num(p.acBalance),
      trophy: num(p.trophyPoints),
      streak: num(p.streakCurrent),
      streakBest: num(p.streakBest),
      freezes: num(p.streakFreezes),
      battlepassXp: num((progress.battlepass as Record<string, unknown> | undefined)?.xp),
      synced: Object.keys(progress).length > 0,
    },
    look: {
      frameId: str(profile.frameId),
      titleId: str(profile.titleId),
      backgroundId: str(profile.backgroundId),
      particleFx: str(profile.particleFx),
      decorFx: str(profile.decorFx),
      equippedTagId: typeof p.equippedTagId === "string" ? p.equippedTagId : "",
      hasAvatar: typeof profile.avatar === "string" && profile.avatar.length > 0,
      bio: str(profile.bio),
      signature: str(profile.signature),
    },
    owned: {
      purchased: Array.isArray(profile.purchased) ? (profile.purchased as string[]) : [],
      claimed: Array.isArray(profile.claimed) ? (profile.claimed as string[]) : [],
      tags: Object.keys((progress.tags ?? {}) as object),
      achievements: Object.keys((progress.achievements ?? {}) as object),
    },
    ledger,
    counts: {
      comments: count("SELECT COUNT(*) AS c FROM comments WHERE user_id = ? AND deleted = 0"),
      chat: count("SELECT COUNT(*) AS c FROM chat_messages WHERE user_id = ?"),
      sessions: count("SELECT COUNT(*) AS c FROM sessions WHERE user_id = ?"),
      reportsAgainst: num(
        db.prepare("SELECT COUNT(*) AS c FROM reports WHERE target_kind = 'user' AND target_id = ?").get(String(id))?.c,
      ),
      followers: count("SELECT COUNT(*) AS c FROM friendships WHERE friend_id = ? AND status = 'accepted'"),
    },
  };
}

/* ------------------------------ Сводка v2 ------------------------------ */

export function dashboard(db: Database, now = Date.now()) {
  const day = 86_400_000;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const series: { day: string; users: number; online: number }[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const from = start.getTime() - i * day;
    const users = num(db.prepare("SELECT COUNT(*) AS c FROM users WHERE created_at >= ? AND created_at < ?").get(from, from + day)?.c);
    const online = num(db.prepare("SELECT COUNT(*) AS c FROM users WHERE last_seen_at >= ? AND last_seen_at < ?").get(from, from + day)?.c);
    series.push({ day: new Date(from).toISOString().slice(5, 10), users, online });
  }
  const top = db
    .prepare(
      `SELECT u.id, u.nickname, ps.level, ps.xp_total, ps.ac_balance FROM player_stats ps JOIN users u ON u.id = ps.user_id
       ORDER BY ps.xp_total DESC LIMIT 5`,
    )
    .all()
    .map((r) => ({ id: num(r.id), nickname: str(r.nickname), level: num(r.level, 1), xp: num(r.xp_total), ac: num(r.ac_balance) }));
  const economy = db.prepare("SELECT COALESCE(SUM(ac_balance),0) AS ac, COALESCE(SUM(xp_total),0) AS xp FROM player_stats").get();
  const pages = num(db.prepare("PRAGMA page_count").get()?.page_count);
  const pageSize = num(db.prepare("PRAGMA page_size").get()?.page_size);
  const mem = process.memoryUsage();
  return {
    stats: stats(db, now),
    series,
    top,
    economy: { ac: num(economy?.ac), xp: num(economy?.xp) },
    errors: errorCounts(db, now),
    system: {
      uptimeSec: Math.round(process.uptime()),
      rssMb: Math.round(mem.rss / 1_048_576),
      heapMb: Math.round(mem.heapUsed / 1_048_576),
      dbMb: Math.round(((pages * pageSize) / 1_048_576) * 10) / 10,
      node: process.version,
    },
  };
}

/* ----------------------------- Журнал действий ------------------------- */

export function logAction(db: Database, admin: UserRow, action: string, targetId: number, targetName: string, detail: string, now = Date.now()): void {
  db.prepare(
    "INSERT INTO admin_log (admin_id, admin_name, action, target_id, target_name, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(admin.id, admin.nickname, action.slice(0, 40), targetId, targetName.slice(0, 60), detail.slice(0, 300), now);
  db.prepare("DELETE FROM admin_log WHERE id IN (SELECT id FROM admin_log ORDER BY id DESC LIMIT -1 OFFSET 3000)").run();
}

export function listLog(db: Database, limit = 100) {
  return db
    .prepare("SELECT * FROM admin_log ORDER BY id DESC LIMIT ?")
    .all(Math.min(Math.max(limit, 1), 300))
    .map((r) => ({
      id: num(r.id),
      admin: str(r.admin_name),
      action: str(r.action),
      targetId: num(r.target_id),
      target: str(r.target_name),
      detail: str(r.detail),
      at: num(r.created_at),
    }));
}

export function nicknameOf(db: Database, id: number): string {
  return str(db.prepare("SELECT nickname FROM users WHERE id = ?").get(id)?.nickname);
}

/* ------------------------ Комментарии и комнаты ------------------------ */

export function recentComments(db: Database, query: string, limit = 60) {
  const q = `%${query.trim().replace(/[%_]/g, "")}%`;
  return db
    .prepare(
      `SELECT c.id, c.title_id, c.body, c.created_at, c.deleted, u.id AS uid, u.nickname
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.deleted = 0 AND (c.body LIKE ? OR u.nickname LIKE ?) ORDER BY c.id DESC LIMIT ?`,
    )
    .all(q, q, Math.min(Math.max(limit, 1), 150))
    .map((r) => ({
      id: num(r.id),
      titleId: str(r.title_id),
      body: str(r.body),
      createdAt: num(r.created_at),
      userId: num(r.uid),
      nickname: str(r.nickname),
    }));
}

export function deleteComment(db: Database, id: number): AdminResult {
  const info = db.prepare("UPDATE comments SET deleted = 1 WHERE id = ? AND deleted = 0").run(id);
  return num(info.changes) > 0 ? { ok: true } : { ok: false, error: "Комментарий не найден" };
}

export function listRooms(db: Database, now = Date.now()) {
  return db
    .prepare(
      `SELECT r.id, r.code, r.title, r.anime, r.access, r.episode, r.created_at,
              (SELECT COUNT(*) FROM watch_room_members m WHERE m.room_id = r.id AND m.seen_at > ?) AS live,
              (SELECT COUNT(*) FROM watch_room_members m WHERE m.room_id = r.id) AS members
       FROM watch_rooms r ORDER BY r.id DESC LIMIT 60`,
    )
    .all(now - 60_000)
    .map((r) => ({
      id: num(r.id),
      code: str(r.code),
      title: str(r.title),
      anime: str(r.anime),
      access: str(r.access),
      episode: num(r.episode),
      createdAt: num(r.created_at),
      live: num(r.live),
      members: num(r.members),
    }));
}

export function closeRoom(db: Database, id: number): AdminResult {
  const info = db.prepare("DELETE FROM watch_rooms WHERE id = ?").run(id);
  return num(info.changes) > 0 ? { ok: true } : { ok: false, error: "Комната не найдена" };
}
