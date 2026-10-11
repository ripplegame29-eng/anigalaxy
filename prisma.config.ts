import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Конфигурация Prisma 7.
 *
 * В шестой версии адрес БД жил в `schema.prisma` и читался через
 * `env("DATABASE_URL")`. В седьмой это убрали: миграции берут адрес отсюда,
 * а рантайм-клиент получает его через драйвер-адаптер в `src/lib/db.ts`.
 * Смысл разделения — в схеме остаётся только описание данных, а откуда их
 * взять решает окружение.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Миграции применяются вручную (`npx prisma migrate dev`), а не при старте.
    // На Vercel и в CI деплой только проверяет, что схема не разошлась с миграциями:
    // автоматически применять миграции при деплое опасно — опечатка в SQL уедет
    // в прод и уронит его.
    seed: "node prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
});