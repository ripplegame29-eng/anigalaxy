import test from "node:test";
import assert from "node:assert/strict";

import { EMPTY_DOC, parseDoc, PROGRESS_KEY, PROGRESS_SCHEMA } from "../../.tsc-tests/lib/progression/doc.js";
import {
  dayIndex,
  dayIndexFromKey,
  dayKeyOf,
  timeParts,
  weekIndexOf,
} from "../../.tsc-tests/lib/progression/time.js";

test("документ: ключ и схема зафиксированы", () => {
  assert.equal(PROGRESS_KEY, "animehub:progress:v1");
  assert.equal(EMPTY_DOC.schema, PROGRESS_SCHEMA);
  assert.equal(EMPTY_DOC.daily.date, -1, "первое событие всегда ротирует день");
  assert.equal(EMPTY_DOC.quests.day, -1, "первое событие всегда крутит квесты");
});

test("parseDoc: мусор и неверный тип → null", () => {
  assert.equal(parseDoc("не json"), null);
  assert.equal(parseDoc("42"), null);
  assert.equal(parseDoc('"строка"'), null);
  assert.equal(parseDoc(JSON.stringify({ schema: "1" })), null);
  assert.equal(parseDoc(JSON.stringify({ foo: 1 })), null);
});

test("parseDoc: частичный документ дополняется без потери данных", () => {
  const doc = parseDoc(
    JSON.stringify({
      schema: 1,
      progress: { xpTotal: 100, acBalance: 55, level: 3 },
      ledger: [{ id: "x", currency: "XP", amount: 1, status: "confirmed", idempotencyKey: "k" }],
      meta: { migrated: true },
    }),
  );

  assert.ok(doc);
  assert.equal(doc.progress.xpTotal, 100, "значения сохраняются");
  assert.equal(doc.progress.acBalance, 55);
  assert.equal(doc.progress.level, 3);
  assert.equal(doc.ledger.length, 1, "журнал сохраняется");
  assert.equal(doc.meta.migrated, true);
  assert.equal(doc.daily.date, -1, "недостающие секции — из умолчаний");
  assert.ok(doc.progress.tz, "пояс подставлен системный");
  assert.ok(Array.isArray(doc.quests.daily));
});

test("parseDoc: отрицательные и нечисловые значения отсекаются", () => {
  const doc = parseDoc(
    JSON.stringify({
      schema: 1,
      progress: { xpTotal: -50, acBalance: -1, level: 0, streakCurrent: "много" },
      counters: { A: 1 },
      daily: { date: "вчера", counts: { X: 1 } },
    }),
  );
  assert.equal(doc.progress.xpTotal, 0);
  assert.equal(doc.progress.acBalance, 0);
  assert.equal(doc.progress.level, 1, "уровень ≥ 1");
  assert.equal(doc.progress.streakCurrent, 0);
  assert.equal(doc.counters.A, 1);
  assert.equal(doc.daily.date, -1);
  assert.equal(doc.daily.counts.X, 1, "счётчики дней сохраняются");
});

test("время: день зависит от пояса", () => {
  const t = Date.UTC(2026, 2, 10, 23, 30);
  assert.equal(dayKeyOf(t, "UTC"), "2026-03-10");
  assert.equal(dayKeyOf(t, "Asia/Tokyo"), "2026-03-11", "Токио уже 11 марта");
  assert.equal(dayIndex(t, "Asia/Tokyo") - dayIndex(t, "UTC"), 1);
});

test("время: индексы дней и недель детерминированы", () => {
  assert.equal(dayIndexFromKey("1970-01-01"), 0);
  assert.equal(dayIndexFromKey("1970-01-08"), 7);
  assert.equal(dayIndexFromKey("2026-03-10"), dayIndex(Date.UTC(2026, 2, 10), "UTC"));
  assert.ok(Number.isNaN(dayIndexFromKey("вчера")));

  assert.equal(weekIndexOf(0), 0);
  assert.equal(weekIndexOf(6), 0);
  assert.equal(weekIndexOf(7), 1);
  assert.equal(weekIndexOf(13), 1);
  assert.equal(weekIndexOf(14), 2);
});

test("время: локальные часы в поясе", () => {
  const t = Date.UTC(2026, 2, 10, 4, 4);
  assert.deepEqual(timeParts(t, "UTC"), { hour: 4, minute: 4 });
  assert.deepEqual(timeParts(t, "Asia/Tokyo"), { hour: 13, minute: 4 });
});
