/** Тикет-система поддержки: обращения игроков и ответы администрации */

import { num, str, transaction, type Database } from "./sqlite";

export const CATEGORIES = ["account", "payment", "bug", "content", "idea", "other"] as const;
export type TicketCategory = (typeof CATEGORIES)[number];
export type TicketStatus = "open" | "answered" | "closed";

const MAX_OPEN = 5;

export interface TicketRow {
  id: number;
  subject: string;
  category: string;
  status: TicketStatus;
  createdAt: number;
  updatedAt: number;
  unread: boolean;
  /** Только для списка администратора */
  nickname?: string;
  userId?: number;
}
export interface TicketMessage {
  id: number;
  isStaff: boolean;
  body: string;
  createdAt: number;
}
type Result<T> = { ok: true; value: T } | { ok: false; error: string; code?: string };
const fail = (error: string, code = "invalid"): { ok: false; error: string; code: string } => ({ ok: false, error, code });

function toTicket(row: Record<string, unknown>, staff: boolean): TicketRow {
  const t: TicketRow = {
    id: num(row.id),
    subject: str(row.subject),
    category: str(row.category),
    status: str(row.status, "open") as TicketStatus,
    createdAt: num(row.created_at),
    updatedAt: num(row.updated_at),
    unread: num(staff ? row.staff_unread : row.user_unread) > 0,
  };
  if (staff) {
    t.nickname = str(row.nickname);
    t.userId = num(row.user_id);
  }
  return t;
}

export function createTicket(
  db: Database,
  userId: number,
  input: { subject: string; category: string; body: string },
  now = Date.now(),
): Result<number> {
  const subject = input.subject.trim().replace(/\s+/g, " ").slice(0, 90);
  const body = input.body.trim().slice(0, 2000);
  const category = (CATEGORIES as readonly string[]).includes(input.category) ? input.category : "other";
  if (subject.length < 4) return fail("Тема: минимум 4 символа");
  if (body.length < 10) return fail("Опишите проблему подробнее: минимум 10 символов");
  const open = num(db.prepare("SELECT COUNT(*) AS c FROM tickets WHERE user_id = ? AND status <> 'closed'").get(userId)?.c);
  if (open >= MAX_OPEN) return fail(`Одновременно можно держать до ${MAX_OPEN} открытых обращений. Закройте решённые`, "limit");
  const recent = num(db.prepare("SELECT COUNT(*) AS c FROM tickets WHERE user_id = ? AND created_at > ?").get(userId, now - 60_000)?.c);
  if (recent >= 1) return fail("Подождите минуту перед новым обращением", "rate_limit");
  return transaction(db, () => {
    const info = db
      .prepare("INSERT INTO tickets (user_id, subject, category, status, created_at, updated_at, user_unread, staff_unread) VALUES (?, ?, ?, 'open', ?, ?, 0, 1)")
      .run(userId, subject, category, now, now);
    const id = num(info.lastInsertRowid);
    db.prepare("INSERT INTO ticket_messages (ticket_id, author_id, is_staff, body, created_at) VALUES (?, ?, 0, ?, ?)").run(id, userId, body, now);
    return { ok: true as const, value: id };
  });
}

export function listUserTickets(db: Database, userId: number): TicketRow[] {
  return db
    .prepare("SELECT * FROM tickets WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50")
    .all(userId)
    .map((r) => toTicket(r, false));
}

export function unreadForUser(db: Database, userId: number): number {
  return num(db.prepare("SELECT COUNT(*) AS c FROM tickets WHERE user_id = ? AND user_unread > 0").get(userId)?.c);
}

