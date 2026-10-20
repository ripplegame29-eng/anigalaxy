/**
 * Серия дней: уровни, шаг кольца и награды на отметках.
 *
 * Проверяется СКОМПИЛИРОВАННЫЙ код из `.tsc-tests/` (см. tools/run-tests.mjs).
 * Награды сверяются с реальным конфигом проекта: если движник перестанет
 * выдавать AC за серию или у достижения сменится порог, тест упадёт, а не
 * капсула будет обещать то, чего движок не даёт.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  STREAK_FREEZE_MAX,
  STREAK_MARKS,
  formatCountdown,
  msUntilMidnight,
  pluralDays,
  streakReward,
  streakSpan,
  streakTier,
  streakWeek,
} from "../../.tsc-tests/lib/streak-capsule.js";
import { PROGRESSION_CONFIG } from "../../.tsc-tests/lib/progression/progression.config.js";

test("уровень серии: пороги из макета 0/7/30/100/365", () => {
  assert.deepEqual(streakTier(0), { index: 0, name: "Искра" });
  assert.equal(streakTier(6).index, 0, "шестой день ещё Искра");
  assert.equal(streakTier(7).name, "Пламя");
  assert.equal(streakTier(29).index, 1, "29 дней — ещё Пламя");
  assert.equal(streakTier(30).name, "Плазма");
  assert.equal(streakTier(99).index, 2);
  assert.equal(streakTier(100).name, "Звёздный след");
  assert.equal(streakTier(364).index, 3);
  assert.equal(streakTier(365).name, "Сверхновая");
  assert.equal(streakTier(4000).name, "Сверхновая", "выше максимума не растёт");
});

test("кольцо: шаг до следующей отметки и пол после всех отметок", () => {
  const at0 = streakSpan(0);
  assert.equal(at0.prev, 0);
  assert.equal(at0.next, 7);
  assert.equal(at0.percent, 4, "нижняя граница 4% из макета, а не ноль");

  const mid = streakSpan(3);
  assert.equal(mid.next, 7);
  assert.equal(mid.percent, Math.max(4, (3 / 7) * 100), "три дня из семи — почти половина пути");
  assert.ok(mid.percent > 42 && mid.percent < 43, "точная доля шага, не округлённая на глаз");

  const onMark = streakSpan(30);
  assert.equal(onMark.prev, 30, "на отметке шаг начинается заново");
  assert.equal(onMark.next, 60);

  const done = streakSpan(365);
  assert.equal(done.next, null);
  assert.equal(done.percent, 100, "все отметки пройдены — кольцо полное");
});

test("награда на отметке берётся из конфига, а не выдумывается", () => {
  const { economy, achievements } = PROGRESSION_CONFIG;
  assert.equal(economy.streakEveryDays, 7, "движок платит AC каждые 7 дней");

  const week = streakReward(7);
  assert.ok(week, "на неделе награда есть");
  assert.equal(week.ac, economy.streakBonusAc);
  assert.match(week.label, /\+50 AC/);
  assert.match(week.label, /достижение/);

  const month = streakReward(30);
  assert.ok(month);
  assert.equal(month.ac, 0, "30 не кратно 7 — AC не платится");
  // Ищем именно достижение серии: порог 30 есть и у других семейств.
  const ach30 = achievements.find(
    (a) => a.family === "streak" && a.condition.metric === "STREAK_BEST" && a.condition.threshold === 30,
  );
  assert.ok(ach30, "в конфиге есть достижение серии на 30 дней");
  assert.ok(month.label.includes(ach30.name), `в капсуле: ${month.label}`);
  assert.equal(month.achievementId, ach30.id);
});

test("на отметке без награды капсула скажет честно, а не придумает предмет", () => {
  // 60 и 200 не кратны 7, и достижений на таких порогах в проекте нет.
  const hasAch = (d) =>
    PROGRESSION_CONFIG.achievements.some(
      (a) => a.family === "streak" && a.condition.metric === "STREAK_BEST" && a.condition.threshold === d,
    );
  assert.equal(hasAch(60), false, "фикстура конфига: достижения на 60 нет");
  assert.equal(streakReward(60), null);
  assert.equal(streakReward(200), null);
  assert.equal(streakReward(null), null);
});

test("каждая отметка макета разрешается: либо награда, либо честное «нет»", () => {
  for (const mark of STREAK_MARKS) {
    const reward = streakReward(mark);
    if (reward === null) continue;
    const real = PROGRESSION_CONFIG.achievements.some(
      (a) => a.family === "streak" && a.condition.metric === "STREAK_BEST" && a.condition.threshold === mark,
    );
    const acPaid = mark % PROGRESSION_CONFIG.economy.streakEveryDays === 0;
    assert.ok(real || acPaid, `отметка ${mark}: награда есть, но ни AC, ни достижения`);
  }
});

test("склонение: «день / дня / дней»", () => {
  assert.equal(pluralDays(1), "день");
  assert.equal(pluralDays(2), "дня");
  assert.equal(pluralDays(5), "дней");
  assert.equal(pluralDays(11), "дней");
  assert.equal(pluralDays(21), "день");
  assert.equal(pluralDays(22), "дня");
  assert.equal(pluralDays(0), "дней");
});

test("неделя отмечает ровно дни серии, а не произвольные семь", () => {
  // Серия из 3 дней, последняя активность — среда 11 марта 2026.
  const week = streakWeek("2026-03-11", 3);
  assert.equal(week.days.length, 7);
  assert.equal(week.days[0].label, "Пн", "неделя начинается с понедельника");
  assert.equal(week.days[6].label, "Вс");

  for (const key of ["2026-03-09", "2026-03-10", "2026-03-11"]) {
    assert.ok(week.done.has(key), `${key} входит в серию`);
  }
  assert.ok(week.done.size === 3, "отмечено ровно столько дней, сколько в серии");
  assert.equal(week.done.has("2026-03-08"), false, "день до начала серии не отмечен");
});

test("пустая серия не отмечает ничего", () => {
  const week = streakWeek("2026-03-11", 0);
  assert.equal(week.done.size, 0);
});

test("заморозки: максимум берётся из конфига услуги", () => {
  assert.equal(STREAK_FREEZE_MAX, PROGRESSION_CONFIG.economy.freezeMax);
});

test("обратный отсчёт до полуночи не отрицательный", () => {
  const now = new Date(2026, 2, 11, 23, 59, 30);
  const ms = msUntilMidnight(now);
  assert.ok(ms > 0 && ms <= 30_000, "до полуночи полминуты");
  assert.equal(formatCountdown(ms), "00:00:30");
  assert.equal(formatCountdown(-5000), "00:00:00", "прошлое время не показывается минусом");
});