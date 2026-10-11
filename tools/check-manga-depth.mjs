/* Глубина каталога и цена догрузки пула */
import { spawnSync } from "node:child_process";
import Module from "node:module";
import { createRequire } from "node:module";

const tsc = spawnSync("npx tsc -p tsconfig.tools.json", { stdio: "inherit", shell: true });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

const load = Module._load;
Module._load = function (r, p, m) {
  if (r === "server-only") return {};
  return load.call(this, r, p, m);
};
const require = createRequire(import.meta.url);
const { mangaCatalogPage } = require("../.tsc-tests/lib/mangadex.js");

const seen = new Set();
let dups = 0;
let pages = 0;
let noChapters = 0;

for (let page = 1; page <= 20; page++) {
  const t0 = Date.now();
  const { cards, hasMore } = await mangaCatalogPage("best", (page - 1) * 30, 30);
  pages++;
  for (const c of cards) {
    if (seen.has(c.id)) dups++;
    seen.add(c.id);
    if (!c.chapterCount) noChapters++;
  }
  console.log(
    `стр. ${String(page).padStart(2)}: ${String(cards.length).padStart(2)} карточек | ${String(Date.now() - t0).padStart(5)} мс | всего ${seen.size} | hasMore=${hasMore}`,
  );
  if (!hasMore) break;
}

console.log(`\nстраниц: ${pages}, уникальных тайтлов: ${seen.size}, дублей: ${dups}`);
console.log(`без счётчика глав: ${noChapters}`);
console.log(`тайтлов на страницу в среднем: ${Math.round(seen.size / pages)}`);