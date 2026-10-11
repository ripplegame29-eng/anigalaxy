import { readFileSync } from "node:fs";
import { levelEmblem as ported, ERAS as eras2, eraOf as era2 } from "../src/lib/levelEmblem.js";

const html = readFileSync("C:/Users/WHITE POWER/Desktop/фото/level-emblem.html", "utf8");
// вырезаем компонентную часть оригинального файла (между маркером и началом ДЕМО)
const start = html.indexOf("const ERAS=[");
const end = html.indexOf("/* ============ ДЕМО ============ */");
if (start < 0 || end < 0) { console.error("markers not found"); process.exit(1); }
const src = html.slice(start, end);
const orig = eval(src + "; levelEmblem");

let UID = 0; // сброс детерминированной последовательности в ported? нет — ported имеет свой UID.
// Вместо сравнения сырых строк (UID-счётчик растёт), сравнение по замене id -> TOK
const norm = (s) => s.replace(/g\d+/g, "gX").replace(/id="gX/g, 'id="gX');

const cases = [
  [1, 50, 120, {}], [5, 83, 120, {}], [15, 30, 120, {}], [30, 64, 120, {}],
  [50, 12, 120, {}], [75, 91, 120, {}], [100, 5, 120, {}],
  [1, 50, 48, {}], [5, 83, 48, {}], [15, 30, 48, {}], [30, 64, 48, {}],
  [50, 12, 48, {}], [75, 91, 48, {}], [100, 5, 48, {}],
  [40, 0, 72, { locked: 1 }], [3, 0, 96, { up: 1 }],
];
let ok = 0;
for (const [L, p, s, o] of cases) {
  const a = norm(orig(L, p, s, o));
  const b = norm(ported(L, p, s, o));
  const same = a === b;
  console.log(`level=${L} size=${s} opts=${JSON.stringify(o)} same=${same} lenA=${a.length} lenB=${b.length}`);
  if (!same) {
    const i = findDiff(a, b);
    console.log("  first diff at", i, "A:", a.slice(i - 40, i + 40), "B:", b.slice(i - 40, i + 40));
  } else ok++;
}
console.log("TOTAL same:", ok, "/", cases.length);
function findDiff(a, b) { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return i; return Math.min(a.length, b.length); }
