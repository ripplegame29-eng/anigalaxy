/**
 * Промежуточная сборка + юнит-тесты прогрессии (§15.2, §0.6).
 *
 *   node tools/run-tests.mjs
 *
 * 1. tsc по tsconfig.tools.json → `.tsc-tests/` (CommonJS, без зависимостей
 *    вне проекта — новых dev-deps не добавляем);
 * 2. `node --test tests/progression/` — тесты на чистом JS импортируют
 *    скомпилированный движок/миграцию/конфиг.
 *
 * Код ошибки = число проваленных проверок (0 — зелёный прогон).
 */

import { spawnSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, ".tsc-tests");

const tsc = spawnSync("npx tsc -p tsconfig.tools.json", {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
if (tsc.status !== 0) {
  console.error("[tests] сборка не удалась");
  process.exit(tsc.status ?? 1);
}

const testDirs = ["progression", "server"];
const files = testDirs.flatMap((dir) => {
  const full = path.join(root, "tests", dir);
  try {
    return readdirSync(full)
      .filter((f) => f.endsWith(".test.mjs"))
      .map((f) => path.join("tests", dir, f));
  } catch {
    return [];
  }
});
if (files.length === 0) {
  console.error("[tests] нет файлов tests/*/*.test.mjs");
  process.exit(1);
}

const run = spawnSync(process.execPath, ["--test", ...files], { cwd: root, stdio: "inherit" });

// сборочные артефакты храним только на время прогона
try {
  rmSync(outDir, { recursive: true, force: true });
} catch {
  // не критично
}

process.exit(run.status ?? 1);
