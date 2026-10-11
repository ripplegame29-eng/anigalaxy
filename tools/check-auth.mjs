/**
 * Проверка серверной авторизации без браузера.
 *
 * Что проверяем:
 * 1. /admin без сессии отдаёт редирект на /login, а не саму панель
 * 2. argon2-хэш из базы совпадает с паролем сида и не совпадает с чужим
 *
 * Запуск: node tools/check-auth.mjs
 */

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { verify } from "@node-rs/argon2";
import { isAbsolute, join } from "node:path";

const BASE = "http://localhost:3000";
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD ?? "anigalaxy-admin-2026";

function resolve(url) {
  const raw = url.startsWith("file:") ? url.slice(5) : url;
  if (!raw) return join(process.cwd(), "prisma", "dev.db");
  if (raw === ":memory:" || isAbsolute(raw)) return raw;
  return join(process.cwd(), "prisma", raw.split(/[/\\]/).pop() ?? "dev.db");
}

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✔" : "✖"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

/* ------------------------- 1. Закрыт ли /admin -------------------------- */

const res = await fetch(`${BASE}/admin`, { redirect: "manual" });

check(
  "/admin без сессии отдаёт редирект (307/308)",
  res.status === 307 || res.status === 308,
  `статус ${res.status}`,
);
check(
  "редирект ведёт на /login",
  (res.headers.get("location") ?? "").startsWith("/login"),
  res.headers.get("location") ?? "(нет location)",
);

const loginPage = await fetch(`${BASE}/login`);
check("/login отдаёт страницу", loginPage.status === 200, `статус ${loginPage.status}`);

/* --------------------------- 2. Хэш пароля ----------------------------- */

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: resolve(process.env.DATABASE_URL ?? "file:./dev.db") }),
});

const admin = await db.user.findFirst({ where: { role: "admin" } });

if (!admin) {
  check("в базе есть администратор", false, "не найден — запусти npm run db:seed");
} else {
  check("в базе есть администратор", true, admin.nickname);

  check(
    "пароль сида подходит к хэшу",
    await verify(admin.passwordHash, ADMIN_PASSWORD),
  );
  check(
    "чужой пароль НЕ подходит",
    !(await verify(admin.passwordHash, "definitely-not-the-password")),
  );
  check("хэш начинается с $argon2id$", admin.passwordHash.startsWith("$argon2id$"));

  const plain = Buffer.from(admin.passwordHash, "base64").toString();
  check(
    "в хэше нет пароля открытым текстом",
    !plain.includes(ADMIN_PASSWORD),
    "base64 от пароля не должен совпадать",
  );
}

await db.$disconnect();

console.log(failed === 0 ? "\nВсе проверки пройдены" : `\nПровалено: ${failed}`);
process.exitCode = failed === 0 ? 0 : 1;