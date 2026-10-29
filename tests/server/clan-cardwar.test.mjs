import test from "node:test";
import assert from "node:assert/strict";

import { cardsOfRank } from "../../.tsc-tests/lib/cards/catalog.js";
import { seeded } from "../../.tsc-tests/lib/cards/battle.js";
import { CW, DONATE } from "../../.tsc-tests/lib/cards/clanwar.js";
import { addCard, getWallet, listInventory } from "../../.tsc-tests/lib/server/cards.js";
import { setDeck } from "../../.tsc-tests/lib/server/cards-battle.js";
import { createClan, joinClan } from "../../.tsc-tests/lib/server/clans.js";
import { cwAttack, cwCancelSearch, cwSearch, cwSettle, cwState, cwVsBot } from "../../.tsc-tests/lib/server/clan-cardwar.js";
import { cancelRequest, donateCard, donateState, requestCards } from "../../.tsc-tests/lib/server/clan-donate.js";
import { freshDb, makeUser } from "./helpers.mjs";

const NOW = Date.parse("2026-03-04T12:00:00Z");
const H = 3_600_000;

function deck(db, uid, rank, level) {
  getWallet(db, uid, NOW);
  const ids = [0, 1, 2, 3].map((i) => addCard(db, uid, cardsOfRank(rank)[i].id, NOW, false, level));
  assert.ok(setDeck(db, uid, ids).ok);
  db.prepare("UPDATE card_wallet SET energy = 10 WHERE user_id = ?").run(uid);
  return ids;
}

function clan(db, name, tag, size, rank = 1, level = 1) {
  const leader = makeUser(db);
  const c = createClan(db, leader.id, { name, tag }).value;
  const users = [leader];
  for (let i = 1; i < size; i += 1) {
    const u = makeUser(db);
    assert.ok(joinClan(db, u.id, c.id, NOW).ok);
    users.push(u);
  }
  users.forEach((u) => deck(db, u.id, rank, level));
  db.prepare("UPDATE clan_members SET joined_at = ? WHERE clan_id = ?").run(NOW, c.id);
  return { c, leader, users };
}

test("война: поиск, очередь, пара по размеру и отмена", () => {
  const db = freshDb();
  const a = clan(db, "Alpha Squad", "AL", 3);
  const b = clan(db, "Beta Squad", "BE", 3);
  assert.equal(cwSearch(db, a.users[1].id, 3, NOW).ok, false, "рядовой не может");
  assert.equal(cwSearch(db, a.leader.id, 7, NOW).ok, false, "неверный размер");
  assert.equal(cwSearch(db, a.leader.id, 5, NOW).ok, false, "мало бойцов");
  const first = cwSearch(db, a.leader.id, 3, NOW);
  assert.ok(first.ok && !first.value.started);
  assert.ok(cwState(db, a.leader.id, NOW).search);
  assert.ok(cwCancelSearch(db, a.leader.id).ok);
  assert.equal(cwState(db, a.leader.id, NOW).search, null);
  cwSearch(db, a.leader.id, 3, NOW);
  const second = cwSearch(db, b.leader.id, 3, NOW);
  assert.ok(second.ok && second.value.started);
  const sa = cwState(db, a.leader.id, NOW);
  assert.equal(sa.war.phase, "prep");
  assert.equal(sa.war.foe.tag, "BE");
  assert.equal(sa.war.mine.slots.length, 3);
  assert.equal(cwSearch(db, a.leader.id, 3, NOW).ok, false, "уже в войне");
});

test("война: подготовка запрещает нападать, затем звёзды, защита и победитель", () => {
  const db = freshDb();
  const a = clan(db, "Strong Ones", "ST", 3, 4, 20);
  assert.ok(cwVsBot(db, a.leader.id, 3, NOW, seeded(1)).ok);
  const st = cwState(db, a.leader.id, NOW);
  assert.ok(st.war.bot);
  assert.equal(cwAttack(db, a.users[0].id, 1, NOW, seeded(2)).ok, false, "подготовка");
  const t = NOW + CW.prepMs + 1000;
  const r = cwAttack(db, a.users[0].id, 1, t, seeded(2));
  assert.ok(r.ok, r.error);
  assert.ok(r.value.title);
  const after = cwState(db, a.leader.id, t);
  assert.equal(after.war.phase, "battle");
  assert.equal(after.war.me.attacksLeft, CW.attacksEach - 1);
  assert.equal(cwAttack(db, a.users[0].id, 1, t, seeded(3)).ok, false, "ту же базу дважды нельзя");
  assert.equal(cwAttack(db, a.users[0].id, 2, t, seeded(3)).ok, true, "вторая атака на другую базу");
  assert.equal(cwAttack(db, a.users[0].id, 1, t, seeded(4)).ok, false, "лимит атак исчерпан");
  assert.equal(cwAttack(db, a.users[0].id, 99, t, seeded(5)).ok, false, "нет такой базы");
  const mid = cwState(db, a.leader.id, t);
  assert.ok(mid.war.mine.score + mid.war.foe.score >= 1);
  // конец войны
  const end = NOW + CW.prepMs + CW.battleMs + 1000;
  assert.ok(cwSettle(db, end) >= 1);
  const done = cwState(db, a.leader.id, end);
  assert.ok(done.war === null || done.war.phase === "done");
  const hist = done.history[0];
  assert.ok(hist && ["win", "lose", "draw"].includes(hist.result));
  assert.equal(cwSettle(db, end + 1000), 0, "повторно не рассчитывается");
});

