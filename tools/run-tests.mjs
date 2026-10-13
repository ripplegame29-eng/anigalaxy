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
import { readdirSync, rmSync, statSync } from "node:fs";
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

/**
 * Все `*.test.mjs` под tests/, а не только tests/progression.
 *
 * Каталоги по домену (`tests/clans/`, `tests/progression/`) полезнее плоского
 * списка: рядом лежат тесты одного модуля. Рекурсия на любую глубину — но
 * структуру глубже двух уровней заводить незачем.
 */
function collectTests(dir) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectTests(full));
    } else if (entry.name.endsWith(".test.mjs")) {
      found.push(full);
    }
  }
  return found;
}

const files = collectTests(path.join(root, "tests")).map((f) =>
  path.relative(root, f),
);
if (files.length === 0) {
  console.error("[tests] не найдено ни одного tests/**/\\*.test.mjs");
  process.exit(1);
}

const run = spawnSync(process.execPath, ["--test", ...files], {
  cwd: root,
  stdio: "inherit",
});

// сборочные артефакты храним только на время прогона
try {
  rmSync(outDir, { recursive: true, force: true });
} catch {
  // не критично
}

process.exit(run.status ?? 1);
