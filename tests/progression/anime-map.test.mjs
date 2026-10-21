/** Карта аниме: все награды существуют в магазине, граф без дыр и дублей */
import test from "node:test";
import assert from "node:assert/strict";
import { ROUTES, itemInfo, allRewardItems } from "../../.tsc-tests/lib/anime-map-data.js";

test("каждая награда карты есть в магазине и имеет цену", () => {
  for (const { id } of allRewardItems()) {
    const info = itemInfo(id);
    assert.ok(info, `нет предмета ${id}`);
    assert.ok(info.price > 0, `у ${id} нет цены`);
  }
});

test("награды не повторяются между узлами", () => {
  const ids = allRewardItems().map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, "есть повторяющиеся награды");
});

test("граф маршрутов: id уникальны, зависимости существуют, есть старт и финал", () => {
  const routeIds = new Set();
  for (const route of ROUTES) {
    assert.ok(!routeIds.has(route.id));
    routeIds.add(route.id);
    const ids = new Set(route.nodes.map((n) => n.id));
    assert.equal(ids.size, route.nodes.length, `${route.id}: дубль узла`);
    assert.ok(route.nodes.some((n) => n.requires.length === 0), `${route.id}: нет стартового узла`);
    assert.ok(route.nodes.some((n) => n.tag === "boss"), `${route.id}: нет финала`);
    for (const n of route.nodes) for (const r of n.requires) assert.ok(ids.has(r), `${route.id}: ${n.id} требует ${r}`);
  }
});