test("война: проигранная атака отдаёт очко защитнику, победа даёт клану трофеи", () => {
  const db = freshDb();
  const weak = clan(db, "Weak Ones", "WK", 3, 0, 1);
  const strong = clan(db, "Strong Ones", "SG", 3, 4, 30);
  assert.ok(cwSearch(db, weak.leader.id, 3, NOW).ok);
  assert.ok(cwSearch(db, strong.leader.id, 3, NOW).ok);
  const t = NOW + CW.prepMs + 1000;
  const r = cwAttack(db, weak.users[0].id, 1, t, seeded(7));
  assert.ok(r.ok, r.error);
  const s = cwState(db, weak.leader.id, t);
  assert.equal(s.war.foe.score >= CW.defensePoint, true, "защитник получил очко");
  assert.equal(s.war.mine.stars, 0);
  const end = NOW + CW.prepMs + CW.battleMs + 1000;
  cwSettle(db, end);
  const h = cwState(db, weak.leader.id, end).history[0];
  assert.equal(h.result, "lose");
  assert.equal(cwState(db, strong.leader.id, end).history[0].result, "win");
  const trophies = (id) => cwState(db, id, end).trophies;
  assert.ok(trophies(strong.leader.id) > trophies(weak.leader.id));
});

function pair(db) {
  const c = clan(db, "Givers", "GV", 2);
  return { c, giver: c.users[0], taker: c.users[1] };
}

test("донат: запрос, лимиты, передача карты и награда донору", () => {
  const db = freshDb();
  const { giver, taker } = pair(db);
  const later = NOW + 25 * H;
  const cardId = cardsOfRank(1)[8].id;
  assert.equal(requestCards(db, taker.id, cardId, 2, NOW).ok, false, "новичок");
  assert.equal(requestCards(db, taker.id, cardsOfRank(3)[0].id, 1, later).ok, false, "S не передаётся");
  assert.equal(requestCards(db, taker.id, cardId, 9, later).ok, false, "слишком много");
  const rq = requestCards(db, taker.id, cardId, 2, later);
  assert.ok(rq.ok, rq.error);
  assert.equal(requestCards(db, taker.id, cardId, 1, later).ok, false, "один открытый запрос");
  assert.equal(donateCard(db, taker.id, rq.value, later).ok, false, "себе нельзя");
  assert.equal(donateCard(db, giver.id, rq.value, later).ok, false, "нет копии");
  addCard(db, giver.id, cardId, later, false, 1);
  addCard(db, giver.id, cardId, later, false, 1);
  const st = donateState(db, giver.id, later);
  assert.equal(st.requests[0].canGive, 2);
  const dust0 = getWallet(db, giver.id, later).dust;
  const g = donateCard(db, giver.id, rq.value, later);
  assert.ok(g.ok, g.error);
  assert.ok(getWallet(db, giver.id, later).dust > dust0);
  assert.equal(listInventory(db, taker.id).filter((c) => c.cardId === cardId).length, 1);
  assert.ok(donateCard(db, giver.id, rq.value, later).ok);
  assert.equal(donateState(db, taker.id, later).requests.length, 0, "запрос закрыт после полной выдачи");
  assert.equal(listInventory(db, taker.id).filter((c) => c.cardId === cardId).length, 2);
});

test("донат: защищённые копии не отдаются, запрос протухает и отменяется", () => {
  const db = freshDb();
  const { c, giver, taker } = pair(db);
  const later = NOW + 25 * H;
  const cardId = cardsOfRank(0)[9].id;
  const rq = requestCards(db, taker.id, cardId, 1, later).value;
  const mine = addCard(db, giver.id, cardId, later, false, 1);
  db.prepare("UPDATE card_inv SET locked = 1 WHERE id = ?").run(mine);
  assert.equal(donateCard(db, giver.id, rq, later).ok, false, "замок");
  db.prepare("UPDATE card_inv SET locked = 0 WHERE id = ?").run(mine);
  assert.equal(donateCard(db, giver.id, rq, later + DONATE.requestMs + 1).ok, false, "протух");
  assert.ok(c);
  const rq2 = requestCards(db, taker.id, cardId, 1, later + DONATE.requestMs + 2 * H);
  assert.ok(rq2.ok, rq2.error);
  assert.ok(cancelRequest(db, taker.id).ok);
  assert.equal(donateCard(db, giver.id, rq2.value, later + DONATE.requestMs + 2 * H).ok, false, "отменён");
});
