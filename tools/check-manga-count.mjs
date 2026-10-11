/**
 * Сколько манги отдаём и сколько это стоит по времени.
 * Запуск: node tools/check-manga-count.mjs
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import Module from "node:module";
import { createRequire } from "node:module";

const tsc = spawnSync("npx tsc -p tsconfig.tools.json", { stdio: "inherit", shell: true });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return load.call(this, request, parent, isMain);
};
const require = createRequire(import.meta.url);
const { mangaRow, mangaCatalogPage } = require("../.tsc-tests/lib/mangadex.js");

for (const sort of ["hot", "best"]) {
  const t0 = Date.now();
  const cards = await mangaRow(sort, 30);
  const cold = Date.now() - t0;

  const t1 = Date.now();
  await mangaRow(sort, 30);
  const warm = Date.now() - t1;

  console.log(`\n${sort}: ${cards.length} карточек | холодный ${cold} мс, из кэша ${warm} мс`);
  const withChapters = cards.filter((c) => (c.chapterCount ?? 0) > 0).length;
  console.log(`  с главами на русском: ${withChapters}/${cards.length}`);
  console.log(`  с обложкой: ${cards.filter((c) => c.poster).length}`);
  console.log(`  уникальных id: ${new Set(cards.map((c) => c.id)).size}`);
  console.log(
    "  примеры:",
    cards.slice(0, 4).map((c) => `${c.title.slice(0, 26)} (${c.chapterCount} гл.)`).join(" | "),
  );
  assert.ok(cards.length >= 25, `${sort}: ряду хватает карточек`);
  assert.ok(withChapters === cards.length, `${sort}: все карточки читаемые`);
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length, `${sort}: без дублей`);
}

/* ---------------- Каталог по страницам ---------------- */
console.log("\n--- каталог постранично ---");
const seen = new Set();
let duplicates = 0;
for (const page of [1, 2, 3, 4]) {
  const t0 = Date.now();
  const { cards, hasMore } = await mangaCatalogPage("hot", (page - 1) * 30, 30);
  console.log(`стр. ${page}: ${cards.length} карточек, hasMore=${hasMore}, ${Date.now() - t0} мс`);
  for (const c of cards) {
    if (seen.has(c.id)) duplicates++;
    seen.add(c.id);
  }
  if (!hasMore) {
    console.log("  (дальше страниц нет — кнопка скроется)");
    break;
  }
}
console.log(`уникальных тайтлов: ${seen.size}, дублей между страницами: ${duplicates}`);
assert.equal(duplicates, 0, "между страницами нет повторов");
assert.ok(seen.size >= 60, "каталог отдаёт больше одной страницы");

console.log("\ncount: OK");