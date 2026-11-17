/**
 * Отложенные подарки новичкам (бонус за регистрацию, подарок по приглашению).
 *
 * Сразу после регистрации браузер переносит на сервер локальный прогресс
 * гостя и перезаписал бы всё, что сервер успел записать. Поэтому подарок
 * ставится в очередь и выдаётся сразу после первого сохранения прогресса.
 */

import { adjustBalance, editProfile, pushNotice } from "./admin-edit";
import { getDoc } from "./docs";
import { PROGRESS_DOC_KEY } from "../sync-keys";
import { num, str, type Database } from "./sqlite";
import type { UserRow } from "./users";

/** Страховка: таблица создаётся и здесь, если миграция по какой-то причине не прошла */
const ensured = new WeakSet<Database>();
function ensureTable(db: Database): void {
  if (ensured.has(db)) return;
  db.exec(`CREATE TABLE IF NOT EXISTS pending_grants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ac INTEGER NOT NULL DEFAULT 0,
    xp INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    notice TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pending_grants_user ON pending_grants(user_id)`);
  ensured.add(db);
}

const SYSTEM = { nickname: "AniGalaxy" } as unknown as UserRow;

export function queueGrant(
  db: Database,
  userId: number,
  grant: { ac?: number; xp?: number; note: string; notice?: string },
  now = Date.now(),
): void {
  ensureTable(db);
  db.prepare("INSERT INTO pending_grants (user_id, ac, xp, note, notice, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    userId,
    grant.ac ?? 0,
    grant.xp ?? 0,
    grant.note,
    grant.notice ?? "",
    now,
  );
}

/** Выдать накопленное; вызывать, когда прогресс игрока уже есть на сервере */
export function flushGrants(db: Database, userId: number, now = Date.now()): number {
  if (!getDoc(db, userId, PROGRESS_DOC_KEY)) return 0;
  ensureTable(db);
  const rows = db.prepare("SELECT id, ac, xp, note, notice FROM pending_grants WHERE user_id = ? ORDER BY id").all(userId);
  for (const row of rows) {
    const gone = db.prepare("DELETE FROM pending_grants WHERE id = ?").run(num(row.id));
    if (!num((gone as { changes?: number }).changes)) continue;
    adjustBalance(db, SYSTEM, userId, { ac: num(row.ac), xp: num(row.xp), note: str(row.note) }, now);
    const notice = str(row.notice);
    if (notice) editProfile(db, userId, (profile) => pushNotice(profile, notice, now), now);
  }
  return rows.length;
}
