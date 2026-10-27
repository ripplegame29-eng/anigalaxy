import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeUser } from "./helpers.mjs";
import { claimWelcome, welcomeState } from "../../.tsc-tests/lib/server/welcome.js";
import { getDoc } from "../../.tsc-tests/lib/server/docs.js";
import { findUserById } from "../../.tsc-tests/lib/server/users.js";

const DAY = 86_400_000;
const fresh = (db, id) => findUserById(db, id);
const ac = (db, id) => JSON.parse(getDoc(db, id, "animehub:progress:v1").value).progress.acBalance;

test("квест: день 1 сразу, дни 2 и 3 открываются по дням, повторно забрать нельзя", () => {
  const db = freshDb();
  const u = makeUser(db, "Newbie");
  const t0 = fresh(db, u.id).createdAt + 1000;

  let s = welcomeState(db, fresh(db, u.id), t0);
  assert.deepEqual(s.days.map((d) => d.status), ["ready", "locked", "locked"]);
  assert.equal(claimWelcome(db, fresh(db, u.id), 2, t0).ok, false, "день 2 ещё закрыт");
  assert.equal(claimWelcome(db, fresh(db, u.id), 1, t0).ok, true);
  assert.equal(claimWelcome(db, fresh(db, u.id), 1, t0).ok, false, "повторно нельзя");
  assert.equal(ac(db, u.id), 50);

  s = welcomeState(db, fresh(db, u.id), t0 + DAY);
  assert.deepEqual(s.days.map((d) => d.status), ["claimed", "ready", "locked"]);
  assert.equal(claimWelcome(db, fresh(db, u.id), 2, t0 + DAY).ok, true);
  assert.ok(fresh(db, u.id).premiumUntil > 0, "день 2 даёт Premium");

  assert.equal(claimWelcome(db, fresh(db, u.id), 3, t0 + 2 * DAY).ok, true);
  const profile = JSON.parse(getDoc(db, u.id, "animehub:profile:v1").value);
  assert.ok(profile.purchased.includes("frame-13"), "на 3-й день рамка");
  assert.equal(welcomeState(db, fresh(db, u.id), t0 + 2 * DAY).active, false);
});

test("квест закрывается через две недели", () => {
  const db = freshDb();
  const u = makeUser(db, "Late");
  const late = fresh(db, u.id).createdAt + 20 * DAY;
  assert.equal(welcomeState(db, fresh(db, u.id), late).active, false);
  assert.equal(claimWelcome(db, fresh(db, u.id), 1, late).ok, false);
});

test("Premium: пробный период один раз, подарок месяца один раз в месяц и только подписчику", async () => {
  const { startTrial, claimDrop, premiumState } = await import("../../.tsc-tests/lib/server/premium.js");
  const db = freshDb();
  const u = makeUser(db, "Trial");
  assert.equal(claimDrop(db, fresh(db, u.id)).ok, false, "без подписки подарка нет");
  assert.equal(premiumState(db, fresh(db, u.id)).trial.available, true);
  assert.equal(startTrial(db, fresh(db, u.id)).ok, true);
  const after = fresh(db, u.id);
  assert.ok(after.premiumUntil > Date.now() + 2.9 * DAY);
  assert.equal(startTrial(db, after).ok, false, "повторно нельзя");
  assert.equal(claimDrop(db, after).ok, true);
  assert.equal(claimDrop(db, after).ok, false, "в этом месяце уже получен");
  const p = JSON.parse(getDoc(db, u.id, "animehub:progress:v1").value).progress;
  assert.equal(p.acBalance, 300);
  assert.equal(p.streakFreezes, 1);
});
