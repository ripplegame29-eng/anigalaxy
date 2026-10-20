/**
 * Награды за рубежи реферальной программы.
 *
 * Проверяется СКОМПИЛИРОВАННЫЙ код из `.tsc-tests/` (см. tools/run-tests.mjs).
 * Сверяется с настоящим конфигом: если у тега или рамки поменяется рубеж,
 * тест упадёт, а не каталог будет обещать один порог, а выдавать другой.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { FRAMES, unlockHint } from "../../.tsc-tests/lib/cosmetics.js";
import { PROGRESSION_CONFIG } from "../../.tsc-tests/lib/progression/progression.config.js";
import { applyEvent } from "../../.tsc-tests/lib/progression/engine.js";
import { at, ctx, freshDoc } from "./helpers.mjs";

/** Рубежи из хранилища наград — те же числа, что показывает страница рефералки */
const MARKS = { sensei: 1, geass: 3, guy: 10, wings: 30, hero: 100 };

const frame = (id) => FRAMES.find((item) => item.id === id);

test("рамки за рубежи открываются по числу друзей", () => {
  assert.equal(frame("frame-36").unlock.referral, MARKS.geass, "Геасс — за 3 друзей");
  assert.equal(frame("frame-03").unlock.referral, MARKS.guy, "Маска гуля — за 10 друзей");
  assert.equal(frame("frame-27").unlock.referral, MARKS.wings, "Крылья свободы — за 30 друзей");
});

test("подпись условия совпадает с рубежом", () => {
  assert.equal(unlockHint(frame("frame-36").unlock), "3 друга");
  assert.equal(unlockHint(frame("frame-03").unlock), "10 друзей");
  assert.equal(unlockHint(frame("frame-27").unlock), "30 друзей");
});

test("теги за рубежи объявлены в конфиге", () => {
  const sensei = PROGRESSION_CONFIG.tags.find((t) => t.id === "tag_sensei");
  const hero = PROGRESSION_CONFIG.tags.find((t) => t.id === "tag_geroyinogomira");
  assert.equal(sensei.source, "referral");
  assert.equal(sensei.friends, MARKS.sensei);
  assert.equal(hero.source, "referral");
  assert.equal(hero.friends, MARKS.hero);
  assert.equal(hero.price, undefined, "у рубежного тега не осталось цены в магазине");
  assert.ok(
    !PROGRESSION_CONFIG.shop.some((item) => item.id === "tag_geroyinogomira"),
    "рубежный тег не продаётся за AC",
  );
});

/** Документ, в котором уже засчитано N приглашений */
function withReferrals(n) {
  let doc = freshDoc();
  for (let i = 1; i <= n; i += 1) {
    doc = applyEvent(
      doc,
      { type: "REFERRAL_REGISTERED", refCode: "CODE", newNick: `друг${i}` },
      {},
      ctx(at(9, i)),
    ).doc;
  }
  return doc;
}

test("движок выдаёт тег, когда рубеж взят", () => {
  const doc = withReferrals(MARKS.sensei);
  assert.ok(doc.tags.tag_sensei, "«Сенсей» выдан за первого друга");
  assert.equal(doc.tags.tag_sensei.source, "referral");
});

test("до рубежа тег не выдаётся", () => {
  const doc = freshDoc();
  assert.equal(doc.tags.tag_sensei, undefined, "без друзей тега нет");
});

test("рубеж в 100 друзей закрывает только старший тег", () => {
  const many = withReferrals(MARKS.hero);
  assert.ok(many.tags.tag_geroyinogomira, "«Герой иного мира» выдан");
  assert.ok(many.tags.tag_sensei, "младший тег остаётся на месте");

  const few = withReferrals(MARKS.sensei);
  assert.equal(few.tags.tag_geroyinogomira, undefined, "на первом друге старшего тега нет");
});

test("повторная выдача не происходит", () => {
  const once = withReferrals(MARKS.sensei);
  const again = applyEvent(once, { type: "TAG_EQUIPPED", tagId: "tag_sensei" }, {}, ctx(at(10, 0)));
  assert.equal(
    again.doc.tags.tag_sensei.acquiredAt,
    once.tags.tag_sensei.acquiredAt,
    "дата получения не меняется",
  );
  assert.ok(
    !again.effects.some((e) => e.type === "TAG_UNLOCKED" && e.tagId === "tag_sensei"),
    "эффекта повторной выдачи нет",
  );
});

test("приглашение уже прошедшего аккаунта не удваивает рубежи", () => {
  const doc = freshDoc();
  const first = applyEvent(
    doc,
    { type: "REFERRAL_REGISTERED", refCode: "CODE", newNick: "друг1" },
    {},
    ctx(at(9, 1)),
  ).doc;
  const repeat = applyEvent(
    first,
    { type: "REFERRAL_REGISTERED", refCode: "CODE", newNick: "друг1" },
    {},
    ctx(at(9, 2)),
  );
  assert.equal(repeat.rejected?.reason, "already_referred");
  assert.equal(Object.keys(repeat.doc.tags).filter((id) => id === "tag_sensei").length, 1);
});
