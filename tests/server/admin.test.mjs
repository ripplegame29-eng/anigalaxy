import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeUser } from "./helpers.mjs";
import { setBan, setPremiumDays, setRole, stats, listUsers } from "../../.tsc-tests/lib/server/admin.js";
import { findUserById } from "../../.tsc-tests/lib/server/users.js";

function adminOf(db, nick) {
  const u = makeUser(db, nick);
  db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(u.id);
  return findUserById(db, u.id);
}

test("админ: бан, снятие бана, нельзя банить себя и другого админа", () => {
  const db = freshDb();
  const admin = adminOf(db, "Boss");
  const other = adminOf(db, "Boss2");
  const user = makeUser(db, "Victim");
  assert.equal(setBan(db, admin, admin.id, 1).ok, false);
  assert.equal(setBan(db, admin, other.id, 1).ok, false);
  assert.equal(setBan(db, admin, user.id, 1).ok, true);
  assert.ok(findUserById(db, user.id).bannedUntil > Date.now());
  assert.equal(setBan(db, admin, user.id, 0).ok, true);
  assert.equal(findUserById(db, user.id).bannedUntil, 0);
});

test("админ: Premium выдаётся днями и снимается, роли только user/moderator", () => {
  const db = freshDb();
  const admin = adminOf(db, "Boss");
  const user = makeUser(db, "Player");
  const now = Date.now();
  assert.equal(setPremiumDays(db, user.id, 30, now).ok, true);
  assert.equal(findUserById(db, user.id).premiumUntil, now + 30 * 86_400_000);
  assert.equal(setPremiumDays(db, user.id, 0, now).ok, true);
  assert.equal(findUserById(db, user.id).premiumUntil, 0);
  assert.equal(setRole(db, admin, user.id, "admin").ok, false);
  assert.equal(setRole(db, admin, user.id, "moderator").ok, true);
  assert.equal(findUserById(db, user.id).role, "moderator");
});

test("админ: сводка и поиск игроков", () => {
  const db = freshDb();
  makeUser(db, "Alice");
  makeUser(db, "Bob");
  assert.equal(stats(db).users, 2);
  assert.equal(listUsers(db, "ali").length, 1);
});
