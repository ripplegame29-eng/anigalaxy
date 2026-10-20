/**
 * Счётчики, добавленные ради медальных достижений.
 *
 * Главное здесь — что счётчик не врёт: повторные события не должны задваивать
 * прогресс, а жанр, названный по-разному, должен узнаваться.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { resolveMetrics } from "../../.tsc-tests/lib/progression/engine.js";
import { applyEvent } from "../../.tsc-tests/lib/progression/engine.js";
import { genreCount, genreKeyOf, trackGenre } from "../../.tsc-tests/lib/progression/genres.js";
import { PROGRESSION_CONFIG } from "../../.tsc-tests/lib/progression/progression.config.js";
import { EMPTY_DOC } from "../../.tsc-tests/lib/progression/doc.js";

const cfg = PROGRESSION_CONFIG;

const ctx = {
  now: Date.parse("2026-03-01T12:00:00Z"),
  todayIdx: 1,
  weekIdx: 1,
  dayKey: "2026-03-01",
  tz: "UTC",
};

function metricsOf(doc) {
  return resolveMetrics(doc, {}, cfg);
}

/* --------------------------------- Жанры --------------------------------- */

test("жанр узнаётся по любому написанию", () => {
  assert.equal(genreKeyOf("Сёнэн"), "shonen");
  assert.equal(genreKeyOf("Сенен"), "shonen", "без «ё»");
  assert.equal(genreKeyOf("Shounen"), "shonen");
  assert.equal(genreKeyOf("Shonen"), "shonen");
  assert.equal(genreKeyOf("Фантастика"), "fantasy");
  assert.equal(genreKeyOf("Фэнтези"), "fantasy");
  assert.equal(genreKeyOf("Fantasy"), "fantasy");
});

test("чужой жанр не превращается в сёнэн", () => {
  assert.equal(genreKeyOf("Комедия"), undefined);
  assert.equal(genreKeyOf("Романтика"), undefined);
  assert.equal(genreKeyOf(""), undefined);
  // «сёнэн» внутри другого слова — да, а вот «сен» — нет
  assert.equal(genreKeyOf("Сенгоку"), undefined);
});

test("повторное событие по тайтлу не задваивает счётчик", () => {
  const map = {};
  trackGenre(map, "12", ["Сёнэн", "Приключения"]);
  trackGenre(map, "12", ["Сёнэн", "Приключения"]);
  trackGenre(map, "88", ["Сёнэн"]);
  assert.equal(map["Сёнэн"].length, 2, "два разных тайтла");
  assert.equal(map["Приключения"].length, 1, "третий тайтл без этого жанра");
  assert.equal(genreCount(map, "shonen"), 2);
});

test("один тайтл с несколькими жанрами засчитывается в каждый", () => {
  const map = {};
  trackGenre(map, "7", ["Сёнэн", "Фантастика"]);
  assert.equal(genreCount(map, "shonen"), 1);
  assert.equal(genreCount(map, "fantasy"), 1);
});

/* ------------------------------ Рекорд суток ------------------------------ */

function watch(doc, seconds, now = ctx.now) {
  return applyEvent(
    doc,
    {
      type: "EPISODE_TICK",
      titleId: "1",
      episodeKey: "1-1",
      seconds,
      speed: 1,
      visible: true,
      durationSec: 1400,
      episodeIndex: 0,
    },
    {},
    { ...ctx, now },
  );
}

test("рекорд суток растёт по мере просмотра", () => {
  let doc = structuredClone(EMPTY_DOC);
  // тик за тиком движем время вперёд, иначе движок посчитает паузу
  let now = ctx.now;
  for (let i = 0; i < 10; i += 1) {
    doc = watch(doc, 30, (now += 30_000)).doc;
  }

  const m = metricsOf(doc);
  assert.equal(m.SECONDS_WATCHED, undefined, "сырых секунд в метриках нет");
  assert.equal(m.MINUTES_WATCHED, 5, "300 секунд → 5 минут");
  // 300 секунд за сутки — это 5 минут, до 1440 (суток) далеко
  assert.equal(m.MAX_MINUTES_IN_DAY, 5);
  assert.ok(m.MAX_MINUTES_IN_DAY < 1440, "сутки ещё не выбраны");
});

test("пауза не начисляет время суток", () => {
  const doc = structuredClone(EMPTY_DOC);
  // разрыв больше паузы — движок не должен засчитывать
  const later = { ...ctx, now: ctx.now + 60 * 60 * 1000 };
  const res = applyEvent(
    doc,
    {
      type: "EPISODE_TICK",
      titleId: "1",
      episodeKey: "1-1",
      seconds: 600,
      speed: 1,
      visible: true,
      durationSec: 1400,
      episodeIndex: 0,
    },
    {},
    later,
  );
  assert.equal(metricsOf(res.doc).MAX_MINUTES_IN_DAY, 0);
});

/* ---------------------------- Мета-достижения ----------------------------- */

test("счётчики «все тайные» и «все достижения» стартуют с нуля", () => {
  const m = metricsOf(structuredClone(EMPTY_DOC));
  assert.equal(m.SECRETS_DONE, 0);
  assert.equal(m.ACHIEVEMENTS_DONE, 0);
});

test("«все достижения» считает и тайные тоже", () => {
  const doc = structuredClone(EMPTY_DOC);
  doc.achievements = {
    ach_start_account: { progress: 1, unlockedAt: 1 },
    ach_secret_return: { progress: 1, unlockedAt: 2 },
    ach_secret_overload: { progress: 1, unlockedAt: 3 },
  };
  const m = metricsOf(doc);
  assert.equal(m.ACHIEVEMENTS_DONE, 3, "все три, включая тайные");
  assert.equal(m.SECRETS_DONE, 2, "из них тайных — два");
});

test("неоткрытые достижения в счётчики не попадают", () => {
  const doc = structuredClone(EMPTY_DOC);
  doc.achievements = {
    ach_start_account: { progress: 1, unlockedAt: 5 },
    ach_episodes_1: { progress: 2, unlockedAt: 0 },
  };
  const m = metricsOf(doc);
  assert.equal(m.ACHIEVEMENTS_DONE, 1);
});

/* --------------------------------- Сезон --------------------------------- */

test("сезон не пройден, пока пропуск не доведён до конца", () => {
  const doc = structuredClone(EMPTY_DOC);
  assert.equal(metricsOf(doc).SEASONS_DONE, 0);
});