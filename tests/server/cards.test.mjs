import test from "node:test";
import assert from "node:assert/strict";

import { CATALOG, cardsOfRank } from "../../.tsc-tests/lib/cards/catalog.js";
import { simulate, seeded } from "../../.tsc-tests/lib/cards/battle.js";
import { SKILLS, ULTIMATES, defaultLoadout, skillPool, slotsOf, validateLoadout, skillUpCost, levelled, validatePassive, skillDef } from "../../.tsc-tests/lib/cards/skills.js";
import { synergyList } from "../../.tsc-tests/lib/cards/synergy.js";
import { applySynergies, applyPassives } from "../../.tsc-tests/lib/cards/battle.js";
import {
  addCard, addMoney, addScroll, bid, cancelAuction, claimDaily, claimMission, createAuction, disenchant, exchangeAc, getWallet,
  listAuctions, listInventory, melt, openPacks, pendingPack, pickFromPack, respondTrade, sendTrade, settleAuctions, sharpen, split, upgrade,
  bumpMission, cancelTrade, setSkills, upgradeSkill,
} from "../../.tsc-tests/lib/server/cards.js";
import { fight, setDeck, unitOf } from "../../.tsc-tests/lib/server/cards-battle.js";
import { claimAchievement, claimSet, claimWeekly, progressState, setShowcase, collectorProfile } from "../../.tsc-tests/lib/server/cards-progress.js";
import { track, getExtra, setExtra } from "../../.tsc-tests/lib/server/cards-extra.js";
import { campaignFight, campaignState, campaignClaim } from "../../.tsc-tests/lib/server/cards-campaign.js";
import { raidFight, raidView, raidClaim } from "../../.tsc-tests/lib/server/cards-raid.js";
import { challenge, battleLog, battleReplay } from "../../.tsc-tests/lib/server/cards-battle.js";
import { CHAPTERS, STAGES } from "../../.tsc-tests/lib/cards/campaign.js";
import { evolve } from "../../.tsc-tests/lib/server/cards.js";
import { passView, passBuy, passClaim, noticesOf, noticesSeen, eventsState } from "../../.tsc-tests/lib/server/cards-season.js";
import { PASS, PASS_XP, passReward, bannerFeatured, BANNER, EVO, evoCost } from "../../.tsc-tests/lib/cards/season.js";
import { weekOf } from "../../.tsc-tests/lib/server/cards-extra.js";
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
  assert.ok(CATALOG.length >= 380);
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
  for (const e of x.events) if (e.t === "cast") assert.ok(skillDef(e.skill));
  // здоровье в событиях не уходит ниже нуля и не выше максимума
  const max = Object.fromEntries([...a1, ...b1].map((u) => [u.key, u.maxHp]));
  for (const e of x.events) if ("hp" in e) assert.ok(e.hp >= 0 && e.hp <= max[e.to]);
  // без умений бой всё равно идёт (обычные атаки)
  const plain = simulate(a1.map((u) => ({ ...u, skills: [] })), b1.map((u) => ({ ...u, skills: [] })), seeded(5));
  assert.ok(!plain.events.some((e) => e.t === "cast" && !e.ult));
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

test("синергии: аниме, стихия и баланс классов дают бонусы; усиленные герои сильнее", () => {
  const m = (series, element, cls) => ({ series, element, cls });
  assert.equal(synergyList([m("A", "fire", "mage"), m("B", "water", "tank")]).length, 0);
  const two = synergyList([m("A", "fire", "mage"), m("A", "water", "tank")]);
  assert.equal(two[0].kind, "series");
  assert.ok(two[0].bonus.atk > 0);
  const four = synergyList([m("A", "fire", "warrior"), m("A", "fire", "tank"), m("A", "fire", "mage"), m("A", "fire", "support")]);
  assert.ok(four.some((s) => s.kind === "series" && s.tier === 3));
  assert.ok(four.some((s) => s.kind === "element"));
  assert.ok(four.some((s) => s.kind === "classes"));
  const units = ["warrior", "tank"].map((cls, i) => ({ key: `a${i}`, side: "a", slot: i, cardId: "x", name: "x", rank: 0, element: "fire", cls, atk: 100, def: 100, hp: 1000, maxHp: 1000, spd: 50, foil: false, level: 1, series: "S" }));
  const r = applySynergies(units);
  assert.equal(r.list.length, 1);
  assert.ok(r.units[0].atk > 100);
});

