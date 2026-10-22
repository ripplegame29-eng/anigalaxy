import test from "node:test";
import assert from "node:assert/strict";

import {
  addRoomMessage,
  createRoom,
  joinRoom,
  leaveRoom,
  listOpenRooms,
  MEMBER_TTL_MS,
  readRoom,
  setRoomState,
} from "../../.tsc-tests/lib/server/watch-together.js";
import { freshDb } from "./helpers.mjs";

const HOST = "client-host-0001";
const GUEST = "client-guest-0002";

function makeRoom(db, now = 1000) {
  const result = createRoom(
    db,
    {
      clientId: HOST,
      nickname: "Хост",
      title: "Вечерний марафон",
      anime: "Магическая битва",
      alias: "jujutsu-kaisen",
      dub: "AniLibria",
      access: "open",
    },
    now,
  );
  assert.equal(result.ok, true);
  return result.value;
}

test("комнаты: создание, код, создатель сразу участник", () => {
  const db = freshDb();
  const snapshot = makeRoom(db);
  assert.match(snapshot.room.code, /^[A-Z0-9]{6}$/);
  assert.equal(snapshot.room.access, "open");
  assert.equal(snapshot.room.limit, 12);
  assert.equal(snapshot.room.episode, 1);
  assert.equal(snapshot.room.viewers, 1);
  assert.equal(snapshot.members.length, 1);
  assert.equal(snapshot.members[0].nickname, "Хост");

  // Создатель отмечен как автор состояния, чтобы клиент не применял его повторно
  assert.equal(snapshot.room.by, HOST);
});

test("комнаты: вход по коду, общий список и вместимость", () => {
  const db = freshDb();
  const created = makeRoom(db);
  const code = created.room.code;

  const joined = joinRoom(db, code, { clientId: GUEST, nickname: "Гость" }, 2000);
  assert.equal(joined.ok, true);
  assert.equal(joined.value.room.viewers, 2);

  const fromOtherDevice = readRoom(db, code, { clientId: GUEST }, 3000);
  assert.equal(fromOtherDevice.ok, true);
  assert.equal(fromOtherDevice.value.members.length, 2);

  // Открытая комната видна в общем списке
  const listed = listOpenRooms(db, 3000);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].code, code);
  assert.equal(listed[0].viewers, 2);

  // Комната «по ссылке» в списке не появляется
  const linkRoom = createRoom(
    db,
    {
      clientId: HOST,
      nickname: "Хост",
      anime: "Рерайт",
      access: "link",
    },
    3000,
  );
  assert.equal(linkRoom.ok, true);
  assert.equal(linkRoom.value.room.limit, 8);
  assert.equal(listOpenRooms(db, 3000).length, 1);
});

test("комнаты: состояние плеера общее, чужой клиент не может писать", () => {
  const db = freshDb();
  const created = makeRoom(db);
  const code = created.room.code;
  joinRoom(db, code, { clientId: GUEST, nickname: "Гость" }, 2000);

  const moved = setRoomState(
    db,
    code,
    GUEST,
    { episode: 3, position: 84.5, playing: true },
    2500,
  );
  assert.equal(moved.ok, true);
  assert.equal(moved.value.room.episode, 3);
  assert.equal(moved.value.room.position, 84.5);
  assert.equal(moved.value.room.playing, true);
  assert.equal(moved.value.room.by, GUEST);

  const stranger = setRoomState(
    db,
    code,
    "client-stranger-9",
    { episode: 9, position: 0, playing: false },
    2600,
  );
  assert.equal(stranger.ok, false);
  assert.equal(stranger.code, "not_member");

  // Состояние переживает перезагрузку: новый клиент видит те же серию и секунду
  const fresh = readRoom(db, code, {}, 3000);
  assert.equal(fresh.ok, true);
  assert.equal(fresh.value.room.episode, 3);
  assert.equal(fresh.value.room.position, 84.5);
});

test("комнаты: чат и антиспам", () => {
  const db = freshDb();
  const created = makeRoom(db);
  const code = created.room.code;
  joinRoom(db, code, { clientId: GUEST, nickname: "Гость" }, 2000);

  const sent = addRoomMessage(db, code, GUEST, "  привет  ", 3000);
  assert.equal(sent.ok, true);
  assert.equal(sent.value.body, "привет");
  assert.equal(sent.value.nickname, "Гость");

  const snapshot = readRoom(db, code, { afterId: created.messages.at(-1)?.id ?? 0 }, 3000);
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.value.messages.length, 1);

  // Пустые и слишком длинные сообщения отклоняются
  assert.equal(addRoomMessage(db, code, GUEST, "   ", 3000).code, "invalid");
  assert.equal(addRoomMessage(db, code, GUEST, "x".repeat(301), 3000).code, "invalid");

  // Больше шести сообщений за 20 секунд — стоп
  for (let i = 1; i < 6; i += 1) {
    assert.equal(addRoomMessage(db, code, GUEST, `msg ${i}`, 3000).ok, true);
  }
  assert.equal(addRoomMessage(db, code, GUEST, "лишнее", 3000).code, "rate_limit");
});

test("комнаты: выход, простой участник и удаление пустой комнаты", () => {
  const db = freshDb();
  const created = makeRoom(db);
  const code = created.room.code;
  joinRoom(db, code, { clientId: GUEST, nickname: "Гость" }, 2000);

  // Участник пропал без запросов — исчезает из среза, но комната жива
  const stale = readRoom(db, code, {}, 2000 + MEMBER_TTL_MS + 1);
  assert.equal(stale.ok, true);
  assert.equal(stale.value.members.length, 0);
  assert.equal(stale.value.room.viewers, 0);

  // Вернулся по ссылке — снова в комнате
  const back = joinRoom(db, code, { clientId: GUEST, nickname: "Гость" }, 2000 + MEMBER_TTL_MS + 2);
  assert.equal(back.ok, true);
  assert.equal(back.value.room.viewers, 1);

  // Выход последнего участника закрывает комнату
  assert.equal(leaveRoom(db, code, GUEST, 3000).ok, true);
  const gone = readRoom(db, code, {}, 3000);
  assert.equal(gone.ok, false);
  assert.equal(gone.code, "not_found");
});
