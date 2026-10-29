/**
 * Симуляция баланса боёв карточек.
 *
 *   node tools/cards-balance.mjs [боёв=4000] [--strict]
 *
 * 1. Собирает движок (tsc → .tsc-tests/), как `tools/run-tests.mjs`.
 * 2. Матрица «класс против класса»: отряды из 4 героев одного класса, равные ранги и уровни.
 * 3. Случайные равные отряды: доля побед по классам, стихиям и по сторонам (A/B).
 * 4. Выводит таблицы; с `--strict` завершается с кодом 1, если любой класс или стихия
 *    уходят за коридор 40–60% побед (нужно, чтобы ни один класс не доминировал); для матрицы класс-на-класс коридор шире: 30–70%.
 */

import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, ".tsc-tests");
const N = Math.max(200, Number(process.argv.find((a) => /^\d+$/.test(a))) || 4000);
const strict = process.argv.includes("--strict");
const LEVEL = 10;
const BAND = [0.4, 0.6];

const tsc = spawnSync("npx tsc -p tsconfig.tools.json", { cwd: root, stdio: "inherit", shell: true });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);
const load = (p) => import(pathToFileURL(path.join(out, p)).href);

try {
  const { CATALOG } = await load("lib/cards/catalog.js");
  const { simulate, seeded } = await load("lib/cards/battle.js");
  const { unitOf, prepareSides, weekIndexOf } = await load("lib/server/cards-battle.js");
  const { CLASSES, ELEMENTS } = await load("lib/cards/config.js");

  const rng = seeded(20260101);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const classes = Object.keys(CLASSES);
  const elements = Object.keys(ELEMENTS);
  const weekMs = 7 * 86_400_000;
  const mk = (cards, side) => cards.map((c, i) => unitOf({ cardId: c.id, level: LEVEL, foil: false }, side, i));
  const fight = (A, B) => {
    const now = 1.7e12 + Math.floor(rng() * 40) * weekMs; // разные недели → разные правила стихий
    const s = prepareSides(mk(A, "a"), mk(B, "b"), now);
    const o = simulate(s.you, s.foe, rng);
    return o.winner === "a" ? 1 : o.winner === "b" ? 0 : 0.5;
  };
  const byRank = (r, cls) => {
    for (const rr of [r, r + 1, r - 1, r + 2, r - 2]) {
      const list = CATALOG.filter((c) => c.rank === rr && (!cls || c.cls === cls));
      if (list.length) return list;
    }
    return CATALOG;
  };
  const ranks = [1, 2, 2, 3];
  /** У поддержки и танков мало героев высоких рангов, поэтому «чистые» классы сравниваем на рангах C/B */
  const mono = [0, 0, 1, 1];
  const draw = (rs, cls) => {
    const used = new Set();
    return rs.map((r) => {
      let c;
      do c = pick(byRank(r, cls));
      while (used.has(c.id));
      used.add(c.id);
      return c;
    });
  };

  /* матрица класс против класса: отряд из одного класса (ранги [1,2,2,3]) */
  const per = Math.max(60, Math.floor(N / (classes.length * classes.length)));
  const matrix = {};
  for (const a of classes) {
    matrix[a] = {};
    for (const b of classes) {
      let w = 0;
      for (let i = 0; i < per; i += 1) {
        const A = draw(mono, a);
        const B = draw(mono, b);
        w += fight(A, B);
      }
      matrix[a][b] = w / per;
    }
  }
  console.log(`\nКласс против класса (отряд из 4 героев одного класса, ранги C/B, ур. ${LEVEL}, ${per} боёв на пару) — доля побед строки:`);
  console.log(["".padEnd(10), ...classes.map((c) => c.slice(0, 8).padStart(8))].join(" "));
  for (const a of classes) console.log([a.padEnd(10), ...classes.map((b) => (matrix[a][b] * 100).toFixed(0).padStart(7) + "%")].join(" "));

  const avg = classes.map((a) => [a, classes.reduce((t, b) => t + matrix[a][b], 0) / classes.length]);
  console.log("Среднее по строке: " + avg.map(([a, v]) => `${a} ${(v * 100).toFixed(0)}%`).join(" · "));
  const matrixFails = avg.filter(([, v]) => v < 0.3 || v > 0.7).map(([a, v]) => `матрица: ${a} ${(v * 100).toFixed(0)}%`);

  /* случайные равные отряды */
  const stat = { cls: {}, el: {}, side: [0, 0] };
  const bump = (m, k, w) => ((m[k] ??= { w: 0, n: 0 }), (m[k].w += w), (m[k].n += 1));
  for (let i = 0; i < N; i += 1) {
    const A = draw(ranks);
    const B = draw(ranks);
    const w = fight(A, B);
    stat.side[0] += w;
    stat.side[1] += 1 - w;
    for (const c of A) {
      bump(stat.cls, c.cls, w);
      bump(stat.el, c.element, w);
    }
    for (const c of B) {
      bump(stat.cls, c.cls, 1 - w);
      bump(stat.el, c.element, 1 - w);
    }
  }
  const fails = [...matrixFails];
  const show = (title, m) => {
    console.log(`\n${title}:`);
    for (const [k, v] of Object.entries(m).sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n)) {
      const p = v.w / v.n;
      const bad = p < BAND[0] || p > BAND[1];
      if (bad) fails.push(`${title}: ${k} ${(p * 100).toFixed(1)}%`);
      console.log(`  ${k.padEnd(10)} ${(p * 100).toFixed(1).padStart(5)}%  (${v.n} появлений)${bad ? "  ← вне коридора" : ""}`);
    }
  };
  show("Случайные равные отряды — доля побед по классу героя", stat.cls);
  show("… по стихии героя", stat.el);
  console.log(`\nСторона A: ${((stat.side[0] / N) * 100).toFixed(1)}% побед (должно быть ≈ 50%: нет преимущества первого хода у стороны)`);
  const sideBad = Math.abs(stat.side[0] / N - 0.5) > 0.06;
  if (sideBad) fails.push("сторона A/B");
  if (fails.length) {
    console.log(`\nВне коридора ${BAND[0] * 100}–${BAND[1] * 100}%:\n  ${fails.join("\n  ")}`);
    if (strict) process.exitCode = 1;
  } else console.log("\nБаланс в коридоре.");
} finally {
  rmSync(out, { recursive: true, force: true });
}