test("пассивки: статовые усиливают, ранг ограничивает «Второе дыхание»", () => {
  const u = [{ key: "a0", side: "a", slot: 0, cardId: "x", name: "x", rank: 0, element: "fire", cls: "mage", atk: 100, def: 100, hp: 1000, maxHp: 1000, spd: 100, foil: false, level: 1, passive: "p-vigor" }];
  assert.equal(applyPassives(u)[0].maxHp, 1120);
  assert.ok(validatePassive("p-revive", 1));
  assert.equal(validatePassive("p-revive", 3), "");
  assert.ok(validatePassive("nope", 4));
});

test("ультимейты: копится энергия и срабатывает; «Второе дыхание» спасает от гибели один раз", () => {
  const mk = (side, i, extra = {}) => ({ key: `${side}${i}`, side, slot: i, cardId: "x", name: `${side}${i}`, rank: 3, element: "fire", cls: "warrior", atk: 400, def: 60, hp: 3000, maxHp: 3000, spd: 80 - i, foil: false, level: 1, skills: ["w-slash"], ...extra });
  const a = [mk("a", 0), mk("a", 1)];
  const b = [mk("b", 0, { passive: "p-revive", hp: 200, maxHp: 200 }), mk("b", 1)];
  const out = simulate(a, b, seeded(3));
  assert.ok(out.events.some((e) => e.t === "energy"));
  assert.ok(out.events.some((e) => e.t === "cast" && e.ult), "ультимейт применён");
  assert.equal(out.events.filter((e) => e.t === "revive").length, 1);
  assert.ok(ULTIMATES.mage.power > 1);
});

test("уровни умений: сила растёт, цена растёт; прокачка списывает пыль и свиток", () => {
  const sk = skillDef("w-slash");
  assert.ok(levelled(sk, 3).power > sk.power);
  assert.equal(levelled(sk, 5).cd, sk.cd - 1);
  assert.ok(skillUpCost(3, 2).dust > skillUpCost(3, 1).dust);
  assert.equal(skillUpCost(3, 3).scroll, 1);
  const db = freshDb();
  const u = makeUser(db);
  getWallet(db, u.id, NOW);
  const [id] = give(db, u.id, cardsOfRank(0).find((c) => c.cls === "warrior").id);
  assert.equal(upgradeSkill(db, u.id, id, "m-fireball").ok, false, "чужое для класса умение");
  addMoney(db, u.id, "dust", -getWallet(db, u.id, NOW).dust);
  assert.equal(upgradeSkill(db, u.id, id, "w-slash").ok, false, "нет пыли");
  addMoney(db, u.id, "dust", 5000);
  addScroll(db, u.id, 0, 3);
  for (let i = 0; i < 4; i += 1) assert.ok(upgradeSkill(db, u.id, id, "w-slash").ok, `ур. ${i + 2}`);
  assert.equal(upgradeSkill(db, u.id, id, "w-slash").ok, false, "максимум");
  const inv = listInventory(db, u.id).find((c) => c.id === id);
  assert.equal(inv.skillLv["w-slash"], 5);
  assert.ok(setSkills(db, u.id, id, ["w-slash"], "p-edge").ok);
  assert.equal(setSkills(db, u.id, id, ["w-slash"], "p-revive").ok, false);
});

test("серия входов: растёт по дням, бонус и веха на 3-й день, сбрасывается после пропуска", () => {
  const db = freshDb();
  const u = makeUser(db);
  getWallet(db, u.id, NOW);
  const day = 86_400_000;
  const r1 = claimDaily(db, u.id, NOW);
  assert.equal(r1.value.streak.n, 1);
  assert.equal(r1.value.streak.bonusPct, 0);
  claimDaily(db, u.id, NOW + day);
  const r3 = claimDaily(db, u.id, NOW + 2 * day);
  assert.equal(r3.value.streak.n, 3);
  assert.ok(r3.value.streak.bonusPct > 0);
  assert.ok(r3.value.streak.milestone, "награда за 3 дня");
  assert.ok(r3.value.diamonds > r1.value.diamonds);
  const skipped = claimDaily(db, u.id, NOW + 5 * day);
  assert.equal(skipped.value.streak.n, 1);
  assert.equal(skipped.value.streak.best, 3);
});

