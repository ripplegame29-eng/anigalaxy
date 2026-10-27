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

import {
  addVoiceMessage,
  chatAudio,
  decorate,
  deleteChatMessage,
  editChatMessage,
  toggleChatReaction,
} from "../../.tsc-tests/lib/server/chat.js";

test("чат: ответ-цитата, реакции, правка и удаление", () => {
  const db = freshDb();
  const a = makeUser(db, "Ann");
  const b = makeUser(db, "Bob");
  const first = addChatMessage(db, a.id, "Ann", { body: "привет" }, 1000);
  const second = addChatMessage(db, b.id, "Bob", { body: "здорово", replyTo: first.value.id }, 2000);
  assert.equal(second.value.replyTo, first.value.id);
  assert.equal(addChatMessage(db, b.id, "Bob", { body: "x", replyTo: 9999 }, 2100).value.replyTo, 0, "несуществующий ответ отбрасывается");

  const shown = decorate(db, listChatMessages(db, 10), b.id);
  assert.equal(shown[1].reply.nickname, "Ann");

  assert.equal(toggleChatReaction(db, b.id, first.value.id, "🔥").value, true);
  assert.equal(toggleChatReaction(db, a.id, first.value.id, "🔥").value, true);
  assert.equal(toggleChatReaction(db, b.id, first.value.id, "💩").code, "invalid");
  const mineView = decorate(db, listChatMessages(db, 10), b.id)[0].reactions[0];
  assert.deepEqual(mineView, { emoji: "🔥", count: 2, mine: true });
  assert.equal(toggleChatReaction(db, b.id, first.value.id, "🔥").value, false, "повтор снимает реакцию");

  assert.equal(editChatMessage(db, b.id, first.value.id, "чужое", 3000).code, "forbidden");
  assert.equal(editChatMessage(db, a.id, first.value.id, "привет!", 3000).ok, true);
  assert.equal(editChatMessage(db, a.id, first.value.id, "поздно", 1000 + 16 * 60_000).code, "expired");
  assert.equal(listChatMessages(db, 10)[0].body, "привет!");

  assert.equal(deleteChatMessage(db, b.id, false, first.value.id).code, "forbidden");
  assert.equal(deleteChatMessage(db, a.id, false, first.value.id).ok, true);
  const gone = listChatMessages(db, 10)[0];
  assert.equal(gone.deleted, true);
  assert.equal(gone.body, "");
});

test("чат: голосовое — лимиты и выдача аудио", () => {
  const db = freshDb();
  const a = makeUser(db, "Voice");
  const data = new Uint8Array([1, 2, 3, 4]);
  assert.equal(addVoiceMessage(db, a.id, "Voice", { data, mime: "text/plain", ms: 3000 }).code, "invalid");
  assert.equal(addVoiceMessage(db, a.id, "Voice", { data, mime: "audio/webm", ms: 100 }).code, "invalid");
  assert.equal(addVoiceMessage(db, a.id, "Voice", { data, mime: "audio/webm", ms: 90_000 }).code, "invalid");
  assert.equal(addVoiceMessage(db, a.id, "Voice", { data: new Uint8Array(500_000), mime: "audio/webm", ms: 3000 }).code, "invalid");
  const ok = addVoiceMessage(db, a.id, "Voice", { data, mime: "audio/webm;codecs=opus", ms: 4000, wave: "12345678" });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.kind, "voice");
  assert.deepEqual([...chatAudio(db, ok.value.id).data], [1, 2, 3, 4]);
  deleteChatMessage(db, a.id, false, ok.value.id);
  assert.equal(chatAudio(db, ok.value.id), null);
});
