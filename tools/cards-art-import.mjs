/**
 * Импорт собственных артов героев.
 *
 *   node tools/cards-art-import.mjs [папка=art-source] [--dry] [--list]
 *
 * Кладите картинки в папку по имени героя: `naruto-uzumaki.png`, `levi-ackerman.webp`…
 * (png / jpg / jpeg / webp). Скрипт обрезает их под карточку (3:4, умный кадр по самому
 * «насыщенному» месту), уменьшает до 600×800 и сохраняет как `data/cards-art/<id>.jpg`.
 * Свой арт заменяет автоматически скачанный с AniList; сервер ничего не перезапишет.
 *
 *   --list   показать, каких героев ещё нет в `data/cards-art`
 *   --dry    только проверить имена, ничего не записывая
 *
 * Список id героев: `node tools/cards-art-import.mjs --list`.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, ".tsc-tests");
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const list = args.includes("--list");
const src = path.resolve(root, args.find((a) => !a.startsWith("--")) ?? "art-source");
const dest = path.join(root, "data", "cards-art");
const W = 600;
const H = 800;

const tsc = spawnSync("npx tsc -p tsconfig.tools.json", { cwd: root, stdio: "inherit", shell: true });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

try {
  const { CATALOG } = await import(pathToFileURL(path.join(out, "lib/cards/catalog.js")).href);
  const ids = new Set(CATALOG.map((c) => c.id));
  const have = existsSync(dest) ? new Set(readdirSync(dest).filter((f) => f.endsWith(".jpg")).map((f) => f.slice(0, -4))) : new Set();

  if (list) {
    const missing = CATALOG.filter((c) => !have.has(c.id));
    console.log(`Героев без арта: ${missing.length} из ${CATALOG.length}\n`);
    for (const c of missing) console.log(`${c.id}\t${c.name}\t${c.series}`);
    process.exit(0);
  }
  if (!existsSync(src)) {
    console.error(`Папка «${src}» не найдена. Создайте её и положите туда картинки вида <id>.png`);
    process.exit(1);
  }
  mkdirSync(dest, { recursive: true });
  const files = readdirSync(src).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  let done = 0;
  const bad = [];
  for (const f of files) {
    const id = f.replace(/\.[^.]+$/, "").toLowerCase();
    if (!ids.has(id)) {
      const near = [...ids].filter((x) => x.includes(id.slice(0, 5)) || id.includes(x.slice(0, 5))).slice(0, 3);
      bad.push(`${f}${near.length ? `  (может быть: ${near.join(", ")})` : ""}`);
      continue;
    }
    if (!dry) {
      await sharp(path.join(src, f)).rotate().resize(W, H, { fit: "cover", position: sharp.strategy.attention }).jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(dest, `${id}.jpg`));
    }
    done += 1;
    console.log(`${dry ? "ок " : "→  "} ${f} → data/cards-art/${id}.jpg${have.has(id) ? "  (заменён)" : ""}`);
  }
  console.log(`\nГотово: ${done} из ${files.length}${dry ? " (пробный запуск)" : ""}.`);
  if (bad.length) console.log(`Не опознаны (имя файла должно совпадать с id героя):\n  ${bad.join("\n  ")}`);
} finally {
  rmSync(out, { recursive: true, force: true });
}
