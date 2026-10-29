/**
 * Выдать аккаунту по одной копии каждой карточки (для проверки коллекции).
 *
 *   node tools/cards-grant-all.mjs почта@example.com [--foil] [--level=15]
 *
 * Уже имеющиеся карточки не дублируются: скрипт можно запускать повторно.
 * Работает с базой проекта (DATABASE_PATH или data/anigalaxy.db). Сервер лучше остановить.
 */

import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, ".tsc-tests-grant");
const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();
const foil = args.includes("--foil");
const level = Number(args.find((a) => a.startsWith("--level="))?.split("=")[1]) || 1;
if (!email) {
  console.error("Укажите почту аккаунта: node tools/cards-grant-all.mjs почта@example.com");
  process.exit(1);
}

const tsc = spawnSync(`npx tsc -p tsconfig.tools.json --outDir "${out}"`, { cwd: root, stdio: "inherit", shell: true });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

try {
  const load = (p) => import(pathToFileURL(path.join(out, p)).href);
  const { CATALOG } = await load("lib/cards/catalog.js");
  const { addCard, getWallet } = await load("lib/server/cards.js");
  const { openDatabase } = await load("lib/server/db.js");
  const file = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(root, "data", "anigalaxy.db");
  const db = openDatabase(file);
  const user = db.prepare("SELECT id, nickname FROM users WHERE lower(email) = ?").get(email);
  if (!user) {
    console.error(`Аккаунт с почтой ${email} не найден в базе ${file}. Сначала зарегистрируйтесь на сайте под этой почтой.`);
    process.exit(1);
  }
  const now = Date.now();
  getWallet(db, Number(user.id), now);
  const have = new Set(db.prepare("SELECT DISTINCT card_id FROM card_inv WHERE user_id = ?").all(user.id).map((r) => String(r.card_id)));
  let added = 0;
  db.exec("BEGIN");
  for (const c of CATALOG) {
    if (have.has(c.id)) continue;
    addCard(db, Number(user.id), c.id, now, foil, level);
    added += 1;
  }
  db.exec("COMMIT");
  console.log(`Готово: ${user.nickname} получил ${added} карточек (всего в каталоге ${CATALOG.length}).`);
} finally {
  rmSync(out, { recursive: true, force: true });
}
