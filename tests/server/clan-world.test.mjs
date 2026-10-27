import test from "node:test";
import assert from "node:assert/strict";

import { createClan, joinClan } from "../../.tsc-tests/lib/server/clans.js";
import { currentSeason } from "../../.tsc-tests/lib/server/clan-points.js";
import { foundCapital, claimTile, attackTile, fortifyTile, influenceOf, settleWorld, worldStandings, worldTiles } from "../../.tsc-tests/lib/server/clan-world.js";
import { buildWorld, effectiveHp } from "../../.tsc-tests/lib/clan-world.js";
import { freshDb, makeUser } from "./helpers.mjs";

const NOW = Date.parse("2026-03-04T12:00:00Z");
const SEASON = currentSeason(NOW);

function clanWith(db, name, tag, xp) {
  const leader = makeUser(db);
  const clan = createClan(db, leader.id, { name, tag }).value;
  const users = [leader];
  for (let i = 1; i < 3; i += 1) {
    const u = makeUser(db);
    assert.ok(joinClan(db, u.id, clan.id, NOW).ok);
    users.push(u);
  }
  users.forEach((u) => db.prepare("INSERT OR REPLACE INTO player_stats (user_id, xp_total, week_base_xp, week_key) VALUES (?, ?, 0, ?)").run(u.id, xp, SEASON));
  return { clan, leader, users };
}

test("карта детерминирована, связна и содержит окраины", () => {
  const w = buildWorld();
  assert.ok(w.tiles.length > 150);
  assert.ok(w.spawns.length >= 8);
  const seen = new Set([0]);
  const stack = [w.byCoord.get("0,0")];
  seen.clear();
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...w.tiles[id].neighbors);
  }
  assert.equal(seen.size, w.tiles.length);
  const names = new Set(w.tiles.map((t) => t.name));
  assert.equal(names.size, w.tiles.length);
});

test("столица, занятие, укрепление и ограничение влиянием", () => {
  const db = freshDb();
  const a = clanWith(db, "Alpha Squad", "AL", 1500);
  const w = buildWorld();
  const spawn = w.spawns[0];
  assert.ok(foundCapital(db, a.leader.id, spawn, NOW).ok);
  assert.equal(foundCapital(db, a.leader.id, w.spawns[1], NOW).ok, false);
  // рядовой не может
  const free = w.tiles[spawn].neighbors[0];
  assert.equal(claimTile(db, a.users[1].id, free, NOW).ok, false);
  assert.equal(influenceOf(db, a.clan.id, NOW).available, 4500);
  assert.ok(claimTile(db, a.leader.id, free, NOW).ok);
  assert.ok(influenceOf(db, a.clan.id, NOW).available < 4500);
  // далёкая клетка недоступна
  assert.equal(claimTile(db, a.leader.id, 0, NOW).ok, false);
  // укрепление
  const r = fortifyTile(db, a.leader.id, free, 100, NOW + 1000);
  assert.ok(r.ok);
});

test("осада: щит блокирует, потом клетка переходит атакующему", () => {
  const db = freshDb();
  const a = clanWith(db, "Alpha Squad", "AL", 3000);
  const b = clanWith(db, "Beta Squad", "BE", 3000);
  const w = buildWorld();
  const s1 = w.spawns[0];
  const near = w.tiles[s1].neighbors[0];
  assert.ok(foundCapital(db, a.leader.id, s1, NOW).ok);
  // соседняя окраина для b — найдём любую соседнюю со спавном a
  const bSpawn = w.tiles[s1].neighbors.find((id) => w.tiles[id].spawn);
  if (bSpawn === undefined) return;
  assert.ok(foundCapital(db, b.leader.id, bSpawn, NOW).ok);
  // оба под щитом
  assert.equal(attackTile(db, b.leader.id, s1, 500, NOW + 60_000).ok, false);
  void near;
  const later = NOW + 13 * 3600_000;
  const hit = attackTile(db, b.leader.id, s1, 400, later);
  assert.ok(hit.ok);
  assert.equal(hit.value.captured, false);
  const rest = attackTile(db, b.leader.id, s1, 9000, later);
  assert.ok(rest.ok);
  assert.equal(rest.value.captured, true);
  const owner = worldTiles(db, later).find((t) => t.tileId === s1);
  assert.equal(owner.clanId, b.clan.id);
});

test("прочность убывает, но не ниже пола", () => {
  assert.equal(effectiveHp(1000, 0, 1000, 0), 1000);
  assert.ok(effectiveHp(1000, 0, 1000, 5 * 86_400_000) < 1000);
  assert.equal(effectiveHp(1000, 0, 1000, 400 * 86_400_000), 300);
});

test("итоги недели: награды и казна, повтор безопасен", () => {
  const db = freshDb();
  const a = clanWith(db, "Alpha Squad", "AL", 1500);
  const w = buildWorld();
  assert.ok(foundCapital(db, a.leader.id, w.spawns[0], NOW).ok);
  assert.equal(worldStandings(db)[0].clanId, a.clan.id);
  const before = db.prepare("SELECT treasury FROM clans WHERE id = ?").get(a.clan.id).treasury;
  const next = NOW + 8 * 86_400_000;
  assert.ok(settleWorld(db, next) >= 1);
  const after = db.prepare("SELECT treasury FROM clans WHERE id = ?").get(a.clan.id).treasury;
  assert.ok(after > before);
  assert.equal(settleWorld(db, next), 0);
  const prizes = db.prepare("SELECT COUNT(*) AS n FROM clan_world_prizes").get().n;
  assert.ok(prizes >= 1);
});
