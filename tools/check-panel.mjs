/**
 * Проверка панели под сессией администратора.
 *
 * Зачем отдельный инструмент: `tools/check-auth.mjs` проверяет только отказ
 * гостю. А дизайн-панельный слой ломается иначе — ошибка в разметке или в
 * server action видна лишь на странице, которая уже прошла проверку прав.
 *
 * Сессия создаётся напрямую в базе: подделать её иначе нечем, а логин по
 * HTTP потребовал бы разбирать серверный action.
 *
 * node tools/check-panel.mjs
 */

import { createHash, randomBytes } from "node:crypto";
import { join, isAbsolute } from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.CHECK_BASE ?? "http://localhost:3000";

function resolve(url) {
  const raw = url.startsWith("file:") ? url.slice(5) : url;
  if (!raw) return join(process.cwd(), "prisma", "dev.db");
  if (raw === ":memory:" || isAbsolute(raw)) return raw;
  return join(process.cwd(), "prisma", raw.split(/[/\\]/).pop() ?? "dev.db");
}

const url = process.env.DATABASE_URL ?? `file:${resolve("")}`;
const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: resolve(url) }) });

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

/* ------------------------------ Сессия ------------------------------- */

const admin = await db.user.findFirst({ where: { role: "admin" } });
if (!admin) {
  console.log("Администратора в базе нет — выполните `prisma db seed`.");
  process.exit(1);
}

const token = randomBytes(32).toString("base64url");
const now = Date.now();

await db.session.create({
  data: {
    tokenHash: createHash("sha256").update(token).digest("hex"),
    userId: admin.id,
    createdAt: now,
    expiresAt: now + 3_600_000,
    lastUsedAt: now,
  },
});

const jar = `ag_session=${token}`;
console.log(`Сессия: ${admin.nickname}\n`);

/* ----------------------------- Разделы ------------------------------- */

const PAGES = [
  ["/admin", "Обзор"],
  ["/admin/users", "Пользователи"],
  ["/admin/moderation", "Модерация"],
  ["/admin/content", "Контент"],
  ["/admin/economy", "Экономика"],
  ["/admin/errors", "Журнал ошибок"],
  ["/admin/settings", "Настройки"],
];

/**
 * Куски разметки, которые обязаны быть на каждой странице. Проверяем их
 * именно здесь: без каркаса из admin.css панель отдаёт 200 с белым листом,
 * и по коду это выглядит как «страница работает».
 */
const SHELL = [
  ["ag-app", "корневой класс темы"],
  ["ag-side", "боковое меню"],
  ["ag-navlink", "пункты меню"],
  ["ag-logo", "логотип"],
  ["ag-top", "верхняя панель"],
  ["ag-search", "поиск разделов"],
  ["ag-toast", "всплывающее уведомление"],
  ["ag-theme", "переключатель темы"],
  ["ag-bg", "фоновая графика"],
  ["ag-me", "карточка администратора"],
];

for (const [path, label] of PAGES) {
  const res = await fetch(BASE + path, { headers: { cookie: jar }, redirect: "manual" });
  check(`${path.padEnd(20)} 200`, res.status === 200, `получено ${res.status}`);

  if (res.status !== 200) continue;

  const html = await res.text();

  for (const [marker, what] of SHELL) {
    check(`  ${label}: ${what}`, html.includes(marker), html.includes(marker) ? "" : `нет «${marker}»`);
  }

  // Пункт меню именно этой страницы должен быть подсвечен. Ищем по тегу
  // целиком, а не по подстроке: Next выводит атрибуты в своём порядке
  // (сначала className, href в конце), жёсткая строка ломалась бы о порядок.
  const anchors = [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
  const active = anchors.some(
    (tag) =>
      tag.includes("ag-navlink") &&
      tag.includes(`href="${path}"`) &&
      tag.includes('aria-current="page"'),
  );
  check(`  ${label}: активный пункт меню`, active);
}

console.log(failed === 0 ? "\nВсе проверки пройдены." : `\nПровалено: ${failed}`);
process.exit(failed === 0 ? 0 : 1);