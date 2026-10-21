/**
 * Клан 2.0: целостность данных — территории, соперники, лавка, сундуки.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { RIVALS, TERRITORIES, territoryOf } from "../../.tsc-tests/lib/clan2/data.js";
import { ALL_ITEMS, CHESTS, itemOf, priceOf } from "../../.tsc-tests/lib/clan2/shop.js";

test("территории: уникальные id, соседи существуют и связаны взаимно", () => {
  const ids = new Set(TERRITORIES.map((t) => t.id));
  assert.equal(ids.size, TERRITORIES.length);
  for (const t of TERRITORIES) {
    for (const n of t.near) {
      assert.ok(ids.has(n), `${t.id}: нет соседа ${n}`);
      assert.ok(territoryOf(n).near.includes(t.id), `${t.id} ↔ ${n} не взаимны`);
    }
  }
  assert.ok(TERRITORIES.some((t) => t.start), "есть стартовая территория");
});

test("соперники: уникальные id", () => {
  assert.equal(new Set(RIVALS.map((r) => r.id)).size, RIVALS.length);
});

test("лавка: id предметов уникальны, у платных есть цена", () => {
  assert.equal(new Set(ALL_ITEMS.map((i) => i.id)).size, ALL_ITEMS.length);
  for (const item of ALL_ITEMS) {
    if (item.id === "clan-bg-standard") continue;
    const price = priceOf(item);
    assert.ok(price.price > 0, `нет цены у ${item.id}`);
    assert.equal(itemOf(item.id)?.id, item.id);
  }
});

test("сундуки: шансы выпадения дают ровно 100%", () => {
  for (const chest of CHESTS) {
    const sum = chest.loot.reduce((s, e) => s + e.chance, 0);
    assert.equal(Math.round(sum * 100) / 100, 100, `сундук ${chest.tier}`);
  }
});
