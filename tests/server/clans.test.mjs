import test from "node:test";
import assert from "node:assert/strict";

import {
  createClan, joinClan, leaveClan, kickMember, contribute, updateClan, getClan, clanMembers,
  clanData, listClans, declareWar, addWarScore, settleWars, activeWar, warHistory, clanIdOfUser, clanEvents, MAX_MEMBERS,
} from "../../.tsc-tests/lib/server/clans.js";
import { freshDb, makeUser } from "./helpers.mjs";

function setup() {
  const db = freshDb();
  const leader = makeUser(db);
  const r = createClan(db, leader.id, { name: "Night Watch", tag: "NW", description: "Ночной дозор" });
  assert.ok(r.ok);
  return { db, leader, clan: r.value };
}

test("создание клана: проверки, один клан на игрока, уникальность", () => {
  const { db, leader, clan } = setup();
  assert.equal(clan.members, 1);
  assert.equal(clanIdOfUser(db, leader.id), clan.id);
  assert.equal(createClan(db, leader.id, { name: "Second", tag: "SC" }).code, "in_clan");
  const other = makeUser(db);
  assert.equal(createClan(db, other.id, { name: "night watch", tag: "XX" }).code, "name_taken");
  assert.equal(createClan(db, other.id, { name: "Fresh", tag: "nw" }).code, "tag_taken");
  assert.equal(createClan(db, other.id, { name: "ab", tag: "AB" }).code, "invalid");
  assert.equal(createClan(db, other.id, { name: "Okay", tag: "!!" }).code, "invalid");
});

test("вступление, лимит состава, выход и передача лидерства", () => {
  const { db, leader, clan } = setup();
  const m1 = makeUser(db);
  assert.ok(joinClan(db, m1.id, clan.id).ok);
  assert.equal(joinClan(db, m1.id, clan.id).code, "in_clan");
  assert.equal(joinClan(db, makeUser(db).id, 9999).code, "not_found");

  const full = createClan(db, makeUser(db).id, { name: "Full Clan", tag: "FC" }).value;
  for (let i = 1; i < MAX_MEMBERS; i += 1) assert.ok(joinClan(db, makeUser(db).id, full.id).ok);
  assert.equal(joinClan(db, makeUser(db).id, full.id).code, "full");

  // лидер уходит — власть у старейшего участника
  assert.ok(leaveClan(db, leader.id).ok);
  assert.equal(getClan(db, clan.id).leaderId, m1.id);
  assert.equal(clanMembers(db, clan.id)[0].role, "leader");
  // последний участник закрывает клан
  const res = leaveClan(db, m1.id);
  assert.equal(res.value.disbanded, true);
  assert.equal(getClan(db, clan.id), null);
});

test("исключение только лидером; вклад растит клан и казну", () => {
  const { db, leader, clan } = setup();
  const m = makeUser(db);
  joinClan(db, m.id, clan.id);
  assert.equal(kickMember(db, m.id, leader.id).code, "forbidden");
  assert.equal(kickMember(db, leader.id, leader.id).code, "invalid");

  assert.ok(contribute(db, m.id, { xp: 500, ac: 100 }).ok);
  const c = getClan(db, clan.id);
  assert.equal(c.xp, 500);
  assert.equal(c.treasury, 100);
  assert.equal(clanMembers(db, clan.id).find((x) => x.userId === m.id).contributedXp, 500);
  assert.equal(contribute(db, m.id, { xp: -5 }).code, "invalid");
  assert.equal(contribute(db, m.id, { xp: 10_000_000 }).code, "invalid");
  assert.equal(contribute(db, makeUser(db).id, { xp: 5 }).code, "no_clan");
  assert.ok(clanEvents(db, clan.id).length >= 3);

  assert.ok(kickMember(db, leader.id, m.id).ok);
  assert.equal(clanIdOfUser(db, m.id), null);
});

test("оформление клана: только лидер, лимит размера", () => {
  const { db, leader, clan } = setup();
  const m = makeUser(db);
  joinClan(db, m.id, clan.id);
  assert.equal(updateClan(db, m.id, { description: "x" }).code, "forbidden");
  assert.ok(updateClan(db, leader.id, { description: "Новое описание", data: { emblem: "dragon", bg: 3 } }).ok);
  assert.deepEqual(clanData(db, clan.id), { emblem: "dragon", bg: 3 });
  assert.equal(updateClan(db, leader.id, { data: { blob: "x".repeat(70_000) } }).code, "too_large");
  assert.equal(listClans(db, { query: "night" }).length, 1);
  assert.equal(listClans(db, { query: "нет такого" }).length, 0);
});

test("война: объявление, очки, итог и ставка из казны", () => {
  const { db, leader, clan } = setup();
  const l2 = makeUser(db);
  const rival = createClan(db, l2.id, { name: "Rivals", tag: "RV" }).value;
  contribute(db, leader.id, { ac: 1000 });
  contribute(db, l2.id, { ac: 600 });

  assert.equal(declareWar(db, l2.id, clan.id, 5000).code, "stake");
  assert.equal(declareWar(db, leader.id, clan.id, 0).code, "invalid");
  const T0 = 1_000_000;
  const war = declareWar(db, leader.id, rival.id, 500, T0);
  assert.ok(war.ok);
  assert.equal(declareWar(db, l2.id, clan.id, 100, T0).code, "busy");
  assert.equal(activeWar(db, rival.id).id, war.value.id);

  assert.ok(addWarScore(db, leader.id, 300, T0 + 1000).ok);
  assert.ok(addWarScore(db, l2.id, 100, T0 + 1000).ok);
  assert.equal(addWarScore(db, leader.id, 9_999_999, T0 + 1000).code, "invalid");
  assert.equal(settleWars(db, T0 + 1000).length, 0, "рано завершать");

  const done = settleWars(db, T0 + 4 * 24 * 3600 * 1000);
  assert.equal(done.length, 1);
  assert.equal(done[0].winner, clan.id);
  assert.equal(getClan(db, clan.id).treasury, 1500);
  assert.equal(getClan(db, rival.id).treasury, 100);
  assert.equal(getClan(db, clan.id).prestige, 1);
  assert.equal(activeWar(db, clan.id), null);
  assert.equal(warHistory(db, rival.id).length, 1);
  assert.equal(settleWars(db, T0 + 5 * 24 * 3600 * 1000).length, 0, "дважды не завершается");
});

test("ничья в войне: казна не меняется", () => {
  const { db, leader, clan } = setup();
  const l2 = makeUser(db);
  const rival = createClan(db, l2.id, { name: "Rivals", tag: "RV" }).value;
  contribute(db, leader.id, { ac: 500 });
  contribute(db, l2.id, { ac: 500 });
  declareWar(db, leader.id, rival.id, 300, 0);
  settleWars(db, 10 * 24 * 3600 * 1000);
  assert.equal(getClan(db, clan.id).treasury, 500);
  assert.equal(getClan(db, rival.id).treasury, 500);
  assert.equal(getClan(db, clan.id).prestige, 0);
});