/** Тикет с перепиской; владелец (или staff) открывает — отметка «прочитано» снимается */
export function getTicket(db: Database, ticketId: number, viewer: { id: number; staff: boolean }): Result<{ ticket: TicketRow; messages: TicketMessage[] }> {
  const row = db.prepare("SELECT t.*, u.nickname FROM tickets t JOIN users u ON u.id = t.user_id WHERE t.id = ?").get(ticketId);
  if (!row || (!viewer.staff && num(row.user_id) !== viewer.id)) return fail("Обращение не найдено", "not_found");
  db.prepare(viewer.staff ? "UPDATE tickets SET staff_unread = 0 WHERE id = ?" : "UPDATE tickets SET user_unread = 0 WHERE id = ?").run(ticketId);
  const messages = db
    .prepare("SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY id LIMIT 300")
    .all(ticketId)
    .map((m) => ({ id: num(m.id), isStaff: num(m.is_staff) === 1, body: str(m.body), createdAt: num(m.created_at) }));
  return { ok: true, value: { ticket: toTicket(row, viewer.staff), messages } };
}

export function addMessage(
  db: Database,
  ticketId: number,
  author: { id: number; staff: boolean },
  body: string,
  now = Date.now(),
): Result<{ ownerId: number; subject: string }> {
  const text = body.trim().slice(0, 2000);
  if (text.length < 2) return fail("Напишите сообщение");
  const row = db.prepare("SELECT * FROM tickets WHERE id = ?").get(ticketId);
  if (!row || (!author.staff && num(row.user_id) !== author.id)) return fail("Обращение не найдено", "not_found");
  if (str(row.status) === "closed" && !author.staff) return fail("Обращение закрыто. Создайте новое или откройте это заново", "closed");
  if (!author.staff) {
    const burst = num(db.prepare("SELECT COUNT(*) AS c FROM ticket_messages WHERE ticket_id = ? AND is_staff = 0 AND created_at > ?").get(ticketId, now - 30_000)?.c);
    if (burst >= 3) return fail("Слишком часто. Подождите немного", "rate_limit");
  }
  transaction(db, () => {
    db.prepare("INSERT INTO ticket_messages (ticket_id, author_id, is_staff, body, created_at) VALUES (?, ?, ?, ?, ?)").run(ticketId, author.id, author.staff ? 1 : 0, text, now);
    if (author.staff) db.prepare("UPDATE tickets SET status = 'answered', updated_at = ?, user_unread = 1 WHERE id = ?").run(now, ticketId);
    else db.prepare("UPDATE tickets SET status = 'open', updated_at = ?, staff_unread = 1 WHERE id = ?").run(now, ticketId);
  });
  return { ok: true, value: { ownerId: num(row.user_id), subject: str(row.subject) } };
}

export function setTicketStatus(db: Database, ticketId: number, actor: { id: number; staff: boolean }, status: "open" | "closed", now = Date.now()): Result<true> {
  const row = db.prepare("SELECT user_id FROM tickets WHERE id = ?").get(ticketId);
  if (!row || (!actor.staff && num(row.user_id) !== actor.id)) return fail("Обращение не найдено", "not_found");
  db.prepare("UPDATE tickets SET status = ?, updated_at = ?, " + (actor.staff ? "user_unread = 1" : "staff_unread = 1") + " WHERE id = ?").run(status, now, ticketId);
  return { ok: true, value: true };
}

export function listAllTickets(db: Database, filter: "open" | "answered" | "closed" | "all", limit = 100): TicketRow[] {
  const where = filter === "all" ? "" : "WHERE t.status = ?";
  const args: (string | number)[] = filter === "all" ? [] : [filter];
  return db
    .prepare(`SELECT t.*, u.nickname FROM tickets t JOIN users u ON u.id = t.user_id ${where} ORDER BY t.staff_unread DESC, t.updated_at DESC LIMIT ?`)
    .all(...args, Math.min(Math.max(limit, 1), 200))
    .map((r) => toTicket(r, true));
}

export function staffUnreadCount(db: Database): number {
  return num(db.prepare("SELECT COUNT(*) AS c FROM tickets WHERE staff_unread > 0 AND status <> 'closed'").get()?.c);
}