test("достижения: ступени по статистике, награда один раз, сеты и недельные задания", () => {
  const db = freshDb();
  const u = makeUser(db);
  getWallet(db, u.id, NOW);
  give(db, u.id, byRank(0));
  const st = progressState(db, u.id, NOW);
  assert.ok(st.achievements.find((a) => a.id === "collector").value >= 1);
  assert.equal(claimAchievement(db, u.id, "opener", NOW).ok, false, "ещё ничего не выполнено");
  track(db, u.id, "packs", 12, NOW);
  const dBefore = getWallet(db, u.id, NOW).diamonds;
  const c = claimAchievement(db, u.id, "opener", NOW);
  assert.ok(c.ok);
  assert.equal(c.value.tiers, 1);
  assert.ok(getWallet(db, u.id, NOW).diamonds > dBefore);
  assert.equal(claimAchievement(db, u.id, "opener", NOW).ok, false, "повторно нельзя");
  // недельное: 10 паков
  const wk = claimWeekly(db, u.id, "wk-pack", NOW);
  assert.ok(wk.ok);
  assert.equal(claimWeekly(db, u.id, "wk-pack", NOW).ok, false);
  // сет: выдаём половину героев одной серии
  const sets = progressState(db, u.id, NOW).sets;
  const s0 = sets.find((s) => s.owned < s.need[0]);
  const ids = CATALOG.filter((c) => c.series === s0.series).slice(0, s0.need[0]).map((c) => c.id);
  for (const id of ids) give(db, u.id, id);
  assert.ok(claimSet(db, u.id, s0.series, 0, NOW).ok);
  assert.equal(claimSet(db, u.id, s0.series, 0, NOW).ok, false);
  assert.equal(claimSet(db, u.id, s0.series, 1, NOW).ok, false, "полный набор не собран");
});

test("витрина: до 5 своих карт, профиль видят другие", () => {
  const db = freshDb();
  const u = makeUser(db);
  getWallet(db, u.id, NOW);
  const ids = [...give(db, u.id, byRank(2)), ...give(db, u.id, byRank(3))];
  assert.ok(setShowcase(db, u.id, ids).ok);
  assert.equal(setShowcase(db, u.id, [999999]).ok, false);
  assert.equal(setShowcase(db, u.id, [1, 2, 3, 4, 5, 6]).ok, false);
  const p = collectorProfile(db, u.nickname);
  assert.ok(p.ok);
  assert.equal(p.value.showcase.length, 2);
});

function strongDeck(db, uid, level = 15) {
  const ids = [4, 4, 4, 4].map((r, i) => give(db, uid, cardsOfRank(r)[i * 2].id, 1, { level })[0]);
  setDeck(db, uid, ids);
  db.prepare("UPDATE card_wallet SET energy = 10 WHERE user_id = ?").run(uid);
  return ids;
}

