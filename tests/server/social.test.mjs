import test from "node:test";
import assert from "node:assert/strict";

import {
  addComment, listComments, deleteComment, voteComment, requestFriend, listFriends, removeFriend,
  setRating, ratingOf, createReport, listReports, resolveReport, addNotification, listNotifications, markNotificationsRead,
} from "../../.tsc-tests/lib/server/social.js";
import { freshDb, makeUser } from "./helpers.mjs";

test("комментарии: добавление, ответы, лимит частоты, удаление", () => {
  const db = freshDb();
  const a = makeUser(db, "Anna");
  const b = makeUser(db, "Boris");
  const first = addComment(db, a.id, { titleId: "serial-1", body: "  Отличное аниме  " }, 1000);
  assert.ok(first.ok);
  assert.ok(addComment(db, b.id, { titleId: "serial-1", body: "Согласен", parentId: first.value }, 1000).ok);
  assert.equal(addComment(db, b.id, { titleId: "serial-2", body: "x", parentId: first.value }, 1000).code, "not_found");
  assert.equal(addComment(db, a.id, { titleId: "serial-1", body: "   " }).code, "invalid");
  assert.equal(addComment(db, a.id, { titleId: "serial-1", body: "x".repeat(2001) }).code, "invalid");
  assert.equal(addComment(db, a.id, { titleId: "bad id!", body: "x" }).code, "invalid");

  const list = listComments(db, "serial-1", a.id);
  assert.equal(list.length, 2);
  assert.equal(list[1].body, "Отличное аниме");

  // спам: 5 в минуту
  for (let i = 0; i < 4; i += 1) addComment(db, a.id, { titleId: "serial-1", body: `c${i}` }, 2000);
  assert.equal(addComment(db, a.id, { titleId: "serial-1", body: "лишний" }, 2000).code, "rate_limit");

  assert.equal(deleteComment(db, b.id, "user", first.value).code, "forbidden");
  assert.ok(deleteComment(db, a.id, "user", first.value).ok);
  assert.equal(listComments(db, "serial-1", null).some((c) => c.id === first.value), false);
});

test("голоса за комментарии: один голос, нельзя за свой", () => {
  const db = freshDb();
  const a = makeUser(db);
  const b = makeUser(db);
  const c = makeUser(db);
  const id = addComment(db, a.id, { titleId: "t1", body: "текст" }, 1000).value;
  assert.equal(voteComment(db, a.id, id, 1).code, "forbidden");
  assert.equal(voteComment(db, b.id, id, 1).value, 1);
  assert.equal(voteComment(db, b.id, id, 1).value, 1, "повтор не удваивает");
  assert.equal(voteComment(db, c.id, id, -1).value, 0);
  assert.equal(voteComment(db, c.id, id, 0).value, 1);
  assert.equal(voteComment(db, b.id, id, 5).code, "invalid");
  assert.equal(listComments(db, "t1", b.id)[0].myVote, 1);
});

test("друзья: заявка, взаимное принятие, удаление", () => {
  const db = freshDb();
  const a = makeUser(db, "Alice");
  const b = makeUser(db, "Bobby");
  assert.equal(requestFriend(db, a.id, "Nobody").code, "not_found");
  assert.equal(requestFriend(db, a.id, "alice").code, "invalid");
  assert.equal(requestFriend(db, a.id, "Bobby").value, "requested");
  assert.equal(requestFriend(db, a.id, "Bobby").code, "exists");
  assert.equal(listFriends(db, a.id)[0].status, "outgoing");
  assert.equal(listFriends(db, b.id)[0].status, "incoming");
  assert.equal(requestFriend(db, b.id, "Alice").value, "accepted");
  assert.equal(listFriends(db, a.id)[0].status, "accepted");
  assert.equal(requestFriend(db, b.id, "Alice").code, "exists");
  removeFriend(db, a.id, b.id);
  assert.equal(listFriends(db, a.id).length, 0);
  assert.equal(listFriends(db, b.id).length, 0);
});

test("оценки: 1–10, среднее по тайтлу, переоценка заменяет", () => {
  const db = freshDb();
  const a = makeUser(db);
  const b = makeUser(db);
  assert.equal(setRating(db, a.id, "t1", 0).code, "invalid");
  assert.equal(setRating(db, a.id, "t1", 11).code, "invalid");
  assert.equal(setRating(db, a.id, "t1", 7.5).code, "invalid");
  setRating(db, a.id, "t1", 8);
  assert.deepEqual(setRating(db, b.id, "t1", 9).value, { avg: 8.5, votes: 2 });
  assert.deepEqual(setRating(db, a.id, "t1", 10).value, { avg: 9.5, votes: 2 });
  assert.deepEqual(ratingOf(db, "nothing"), { avg: 0, votes: 0 });
});

test("жалобы: создание, список, закрытие только модератором", () => {
  const db = freshDb();
  const u = makeUser(db);
  const mod = makeUser(db);
  assert.equal(createReport(db, u.id, { kind: "wtf", targetId: "1" }).code, "invalid");
  const r = createReport(db, u.id, { kind: "comment", targetId: "12", reason: "спам" });
  assert.ok(r.ok);
  assert.equal(listReports(db).length, 1);
  assert.equal(resolveReport(db, u.id, "user", r.value).code, "forbidden");
  assert.ok(resolveReport(db, mod.id, "moderator", r.value).ok);
  assert.equal(resolveReport(db, mod.id, "moderator", r.value).code, "not_found");
  assert.equal(listReports(db).length, 0);
  assert.equal(listReports(db, "resolved").length, 1);
});

test("уведомления: список и отметка прочитанным", () => {
  const db = freshDb();
  const u = makeUser(db);
  addNotification(db, u.id, "friend_request", { from: "Bob" }, 1000);
  addNotification(db, u.id, "war_won", { clan: 1 }, 2000);
  assert.equal(listNotifications(db, u.id).filter((n) => !n.read).length, 2);
  markNotificationsRead(db, u.id, 3000);
  assert.equal(listNotifications(db, u.id).filter((n) => !n.read).length, 0);
  assert.equal(listNotifications(db, makeUser(db).id).length, 0);
});
