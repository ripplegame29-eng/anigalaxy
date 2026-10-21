/**
 * Тонкая обёртка над встроенным `node:sqlite` (Node 22.5+).
 *
 * Почему не better-sqlite3 или Prisma: встроенный модуль не требует
 * нативной сборки на сервере и новых зависимостей, а запросы проекта простые.
 * Модуль достаём через `process.getBuiltinModule`, чтобы сборщик Next не
 * пытался его разрешать статически (и чтобы типы `@types/node@20` не мешали).
 */

export type SqlValue = string | number | bigint | null | Uint8Array;

export interface RunResult {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
}

export interface Statement {
  run(...params: SqlValue[]): RunResult;
  get(...params: SqlValue[]): Record<string, unknown> | undefined;
  all(...params: SqlValue[]): Record<string, unknown>[];
}

export interface Database {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  close(): void;
}

interface SqliteModule {
  DatabaseSync: new (path: string) => Database;
}

let cached: SqliteModule | null = null;

function loadSqlite(): SqliteModule {
  if (cached) return cached;
  const getBuiltin = (process as unknown as { getBuiltinModule?: (id: string) => unknown })
    .getBuiltinModule;
  const mod = getBuiltin?.("node:sqlite") as SqliteModule | undefined;
  if (!mod?.DatabaseSync) {
    throw new Error("Нужен Node.js 22.5+ со встроенным модулем node:sqlite");
  }
  cached = mod;
  return mod;
}

/** Открыть базу и применить рабочие настройки SQLite */
export function openSqlite(file: string): Database {
  const { DatabaseSync } = loadSqlite();
  const db = new DatabaseSync(file);
  if (file !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA synchronous = NORMAL");
  return db;
}

/** Выполнить `fn` одной транзакцией (откат при исключении) */
export function transaction<T>(db: Database, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* транзакция уже закрыта */
    }
    throw error;
  }
}

/** Числовое поле строки (SQLite отдаёт INTEGER как number или bigint) */
export function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  return fallback;
}

export function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
