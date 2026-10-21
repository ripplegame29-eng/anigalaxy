/**
 * Подключение к базе проекта и применение миграций.
 *
 * Путь к файлу: `DATABASE_PATH` (по умолчанию `data/anigalaxy.db` в корне
 * проекта). Для тестов `openDatabase(":memory:")` даёт чистую базу.
 */

import { MIGRATIONS } from "./migrations";
import { openSqlite, transaction, num, type Database } from "./sqlite";

export type { Database } from "./sqlite";

/** Применить недостающие миграции; возвращает версию схемы */
export function migrate(db: Database): number {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `);
  const row = db.prepare("SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrations").get();
  const current = num(row?.v);

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    transaction(db, () => {
      db.exec(migration.sql);
      db.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)").run(
        migration.version,
        migration.name,
        Date.now(),
      );
    });
  }
  return MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;
}

export function openDatabase(file: string): Database {
  const db = openSqlite(file);
  migrate(db);
  return db;
}

let singleton: Database | null = null;

/** Общее подключение процесса (создаёт папку и файл при первом обращении) */
export function getDb(): Database {
  if (singleton) return singleton;
  const nodeRequire = (id: string) =>
    (process as unknown as { getBuiltinModule: (id: string) => unknown }).getBuiltinModule(id);
  const fs = nodeRequire("node:fs") as typeof import("node:fs");
  const path = nodeRequire("node:path") as typeof import("node:path");

  const file = process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.resolve(process.cwd(), "data", "anigalaxy.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  singleton = openDatabase(file);
  return singleton;
}

/** Есть ли у сервера рабочая база (для понятного 503 вместо падения) */
export function dbAvailable(): boolean {
  try {
    getDb();
    return true;
  } catch {
    return false;
  }
}
