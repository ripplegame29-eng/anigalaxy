/**
 * Выдать аккаунту по одной копии каждой карточки (для проверки коллекции).
 *
 *   node tools/cards-grant-all.mjs почта@example.com [--foil] [--level=15]
 *
 * Работает и локально, и на сервере без необходимости сборки tsc:
 *   - локально: data/anigalaxy.db
 *   - на сервере: DATABASE_PATH или /var/lib/anigalaxy/anigalaxy.db
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();
const foil = args.includes("--foil") ? 1 : 0;
const level = Number(args.find((a) => a.startsWith("--level="))?.split("=")[1]) || 1;

if (!email) {
  console.error("Укажите почту: node tools/cards-grant-all.mjs почта@example.com");
  process.exit(1);
}

// Поиск базы данных
let dbFile = process.env.DATABASE_PATH;
if (!dbFile || !fs.existsSync(dbFile)) {
  const candidates = [
    path.join(root, "data", "anigalaxy.db"),
    "/var/lib/anigalaxy/anigalaxy.db",
  ];
  dbFile = candidates.find((c) => fs.existsSync(c));
}

if (!dbFile) {
  console.error("База данных SQLite не найдена ни по одному из стандартных путей.");
  process.exit(1);
}

// Загрузка каталога карт из src/lib/cards/catalog.ts
const catalogSource = fs.readFileSync(path.join(root, "src", "lib", "cards", "catalog.ts"), "utf8");
const rawMatch = catalogSource.match(/const RAW = `([\s\S]*?)`;/);
if (!rawMatch) {
  console.error("Не удалось прочитать RAW каталог карт");
  process.exit(1);
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const seen = new Set();
const cardIds = [];
for (const line of rawMatch[1].trim().split("\n")) {
  const parts = line.split("|");
  if (parts.length < 3) continue;
  const search = parts[2];
  let id = slug(search);
  while (seen.has(id)) id += "-x";
  seen.add(id);
  cardIds.push(id);
}

const db = new DatabaseSync(dbFile);
const user = db.prepare("SELECT id, nickname FROM users WHERE lower(email) = ?").get(email);
if (!user) {
  console.error(`Аккаунт с почтой ${email} не найден в базе ${dbFile}. Сначала зарегистрируйтесь на сайте под этой почтой.`);
  process.exit(1);
}

const now = Date.now();
db.prepare(
  "INSERT OR IGNORE INTO card_wallet (user_id, diamonds, dust, packs, energy, energy_at, created_at) VALUES (?, 1000, 500, 10, 100, ?, ?)"
).run(user.id, now, now);

const have = new Set(
  db.prepare("SELECT DISTINCT card_id FROM card_inv WHERE user_id = ?").all(user.id).map((r) => String(r.card_id))
);

const insert = db.prepare("INSERT INTO card_inv (user_id, card_id, foil, level, pity, created_at) VALUES (?, ?, ?, ?, 0, ?)");
db.exec("BEGIN");
let added = 0;
for (const cid of cardIds) {
  if (have.has(cid)) continue;
  insert.run(user.id, cid, foil, level, now);
  added++;
}
db.exec("COMMIT");

console.log(`Готово: ${user.nickname} получил ${added} новых карточек (всего в коллекции: ${have.size + added} из ${cardIds.length}).`);
