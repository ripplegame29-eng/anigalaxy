import test from "node:test";
import assert from "node:assert/strict";

import { CATALOG, cardsOfRank } from "../../.tsc-tests/lib/cards/catalog.js";
import { simulate, seeded } from "../../.tsc-tests/lib/cards/battle.js";
import { SKILLS, defaultLoadout, skillPool, slotsOf, validateLoadout } from "../../.tsc-tests/lib/cards/skills.js";
import {
  addCard, addMoney, addScroll, bid, cancelAuction, claimDaily, claimMission, createAuction, disenchant, exchangeAc, getWallet,
  listAuctions, listInventory, melt, openPacks, pendingPack, pickFromPack, respondTrade, sendTrade, settleAuctions, sharpen, split, upgrade,
  bumpMission, cancelTrade, setSkills,
} from "../../.tsc-tests/lib/server/cards.js";
import { fight, setDeck, unitOf } from "../../.tsc-tests/lib/server/cards-battle.js";
import { cardsAction, cardsState } from "../../.tsc-tests/lib/server/cards-state.js";
import { adjustBalance } from "../../.tsc-tests/lib/server/admin-edit.js";
import { freshDb, makeUser } from "./helpers.mjs";

const NOW = Date.parse("2026-03-04T12:00:00Z");
const rng = seeded(7);

const byRank = (r) => cardsOfRank(r)[0].id;
function give(db, uid, cardId, n = 1, extra = {}) {
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(addCard(db, uid, cardId, NOW, extra.foil ?? false, extra.level ?? 1));
  return out;
}

test("каталог: уникальные id, все ранги заполнены, статы растут с рангом", () => {
  const ids = new Set(CATALOG.map((c) => c.id));
  assert.equal(ids.size, CATALOG.length);
  assert.ok(CATALOG.length >= 250);
  for (let r = 0; r < 5; r += 1) assert.ok(cardsOfRank(r).length >= 8, `ранг ${r}`);
  assert.ok(cardsOfRank(4)[0].atk > cardsOfRank(0)[0].atk * 3);
});

test("кошелёк: старт выдаётся один раз, ежедневный подарок раз в день", () => {
  const db = freshDb();
  const u = makeUser(db);
  const w = getWallet(db, u.id, NOW);
  assert.equal(w.packs, 5);
  assert.equal(getWallet(db, u.id, NOW).packs, 5);
  assert.ok(claimDaily(db, u.id, NOW).ok);
  assert.equal(claimDaily(db, u.id, NOW).ok, false);
  assert.ok(claimDaily(db, u.id, NOW + 86_400_000).ok);
});

test("пак: ручной выбор 1 из 3, возврат пыли за остальные, нельзя открыть второй до выбора", () => {
  const db = freshDb();
  const u = makeUser(db);
  getWallet(db, u.id, NOW);
  const r = openPacks(db, u.id, { count: 1, pay: "token" }, NOW, rng);
  assert.ok(r.ok);
  assert.equal(r.value.pending.length, 3);
  assert.equal(openPacks(db, u.id, { count: 1, pay: "token" }, NOW, rng).ok, false);
  assert.ok(pendingPack(db, u.id));
  const dustBefore = getWallet(db, u.id, NOW).dust;
  const pick = pickFromPack(db, u.id, 1, NOW);
  assert.ok(pick.ok);
  assert.equal(listInventory(db, u.id).length, 1);
  assert.ok(getWallet(db, u.id, NOW).dust >= dustBefore);
  assert.equal(pickFromPack(db, u.id, 0, NOW).ok, false);
});

