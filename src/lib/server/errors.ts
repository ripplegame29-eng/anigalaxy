/**
 * Журнал ошибок: серверные исключения маршрутов и ошибки из браузеров.
 * Одинаковые ошибки склеиваются по отпечатку, растёт счётчик повторов.
 */

import { createHash } from "node:crypto";

import { num, str, type Database } from "./sqlite";

export interface ErrorInput {
  source: "server" | "client";
  message: string;
  stack?: string;
  path?: string;
  userId?: number;
}

const MAX_ROWS = 2000;

export function logError(db: Database, input: ErrorInput, now = Date.now()): void {
  const message = input.message.slice(0, 500) || "Без текста";
  const stack = (input.stack ?? "").slice(0, 4000);
  const path = (input.path ?? "").slice(0, 200);
  const fingerprint = createHash("sha1").update(`${input.source}|${message}|${path}`).digest("hex");
  db.prepare(
    `INSERT INTO error_log (fingerprint, source, message, stack, path, user_id, first_at, last_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(fingerprint) DO UPDATE SET count = count + 1, last_at = excluded.last_at, resolved = 0,
       user_id = excluded.user_id, stack = CASE WHEN excluded.stack != '' THEN excluded.stack ELSE stack END`,
  ).run(fingerprint, input.source, message, stack, path, input.userId ?? 0, now, now);
  // Не даём журналу расти бесконечно: оставляем самые свежие
  db.prepare(
    "DELETE FROM error_log WHERE id IN (SELECT id FROM error_log ORDER BY last_at DESC LIMIT -1 OFFSET ?)",
  ).run(MAX_ROWS);
}

export function listErrors(db: Database, opts: { resolved?: boolean; source?: string; limit?: number } = {}) {
  const where: string[] = ["resolved = ?"];
  const args: (string | number)[] = [opts.resolved ? 1 : 0];
  if (opts.source === "server" || opts.source === "client") {
    where.push("source = ?");
    args.push(opts.source);
  }
  args.push(Math.min(Math.max(opts.limit ?? 100, 1), 300));
  return db
    .prepare(`SELECT * FROM error_log WHERE ${where.join(" AND ")} ORDER BY last_at DESC LIMIT ?`)
    .all(...args)
    .map((row) => ({
      id: num(row.id),
      source: str(row.source),
      message: str(row.message),
      stack: str(row.stack),
      path: str(row.path),
      userId: num(row.user_id),
      count: num(row.count),
      firstAt: num(row.first_at),
      lastAt: num(row.last_at),
      resolved: num(row.resolved) === 1,
    }));
}

export function errorCounts(db: Database, now = Date.now()) {
  const c = (sql: string, ...a: number[]) => num(db.prepare(sql).get(...a)?.c);
  return {
    open: c("SELECT COUNT(*) AS c FROM error_log WHERE resolved = 0"),
    day: c("SELECT COALESCE(SUM(count),0) AS c FROM error_log WHERE last_at > ?", now - 86_400_000),
  };
}

export function resolveError(db: Database, id: number): boolean {
  return num(db.prepare("UPDATE error_log SET resolved = 1 WHERE id = ?").run(id).changes) > 0;
}

export function clearErrors(db: Database, onlyResolved: boolean): number {
  const info = onlyResolved
    ? db.prepare("DELETE FROM error_log WHERE resolved = 1").run()
    : db.prepare("DELETE FROM error_log").run();
  return num(info.changes);
}
