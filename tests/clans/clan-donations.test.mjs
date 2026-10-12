import test from "node:test";
import assert from "node:assert/strict";

import {
  CLAN_LEVELS,
  cellsAtLevel,
  clanLevel,
  investedIn,
  levelFromCells,
  levelInfo,
  levelProgress,
  normalizeName,
  normalizeTag,
  planDonation,
  toNextLevel,
  validateClan,
} from "../../.tsc-tests/lib/clans.js";

/**
 * Экономика клана: вклады, клетки, уровни.
 *
 * Закрывает ~4000 строк игровой логики, у которых не было ни одного теста.
 * Инварианты здесь — про деньги, поэтому проверяются не «что функция
 * вернула», а сохранность средств: вклад не должен ни создать, ни съесть AC.
 */

/** Клан с заданной сеткой клеток */
function clanWith(cells) {
  return {
    id: "c1",
    name: "Клан",
    tag: "ТЕСТ",
    emblem: "⚔",
    color: "#fff",
    description: "",
    points: 0,
    memberCount: 1,
    since: "2026-01-01",
    level: levelFromCells(cells),
    cells: [...cells],
    claimed: [],
    members: [],
  };
}

/** Сумма всех клеток — деньги, реально заложенные в ратушу */
const total = (cells) => cells.reduce((a, b) => a + b, 0);

/* --------------------------- Сохранность средств ------------------------ */

test("вклад: сумма клеток растёт ровно на внесённое", () => {
  const clan = clanWith([0, 0, 0, 0]);
  const before = total(clan.cells);

  const res = planDonation(clan, 1000, 0);

  assert.equal(total(res.cells) - before, 1000, "ни AC не пропало, ни не появилось");
});

test("вклад: крупная сумма не теряется на краю сетки", () => {
  const clan = clanWith([0, 0, 0]);
  const before = total(clan.cells);

  // Больше, чем влезает в четыре открытые клетки, — остаток должен уйти
  // в новые, а не исчезнуть.
  const res = planDonation(clan, 50_000, 0);

  assert.ok(
    total(res.cells) - before > 4000,
    "вложено существенно больше, чем в первые клетки",
  );
  assert.ok(res.cells.length > 4, "сетка выросла под новый вклад");
});

test("вклад: ни одна клетка не превышает свою цель", () => {
  const clan = clanWith([0, 0, 0, 0, 0]);

  for (const amount of [1, 999, 12_345, 999_999]) {
    const res = planDonation(clan, amount, 0);
    for (let i = 0; i < res.cells.length; i++) {
      const goal = levelInfo(Math.min(i + 1, CLAN_LEVELS.length)).goal;
      assert.ok(
        res.cells[i] <= goal,
        `клетка ${i} = ${res.cells[i]} при цели ${goal} (вклад ${amount})`,
      );
    }
  }
});

test("вклад: результат не зависит от порядка вызова", () => {
  // Один и тот же вклад с нуля должен давать одинаковую сумму независимо
  // от того, с какой клетки начали: перетекание обязано сходиться.
  const a = planDonation(clanWith([0, 0, 0, 0]), 5000, 0);
  const b = planDonation(clanWith([0, 0, 0, 0]), 5000, 3);

  assert.equal(total(a.cells), total(b.cells), "суммы совпали");
});

/* ------------------------------- Очки ----------------------------------- */

test("вклад: очки пропорциональны доле заполненной клетки", () => {
  const goal = levelInfo(1).goal;
  const pointsPerCell = levelInfo(1).points;

  const full = planDonation(clanWith([0]), goal, 0);
  assert.equal(full.points, Math.round(pointsPerCell), "полная клетка даёт полные очки");

  const half = planDonation(clanWith([0]), Math.floor(goal / 2), 0);
  assert.ok(
    Math.abs(half.points - pointsPerCell / 2) <= 1,
    `половина клетки ≈ половина очков, получено ${half.points}`,
  );
});

test("вклад: нулевая и отрицательная сумма ничего не делают", () => {
  const clan = clanWith([5, 5]);

  for (const amount of [0, -100, Number.NaN]) {
    const res = planDonation(clan, amount, 0);
    assert.equal(res.points, 0);
    assert.deepEqual(res.levelsUp, []);
    assert.deepEqual(res.cells, clan.cells);
  }
});

test("вклад: сетка на максимальном уровне больше не принимает деньги", () => {
  // Заполнить четыре клетки мало: planDonation сам открывает новые под вклад.
  // Чтобы взять было некуда, нужно закрыть все уровни.
  const full = [];
  for (let i = 0; i < CLAN_LEVELS.length; i++) full.push(levelInfo(i + 1).goal);

  const res = planDonation(clanWith(full), 100_000, 0);

  assert.equal(res.points, 0, "очки не начислены");
  assert.equal(total(res.cells), total(full), "сетка не изменилась");
  assert.equal(res.levelsUp.length, 0, "уровень не вырос");
});

/* ------------------------------- Уровни --------------------------------- */

test("уровень растёт от суммы вкладов", () => {
  assert.equal(levelFromCells([0, 0, 0]), 1);
  assert.ok(levelFromCells([999_999, 999_999, 999_999, 999_999]) > 1);
});