test("пак: быстрый набор ×6 стоит 5 паков алмазами, жетоны списываются полностью; гарантия эпика", () => {
  const db = freshDb();
  const u = makeUser(db);
  getWallet(db, u.id, NOW);
  addMoney(db, u.id, "diamonds", 1000);
  const before = getWallet(db, u.id, NOW).diamonds;
  const r = openPacks(db, u.id, { count: 6, pay: "diamonds" }, NOW, seeded(1));
  assert.ok(r.ok);
  assert.equal(r.value.results.length, 6);
  assert.equal(getWallet(db, u.id, NOW).diamonds, before - 60 * 5);
  assert.equal(listInventory(db, u.id).length, 6);
  // гарантия: за 20 паков хотя бы одна карта эпик+ при любом ГСЧ, который всё время выдаёт обычные
  const db2 = freshDb();
  const v = makeUser(db2);
  getWallet(db2, v.id, NOW);
  addMoney(db2, v.id, "packs", 40);
  const res = openPacks(db2, v.id, { count: 20, pay: "token" }, NOW, () => 0.01);
  assert.ok(res.ok);
  const best = Math.max(...res.value.results.map((x) => CATALOG.find((c) => c.id === x.chosen.cardId).rank));
  assert.ok(best >= 2);
  const out = openPacks(db2, v.id, { count: 6, pay: "token" }, NOW, () => 0.01);
  assert.ok(out.ok);
});

test("переплавка: 3 одного ранга → 1 выше; чужой ранг, мифик и заблокированные запрещены", () => {
  const db = freshDb();
  const u = makeUser(db);
  getWallet(db, u.id, NOW);
  const ids = give(db, u.id, byRank(0), 3);
  const r = melt(db, u.id, ids, NOW, rng);
  assert.ok(r.ok);
  assert.equal(CATALOG.find((c) => c.id === r.value.cardId).rank, 1);
  assert.equal(listInventory(db, u.id).length, 1);
  const mix = [...give(db, u.id, byRank(0), 2), ...give(db, u.id, byRank(1), 1)];
  assert.equal(melt(db, u.id, mix, NOW).ok, false);
  const myth = give(db, u.id, byRank(4), 3);
  assert.equal(melt(db, u.id, myth, NOW).ok, false);
  const lk = give(db, u.id, byRank(2), 3);
  cardsAction(db, u.id, "lock", { id: lk[0] }, NOW);
  assert.equal(melt(db, u.id, lk, NOW).ok, false);
  assert.equal(melt(db, u.id, [lk[1], lk[1], lk[2]], NOW).ok, false);
});

test("раскол: 1 → 2 рангом ниже, дневной лимит и платный сверх нормы", () => {
  const db = freshDb();
  const u = makeUser(db);
  getWallet(db, u.id, NOW);
  addMoney(db, u.id, "diamonds", 500);
  const one = give(db, u.id, byRank(3), 1)[0];
  const r = split(db, u.id, one, NOW, rng);
  assert.ok(r.ok);
  assert.equal(r.value.cards.length, 2);
  assert.equal(CATALOG.find((c) => c.id === r.value.cards[0].cardId).rank, 2);
  assert.equal(r.value.paid, 0);
  assert.equal(split(db, u.id, give(db, u.id, byRank(0), 1)[0], NOW).ok, false);
  for (let i = 0; i < 6; i += 1) assert.ok(split(db, u.id, give(db, u.id, byRank(1), 1)[0], NOW, rng).ok);
  const before = getWallet(db, u.id, NOW).diamonds;
  const extra = split(db, u.id, give(db, u.id, byRank(1), 1)[0], NOW, rng);
  assert.ok(extra.ok);
  assert.equal(extra.value.paid, 12);
  assert.equal(getWallet(db, u.id, NOW).diamonds, before - 12);
});

test("улучшение: 3 одинаковые → анимированная, уровень и прогресс переносятся", () => {
  const db = freshDb();
  const u = makeUser(db);
  getWallet(db, u.id, NOW);
  const card = byRank(1);
  const a = addCard(db, u.id, card, NOW, false, 4);
  const b = addCard(db, u.id, card, NOW, false, 7);
  const c = addCard(db, u.id, card, NOW, false, 2);
  const r = upgrade(db, u.id, [a, b, c], NOW);
  assert.ok(r.ok);
  assert.equal(r.value.level, 7);
  const inv = listInventory(db, u.id);
  assert.equal(inv.length, 1);
  assert.equal(inv[0].foil, true);
  assert.equal(upgrade(db, u.id, [inv[0].id, inv[0].id, inv[0].id], NOW).ok, false);
  const diff = [...give(db, u.id, byRank(0), 2), ...give(db, u.id, byRank(1), 1)];
  assert.equal(upgrade(db, u.id, diff, NOW).ok, false);
});

