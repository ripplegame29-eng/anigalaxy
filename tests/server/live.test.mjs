import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeUser } from "./helpers.mjs";
import { cardsAction } from "../../.tsc-tests/lib/server/cards-state.js";
import { addCard, getWallet, listInventory } from "../../.tsc-tests/lib/server/cards.js";
import { setDeck } from "../../.tsc-tests/lib/server/cards-battle.js";
import { simulate } from "../../.tsc-tests/lib/cards/battle.js";
import { CATALOG } from "../../.tsc-tests/lib/cards/catalog.js";

function setup() {
  const db = freshDb();
  const u = makeUser(db);
  for (let i = 0; i < 4; i++) addCard(db, u.id, CATALOG[i * 9].id, "test");
  const inv = listInventory(db, u.id);
  const r = setDeck(db, u.id, inv.slice(0, 4).map((c) => c.id));
  assert.ok(r.ok, r.error);
  return { db, u };
}
const snap = (db, id) => JSON.stringify({ ...getWallet(db, id), energyAt: 0 });

test("управляемый бой: старт ничего не пишет, финиш начисляет", () => {
  const { db, u } = setup();
  const before = snap(db, u.id);
  const nb = db.prepare("SELECT COUNT(*) n FROM card_battles").get().n;
  const st = cardsAction(db, u.id, "fight", { live: true });
  assert.ok(st.ok, st.error);
  const rep = st.value;
  assert.ok(rep.live && rep.outcome.pending, "ждёт хода игрока");
  assert.equal(snap(db, u.id), before, "кошелёк не тронут");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM card_battles").get().n, nb);
  // играем на клиенте
  const choices = [];
  let out = rep.outcome;
  while (out.pending) {
    const p = out.pending;
    const a = [...p.acts].reverse().find((x) => x.ready);
    choices.push({ a: a.a, t: a.targets[0], c: p.hand.slice(0, 1) });
    out = simulate(rep.you, rep.foe, Math.random, { perks: rep.live.perks, maxRounds: rep.live.maxRounds, ctl: { seed: rep.live.seed, choices, stop: true } });
  }
  const fin = cardsAction(db, u.id, "live-finish", { id: rep.live.id, choices });
  assert.ok(fin.ok, fin.error);
  assert.equal(fin.value.outcome.events.length, out.events.length, "сервер получил тот же бой");
  assert.equal(JSON.stringify(fin.value.outcome.events), JSON.stringify(out.events));
  assert.equal(fin.value.win, out.winner === "a");
  assert.notEqual(snap(db, u.id), before, "энергия и награды записаны");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM card_battles").get().n, nb + 1);
  assert.equal(cardsAction(db, u.id, "live-finish", { id: rep.live.id, choices }).ok, false, "повторно нельзя");
});

test("брошенный бой доигрывается автоматически при следующем", () => {
  const { db, u } = setup();
  const a = cardsAction(db, u.id, "fight", { live: true });
  assert.ok(a.ok);
  const w0 = getWallet(db, u.id);
  const b = cardsAction(db, u.id, "fight", { live: true });
  assert.ok(b.ok, b.error);
  const w1 = getWallet(db, u.id);
  assert.equal(w1.wins + w1.losses, w0.wins + w0.losses + 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM card_battles").get().n, 1);
  assert.equal(cardsAction(db, u.id, "live-finish", { id: a.value.live.id, choices: [] }).ok, false);
});

test("кампания и обычный (не live) бой работают как раньше", () => {
  const { db, u } = setup();
  const c = cardsAction(db, u.id, "camp-fight", { chapter: 0, stage: 0, live: true });
  assert.ok(c.ok, c.error);
  assert.ok(c.value.live);
  const f = cardsAction(db, u.id, "live-finish", { id: c.value.live.id, choices: [] });
  assert.ok(f.ok, f.error);
  assert.ok(f.value.campaign);
  const plain = cardsAction(db, u.id, "fight", { training: true });
  assert.ok(plain.ok && !plain.value.live && !plain.value.outcome.pending);
});
