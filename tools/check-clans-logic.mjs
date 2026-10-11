/**
 * Проверка механики кланов: уровни, клетки, перетекание вклада, награды.
 * Запуск: node tools/check-clans-logic.mjs
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
const C = require("../.tsc-tests/lib/clans.js");

/* ---------------- Уровни и клетки ---------------- */
console.log("уровней в лестнице:", C.CLAN_LEVELS.length);
assert.ok(C.CLAN_LEVELS.length >= 15, "лестница уровней непустая");
assert.equal(C.cellsAtLevel(1), 1, "на первом уровне одна клетка");
assert.equal(C.cellsAtLevel(5), 5, "на пятом уровне пять клеток");
assert.ok(
  C.CLAN_LEVELS.every((l, i) => i === 0 || l.goal > C.CLAN_LEVELS[i - 1].goal),
  "цель клетки растёт с уровнем",
);

/* ---------------- Счёт уровня по вкладу ---------------- */
const goal1 = C.levelInfo(1).goal;
assert.equal(C.levelFromCells([0]), 1, "пустой клан — первый уровень");
assert.equal(C.levelFromCells([goal1 - 1]), 1, "почти заполнено — уровень прежний");
assert.equal(C.levelFromCells([goal1]), 2, "заполнена первая клетка — второй уровень");

const goal2 = C.levelInfo(2).goal;
const two = [goal1, goal2];
assert.equal(C.levelFromCells(two), 3, "две заполненные клетки — третий уровень");

assert.equal(C.investedIn(two), goal1 + goal2, "вложено сумма клеток");
assert.ok(C.toNextLevel([goal1]) > 0, "до следующего уровня что-то не хватает");
assert.equal(C.toNextLevel(two), C.levelInfo(3).goal, "не хватает ровно цель третьей клетки");
assert.ok(C.levelProgress([goal1]) >= 0 && C.levelProgress([goal1]) < 1, "прогресс внутри уровня 0…1");

/* ---------------- План вклада ---------------- */
const clan = {
  id: "test",
  name: "Тест",
  tag: "TST",
  emblem: "🛡",
  color: "#fff",
  description: "",
  points: 0,
  members: 1,
  since: "2026-01-01",
  level: 1,
  cells: [0],
  claimed: [],
  mine: true,
};

// Вклад ровно в цель первой клетки
let plan = C.planDonation(clan, goal1, 0);
assert.deepEqual(plan.cells.slice(0, 1), [goal1], "клетка заполнена под цель");
assert.equal(plan.points, Math.round(C.levelInfo(1).points), "очки = полная клетка");
assert.deepEqual(plan.levelsUp, [2], "открылся второй уровень");

// Перетекание: 1.5 клетки — вторая наполовину
plan = C.planDonation(clan, Math.round(goal1 + goal2 / 2), 0);
assert.equal(plan.cells[0], goal1, "первая клетка полная");
assert.equal(plan.cells[1], Math.round(goal2 / 2), "остаток ушёл во вторую");
assert.deepEqual(plan.levelsUp, [2], "уровень поднялся один раз");
console.log("перетекание:", plan.cells.slice(0, 2).join(" / "));

// Всё в одну клетку, пока хватает места: она полная, дальше нечего
plan = C.planDonation(clan, 10, 0);
assert.equal(plan.cells[0], 10, "малый вклад идёт в выбранную клетку");
assert.equal(plan.levelsUp.length, 0, "уровень не вырос");

// Вклада больше, чем места в текущих клетках — новые клетки откроются
const big = C.planDonation(clan, goal1 + goal2 * 3, 0);
assert.ok(big.cells.length >= 3, "открылись новые клетки под крупный вклад");
assert.deepEqual(big.levelsUp, [2, 3, 4], "выросли уровни 2, 3 и 4");
console.log("крупный вклад открыл клеток:", big.cells.length, "| уровни:", big.levelsUp.join(","));

// Ноль валюты — ничего не происходит
const empty = C.planDonation(clan, 0, 0);
assert.equal(empty.points, 0, "нулевой вклад не даёт очков");
assert.deepEqual(empty.cells, clan.cells, "клетки не тронуты");

// Очки пропорциональны доле клетки
const half = C.planDonation(clan, Math.round(goal1 / 2), 0);
assert.ok(
  half.points > 0 && half.points < C.levelInfo(1).points,
  `полклетки даёт промежуточные очки (${half.points} из ${Math.round(C.levelInfo(1).points)})`,
);

/* ---------------- Валидация ---------------- */
const state = { own: null, pending: 0, contributed: 0 };
assert.ok(C.validateClan({ name: "Тест", tag: "ТСТ", emblem: "🛡", color: "#fff", description: "" }, state, []).length === 0,
  "нормальный клан проходит валидацию");
assert.ok(C.validateClan({ name: "ab", tag: "A", emblem: "🛡", color: "#fff", description: "" }, state, []).length >= 2,
  "короткие имя и метка отклоняются");
assert.ok(C.validateClan({ name: "123", tag: "ТСТ", emblem: "🛡", color: "#fff", description: "" }, state, []).length > 0,
  "имя из цифр отклоняется");
assert.ok(C.validateClan({ name: "Клан", tag: "ТНГ", emblem: "🛡", color: "#fff", description: "" }, state, []).length > 0,
  "занятая метка отклоняется");
assert.ok(C.validateClan({ name: "Клан", tag: "ТСТ", emblem: "", color: "#fff", description: "" }, state, []).length > 0,
  "без эмблемы отклоняется");

/* ---------------- Нормализация ---------------- */
assert.equal(C.normalizeTag(" ндз "), "НДЗ", "метка приводится в верхний регистр и чистится");
assert.equal(C.normalizeTag("abcd"), "ABCD", "метка обрезается до 4 символов");
assert.equal(C.normalizeName("  Мой   клан  "), "Мой клан", "пробелы схлопываются");
assert.equal(C.normalizeName("x".repeat(40)).length, 24, "имя обрезается до 24 символов");

/* ---------------- Топ и поиск ---------------- */
const withClan = {
  own: { ...clan, points: 100 },
  pending: 0,
  contributed: 50,
};
const all = C.allClans(withClan);
assert.equal(all.length, C.RIVALS.length + 1, "клан игрока добавлен к системным");
assert.ok(all.every((c, i) => i === 0 || c.points <= all[i - 1].points), "топ отсортирован");
assert.ok(C.searchClans(withClan, "обсидиан").length === 1, "поиск по названию сужает выдачу");
assert.ok(C.searchClans(withClan, "обсидиан")[0].name.includes("Обсидиан"), "найден нужный клан");
assert.ok(C.searchClans(withClan, "tst").length === 1, "поиск по метке находит свой клан");
assert.equal(C.searchClans(withClan, "нетакого").length, 0, "пустой результат без ошибок");
assert.equal(C.ownRank(withClan), all.findIndex((c) => c.mine) + 1, "место клана игрока посчитано");

console.log("\nclans-logic: OK");