test("заточка: свиток или пыль, неудача копит гарантию, автозаточка до цели", () => {
  const db = freshDb();
  const u = makeUser(db);
  getWallet(db, u.id, NOW);
  const id = give(db, u.id, byRank(2), 1)[0];
  assert.equal(sharpen(db, u.id, id, {}, NOW, rng).ok, false);
  addScroll(db, u.id, 2, 5);
  const fail = sharpen(db, u.id, id, {}, NOW, () => 0.99);
  assert.ok(fail.ok);
  assert.equal(fail.value.level, 1);
  assert.equal(fail.value.pity, 35);
  // гарантия после трёх неудач
  sharpen(db, u.id, id, {}, NOW, () => 0.99);
  const third = sharpen(db, u.id, id, {}, NOW, () => 0.99);
  assert.equal(third.value.pity, 100);
  const ok = sharpen(db, u.id, id, {}, NOW, () => 0.99);
  assert.equal(ok.value.level, 2);
  assert.equal(ok.value.steps[0].success, true);
  assert.equal(getWallet(db, u.id, NOW).scrolls[2], 1);
  // автозаточка тратит пыль, когда свитки кончились
  addMoney(db, u.id, "dust", 10_000);
  const auto = sharpen(db, u.id, id, { target: 6, maxSpend: 50, useDust: true }, NOW, () => 0.01);
  assert.ok(auto.ok);
  assert.equal(auto.value.level, 6);
  assert.ok(auto.value.dust > 0);
  assert.equal(sharpen(db, u.id, id, { target: 20, maxSpend: 500, useDust: true }, NOW, () => 0.01).value.level, 15);
  assert.equal(sharpen(db, u.id, id, {}, NOW).ok, false);
});

test("обмен: предложение блокирует карты, принятие переносит, отказ и отмена возвращают", () => {
  const db = freshDb();
  const a = makeUser(db, "Alice");
  const b = makeUser(db, "Bob");
  getWallet(db, a.id, NOW);
  getWallet(db, b.id, NOW);
  const mine = give(db, a.id, byRank(1), 1)[0];
  const theirs = give(db, b.id, byRank(2), 1)[0];
  assert.equal(sendTrade(db, a.id, "Alice", [mine], [], "", NOW).ok, false);
  const t = sendTrade(db, a.id, "bob", [mine], [theirs], "хочу", NOW);
  assert.ok(t.ok);
  assert.equal(melt(db, a.id, [mine, mine, mine], NOW).ok, false);
  assert.equal(listInventory(db, a.id)[0].listed, true);
  assert.equal(respondTrade(db, a.id, t.value, true, NOW).ok, false); // не адресат
  assert.ok(respondTrade(db, b.id, t.value, true, NOW).ok);
  assert.equal(listInventory(db, a.id)[0].cardId, byRank(2));
  assert.equal(listInventory(db, b.id)[0].cardId, byRank(1));
  assert.equal(respondTrade(db, b.id, t.value, true, NOW).ok, false);
  // подарок и отмена
  const gift = give(db, a.id, byRank(0), 1)[0];
  const g = sendTrade(db, a.id, "Bob", [gift], [], "", NOW);
  assert.ok(cancelTrade(db, a.id, g.value, NOW).ok);
  assert.equal(listInventory(db, a.id).find((c) => c.id === gift).listed, false);
  const g2 = sendTrade(db, a.id, "Bob", [gift], [], "", NOW);
  assert.ok(respondTrade(db, b.id, g2.value.valueOf(), false, NOW).ok);
  assert.equal(listInventory(db, a.id).find((c) => c.id === gift).listed, false);
});

