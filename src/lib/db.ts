/**
 * Клиент Prisma — единственная точка подключения к базе.
 *
 * Почему не `new PrismaClient()` в каждом модуле: в dev-режиме Next.js
 * перезагружает модули при каждом изменении, и без кеша в `globalThis` каждый
 * перезапуск плодил новое соединение — SQLite быстро доходит до «database is
 * locked». Это ровно та ошибка, которую потом ищут полчаса.
 *
 * Начиная с Prisma 7 клиент создаётся не сам по себе, а с драйвер-адаптером:
 * Prisma больше не тащит собственный бинарник движка, а зовёт обычную
 * библиотеку (`better-sqlite3`). Побочный плюс — можно перейти на Postgres,
 * поменяв одну строку на `@prisma/adapter-pg`, не трогая остальной код.
 *
 * `server-only` стоит не для красоты: если этот модуль случайно попадёт в
 * клиентский бандл, путь к базе уедет в браузер.
 */

import "server-only";

import { isAbsolute } from "node:path";
import { join } from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

/**
 * Prisma и better-sqlite3 ждут путь по-разному: первая — `file:./dev.db`
 * в формате URL, вторая — обычный путь в файловой системе. Относительный путь
 * считаем от корня проекта, иначе при запуске из другой директории база
 * молча создастся рядом с process.cwd() — и каждый запуск получит свою копию.
 */
function resolveDatabaseUrl(url: string): string {
  const raw = url.startsWith("file:") ? url.slice("file:".length) : url;
  if (raw === ":memory:" || isAbsolute(raw)) return raw;
  return join(process.cwd(), raw);
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const adapter = new PrismaBetterSqlite3({ url: resolveDatabaseUrl(url) });
  return new PrismaClient({
    adapter,
    // В логах Prisma по умолчанию видно каждый запрос. В проде это шум
    // и лишняя нагрузка, поэтому оставляем только ошибки.
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

// В dev сохраняем клиент между перезагрузками hot-reload.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}