test("кампания: главы и этапы, закрытые этапы, звёзды и награды один раз, награда главы", () => {
  assert.ok(CHAPTERS.length >= 8);
  const db = freshDb();
  const u = makeUser(db);
  getWallet(db, u.id, NOW);
  const st = campaignState(db, u.id);
  assert.equal(st.length, CHAPTERS.length);
  assert.equal(st[0].stages.length, STAGES);
  assert.ok(st[0].unlocked && !st[1].unlocked);
  assert.ok(st[0].stages[0].unlocked && !st[0].stages[1].unlocked);
  assert.equal(campaignFight(db, u.id, 0, 1, {}, NOW).ok, false, "закрытый этап");
  assert.equal(campaignFight(db, u.id, 0, 0, {}, NOW).ok, false, "нет колоды");
  strongDeck(db, u.id);
  const dBefore = getWallet(db, u.id, NOW).diamonds;
  const r = campaignFight(db, u.id, 0, 0, {}, NOW, seeded(1));
  assert.ok(r.ok);
  assert.ok(r.value.win);
  assert.equal(r.value.campaign.stars, 3);
  assert.ok(r.value.campaign.firstClear);
  assert.ok(getWallet(db, u.id, NOW).diamonds > dBefore);
  assert.equal(getWallet(db, u.id, NOW).energy, 9);
  const again = campaignFight(db, u.id, 0, 0, {}, NOW, seeded(2));
  assert.equal(again.value.campaign.newStars, 0);
  assert.equal(again.value.reward.diamonds, 0, "повторно награды нет");
  const tr = campaignFight(db, u.id, 0, 1, { training: true }, NOW, seeded(3));
  assert.ok(tr.ok);
  assert.equal(getWallet(db, u.id, NOW).energy, 8, "тренировка энергию не тратит");
  // награда главы
  assert.equal(campaignClaim(db, u.id, 0, 0, NOW).ok, false, "глава не пройдена");
  const x = getExtra(db, u.id);
  for (let s2 = 0; s2 < STAGES; s2 += 1) x.camp.stars[`0:${s2}`] = 3;
  setExtra(db, u.id, x);
  assert.ok(campaignClaim(db, u.id, 0, 0, NOW).ok);
  assert.ok(campaignClaim(db, u.id, 0, 1, NOW).ok);
  assert.equal(campaignClaim(db, u.id, 0, 1, NOW).ok, false);
  assert.ok(campaignState(db, u.id)[1].unlocked, "следующая глава открыта");
});

test("дуэли: вызов по нику, защита считается сервером, журнал и повтор, перерыв между боями", () => {
  const db = freshDb();
  const a = makeUser(db, "Attacker");
  const d = makeUser(db, "Defender");
  getWallet(db, a.id, NOW);
  getWallet(db, d.id, NOW);
  assert.equal(challenge(db, a.id, "Defender", NOW).ok, false, "нет колоды");
  strongDeck(db, a.id);
  assert.equal(challenge(db, a.id, "Attacker", NOW).ok, false, "себя нельзя");
  assert.equal(challenge(db, a.id, "Nobody", NOW).ok, false);
  assert.equal(challenge(db, a.id, "Defender", NOW).ok, false, "у соперника нет отряда");
  strongDeck(db, d.id, 1);
  const r = challenge(db, a.id, "Defender", NOW, seeded(4));
  assert.ok(r.ok);
  assert.ok(r.value.pvp);
  assert.equal(challenge(db, a.id, "defender", NOW + 1000).ok, false, "перерыв");
  const log = battleLog(db, a.id);
  assert.equal(log[0].kind, "duel");
  const def = battleLog(db, d.id);
  assert.equal(def[0].kind, "defense");
  assert.equal(def[0].win, !log[0].win);
  const rep = battleReplay(db, a.id, log[0].id);
  assert.ok(rep.ok);
  assert.ok(rep.value.outcome.events.length > 0);
  assert.equal(battleReplay(db, d.id, log[0].id).ok, false, "чужую запись не открыть");
  assert.ok(challenge(db, a.id, "Defender", NOW + 31 * 60_000, seeded(5)).ok);
});

test("рейд: общий запас, 3 попытки в день, таблица урона и награды по ступеням", () => {
  const db = freshDb();
  const u = makeUser(db);
  getWallet(db, u.id, NOW);
  strongDeck(db, u.id);
  const v0 = raidView(db, u.id, NOW);
  assert.ok(v0.maxHp > 0 && v0.hp === v0.maxHp && v0.hitsLeft === 3);
  const r1 = raidFight(db, u.id, NOW, seeded(1));
  assert.ok(r1.ok);
  assert.ok(r1.value.raid.damage > 0);
  assert.ok(raidView(db, u.id, NOW).hp < v0.maxHp);
  db.prepare("UPDATE card_wallet SET energy = 10 WHERE user_id = ?").run(u.id);
  assert.ok(raidFight(db, u.id, NOW, seeded(2)).ok);
  assert.ok(raidFight(db, u.id, NOW, seeded(3)).ok);
  assert.equal(raidFight(db, u.id, NOW, seeded(4)).ok, false, "лимит на день");
  assert.ok(raidFight(db, u.id, NOW + 86_400_000, seeded(5)).ok, "на следующий день снова можно");
  const v = raidView(db, u.id, NOW + 86_400_000);
  assert.equal(v.top[0].hits, 4);
  assert.ok(v.mine.damage > 2000);
  const before = getWallet(db, u.id, NOW).diamonds;
  const c = raidClaim(db, u.id, NOW + 86_400_000);
  assert.ok(c.ok);
  assert.ok(getWallet(db, u.id, NOW).diamonds > before);
  assert.equal(raidClaim(db, u.id, NOW + 86_400_000).ok, false, "уже забрано");
});

