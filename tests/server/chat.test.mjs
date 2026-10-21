import test from "node:test";
import assert from "node:assert/strict";

import { addChatMessage, listChatMessages } from "../../.tsc-tests/lib/server/chat.js";
import { freshDb, makeUser } from "./helpers.mjs";

test("чат: сообщение публикуется, видно всем, пустое и длинное отклоняются", () => {
  const db = freshDb();
  const nika = makeUser(db, "Nika");
  const sora = makeUser(db, "Sora");

  const sent = addChatMessage(db, nika.id, "Nika", { body: "  привет  ", tagId: "tag_sensei" }, 1000);
  assert.equal(sent.ok, true);
  assert.equal(sent.ok && sent.value.body, "привет");

  assert.equal(addChatMessage(db, nika.id, "Nika", { body: "   " }, 1000).code, "invalid");
  assert.equal(addChatMessage(db, nika.id, "Nika", { body: "x".repeat(301) }, 1000).code, "invalid");

  addChatMessage(db, sora.id, "Sora", { body: "привет всем", tagId: "not a valid tag!!" }, 2000);
  const list = listChatMessages(db, 60);
  assert.equal(list.length, 2);
  assert.equal(list[1].nickname, "Sora");
  assert.equal(list[1].tagId, "", "некорректный tagId отбрасывается");

  const afterFirst = listChatMessages(db, 60, list[0].id);
  assert.equal(afterFirst.length, 1);
  assert.equal(afterFirst[0].nickname, "Sora");
});

test("чат: лимит 10 сообщений в минуту на игрока", () => {
  const db = freshDb();
  const nika = makeUser(db, "Nika2");
  for (let i = 0; i < 10; i += 1) {
    assert.equal(addChatMessage(db, nika.id, "Nika2", { body: `msg ${i}` }, 1000).ok, true);
  }
  const over = addChatMessage(db, nika.id, "Nika2", { body: "одиннадцатое" }, 1000);
  assert.equal(over.ok, false);
  assert.equal(over.code, "rate_limit");
});
