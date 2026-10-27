import test from "node:test";
import assert from "node:assert/strict";

import { startLogin, loginStatus, handleUpdate, setTelegramTransport, deviceLabel } from "../../.tsc-tests/lib/server/telegram-login.js";
import { freshDb } from "./helpers.mjs";

process.env.TELEGRAM_BOT_TOKEN = "123:test";
process.env.TELEGRAM_BOT_USERNAME = "ag_test_bot";
process.env.TELEGRAM_LOGIN_MODE = "webhook"; // без фонового опроса в тестах

const META = { ip: "1.2.3.4", ua: "Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537" };

function fake() {
  const calls = [];
  setTelegramTransport(async (method, body) => {
    calls.push({ method, body });
    return { ok: true, result: { message_id: 77 } };
  });
  return calls;
}
const msg = (token, from) => ({ update_id: 1, message: { message_id: 5, text: `/start login_${token}`, from, chat: { id: from.id, type: "private" } } });
const press = (data, from) => ({ update_id: 2, callback_query: { id: "cb1", from, data, message: { message_id: 77, chat: { id: from.id } } } });

test("полный вход: ссылка → код в боте → подтверждение → сессия один раз", async () => {
  const db = freshDb();
  const calls = fake();
  const s = startLogin(db, META);
  assert.ok(s.ok);
  assert.match(s.value.link, /^https:\/\/t\.me\/ag_test_bot\?start=login_/);
  assert.equal(loginStatus(db, s.value.token, META).status, "pending");

  const user = { id: 555, first_name: "Рин", username: "rin_test" };
  await handleUpdate(db, msg(s.value.token, user));
  const ask = calls.find((c) => c.method === "sendMessage");
  assert.ok(ask.body.text.includes(s.value.code), "в сообщении бота есть код с сайта");
  assert.ok(ask.body.text.includes("Chrome · Windows"));
  assert.equal(loginStatus(db, s.value.token, META).status, "pending");

  await handleUpdate(db, press(`ok:${s.value.token}`, user));
  const done = loginStatus(db, s.value.token, META);
  assert.equal(done.status, "ok");
  assert.equal(done.user.telegramId, "555");
  assert.ok(done.session.token.length > 20);
  assert.equal(loginStatus(db, s.value.token, META).status, "unknown", "токен одноразовый");
  // тот же человек входит повторно — тот же аккаунт
  const s2 = startLogin(db, META);
  await handleUpdate(db, msg(s2.value.token, user));
  await handleUpdate(db, press(`ok:${s2.value.token}`, user));
  assert.equal(loginStatus(db, s2.value.token, META).user.id, done.user.id);
});

test("чужой аккаунт не может подтвердить вход, отмена закрывает запрос", async () => {
  const db = freshDb();
  fake();
  const s = startLogin(db, META);
  const victim = { id: 1, username: "victim" };
  const attacker = { id: 2, username: "attacker" };
  await handleUpdate(db, msg(s.value.token, victim));
  await handleUpdate(db, press(`ok:${s.value.token}`, attacker));
  assert.equal(loginStatus(db, s.value.token, META).status, "pending");
  await handleUpdate(db, press(`no:${s.value.token}`, victim));
  assert.equal(loginStatus(db, s.value.token, META).status, "cancelled");
});

test("просроченный запрос не подтверждается; лимит попыток", async () => {
  const db = freshDb();
  fake();
  const s = startLogin(db, { ...META, now: 1000 });
  const user = { id: 9, username: "late" };
  await handleUpdate(db, msg(s.value.token, user), 1000 + 6 * 60_000);
  await handleUpdate(db, press(`ok:${s.value.token}`, user), 1000 + 6 * 60_000);
  assert.equal(loginStatus(db, s.value.token, { ...META, now: 1000 + 6 * 60_000 }).status, "pending" === "x" ? "" : "expired");
  for (let i = 0; i < 8; i += 1) startLogin(db, { ...META, ip: "9.9.9.9" });
  assert.equal(startLogin(db, { ...META, ip: "9.9.9.9" }).ok, false);
});

test("подпись устройства", () => {
  assert.equal(deviceLabel("Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile"), "Chrome · Android");
});
