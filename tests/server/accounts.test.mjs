import test from "node:test";
import assert from "node:assert/strict";

import {
  registerUser, verifyLogin, createSession, sessionUser, destroySession,
  changeUserPassword, upsertTelegramUser, loginAllowed, recordLoginFailure, clearLoginFailures,
} from "../../.tsc-tests/lib/server/users.js";
import { hashPassword, verifyPassword } from "../../.tsc-tests/lib/server/passwords.js";
import { freshDb, makeUser } from "./helpers.mjs";

test("миграции применяются и повторный запуск безопасен", async () => {
  const db = freshDb();
  const { migrate } = await import("../../.tsc-tests/lib/server/db.js");
  const v1 = migrate(db);
  const v2 = migrate(db);
  assert.equal(v1, v2);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
  for (const t of ["users", "sessions", "user_docs", "player_stats", "clans", "comments", "friendships", "notifications"]) {
    assert.ok(tables.includes(t), `нет таблицы ${t}`);
  }
});

test("пароль хэшируется scrypt и проверяется", () => {
  const h = hashPassword("пароль-123");
  assert.ok(h.startsWith("scrypt$"));
  assert.notEqual(h, hashPassword("пароль-123"), "соль должна различаться");
  assert.equal(verifyPassword("пароль-123", h), true);
  assert.equal(verifyPassword("другой", h), false);
  assert.equal(verifyPassword("x", "мусор"), false);
});

test("регистрация: проверки и уникальность без учёта регистра", () => {
  const db = freshDb();
  assert.equal(registerUser(db, { nickname: "ab", email: "a@b.co", password: "secret1" }).ok, false);
  assert.equal(registerUser(db, { nickname: "Ninja", email: "bad", password: "secret1" }).ok, false);
  assert.equal(registerUser(db, { nickname: "Ninja", email: "n@x.io", password: "123" }).ok, false);
  assert.equal(registerUser(db, { nickname: "Ninja", email: "n@x.io", password: "secret1" }).ok, true);
  const dupNick = registerUser(db, { nickname: "NINJA", email: "other@x.io", password: "secret1" });
  assert.equal(dupNick.ok, false);
  assert.equal(dupNick.code, "nickname_taken");
  const dupMail = registerUser(db, { nickname: "Other", email: "N@X.IO", password: "secret1" });
  assert.equal(dupMail.code, "email_taken");
});

test("вход по нику и по почте; неверный пароль отвергается", () => {
  const db = freshDb();
  makeUser(db, "Kira");
  assert.equal(verifyLogin(db, "kira", "secret123").ok, true);
  assert.equal(verifyLogin(db, "kira@example.com", "secret123").ok, true);
  const bad = verifyLogin(db, "Kira", "nope");
  assert.equal(bad.ok, false);
  assert.equal(bad.code, "bad_password");
  assert.equal(verifyLogin(db, "ghost", "secret123").code, "no_user");
});

test("сессия: токен хранится хэшем, истекает и удаляется", () => {
  const db = freshDb();
  const u = makeUser(db, "Sess");
  const { token } = createSession(db, u.id, { now: 1_000 });
  const stored = db.prepare("SELECT token_hash FROM sessions").get().token_hash;
  assert.notEqual(stored, token);
  assert.equal(sessionUser(db, token, 2_000)?.id, u.id);
  assert.equal(sessionUser(db, "чужой-токен", 2_000), null);
  assert.equal(sessionUser(db, token, 1_000 + 31 * 24 * 3600 * 1000), null, "после срока не работает");
  destroySession(db, token);
  assert.equal(sessionUser(db, token, 2_000), null);
});

test("заблокированный игрок не входит и не держит сессию", () => {
  const db = freshDb();
  const u = makeUser(db, "Bad");
  const { token } = createSession(db, u.id, { now: 1_000 });
  db.prepare("UPDATE users SET banned_until = ? WHERE id = ?").run(10_000_000, u.id);
  assert.equal(verifyLogin(db, "Bad", "secret123", 5_000).code, "banned");
  assert.equal(sessionUser(db, token, 5_000), null);
});

test("смена пароля: нужен текущий, сессии сбрасываются", () => {
  const db = freshDb();
  const u = makeUser(db, "Pass1");
  const { token } = createSession(db, u.id);
  assert.equal(changeUserPassword(db, u.id, "wrong", "newsecret1").ok, false);
  assert.equal(changeUserPassword(db, u.id, "secret123", "newsecret1").ok, true);
  assert.equal(verifyLogin(db, "Pass1", "newsecret1").ok, true);
  assert.equal(verifyLogin(db, "Pass1", "secret123").ok, false);
  assert.equal(sessionUser(db, token), null);
});

test("Telegram: повторный вход даёт того же игрока, ники не конфликтуют", () => {
  const db = freshDb();
  const a = upsertTelegramUser(db, { telegramId: "111", nickname: "alex" });
  const b = upsertTelegramUser(db, { telegramId: "111", nickname: "alex" });
  assert.equal(a.value.id, b.value.id);
  const c = upsertTelegramUser(db, { telegramId: "222", nickname: "alex" });
  assert.notEqual(c.value.nickname.toLowerCase(), "alex");
});

test("лимит неудачных входов", () => {
  const db = freshDb();
  for (let i = 0; i < 10; i += 1) recordLoginFailure(db, "ip:1", 1000 + i);
  assert.equal(loginAllowed(db, "ip:1", 2000), false);
  assert.equal(loginAllowed(db, "ip:2", 2000), true);
  assert.equal(loginAllowed(db, "ip:1", 1000 + 11 * 60 * 1000), true, "окно прошло");
  clearLoginFailures(db, "ip:1");
  assert.equal(loginAllowed(db, "ip:1", 2000), true);
});
