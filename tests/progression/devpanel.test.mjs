/**
 * Dev-панель (§15 этап 7): операции, которые она отправляет в движок, —
 * «+N к счётчику», выдача/изъятие XP и AC с причиной, ручная выдача тега.
 *
 * Главная проверка §16: событие, меняющее счётчик, РЕАЛЬНО разблокирует
 * достижение — не просто пишет число в документ.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { at, apply, freshDoc } from "./helpers.mjs";

test("dev: +N к счётчику разблокирует достижения и начисляет их награду", () => {
  const r = apply(
    freshDoc(),
    { type: "DEV_ADJUST", metric: "EPISODES_COMPLETED", delta: 10 },
    {},
    at(10, 0),
  );

  assert.equal(r.doc.counters.EPISODES_COMPLETED, 10, "счётчик подвинулся");
  assert.ok(r.doc.achievements.ach_episodes_1?.unlockedAt, "порог 1 серии");
  assert.ok(r.doc.achievements.ach_episodes_10?.unlockedAt, "порог 10 серий");

  const unlocked = r.effects.filter((e) => e.type === "ACHIEVEMENT_UNLOCKED");
  assert.equal(unlocked.length, 2, "оба порога закрыты одним событием");
  assert.ok(r.doc.progress.xpTotal > 0, "XP за достижения реально на счету");
  assert.ok(r.doc.ledger.some((e) => e.type === "ach_episodes_10"), "награда в журнале");
});

test("dev: повторное событие с тем же счётчиком не дублирует разблокировку", () => {
  const first = apply(
    freshDoc(),
    { type: "DEV_ADJUST", metric: "COMMENTS_VALID", delta: 1 },
    {},
    at(10, 0),
  );
  const second = apply(
    first.doc,
    { type: "DEV_ADJUST", metric: "COMMENTS_VALID", delta: 1 },
    {},
    at(10, 1),
  );

  assert.equal(first.doc.counters.COMMENTS_VALID, 1);
  assert.equal(second.doc.counters.COMMENTS_VALID, 2);
  assert.ok(first.doc.achievements.ach_comments_1?.unlockedAt, "первый комментарий закрыт");
  assert.ok(
    !second.effects.some((e) => e.type === "ACHIEVEMENT_UNLOCKED"),
    "то же достижение второй раз не выдаётся",
  );
  assert.equal(second.doc.achievements.ach_comments_1.unlockedAt, first.doc.achievements.ach_comments_1.unlockedAt);
});

test("dev: счётчик не уходит ниже нуля", () => {
  const r = apply(freshDoc(), { type: "DEV_ADJUST", metric: "RATINGS", delta: -5 }, {}, at(10, 0));
  assert.equal(r.doc.counters.RATINGS, 0);
});

test("dev: выдача тега — один раз, с эффектом и записью источника", () => {
  const first = apply(freshDoc(), { type: "DEV_TAG_GRANTED", tagId: "tag_ronin" }, {}, at(10, 0));

  assert.ok(first.doc.tags.tag_ronin, "тег в собрании");
  assert.equal(first.doc.tags.tag_ronin.source, "admin", "источник — ручная выдача");
  assert.ok(first.effects.some((e) => e.type === "TAG_UNLOCKED" && e.tagId === "tag_ronin"));

  const second = apply(first.doc, { type: "DEV_TAG_GRANTED", tagId: "tag_ronin" }, {}, at(10, 1));
  assert.equal(second.effects.filter((e) => e.type === "TAG_UNLOCKED").length, 0, "повторно не выдаётся");
  assert.equal(second.rejected?.reason, "tag_not_grantable");
  assert.ok(second.doc.rejected.some((e) => e.reason === "tag_not_grantable"), "отказ в логе антиабьюза");
});

test("dev: несуществующий тег не выдаётся", () => {
  const r = apply(freshDoc(), { type: "DEV_TAG_GRANTED", tagId: "tag_missing" }, {}, at(10, 0));
  assert.equal(Object.keys(r.doc.tags).length, 0);
  assert.equal(r.rejected?.reason, "tag_not_grantable");
});

test("dev: ADMIN_GRANT пишет причину в журнал и не уводит баланс ниже нуля", () => {
  const plus = apply(
    freshDoc(),
    { type: "ADMIN_GRANT", currency: "AC", amount: 500, reason: "dev-panel" },
    {},
    at(10, 0),
  );
  assert.equal(plus.doc.progress.acBalance, 500);
  const entry = plus.doc.ledger.find((e) => e.source === "ADMIN" && e.currency === "AC");
  assert.ok(entry, "запись выдачи в USER_REWARDS_LOG");
  assert.equal(entry.amount, 500);
  assert.equal(entry.metadata?.reason, "dev-panel");
  assert.ok(plus.effects.some((e) => e.type === "AC_GAINED"));

  const minus = apply(
    plus.doc,
    { type: "ADMIN_GRANT", currency: "AC", amount: -9999, reason: "dev-panel" },
    {},
    at(10, 1),
  );
  assert.equal(minus.doc.progress.acBalance, 0, "баланс не уходит в минус");
  assert.ok(
    minus.doc.ledger.some((e) => e.source === "ADMIN" && e.amount === -9999),
    "списание — та же запись журнала с отрицательной суммой",
  );
});
