import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeUser } from "./helpers.mjs";
import { attachReferral, ensureRefCode, referralState, settleReferrals } from "../../.tsc-tests/lib/server/referrals.js";
import { flushGrants } from "../../.tsc-tests/lib/server/grants.js";
import { getDoc } from "../../.tsc-tests/lib/server/docs.js";
import { adjustBalance } from "../../.tsc-tests/lib/server/admin-edit.js";
import { findUserById } from "../../.tsc-tests/lib/server/users.js";

const admin = { nickname: "test" };
const progressOf = (db, id) => JSON.parse(getDoc(db, id, "animehub:progress:v1").value);
const profileOf = (db, id) => JSON.parse(getDoc(db, id, "animehub:profile:v1").value);

/** Довести друга до условий: 10 уровень и 30 минут просмотра */
function mature(db, id) {
  adjustBalance(db, admin, id, { setLevel: 10 });
  const doc = progressOf(db, id);
  doc.counters = { ...doc.counters, SECONDS_WATCHED: 1800 };
  db.prepare("UPDATE user_docs SET value = ? WHERE user_id = ? AND doc_key = 'animehub:progress:v1'").run(JSON.stringify(doc), id);
}

test("код постоянный и уникальный", () => {
  const db = freshDb();
  const a = makeUser(db, "Иван");
  const b = makeUser(db, "Иван2");
  const code = ensureRefCode(db, a.id);
  assert.match(code, /^[A-Z0-9]+$/);
  assert.equal(ensureRefCode(db, a.id), code);
  assert.notEqual(ensureRefCode(db, b.id), code);
});

test("регистрация по коду: другу подарок, на себя и повторно — нельзя", () => {
  const db = freshDb();
  const inviter = makeUser(db, "Inviter");
  const code = ensureRefCode(db, inviter.id);
  const friend = makeUser(db, "Friend");
  assert.equal(attachReferral(db, friend.id, code), true);
  assert.equal(attachReferral(db, friend.id, code), false, "повторно нельзя");
  assert.equal(attachReferral(db, inviter.id, code), false, "на себя нельзя");
  assert.equal(attachReferral(db, makeUser(db, "Stranger").id, "NOPE"), false, "неверный код");
  assert.equal(getDoc(db, friend.id, "animehub:progress:v1"), null, "подарок ждёт первого сохранения прогресса");
  assert.equal(flushGrants(db, friend.id), 0);
  adjustBalance(db, admin, friend.id, { ac: 1 });
  assert.equal(flushGrants(db, friend.id), 1);
  assert.equal(progressOf(db, friend.id).progress.xpTotal, 500);
  assert.ok(findUserById(db, friend.id).premiumUntil > Date.now() + 6 * 86_400_000);
});

test("друг не засчитывается, пока не дорос; потом — Premium и первый рубеж ровно один раз", () => {
  const db = freshDb();
  const inviter = makeUser(db, "Inviter");
  const code = ensureRefCode(db, inviter.id);
  const friend = makeUser(db, "Friend");
  attachReferral(db, friend.id, code);

  settleReferrals(db, inviter.id);
  assert.equal(referralState(db, findUserById(db, inviter.id)).qualified, 0);
  assert.equal(findUserById(db, inviter.id).premiumUntil, 0);

  mature(db, friend.id);
  settleReferrals(db, inviter.id);
  settleReferrals(db, inviter.id);
  const state = referralState(db, findUserById(db, inviter.id));
  assert.equal(state.qualified, 1);
  assert.deepEqual(state.claimed, [1]);
  const user = findUserById(db, inviter.id);
  assert.ok(user.premiumUntil > Date.now() + 2.9 * 86_400_000 && user.premiumUntil < Date.now() + 3.1 * 86_400_000);
  const doc = progressOf(db, inviter.id);
  assert.equal(doc.progress.xpTotal, 500, "XP рубежа ×1");
  assert.ok(doc.tags.tag_sensei, "тег «Сенсей»");
  assert.equal(state.top[0].nickname, "Inviter");
  assert.equal(state.me.rank, 1);
});

test("рубеж ×3 выдаёт рамку «Геасс»", () => {
  const db = freshDb();
  const inviter = makeUser(db, "Inviter");
  const code = ensureRefCode(db, inviter.id);
  for (let i = 0; i < 3; i += 1) {
    const f = makeUser(db, `Friend${i}`);
    attachReferral(db, f.id, code);
    mature(db, f.id);
  }
  settleReferrals(db, inviter.id);
  assert.deepEqual(referralState(db, findUserById(db, inviter.id)).claimed, [1, 3]);
  assert.ok(profileOf(db, inviter.id).purchased.includes("frame-36"));
});

test("подарок другу ставится в очередь и выдаётся после первого сохранения прогресса", async () => {
  const { flushGrants, queueGrant } = await import("../../.tsc-tests/lib/server/grants.js");
  const db = freshDb();
  const u = makeUser(db, "Fresh");
  queueGrant(db, u.id, { ac: 100, note: "Бонус" });
  assert.equal(flushGrants(db, u.id), 0, "пока прогресса на сервере нет — ждём");
  adjustBalance(db, admin, u.id, { xp: 1 }); // имитация первого сохранения прогресса
  assert.equal(flushGrants(db, u.id), 1);
  assert.equal(progressOf(db, u.id).progress.acBalance, 100);
  assert.equal(flushGrants(db, u.id), 0, "второй раз ничего не выдаётся");
});
