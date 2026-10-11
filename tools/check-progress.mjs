/**
 * Сквозная проверка зеркала прогресса.
 *
 * Сессия создаётся напрямую в базе, а не через форму: Server Action входа
 * через HTTP не воспроизвести (Flight-протокол), а проверять надо не форму,
 * а путь данных — авторизация уже покрыта tools/check-auth.mjs.
 *
 * Запуск: node tools/check-progress.mjs
 */

import { createHash, randomBytes } from "node:crypto";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

// PROGRESS_SCHEMA из src/lib/progression/doc.ts. Импортировать оттуда нельзя:
// doc.ts тянет соседние модули без расширения, а Node их не резолвит.
// Константа меняется крайне редко; при смене — синхронизировать здесь.
const PROGRESS_SCHEMA = 1;

const BASE = "http://localhost:3000";
const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: "prisma/dev.db" }),
});

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✔" : "✖"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

const admin = await db.user.findFirst({ where: { role: "admin" } });
if (!admin) {
  console.error("Нет администратора — запусти npm run db:seed");
  process.exit(1);
}

const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token).digest("hex");
const now = Date.now();

await db.session.create({
  data: {
    tokenHash,
    userId: admin.id,
    createdAt: now,
    expiresAt: now + 3_600_000,
    lastUsedAt: now,
    ip: "127.0.0.1",
    userAgent: "check-progress",
  },
});

const cookie = `ag_session=${token}`;

async function call(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), cookie },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

try {
  /* --------------------- 1. GET с сессией: пусто ---------------------- */
  const empty = await call("/api/progress");
  check("GET с сессией отвечает 200", empty.status === 200, `статус ${empty.status}`);
  check("документа ещё нет", empty.body?.doc === null);

  /* -------------------- 2. PUT нормального документа ------------------ */
  const doc = {
    schema: PROGRESS_SCHEMA,
    progress: {
      userId: admin.id,
      xpTotal: 12345,
      level: 12,
      acBalance: 777,
      streakCurrent: 3,
      streakBest: 9,
      streakFreezes: 0,
      lastActiveDate: "2026-10-11",
      tz: "Europe/Moscow",
      equippedTagId: null,
      trophyPoints: 0,
      createdAt: now,
    },
    counters: {},
    sets: { genres: [] },
    daily: {},
    quests: {},
    battlepass: {},
    sessions: [],
    achievements: { ach_first: { at: now } },
    tags: {},
    purchases: [],
    ledger: [],
    flags: {},
    rate: {},
    rejected: [],
    meta: { configVersion: 1, lastEventAt: now, events: 42 },
  };

  const put = await call("/api/progress", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc: JSON.stringify(doc) }),
  });
  check("PUT принял документ", put.status === 200 && put.body?.ok === true, JSON.stringify(put.body));

  /* ------------------------ 3. Документ в базе ------------------------- */
  const row = await db.playerProgress.findUnique({ where: { userId: admin.id } });
  check("запись появилась в player_progress", Boolean(row));
  check("revision = 1 после первой записи", row?.revision === 1, `revision ${row?.revision}`);

  const stored = row ? JSON.parse(row.doc) : null;
  check("уровень сохранён", stored?.progress?.level === 12, `уровень ${stored?.progress?.level}`);
  check("AC сохранён", stored?.progress?.acBalance === 777, `AC ${stored?.progress?.acBalance}`);
  check("события сохранены", stored?.meta?.events === 42);

  /* --------------------- 4. GET возвращает документ --------------------- */
  const after = await call("/api/progress");
  const back = after.body?.doc ? JSON.parse(after.body.doc) : null;
  check("GET отдаёт тот же документ", back?.progress?.level === 12);

  /* ------------------ 5. Повторная запись: revision растёт -------------- */
  await call("/api/progress", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc: JSON.stringify({ ...doc, meta: { ...doc.meta, events: 43 } }) }),
  });
  const row2 = await db.playerProgress.findUnique({ where: { userId: admin.id } });
  check("revision вырос до 2", row2?.revision === 2, `revision ${row2?.revision}`);

  /* ------------------------- 6. Отказы --------------------------------- */
  const badJson = await call("/api/progress", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc: "{не json" }),
  });
  check("битый JSON отклонён", badJson.status === 400, `статус ${badJson.status}`);

  const notObject = await call("/api/progress", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc: "[1,2,3]" }),
  });
  check("массив вместо объекта отклонён", notObject.status === 400);

  const future = await call("/api/progress", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc: JSON.stringify({ ...doc, schema: PROGRESS_SCHEMA + 5 }) }),
  });
  check(
    "документ новее сервера не затирает старый",
    future.status === 400,
    `статус ${future.status}`,
  );

  const row3 = await db.playerProgress.findUnique({ where: { userId: admin.id } });
  check("старый документ уцелел после отказа", row3?.revision === 2, `revision ${row3?.revision}`);

  const noDoc = await call("/api/progress", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notDoc: "x" }),
  });
  check("запрос без поля doc отклонён", noDoc.status === 400);
} finally {
  await db.session.deleteMany({ where: { tokenHash } });
  await db.$disconnect();
}

console.log(failed === 0 ? "\nЗеркало прогресса работает" : `\nПровалено: ${failed}`);
process.exitCode = failed === 0 ? 0 : 1;