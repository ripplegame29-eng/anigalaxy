/**
 * Загрузка артов персонажей для карточек с AniList (публичный GraphQL API).
 *
 *   node tools/cards-sync.mjs            — скачать недостающие арты
 *   node tools/cards-sync.mjs --force    — перекачать все
 *   node tools/cards-sync.mjs naruto-uzumaki  — только указанные id
 *
 * Файлы кладутся в data/cards-art/<id>.jpg (сервер делает то же самое сам в фоне). Пока файла нет, на карточке
 * рисуется стильная заглушка с инициалами. Скрипт можно запускать сколько
 * угодно раз: уже скачанное пропускается.
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "data", "cards-art");
mkdirSync(outDir, { recursive: true });

const src = readFileSync(path.join(root, "src", "lib", "cards", "catalog.ts"), "utf8");
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const seen = new Set();
const cards = [];
for (const line of src.split("\n")) {
  const m = /^[0-4]\|([^|]+)\|([^|]+)\|/.exec(line);
  if (!m) continue;
  let id = slug(m[2]);
  while (seen.has(id)) id += "-x";
  seen.add(id);
  cards.push({ id, name: m[1], search: m[2] });
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--"));
const todo = cards.filter((c) => (only.length ? only.includes(c.id) : true) && (force || !existsSync(path.join(outDir, `${c.id}.jpg`))));
console.log(`Карт в каталоге: ${cards.length}, к загрузке: ${todo.length}`);

const QUERY = `query ($q: String) { Page(page: 1, perPage: 1) { characters(search: $q, sort: FAVOURITES_DESC) { id image { large } } } }`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function find(search) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { q: search } }),
    });
    if (res.status === 429) {
      await sleep(Number(res.headers.get("retry-after") ?? 30) * 1000 + 500);
      continue;
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`AniList вернул HTTP ${res.status}: ${text.replace(/\s+/g, " ").slice(0, 160)}`);
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`AniList вернул не JSON: ${text.replace(/\s+/g, " ").slice(0, 160)}`);
    }
    if (json?.errors?.length) throw new Error(`AniList: ${json.errors[0].message}`);
    return json?.data?.Page?.characters?.[0]?.image?.large ?? null;
  }
  throw new Error("AniList ограничил запросы (HTTP 429) — подождите несколько минут и запустите снова");
}

/** Запасные написания имени: AniList пишет японские имена по-разному (Shouko/Shoko, Jiro/Jirou) */
const OVERRIDES = {
  "Shoko Ieiri": ["Shouko Ieiri", "Ieiri Shouko"],
  "Barragan Luisenbarn": ["Baraggan Louisenbairn", "Baraggan"],
  "Zeref Dragneel": ["Zeref"],
};
function variants(name) {
  const set = new Set([name, ...(OVERRIDES[name] ?? [])]);
  const parts = name.split(/\s+/);
  if (parts.length === 2) set.add(`${parts[1]} ${parts[0]}`);
  for (const v of [...set]) {
    set.add(v.replace(/ou/gi, "o").replace(/oo/gi, "o").replace(/uu/gi, "u"));
    set.add(v.replace(/o(?=[^aeiouy]|\b)/g, "ou"));
  }
  return [...set];
}
async function findAny(name) {
  for (const v of variants(name)) {
    const url = await find(v);
    if (url && !url.includes("default.jpg")) return url;
    await sleep(400);
  }
  return null;
}

let ok = 0;
const failed = [];
for (const [i, c] of todo.entries()) {
  try {
    const url = await findAny(c.search);
    if (!url || url.includes("default.jpg")) throw new Error(`персонаж «${c.search}» не найден на AniList`);
    const img = await fetch(url);
    if (!img.ok) throw new Error(`HTTP ${img.status}`);
    writeFileSync(path.join(outDir, `${c.id}.jpg`), Buffer.from(await img.arrayBuffer()));
    ok += 1;
    console.log(`[${i + 1}/${todo.length}] ✓ ${c.name}`);
  } catch (e) {
    failed.push(c.id);
    console.log(`[${i + 1}/${todo.length}] ✗ ${c.name} — ${e.message}`);
  }
  await sleep(750);
}
console.log(`Готово: скачано ${ok}, не найдено ${failed.length}${failed.length ? ` (${failed.join(", ")})` : ""}`);
if (failed.length === todo.length && todo.length) console.log("Похоже, нет доступа к AniList — проверьте интернет/VPN и запустите ещё раз.");
