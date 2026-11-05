import test from "node:test";
import assert from "node:assert/strict";
import { simulate, seeded, applyGearStats } from "../../.tsc-tests/lib/cards/battle.js";
import { perksOfGear, mergePerks, arenaOfDay, dayIndex, ARENA_MODS, RELICS, resonanceOf, rollRelic, BOOSTERS } from "../../.tsc-tests/lib/cards/gear.js";

const mk = (side, n = 4, hp = 900) =>
  Array.from({ length: n }, (_, i) => ({
    key: `${side}${i}`, side, slot: i, cardId: "x", name: `U${i}`, rank: 2, element: ["fire", "water", "wind", "earth"][i % 4],
    cls: ["warrior", "mage", "tank", "support"][i % 4], atk: 120, def: 60, hp, maxHp: hp, spd: 50 + i, foil: false, level: 1,
    skills: [], passive: "",
  }));

test("без снаряжения результат тот же и детерминирован", () => {
  const a = simulate(mk("a"), mk("b"), seeded(7));
  const b = simulate(mk("a"), mk("b"), seeded(7), { perks: {} });
  assert.deepEqual(a.events, b.events);
});

test("вампиризм лечит, а стартовый щит и энергия видны в событиях", () => {
  const p = perksOfGear([{ id: "r-fang", lv: 5 }, { id: "r-aegis", lv: 3 }, { id: "r-chrono", lv: 2 }]);
  const o = simulate(mk("a"), mk("b"), seeded(3), { perks: { a: p } });
  assert.ok(o.events.some((e) => e.t === "heal" && e.skill === "g-vamp" && e.from.startsWith("a")));
  assert.ok(o.events.filter((e) => e.t === "shield" && e.round === 0).length === 4);
  assert.ok(o.events.some((e) => e.t === "energy" && e.round === 0));
});

test("Сердце феникса возрождает павшего один раз", () => {
  const p = perksOfGear([{ id: "r-phoenix", lv: 5 }]);
  const weak = mk("a", 4, 120);
  const o = simulate(weak, mk("b", 4, 2000), seeded(11), { perks: { a: p } });
  const rev = o.events.filter((e) => e.t === "revive" && e.src === "gear");
  assert.equal(rev.length, 1);
});

test("правило арены: тишина режет энергию, перегрузка ускоряет", () => {
  const calm = ARENA_MODS.find((m) => m.id === "a-calm").perks;
  const chg = ARENA_MODS.find((m) => m.id === "a-charge").perks;
  const firstUlt = (arena) => simulate(mk("a"), mk("b"), seeded(5), { perks: { arena } }).events.findIndex((e) => e.t === "cast" && e.ult);
  const c = firstUlt(calm), f = firstUlt(chg);
  assert.ok(f !== -1 && (c === -1 || f < c));
});

test("статы снаряжения применяются до боя", () => {
  const u = applyGearStats(mk("a"), mergePerks({ atk: 0.1, hp: 0.2 }));
  assert.equal(u[0].atk, 132);
  assert.equal(u[0].maxHp, 1080);
});

test("правило дня меняется и даёт все варианты", () => {
  const seen = new Set();
  for (let i = 0; i < 20; i++) seen.add(arenaOfDay(i).id);
  assert.equal(seen.size, ARENA_MODS.length);
  assert.notEqual(arenaOfDay(10).id, arenaOfDay(11).id);
  assert.ok(Number.isInteger(dayIndex(Date.now())));
});

test("резонанс и выпадение", () => {
  const rares = RELICS.filter((r) => r.rarity === "rare").slice(0, 3).map((r) => ({ id: r.id, lv: 1 }));
  assert.equal(resonanceOf(rares).id, "res-rare");
  const trio = ["r-fang", "r-banner", "r-phoenix"].map((id) => ({ id, lv: 1 }));
  assert.equal(resonanceOf(trio).id, "res-triad");
  const cnt = { rare: 0, epic: 0, legend: 0 };
  const r = seeded(1);
  for (let i = 0; i < 2000; i++) cnt[rollRelic(2, r(), r()).rarity]++;
  assert.ok(cnt.rare > cnt.epic && cnt.epic > cnt.legend && cnt.legend > 0);
  assert.equal(BOOSTERS.length, 5);
});
