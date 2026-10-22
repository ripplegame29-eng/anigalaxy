import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeUser } from "./helpers.mjs";
import { dashboard, searchUsers, userDetail, logAction, listLog } from "../../.tsc-tests/lib/server/admin.js";
import { adjustBalance, setItem, updateAccount, broadcast, massGrant, resetPassword, deleteUser, equipItem } from "../../.tsc-tests/lib/server/admin-edit.js";
import { logError, listErrors, clearErrors } from "../../.tsc-tests/lib/server/errors.js";
import { getDoc } from "../../.tsc-tests/lib/server/docs.js";
import { findUserById } from "../../.tsc-tests/lib/server/users.js";

function adminOf(db, nick) {
  const u = makeUser(db, nick);
  db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(u.id);
  return findUserById(db, u.id);
}
const progressOf = (db, id) => JSON.parse(getDoc(db, id, "animehub:progress:v1").value);
const profileOf = (db, id) => JSON.parse(getDoc(db, id, "animehub:profile:v1").value);

test("баланс: выдача, списание, уровень пересчитывается, журнал наград", () => {
  const db = freshDb();
  const admin = adminOf(db, "Boss");
  const user = makeUser(db, "Player");
  assert.equal(adjustBalance(db, admin, user.id, { ac: 500, xp: 1000, note: "тест" }).ok, true);
  let p = progressOf(db, user.id);
  assert.equal(p.progress.acBalance, 500);
  assert.equal(p.progress.xpTotal, 1000);
  assert.ok(p.progress.level >= 1);
  assert.equal(p.ledger.filter((e) => e.source === "ADMIN").length, 2);
  assert.equal(adjustBalance(db, admin, user.id, { ac: -9999 }).ok, true);
  assert.equal(progressOf(db, user.id).progress.acBalance, 0, "баланс не уходит в минус");
  assert.equal(adjustBalance(db, admin, user.id, { setLevel: 10 }).ok, true);
  p = progressOf(db, user.id);
  assert.equal(p.progress.level, 10);
  assert.equal(db.prepare("SELECT level FROM player_stats WHERE user_id = ?").get(user.id).level, 10);
  assert.equal(adjustBalance(db, admin, user.id, {}).ok, false);
  assert.equal(adjustBalance(db, admin, 99999, { ac: 1 }).ok, false);
});

test("предметы: рамка выдаётся и надевается, тег и достижение выдаются и отзываются", () => {
  const db = freshDb();
  const admin = adminOf(db, "Boss");
  const user = makeUser(db, "Player");
  assert.equal(setItem(db, admin, user.id, "frame", "frame-x", true, { equip: true, notify: true, label: "Икс" }).ok, true);
  let prof = profileOf(db, user.id);
  assert.deepEqual(prof.purchased, ["frame-x"]);
  assert.equal(prof.frameId, "frame-x");
  assert.match(prof.notices[0].text, /Икс/);
  assert.equal(setItem(db, admin, user.id, "frame", "frame-x", false).ok, true);
  prof = profileOf(db, user.id);
  assert.deepEqual(prof.purchased, []);
  assert.equal(prof.frameId, "");

  assert.equal(setItem(db, admin, user.id, "tag", "tag_otaku", true, { equip: true }).ok, true);
  let p = progressOf(db, user.id);
  assert.ok(p.tags.tag_otaku);
  assert.equal(p.progress.equippedTagId, "tag_otaku");
  setItem(db, admin, user.id, "tag", "tag_otaku", false);
  p = progressOf(db, user.id);
  assert.equal(p.tags.tag_otaku, undefined);
  assert.equal(p.progress.equippedTagId, null);

  assert.equal(setItem(db, admin, user.id, "achievement", "ach_x", true, { progress: 5 }).ok, true);
  assert.equal(progressOf(db, user.id).achievements.ach_x.progress, 5);
  assert.equal(setItem(db, admin, user.id, "frame", "плохой id!", true).ok, false);
  assert.equal(setItem(db, admin, user.id, "bogus", "abc", true).ok, false);
  assert.equal(equipItem(db, user.id, "frame", "frame-y").ok, true);
  assert.equal(profileOf(db, user.id).frameId, "frame-y");
});