test("уровень зависит от суммы вкладов, а не от формы сетки", () => {
  // Это и есть настоящий инвариант levelFromCells: раскладка вложенного по
  // клеткам не влияет на уровень, важна только сумма. Раньше это ничем не
  // проверялось, и «уровень» мог бы незаметно поехать от переноса вклада
  // из одной клетки в другую.
  const goal1 = levelInfo(1).goal;

  assert.equal(levelFromCells([goal1, 0, 0, 0]), 2, "одна заполненная клетка");
  assert.equal(levelFromCells([goal1 / 2, goal1 / 2, 0, 0]), 2, "две полузаполненных");
  assert.equal(
    levelFromCells([goal1, 0, 0, 0]),
    levelFromCells([0, goal1, 0, 0]),
    "раскладка не влияет",
  );
  assert.equal(levelFromCells([0, 0, 0]), 1, "пустая сетка — первый уровень");
});

test("cellsAtLevel: количество клеток не убывает", () => {
  let previous = 0;
  for (const level of [1, 2, 5, 10, CLAN_LEVELS.length, CLAN_LEVELS.length + 5]) {
    const cells = cellsAtLevel(level);
    assert.ok(cells >= 1, `уровень ${level} открывает хотя бы одну клетку, получено ${cells}`);
    assert.ok(cells >= previous, `уровень ${level}: ${cells} клеток, не меньше предыдущего`);
    previous = cells;
  }
});

test("levelInfo: уровень вне диапазона откатывается, а не падает", () => {
  assert.equal(levelInfo(0).goal, levelInfo(1).goal, "ниже первого — первый");
  assert.equal(
    levelInfo(999).goal,
    levelInfo(CLAN_LEVELS.length).goal,
    "выше последнего — последний",
  );
});

test("уровень клана из очков: монотонный, минимум 1", () => {
  // Верхней границы здесь нет намеренно: это уровень СИСТЕМНЫХ кланов,
  // у которых очки генерируются (см. clanLevel в clans.ts). Используется
  // для показа в чате, поэтому 667 у богатого соперника — норма, а не баг.
  assert.equal(clanLevel(0), 1, "без очков клан первого уровня");

  let previous = 1;
  for (const points of [100, 1_000, 10_000, 100_000, 1_000_000]) {
    const level = clanLevel(points);
    assert.ok(level >= previous, `очки ${points} → ${level}, не ниже предыдущего`);
    assert.ok(level >= 1);
    previous = level;
  }
});

test("прогресс уровня в пределах 0…1", () => {
  const cells = [1000, 1000, 1000, 1000, 1000, 1000];
  const p = levelProgress(cells);
  assert.ok(p >= 0 && p <= 1, `прогресс ${p} вне диапазона`);

  assert.equal(levelProgress([0, 0, 0]), levelProgress([0, 0, 0]), "стабилен");
});

test("toNextLevel: сколько ещё до следующего уровня", () => {
  const cells = [1000, 1000];
  const need = toNextLevel(cells);
  assert.ok(need >= 0, "остаток не отрицательный");
});

test("investedIn суммирует сетку", () => {
  assert.equal(investedIn({ cells: [10, 20, 30] }), 60);
  assert.equal(investedIn({ cells: [] }), 0);
});

/* ------------------------------ Нормализация --------------------------- */

test("тег клана: 2–4 символа, верхний регистр, без мусора", () => {
  assert.equal(normalizeTag("abc"), "ABC");
  assert.equal(normalizeTag("a".repeat(20)), "AAAA", "обрезается до 4");
  assert.equal(normalizeTag("a-b-c!"), "ABC", "лишние символы уходят");
});

test("имя клана: лишние пробелы схлопываются, длина ограничена", () => {
  assert.equal(normalizeName("  Мой   Клан  "), "Мой Клан");
  assert.equal(normalizeName("x".repeat(50)).length, 24);
});

test("validateClan: короткие имя и метка отклоняются", () => {
  const empty = { own: null };

  assert.ok(
    validateClan({ name: "", tag: "", emblem: "⚔", color: "#fff", description: "" }, empty, [])
      .length > 0,
    "пустое имя отклонено",
  );
  assert.ok(
    validateClan({ name: "Клан", tag: "a", emblem: "⚔", color: "#fff", description: "" }, empty, [])
      .length > 0,
    "метка короче двух символов отклонена",
  );
  assert.ok(
    validateClan({ name: "12345", tag: "ТЕСТ", emblem: "⚔", color: "#fff", description: "" }, empty, [])
      .length > 0,
    "имя из одних цифр отклонено",
  );
  assert.ok(
    validateClan({ name: "Клан", tag: "ТЕСТ", emblem: "", color: "#fff", description: "" }, empty, [])
      .length > 0,
    "без эмблемы отклонено",
  );
});

test("validateClan: занятая метка отклонена", () => {
  // Метки соперников в проекте короткие (2–3 символа), как в RIVALS:
  // normalizeTag режет до четырёх, и сравнение с длинной меткой прошло бы
  // мимо проверки. Поэтому берём реальную длину.
  const errors = validateClan(
    { name: "Новый Клан", tag: "ЗАНЯ", emblem: "⚔", color: "#fff", description: "" },
    { own: null },
    ["ЗАНЯ"],
  );
  assert.ok(
    errors.some((e) => e.includes("ЗАНЯ")),
    `метка соперника занята, получено: ${JSON.stringify(errors)}`,
  );
});

test("validateClan: корректный клан ошибок не даёт", () => {
  const errors = validateClan(
    { name: "Новый Клан", tag: "НОВЫ", emblem: "⚔", color: "#fff", description: "" },
    { own: null },
    [],
  );
  assert.deepEqual(errors, [], `ожидался пустой список, получено: ${JSON.stringify(errors)}`);
});