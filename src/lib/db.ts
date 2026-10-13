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
 * Куда смотреть за базой по умолчанию.
 *
 * Путь собирается литералом, а не `join(process.cwd(), raw)` с переменной:
 * статический анализ Next разбирает только константы, и с переменной он не
 * может оценить границы — из-за чего включает в сборку весь проект целиком
 * (предупреждение «Dynamic filesystem access causes tracing of the whole
 * project»). База лежит рядом со схемой, в `prisma/`, — там же её создают
 * миграции, так что одна и та же строка в `.env` означает одно и то же и для
 * CLI, и для рантайма.
 */
const DEFAULT_DB_FILE = join(process.cwd(), "prisma", "dev.db");

function resolveDatabaseUrl(url: string): string {
  const raw = url.startsWith("file:") ? url.slice("file:".length) : url;

  if (!raw) return DEFAULT_DB_FILE;
  // В памяти — для тестов и одноразовых скриптов.
  if (raw === ":memory:") return raw;
  // В проде путь обычно абсолютный (или базы нет вовсе и будет Postgres).
  if (isAbsolute(raw)) return raw;

  // Относительный путь: берём только имя файла и кладём в `prisma/`.
  // Так база физически не может оказаться в корне репозитория — там её
  // однажды уже создавал Prisma CLI, и в `.gitignore` пришлось бы дублировать
  // правила на два возможных места.
  const file = raw.split(/[/\\]/).pop() ?? "dev.db";
  return join(process.cwd(), "prisma", file);
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