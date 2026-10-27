import test from "node:test";
import assert from "node:assert/strict";

import { createClan, joinClan, leaveClan, getClan } from "../../.tsc-tests/lib/server/clans.js";
import { clanPoints, currentSeason, weeklyPointsFor } from "../../.tsc-tests/lib/server/clan-points.js";
import { settleSeasons, leagueTable, claimGoal } from "../../.tsc-tests/lib/server/clan-season.js";
import { createOrder, markOrderPaid, buyItem, equipItem, buySlots } from "../../.tsc-tests/lib/server/clan-economy.js";
import { flushGrants } from "../../.tsc-tests/lib/server/grants.js";
import { freshDb, makeUser } from "./helpers.mjs";

const NOW = Date.parse("2026-03-04T12:00:00Z"); // среда
const SEASON = currentSeason(NOW);

function setXp(db, userId, gained) {
  db.prepare(
    "INSERT OR REPLACE INTO player_stats (user_id, xp_total, week_base_xp, week_key) VALUES (?, ?, 0, ?)",
  ).run(userId, gained, SEASON);
}

function clanWith(db, name, tag, n) {
  const leader = makeUser(db);
  const clan = createClan(db, leader.id, { name, tag }).value;
  const users = [leader];
  for (let i = 1; i < n; i += 1) {
    const u = makeUser(db);
    assert.ok(joinClan(db, u.id, clan.id, NOW).ok);
    users.push(u);
  }
  return { clan, users };
}

test("очки клана считаются из опыта игроков, вклад ограничен и замораживается при выходе", () => {
  const db = freshDb();
  const { clan, users } = clanWith(db, "Alpha Squad", "AL", 3);
  users.forEach((u, i) => setXp(db, u.id, [1000, 500, 20000][i]));
  assert.equal(weeklyPointsFor(db, users[0].id, SEASON), 1000);
  // кап 6000 на игрока
  assert.equal(clanPoints(db, clan.id, SEASON), 1000 + 500 + 6000);
  // ушедший оставляет свой вклад
  leaveClan(db, users[1].id, NOW);
  setXp(db, users[1].id, 9000);
  assert.equal(clanPoints(db, clan.id, SEASON), 1000 + 500 + 6000);
});

test("вступивший позже не приносит опыт, набранный до вступления", () => {
  const db = freshDb();
  const { clan } = clanWith(db, "Beta Squad", "BE", 3);
  const late = makeUser(db);
  setXp(db, late.id, 5000);
  joinClan(db, late.id, clan.id, NOW);
  assert.equal(clanPoints(db, clan.id, SEASON), 0);
  setXp(db, late.id, 5400);
  assert.equal(clanPoints(db, clan.id, SEASON), 400);
});

test("итоги недели: награды, кубки, повышение и понижение, идемпотентность", () => {
  const db = freshDb();
  const groups = [0, 1, 2, 3].map((i) => clanWith(db, `Clan Number ${i}`, `C${i}`, 3));
  groups.forEach((g, i) => g.users.forEach((u) => setXp(db, u.id, 1000 * (i + 1))));
  const after = NOW + 8 * 86_400_000;
  assert.ok(settleSeasons(db, after) >= 1);
  assert.equal(settleSeasons(db, after), 0);
  const top = getClan(db, groups[3].clan.id);
  assert.equal(top.trophies, 5);
  assert.equal(top.league, 1);
  assert.equal(getClan(db, groups[0].clan.id).league, 0);
  assert.ok(top.treasury >= 1500);
});

test("цель недели: сундук один раз и только с личным вкладом", () => {
  const db = freshDb();
  const { clan, users } = clanWith(db, "Gamma Squad", "GA", 3);
  setXp(db, users[0].id, 4000);
  setXp(db, users[1].id, 4000);
  setXp(db, users[2].id, 10);
  assert.equal(claimGoal(db, users[0].id, clan.id, 1, NOW).ok, true);
  assert.equal(claimGoal(db, users[0].id, clan.id, 1, NOW).ok, false);
  assert.equal(claimGoal(db, users[2].id, clan.id, 1, NOW).ok, false);
  assert.equal(claimGoal(db, users[0].id, clan.id, 3, NOW).ok, false);
});

test("кристаллы: заказ оплачивается один раз, покупки и места", () => {
  const db = freshDb();
  const { clan, users } = clanWith(db, "Delta Squad", "DE", 3);
  const order = createOrder(db, users[0].id, "crystal").value;
  assert.equal(markOrderPaid(db, order.id, "ref1").value.crystals, 340);
  assert.equal(markOrderPaid(db, order.id, "ref1").value.crystals, 0);
  assert.equal(getClan(db, clan.id).crystals, 340);
  assert.equal(createOrder(db, users[0].id, "nope").ok, false);

  assert.equal(buyItem(db, users[2].id, "banner-moss", "crystals").ok, false); // боец не покупает
  assert.ok(buyItem(db, users[0].id, "banner-moss", "crystals").ok);
  assert.equal(buyItem(db, users[0].id, "banner-moss", "crystals").ok, false);
  assert.equal(buyItem(db, users[0].id, "banner-eclipse", "treasury").ok, false);
  assert.equal(equipItem(db, users[0].id, "banner", "banner-dawn").ok, false);
  assert.ok(equipItem(db, users[0].id, "banner", "banner-moss").ok);
  assert.equal(buySlots(db, users[0].id).ok, false); // осталось 200 < 250
  markOrderPaid(db, createOrder(db, users[0].id, "spark").value.id, "ref2");
  assert.ok(buySlots(db, users[0].id).ok);
  assert.equal(getClan(db, clan.id).extraSlots, 5);
  assert.equal(getClan(db, clan.id).crystals, 50);
  void flushGrants;
  void leagueTable;
});