test("аукцион: ставки, возврат перебитой, комиссия, антиснайпер, снятие и просрочка", () => {
  const db = freshDb();
  const s = makeUser(db, "Seller");
  const x = makeUser(db, "Xray");
  const y = makeUser(db, "Yankee");
  [s, x, y].forEach((u) => getWallet(db, u.id, NOW));
  addMoney(db, x.id, "diamonds", 1000);
  addMoney(db, y.id, "diamonds", 1000);
  const inv = give(db, s.id, byRank(3), 1)[0];
  assert.equal(createAuction(db, s.id, inv, 5, 2, NOW).ok, false);
  const lot = createAuction(db, s.id, inv, 100, 2, NOW);
  assert.ok(lot.ok);
  assert.equal(bid(db, s.id, lot.value, 200, NOW).ok, false);
  assert.equal(bid(db, x.id, lot.value, 99, NOW).ok, false);
  assert.ok(bid(db, x.id, lot.value, 100, NOW).ok);
  assert.equal(getWallet(db, x.id, NOW).diamonds, 300 + 1000 - 100);
  assert.equal(bid(db, y.id, lot.value, 102, NOW).ok, false); // шаг 5%
  assert.ok(bid(db, y.id, lot.value, 105, NOW).ok);
  assert.equal(getWallet(db, x.id, NOW).diamonds, 300 + 1000);
  assert.equal(cancelAuction(db, s.id, lot.value).ok, false);
  const lateNow = NOW + 2 * 3_600_000 - 30_000;
  assert.ok(bid(db, x.id, lot.value, 200, lateNow).ok);
  const ends = listAuctions(db, {}, lateNow)[0].endsAt;
  assert.ok(ends > NOW + 2 * 3_600_000);
  assert.equal(settleAuctions(db, lateNow + 60_000), 0);
  assert.equal(settleAuctions(db, ends + 1), 1);
  assert.equal(listInventory(db, x.id)[0].cardId, byRank(3));
  assert.equal(getWallet(db, s.id, NOW).diamonds, 300 + 190);
  assert.equal(getWallet(db, y.id, NOW).diamonds, 300 + 1000);
  // лот без ставок возвращается продавцу
  const inv2 = give(db, s.id, byRank(0), 1)[0];
  const l2 = createAuction(db, s.id, inv2, 10, 1, NOW);
  assert.equal(settleAuctions(db, NOW + 2 * 3_600_000), 1);
  assert.equal(listInventory(db, s.id).find((c) => c.id === inv2).listed, false);
  const inv3 = give(db, s.id, byRank(0), 1)[0];
  const l3 = createAuction(db, s.id, inv3, 10, 1, NOW);
  assert.ok(cancelAuction(db, s.id, l3.value).ok);
  assert.equal(l2.ok && l3.ok, true);
});

