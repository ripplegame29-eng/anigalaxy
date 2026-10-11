/**
 * Теги (§9.2, §12.3): экипировка, снятие, покупка у движка.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { at, apply, freshDoc } from "./helpers.mjs";

test("тег: экипировка пишет equippedTagId, снятие обнуляет", () => {
  let doc = freshDoc();
  doc = apply(doc, { type: "TAG_EQUIPPED", tagId: "tag_otaku" }, {}, at(12, 0)).doc;
  assert.equal(doc.progress.equippedTagId, "tag_otaku");

  const unequip = apply(doc, { type: "UNEQUIP_TAG" }, {}, at(12, 1));
  assert.equal(unequip.doc.progress.equippedTagId, null, "тег снят");
  assert.equal(unequip.doc.counters.MAX_TAG_SWAPS_IN_DAY, 2, "снятие — тоже смена облика");
});

test("тег: неизвестный id отклоняется", () => {
  const doc = freshDoc();
  const res = apply(doc, { type: "TAG_EQUIPPED", tagId: "tag_missing" }, {}, at(12, 0));
  assert.equal(res.rejected?.reason, "unknown_tag");
  assert.equal(res.doc.progress.equippedTagId, null);
});

test("тег из магазина: покупка списывает AC и добавляет тег в собрание", () => {
  let doc = freshDoc();
  doc = apply(doc, { type: "ADMIN_GRANT", currency: "AC", amount: 500 }, {}, at(9, 0)).doc;
  const before = doc.progress.acBalance;

  const buy = apply(
    doc,
    { type: "SHOP_PURCHASED", itemId: "tag_ronin", kind: "tag", price: 500 },
    {},
    at(9, 1),
  );
  doc = buy.doc;
  assert.equal(doc.progress.acBalance, before - 500, "AC списаны");
  assert.ok(doc.tags.tag_ronin, "тег попал в собрание");
  assert.equal(doc.tags.tag_ronin.source, "shop", "источник — магазин");
  assert.ok(
    buy.effects.some((effect) => effect.type === "TAG_UNLOCKED"),
    "эффект TAG_UNLOCKED испущен",
  );
  assert.ok(
    buy.effects.some((effect) => effect.type === "ITEM_GRANTED"),
    "эффект ITEM_GRANTED испущен",
  );
  assert.ok(doc.ledger.some((entry) => entry.source === "SHOP"), "строка SHOP в журнале");

  // Повторная покупка того же тега — отклонение, баланс не трогаем
  const again = apply(
    doc,
    { type: "SHOP_PURCHASED", itemId: "tag_ronin", kind: "tag", price: 500 },
    {},
    at(9, 2),
  );
  assert.equal(again.rejected?.reason, "already_owned");
  assert.equal(again.doc.progress.acBalance, doc.progress.acBalance, "без списания");
});

test("тег из магазина: без средств покупка отклоняется", () => {
  const doc = freshDoc();
  const res = apply(
    doc,
    { type: "SHOP_PURCHASED", itemId: "tag_ronin", kind: "tag", price: 500 },
    {},
    at(9, 0),
  );
  assert.equal(res.rejected?.reason, "insufficient_ac");
  assert.equal(res.doc.tags.tag_ronin, undefined, "тег не выдан");
});