test("профиль: смена ника/почты с проверкой уникальности, сброс пароля", () => {
  const db = freshDb();
  const admin = adminOf(db, "Boss");
  const a = makeUser(db, "Alpha");
  makeUser(db, "Beta");
  assert.equal(updateAccount(db, admin, a.id, { nickname: "Beta" }).ok, false);
  assert.equal(updateAccount(db, admin, a.id, { nickname: "Gamma", bio: "привет" }).ok, true);
  assert.equal(findUserById(db, a.id).nickname, "Gamma");
  assert.equal(profileOf(db, a.id).bio, "привет");
  assert.equal(updateAccount(db, admin, a.id, { email: "не почта" }).ok, false);
  const r = resetPassword(db, admin, a.id);
  assert.equal(r.ok, true);
  assert.ok(r.value.length >= 6);
  const other = adminOf(db, "Boss2");
  assert.equal(resetPassword(db, admin, other.id).ok, false);
  assert.equal(deleteUser(db, admin, other.id).ok, false);
  assert.equal(deleteUser(db, admin, admin.id).ok, false);
  assert.equal(deleteUser(db, admin, a.id).ok, true);
  assert.equal(findUserById(db, a.id), null);
});

test("рассылка и массовая выдача доходят до аудитории, забаненные пропускаются", () => {
  const db = freshDb();
  const admin = adminOf(db, "Boss");
  const a = makeUser(db, "Alpha");
  const b = makeUser(db, "Beta");
  db.prepare("UPDATE users SET banned_until = ? WHERE id = ?").run(Date.now() + 1e9, b.id);
  const sent = broadcast(db, "all", "Привет всем");
  assert.equal(sent.ok, true);
  assert.equal(profileOf(db, a.id).notices[0].text, "Привет всем");
  assert.equal(getDoc(db, b.id, "animehub:profile:v1"), null);
  assert.equal(broadcast(db, "all", " ").ok, false);
  const g = massGrant(db, admin, "all", { ac: 100, premiumDays: 3 });
  assert.equal(g.ok, true);
  assert.equal(progressOf(db, a.id).progress.acBalance, 100);
  assert.ok(findUserById(db, a.id).premiumUntil > Date.now());
  assert.equal(massGrant(db, admin, "all", {}).ok, false);
});

test("поиск, карточка игрока, сводка, журнал действий и ошибок", () => {
  const db = freshDb();
  const admin = adminOf(db, "Boss");
  const a = makeUser(db, "Alpha");
  adjustBalance(db, admin, a.id, { ac: 42 });
  const found = searchUsers(db, { q: "alp", filter: "all", sort: "xp" });
  assert.equal(found.total, 1);
  assert.equal(searchUsers(db, { filter: "premium" }).total, 0);
  assert.equal(searchUsers(db, { filter: "staff" }).total, 1);
  const detail = userDetail(db, a.id);
  assert.equal(detail.balance.ac, 42);
  assert.equal(detail.user.nickname, "Alpha");
  assert.equal(userDetail(db, 12345), null);
  const dash = dashboard(db);
  assert.equal(dash.series.length, 14);
  assert.equal(dash.stats.users, 2);

  logAction(db, admin, "balance", a.id, "Alpha", "AC +42");
  assert.equal(listLog(db)[0].detail, "AC +42");

  logError(db, { source: "server", message: "boom", path: "GET /x" });
  logError(db, { source: "server", message: "boom", path: "GET /x" });
  logError(db, { source: "client", message: "oops" });
  const list = listErrors(db);
  assert.equal(list.length, 2);
  assert.equal(list.find((e) => e.message === "boom").count, 2);
  assert.equal(listErrors(db, { source: "client" }).length, 1);
  assert.equal(clearErrors(db, false), 2);
});