test("бои: симуляция детерминирована, колода нужна, энергия и награды, PvP-соперник", () => {
  const mk = (side, ids) => ids.map((id, i) => unitOf({ cardId: id, level: 1, foil: false }, side, i));
  const ra = cardsOfRank(2).slice(0, 4).map((c) => c.id);
  const rb = cardsOfRank(0).slice(0, 4).map((c) => c.id);
  const one = simulate(mk("a", ra), mk("b", rb), seeded(3));
  const two = simulate(mk("a", ra), mk("b", rb), seeded(3));
  assert.deepEqual(one, two);
  assert.equal(one.winner, "a");
  assert.ok(one.events.length > 0);

  const db = freshDb();
  const u = makeUser(db, "Fighter");
  const v = makeUser(db, "Rival");
  getWallet(db, u.id, NOW);
  getWallet(db, v.id, NOW);
  assert.equal(fight(db, u.id, {}, NOW, rng).ok, false);
  const ids = ra.map((c) => give(db, u.id, c, 1)[0]);
  assert.equal(setDeck(db, u.id, [ids[0], ids[0]]).ok, false);
  assert.ok(setDeck(db, u.id, ids).ok);
  const r = fight(db, u.id, {}, NOW, seeded(11));
  assert.ok(r.ok);
  assert.equal(r.value.pvp, false);
  assert.equal(r.value.energy, 9);
  assert.equal(getWallet(db, u.id, NOW).rating, 1000 + r.value.reward.rating);
  // у соперника есть колода — он найдётся
  const vids = rb.map((c) => give(db, v.id, c, 1)[0]);
  setDeck(db, v.id, vids);
  const pvp = fight(db, u.id, {}, NOW, seeded(5));
  assert.ok(pvp.ok);
  assert.equal(pvp.value.pvp, true);
  assert.equal(pvp.value.foeName, "Rival");
  // тренировка не тратит энергию
  const e = getWallet(db, u.id, NOW).energy;
  assert.ok(fight(db, u.id, { training: true }, NOW, seeded(2)).ok);
  assert.equal(getWallet(db, u.id, NOW).energy, e);
  // энергия кончается
  for (let i = 0; i < 12; i += 1) fight(db, u.id, {}, NOW, seeded(i));
  assert.equal(getWallet(db, u.id, NOW).energy, 0);
  assert.equal(fight(db, u.id, {}, NOW, rng).ok, false);
  assert.equal(getWallet(db, u.id, NOW + 21 * 60_000).energy, 1);
});

test("задания, пыль, обмен AC и действие через диспетчер", () => {
  const db = freshDb();
  const u = makeUser(db);
  getWallet(db, u.id, NOW);
  assert.equal(claimMission(db, u.id, "win3", NOW).ok, false);
  bumpMission(db, u.id, "win3", 3, NOW);
  assert.ok(claimMission(db, u.id, "win3", NOW).ok);
  assert.equal(claimMission(db, u.id, "win3", NOW).ok, false);
  bumpMission(db, u.id, "win3", 1, NOW + 86_400_000);
  const ids = give(db, u.id, byRank(2), 2);
  const d = disenchant(db, u.id, ids, NOW);
  assert.ok(d.ok);
  assert.equal(d.value.dust, 220);
  assert.equal(listInventory(db, u.id).length, 0);
  // обмен AC → алмазы
  assert.equal(exchangeAc(db, u.id, 10, NOW).ok, false);
  adjustBalance(db, { nickname: "t" }, u.id, { ac: 600 }, NOW);
  const ex = exchangeAc(db, u.id, 10, NOW);
  assert.ok(ex.ok);
  assert.equal(ex.value.acBalance, 600 - 120);
  assert.equal(exchangeAc(db, u.id, 100, NOW).ok, false);
  assert.equal(cardsAction(db, u.id, "nope", {}, NOW).ok, false);
  const st = cardsState(db, u.id, NOW);
  assert.ok(st.wallet.diamonds > 300);
  assert.equal(st.premium, false);
});

test("стартовый отряд: выдаётся один раз, сразу собирается колода", async () => {
  const { grantStarter } = await import("../../.tsc-tests/lib/server/cards.js");
  const db = freshDb();
  const u = makeUser(db);
  grantStarter(db, u.id, NOW);
  grantStarter(db, u.id, NOW);
  const inv = listInventory(db, u.id);
  assert.equal(inv.length, 4);
  assert.deepEqual(getWallet(db, u.id, NOW).deck.length, 4);
  assert.ok(fight(db, u.id, { training: true }, NOW, seeded(4)).ok);
  const v = makeUser(db);
  give(db, v.id, byRank(0), 1);
  grantStarter(db, v.id, NOW);
  assert.equal(listInventory(db, v.id).length, 1);
});