test("пробуждение: нужен 15 уровень, копии и пыль; ступень даёт силу, копии тратятся", () => {
  const db = freshDb();
  const u = makeUser(db);
  getWallet(db, u.id, NOW);
  const id = cardsOfRank(2)[0].id;
  const [base] = give(db, u.id, id, 1, { level: 14 });
  const copies = give(db, u.id, id, 2);
  addMoney(db, u.id, "dust", 100000);
  assert.equal(evolve(db, u.id, base, copies, NOW).ok, false, "уровень мал");
  db.prepare("UPDATE card_inv SET level = 15 WHERE id = ?").run(base);
  assert.equal(evolve(db, u.id, base, [copies[0]], NOW).ok, false, "мало копий");
  assert.equal(evolve(db, u.id, base, [base, copies[1]], NOW).ok, false, "сама себя");
  const other = give(db, u.id, cardsOfRank(2)[1].id, 2);
  assert.equal(evolve(db, u.id, base, other, NOW).ok, false, "другой герой");
  const dust0 = getWallet(db, u.id, NOW).dust;
  assert.ok(evolve(db, u.id, base, copies, NOW).ok);
  assert.equal(getWallet(db, u.id, NOW).dust, dust0 - evoCost(2, 0));
  assert.equal(cardsState(db, u.id, NOW).inventory.find((c) => c.id === base).evo, 1);
  assert.equal(cardsState(db, u.id, NOW).inventory.filter((c) => c.cardId === id).length, 1);
  const a = unitOf({ cardId: id, level: 15, foil: false, evo: 0 }, "a", 0).atk;
  const b = unitOf({ cardId: id, level: 15, foil: false, evo: 1 }, "a", 0).atk;
  assert.ok(b > a * 1.1);
  const more = give(db, u.id, id, 3);
  assert.ok(evolve(db, u.id, base, more, NOW).ok);
  assert.equal(evolve(db, u.id, base, give(db, u.id, id, 3), NOW).ok, false, "предел");
  assert.ok(EVO.bonus[2] > EVO.bonus[1]);
  // пробуждённую карту нельзя пустить в расход
  assert.equal(cardsAction(db, u.id, "disenchant", { ids: [base] }, NOW).ok, false);
});

test("сезонный пасс: очки идут от действий, награды по уровням один раз, премиум-ветка платная, новый сезон сбрасывает", () => {
  const db = freshDb();
  const u = makeUser(db);
  getWallet(db, u.id, NOW);
  assert.equal(passView(db, u.id, NOW).level, 0);
  assert.equal(passClaim(db, u.id, "free", 1, NOW).ok, false, "уровень не достигнут");
  track(db, u.id, "wins", 5, NOW);
  const v = passView(db, u.id, NOW);
  assert.equal(v.xp, 5 * PASS_XP.wins);
  assert.equal(v.level, Math.floor(v.xp / PASS.xpPerLevel));
  assert.ok(v.level >= 1);
  const d0 = getWallet(db, u.id, NOW).diamonds;
  assert.ok(passClaim(db, u.id, "free", 1, NOW).ok);
  assert.equal(passClaim(db, u.id, "free", 1, NOW).ok, false, "повторно нельзя");
  assert.equal(passClaim(db, u.id, "premium", 1, NOW).ok, false, "премиум не куплен");
  addMoney(db, u.id, "diamonds", 1000);
  assert.ok(passBuy(db, u.id, NOW).ok);
  assert.equal(passBuy(db, u.id, NOW).ok, false);
  assert.ok(passClaim(db, u.id, "premium", 0, NOW).ok, "все доступные");
  assert.equal(passClaim(db, u.id, "premium", 0, NOW).ok, false, "больше нечего");
  assert.ok(getWallet(db, u.id, NOW).diamonds > d0 + 1000 - PASS.price);
  track(db, u.id, "wins", 1000, NOW);
  assert.equal(passView(db, u.id, NOW).level, PASS.levels);
  assert.ok(passReward(PASS.levels, "premium").packs >= 3);
  const next = passView(db, u.id, NOW + PASS.seasonMs);
  assert.equal(next.xp, 0);
  assert.equal(next.bought, false);
});

