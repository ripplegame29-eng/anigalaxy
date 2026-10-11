/**
 * Наполнение базы при первом запуске.
 *
 * Создаёт администратора из переменных ADMIN_SEED_* и заводит значения по
 * умолчанию для настроек и feature flags. Скрипт идемпотентный: повторный
 * запуск не создаёт дубли и не затирает уже существующие значения — поэтому
 * его можно безопасно звать в любой момент, а не только на пустой базе.
 *
 * Запуск: `npm run db:seed`
 */

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { isAbsolute, join } from "node:path";

const adapter = new PrismaBetterSqlite3({
  url: resolveDatabaseUrl(process.env.DATABASE_URL ?? "file:./dev.db"),
});
const db = new PrismaClient({ adapter });

function resolveDatabaseUrl(url: string): string {
  const raw = url.startsWith("file:") ? url.slice("file:".length) : url;
  if (raw === ":memory:" || isAbsolute(raw)) return raw;
  return join(process.cwd(), raw);
}

/**
 * Параметры argon2id. Стоимость 19 — примерно 100 мс на проверку на средней
 * машине. Выше 20 на дешёвом VPS login перестаёт «отзываться» и люди начинают
 * считать пароль по три раза; ниже 18 при 8 ядрах делает перебор дешёвым.
 */
const ARGON2 = {
  memoryCost: 19_456, // 19 МБ
  timeCost: 2,
  parallelism: 1,
} as const;

const DEFAULT_FLAGS = [
  { key: "battlePass", enabled: true, description: "Боевой пропуск" },
  { key: "clans", enabled: true, description: "Кланы" },
  { key: "watchTogether", enabled: true, description: "Совместный просмотр" },
  { key: "donate", enabled: true, description: "Страница доната" },
  { key: "premium", enabled: true, description: "Платная подписка" },
  { key: "chat", enabled: true, description: "Виджет чата" },
  { key: "manga", enabled: true, description: "Раздел манги" },
  { key: "adminPanel", enabled: true, description: "Админ-панель" },
];

const DEFAULT_SETTINGS = [
  {
    key: "site.title",
    value: "AniGalaxy",
    description: "Название сайта в заголовке и подвале",
  },
  {
    key: "site.tagline",
    value: "Смотри аниме с комментариями, кланами и боевым пропуском",
    description: "Подзаголовок на главной",
  },
  {
    key: "moderation.autoHideThreshold",
    value: "5",
    description:
      "Сколько жалоб на комментарий скрывает его автоматически до разбора модератором",
  },
];

async function main() {
  const nickname = process.env.ADMIN_SEED_NICKNAME ?? "admin";
  const email = process.env.ADMIN_SEED_EMAIL ?? "admin@example.com";
  const password = process.env.ADMIN_SEED_PASSWORD ?? "";

  /* ---------------------------- Администратор --------------------------- */

  if (!password) {
    console.warn(
      "Пароль администратора не задан (ADMIN_SEED_PASSWORD) — аккаунт не создан.",
    );
  } else if (password === "change-me-now") {
    // Слишком легко забыть, что это заглушка из .env.example
    console.warn(
      "ADMIN_SEED_PASSWORD всё ещё равен заглушке «change-me-now». Задай настоящий пароль.",
    );
  } else {
    const existing = await db.user.findUnique({ where: { nickname } });

    if (existing) {
      console.log(`Админ «${nickname}» уже есть — пароль не трогаем.`);
    } else {
      const passwordHash = await hash(password, ARGON2);
      const now = Date.now();

      await db.user.create({
        data: {
          nickname,
          email,
          passwordHash,
          role: "admin",
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
      });

      await db.auditLog.create({
        data: {
          actorId: null,
          action: "admin.seed",
          targetType: "user",
          targetId: nickname,
          summary: `Создан первый администратор «${nickname}»`,
          createdAt: now,
        },
      });

      console.log(`Создан администратор: ${nickname} <${email}>`);
    }
  }

  /* --------------------------- Флаги и настройки ------------------------ */

  for (const flag of DEFAULT_FLAGS) {
    await db.featureFlag.upsert({
      where: { key: flag.key },
      create: { ...flag, updatedAt: Date.now() },
      update: {}, // значение флага не перетираем: админ мог его уже выключить
    });
  }

  for (const setting of DEFAULT_SETTINGS) {
    await db.setting.upsert({
      where: { key: setting.key },
      create: { ...setting, updatedAt: Date.now() },
      update: {}, // настройки редактируются в панели — seed их не затирает
    });
  }

  const counts = {
    пользователей: await db.user.count(),
    флагов: await db.featureFlag.count(),
    настроек: await db.setting.count(),
  };

  console.log("База готова:", counts);
}

main()
  .catch((error: unknown) => {
    console.error("Не удалось наполнить базу:", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());