test("умения: пул героя, слоты по рангу, валидация и сохранение выбора", () => {
  for (const c of CATALOG) {
    assert.equal(skillPool(c.cls, c.element).length, 7);
    const def = defaultLoadout(c.cls, c.element, c.rank);
    assert.equal(def.length, slotsOf(c.rank));
    assert.equal(validateLoadout(def, c.cls, c.element, c.rank), "");
  }
  assert.ok(SKILLS.every((s) => s.cd >= 1 && s.name && s.desc));
  const db = freshDb();
  const u = makeUser(db, "Skiller");
  const card = cardsOfRank(0)[0];
  const [inv] = give(db, u.id, card.id, 1);
  assert.deepEqual(listInventory(db, u.id)[0].skills, defaultLoadout(card.cls, card.element, 0));
  const pool = skillPool(card.cls, card.element);
  assert.equal(setSkills(db, u.id, inv, [pool[0].id, pool[1].id]).ok, false, "у обычной один слот");
  assert.equal(setSkills(db, u.id, inv, []).ok, false);
  assert.equal(setSkills(db, u.id, inv, ["no-such"]).ok, false);
  const other = SKILLS.find((s) => s.cls && s.cls !== card.cls);
  assert.equal(setSkills(db, u.id, inv, [other.id]).ok, false, "чужой класс");
  assert.ok(setSkills(db, u.id, inv, [pool[4].id]).ok);
  assert.deepEqual(listInventory(db, u.id)[0].skills, [pool[4].id]);
  const v = makeUser(db, "Thief");
  assert.equal(setSkills(db, v.id, inv, [pool[0].id]).ok, false, "чужая карта");
  assert.ok(cardsAction(db, u.id, "skills", { id: inv, skills: [pool[1].id] }).ok);
});

test("бой с умениями: касты, щиты, лечение, оглушение; результат детерминирован", () => {
  const pick = (cls, rank) => cardsOfRank(rank).find((c) => c.cls === cls);
  const squad = (side, defs, skills) => defs.map((d, i) => unitOf({ cardId: d.id, level: 3, foil: false, skills: skills[i] }, side, i));
  const A = [pick("support", 3) ?? pick("support", 2), pick("warrior", 3), pick("mage", 3), pick("tank", 3) ?? pick("tank", 2)].filter(Boolean);
  const B = cardsOfRank(2).slice(0, 4);
  const sk = (d) => skillPool(d.cls, d.element).slice(0, slotsOf(d.rank)).map((s) => s.id);
  const a1 = squad("a", A, A.map(sk));
  const b1 = squad("b", B, B.map(sk));
  const x = simulate(a1, b1, seeded(5));
  const y = simulate(a1, b1, seeded(5));
  assert.deepEqual(x, y);
  const kinds = new Set(x.events.map((e) => e.t));
  assert.ok(kinds.has("cast"), "умения применяются");
  assert.ok(x.events.some((e) => e.t === "hit" && e.skill), "урон от умения");
  // каждый cast ссылается на существующее умение
  for (const e of x.events) if (e.t === "cast") assert.ok(SKILLS.some((s) => s.id === e.skill));
  // здоровье в событиях не уходит ниже нуля и не выше максимума
  const max = Object.fromEntries([...a1, ...b1].map((u) => [u.key, u.maxHp]));
  for (const e of x.events) if ("hp" in e) assert.ok(e.hp >= 0 && e.hp <= max[e.to]);
  // без умений бой всё равно идёт (обычные атаки)
  const plain = simulate(a1.map((u) => ({ ...u, skills: [] })), b1.map((u) => ({ ...u, skills: [] })), seeded(5));
  assert.ok(!plain.events.some((e) => e.t === "cast"));
  assert.ok(plain.events.length > 0);
  // оглушение пропускает ход
  const stunner = SKILLS.find((s) => s.stun);
  const st = simulate(
    a1.map((u) => ({ ...u, skills: [stunner.id] })),
    b1.map((u) => ({ ...u, skills: [] })),
    seeded(8),
  );
  assert.ok(st.events.some((e) => e.t === "status" && e.kind === "stun" && e.on));
});