test("баннер недели: герой недели детерминирован, гарантия срабатывает, пак стоит как обычный", () => {
  const db = freshDb();
  const u = makeUser(db);
  getWallet(db, u.id, NOW);
  const week = weekOf(NOW);
  const f = bannerFeatured(week);
  assert.equal(f, bannerFeatured(week));
  assert.ok(cardsOfRank(3).concat(cardsOfRank(4)).some((c) => c.id === f));
  assert.equal(eventsState(db, u.id, NOW).banner.featured, f);
  addMoney(db, u.id, "packs", 500);
  let got = false;
  for (let i = 0; i < BANNER.guarantee && !got; i += 1) {
    const r = openPacks(db, u.id, { count: 1, pay: "token", quick: true, banner: true }, NOW, seeded(100 + i));
    assert.ok(r.ok);
    got = r.value.results[0].offers.includes(f);
    if (r.value.pending) db.prepare("DELETE FROM card_pending WHERE user_id = ?").run(u.id);
  }
  assert.ok(got, "герой недели выпал не позже гарантии");
  assert.equal(eventsState(db, u.id, NOW).banner.counter, 0);
});

test("уведомления: защита и итоги аукциона считаются, отметка прочитанного сбрасывает", () => {
  const db = freshDb();
  const a = makeUser(db, "Attacker2");
  const d = makeUser(db, "Defender2");
  getWallet(db, a.id, NOW);
  getWallet(db, d.id, NOW);
  assert.deepEqual(noticesOf(db, d.id), { defenses: 0, auctions: 0, trades: 0 });
  strongDeck(db, a.id);
  strongDeck(db, d.id, 1);
  assert.ok(challenge(db, a.id, "Defender2", NOW, seeded(9)).ok);
  assert.equal(noticesOf(db, d.id).defenses, 1);
  assert.equal(noticesOf(db, a.id).defenses, 0);
  noticesSeen(db, d.id);
  assert.equal(noticesOf(db, d.id).defenses, 0);
});

test("баланс: в равных случайных отрядах ни один класс и ни одна сторона не доминируют", () => {
  const rng = seeded(777);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const draw = () => {
    const used = new Set();
    return [1, 2, 2, 3].map((r) => {
      let c;
      do c = pick(cardsOfRank(r));
      while (used.has(c.id));
      used.add(c.id);
      return c;
    });
  };
  const mk = (cs, side) => cs.map((c, i) => unitOf({ cardId: c.id, level: 10, foil: false }, side, i));
  const cls = {};
  let sideA = 0;
  const N = 1500;
  for (let i = 0; i < N; i += 1) {
    const A = draw();
    const B = draw();
    const o = simulate(applyPassives(applySynergies(mk(A, "a")).units), applyPassives(applySynergies(mk(B, "b")).units), rng);
    const w = o.winner === "a" ? 1 : 0;
    sideA += w;
    for (const c of A) (cls[c.cls] ??= { w: 0, n: 0 }), (cls[c.cls].w += w), (cls[c.cls].n += 1);
    for (const c of B) (cls[c.cls] ??= { w: 0, n: 0 }), (cls[c.cls].w += 1 - w), (cls[c.cls].n += 1);
  }
  assert.ok(Math.abs(sideA / N - 0.5) < 0.06, `сторона A: ${sideA / N}`);
  for (const [k, v] of Object.entries(cls)) assert.ok(v.w / v.n > 0.38 && v.w / v.n < 0.62, `${k}: ${(v.w / v.n).toFixed(3)}`);
});
