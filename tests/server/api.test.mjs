/**
 * Сквозная проверка серверных маршрутов: настоящие обработчики с настоящей
 * (временной) базой, запросы — через NextRequest из установленного Next.
 */

import test from "node:test";
import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dbFile = path.join(os.tmpdir(), `ag-api-test-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_PATH = dbFile;

// «@/…» в скомпилированном коде → .tsc-tests/…
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith("@/")) request = path.join(root, ".tsc-tests", request.slice(2));
  return originalResolve.call(this, request, ...rest);
};

const require = createRequire(import.meta.url);
const { NextRequest } = require(path.join(root, "node_modules", "next", "server.js"));
const api = (p) => require(path.join(root, ".tsc-tests", "app", "api", p, "route.js"));

const BASE = "http://localhost:3000";

function makeReq(method, url, body, cookie) {
  const headers = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  return new NextRequest(BASE + url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Достать «ag_session=…» из Set-Cookie ответа */
function cookieOf(res) {
  const raw = res.headers.get("set-cookie") ?? "";
  const m = raw.match(/ag_session=([^;]*)/);
  return m && m[1] ? `ag_session=${m[1]}` : null;
}

test.after(() => {
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(dbFile + suffix, { force: true });
});

test("регистрация выдаёт httpOnly-cookie, /me узнаёт игрока, выход закрывает сессию", async () => {
  const reg = await api("account/register").POST(makeReq("POST", "/api/account/register", { nickname: "ApiUser", email: "api@user.io", password: "secret123" }));
  assert.equal(reg.status, 201);
  const setCookie = reg.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=lax/i);
  assert.doesNotMatch(setCookie, /Secure/i, "по http cookie без Secure");
  const cookie = cookieOf(reg);
  assert.ok(cookie);
  const body = await reg.json();
  assert.equal(body.account.nickname, "ApiUser");
  assert.equal("passHash" in body.account, false);

  const me = await api("account/me").GET(makeReq("GET", "/api/account/me", undefined, cookie));
  assert.equal((await me.json()).account.nickname, "ApiUser");
  const guest = await api("account/me").GET(makeReq("GET", "/api/account/me"));
  assert.equal((await guest.json()).account, null);

  const out = await api("account/logout").POST(makeReq("POST", "/api/account/logout", {}, cookie));
  assert.equal(out.status, 200);
  const after = await api("account/me").GET(makeReq("GET", "/api/account/me", undefined, cookie));
  assert.equal((await after.json()).account, null);
});

test("вход: неверный пароль 401, лимит попыток 429, верный пароль даёт cookie", async () => {
  const login = (pw, ip = "9.9.9.9") => {
    const req = makeReq("POST", "/api/account/login", { login: "apiuser", password: pw });
    req.headers.set("x-forwarded-for", ip);
    return api("account/login").POST(req);
  };
  const good = await login("secret123", "1.1.1.1");
  assert.equal(good.status, 200);
  assert.ok(cookieOf(good));
  for (let i = 0; i < 10; i += 1) assert.equal((await login("wrong", "2.2.2.2")).status, 401);
  assert.equal((await login("wrong", "2.2.2.2")).status, 429);
  assert.equal((await login("secret123", "3.3.3.3")).status, 429, "лимит и на сам логин");
});

test("запись с чужого Origin отклоняется (CSRF)", async () => {
  const req = makeReq("POST", "/api/account/register", { nickname: "Evil", email: "e@e.io", password: "secret123" });
  req.headers.set("origin", "https://evil.example");
  req.headers.set("host", "localhost:3000");
  const res = await api("account/register").POST(req);
  assert.equal(res.status, 403);
});

async function signUp(nick) {
  const res = await api("account/register").POST(makeReq("POST", "/api/account/register", { nickname: nick, email: `${nick.toLowerCase()}@mail.io`, password: "secret123" }));
  assert.equal(res.status, 201);
  return cookieOf(res);
}

test("синхронизация: без входа 401, запись, версии, конфликт, чужие данные недоступны", async () => {
  const guest = await api("sync").GET(makeReq("GET", "/api/sync"));
  assert.equal(guest.status, 401);

  const a = await signUp("SyncA");
  const b = await signUp("SyncB");
  const put = (cookie, docs) => api("sync").POST(makeReq("POST", "/api/sync", { docs }, cookie));

  let res = await (await put(a, [{ key: "animehub:favorites:v1", value: "[1,2]" }])).json();
  assert.equal(res.results[0].ok, true);
  assert.equal(res.results[0].version, 1);
  res = await (await put(a, [{ key: "animehub:favorites:v1", value: "[1]", baseVersion: 0 }])).json();
  assert.equal(res.results[0].reason, "conflict");
  assert.equal(res.results[0].server.value, "[1,2]");
  res = await (await put(a, [{ key: "evil:key", value: "x" }, { key: "animehub:account:v1", value: "x" }])).json();
  assert.deepEqual(res.results.map((r) => r.reason), ["invalid", "invalid"]);

  const listA = await (await api("sync").GET(makeReq("GET", "/api/sync", undefined, a))).json();
  assert.equal(listA.docs.length, 1);
  const listB = await (await api("sync").GET(makeReq("GET", "/api/sync", undefined, b))).json();
  assert.equal(listB.docs.length, 0);

  const wipe = await api("sync").POST(makeReq("POST", "/api/sync", { wipe: true }, a));
  assert.equal(wipe.status, 200);
  assert.equal((await (await api("sync").GET(makeReq("GET", "/api/sync", undefined, a))).json()).docs.length, 0);
});

test("лидерборд: прогресс из синхронизации попадает в таблицу и моё место", async () => {
  const c = await signUp("BoardC");
  const progress = JSON.stringify({ schema: 1, progress: { xpTotal: 700, level: 3, acBalance: 10 } });
  await api("sync").POST(makeReq("POST", "/api/sync", { docs: [{ key: "animehub:progress:v1", value: progress }] }, c));
  const progress2 = JSON.stringify({ schema: 1, progress: { xpTotal: 1100, level: 3, acBalance: 10 } });
  await api("sync").POST(makeReq("POST", "/api/sync", { docs: [{ key: "animehub:progress:v1", value: progress2, baseVersion: 1 }] }, c));

  const all = await (await api("leaderboard").GET(makeReq("GET", "/api/leaderboard?period=all", undefined, c))).json();
  assert.ok(all.rows.some((r) => r.nickname === "BoardC" && r.points === 1100));
  const week = await (await api("leaderboard").GET(makeReq("GET", "/api/leaderboard", undefined, c))).json();
  assert.equal(week.me.points, 400);
  assert.equal(week.me.rank, 1);
  assert.equal("userId" in week.rows[0], false, "id игроков наружу не отдаём");

  const rewards = await api("leaderboard/rewards").GET(makeReq("GET", "/api/leaderboard/rewards", undefined, c));
  assert.deepEqual((await rewards.json()).rewards, []);
});

test("кланы: создание, вступление, вклад, мой клан, война", async () => {
  const lead = await signUp("ClanLead");
  const mate = await signUp("ClanMate");
  const lead2 = await signUp("ClanLead2");
  const act = (cookie, body) => api("clans/action").POST(makeReq("POST", "/api/clans/action", body, cookie));

  const created = await api("clans").POST(makeReq("POST", "/api/clans", { name: "Api Clan", tag: "API" }, lead));
  assert.equal(created.status, 201);
  const clanId = (await created.json()).clan.id;
  const second = await (await api("clans").POST(makeReq("POST", "/api/clans", { name: "Rival Clan", tag: "RIV" }, lead2))).json();

  assert.equal((await act(mate, { action: "join", clanId })).status, 200);
  assert.equal((await act(mate, { action: "contribute", xp: 250, ac: 40 })).status, 200);
  assert.equal((await act(mate, { action: "kick", userId: 1 })).status, 403);
  assert.equal((await act(mate, { action: "fly" })).status, 400);

  const mine = await (await api("clans/me").GET(makeReq("GET", "/api/clans/me", undefined, mate))).json();
  assert.equal(mine.clan.xp, 250);
  assert.equal(mine.members.length, 2);

  const list = await (await api("clans").GET(makeReq("GET", "/api/clans?q=api"))).json();
  assert.equal(list.clans.length, 1);

  await act(lead, { action: "contribute", ac: 500 });
  await act(lead2, { action: "contribute", ac: 500 });
  const war = await act(lead, { action: "declare_war", clanId: second.clan.id, stake: 200 });
  assert.equal(war.status, 200);
  assert.equal((await act(mate, { action: "war_score", points: 120 })).status, 200);
  const warState = await (await api("clans/me").GET(makeReq("GET", "/api/clans/me", undefined, lead))).json();
  assert.equal(warState.war.scoreA, 120);
});

test("комментарии, друзья, оценки, уведомления через API", async () => {
  const u1 = await signUp("TalkOne");
  const u2 = await signUp("TalkTwo");
  const post = (route, cookie, body) => api(route).POST(makeReq("POST", `/api/${route}`, body, cookie));

  assert.equal((await post("comments", undefined, { action: "add", titleId: "serial-1", body: "x" })).status, 401);
  const added = await post("comments", u1, { action: "add", titleId: "serial-1", body: "Класс!" });
  assert.equal(added.status, 201);
  const id = (await added.json()).id;
  assert.equal((await post("comments", u2, { action: "vote", id, value: 1 })).status, 200);
  const list = await (await api("comments").GET(makeReq("GET", "/api/comments?title=serial-1", undefined, u2))).json();
  assert.equal(list.comments[0].score, 1);
  assert.equal(list.comments[0].myVote, 1);
  assert.equal("userId" in list.comments[0], true);
  assert.equal((await post("comments", u2, { action: "delete", id })).status, 403);

  assert.equal((await (await post("friends", u1, { action: "request", nickname: "TalkTwo" })).json()).status, "requested");
  assert.equal((await (await post("friends", u2, { action: "request", nickname: "TalkOne" })).json()).status, "accepted");
  const friends = await (await api("friends").GET(makeReq("GET", "/api/friends", undefined, u1))).json();
  assert.equal(friends.friends[0].status, "accepted");

  assert.equal((await post("ratings", u1, { titleId: "serial-1", score: 9 })).status, 200);
  const rating = await (await api("ratings").GET(makeReq("GET", "/api/ratings?title=serial-1"))).json();
  assert.deepEqual(rating, { avg: 9, votes: 1 });
  assert.equal((await post("ratings", u1, { titleId: "serial-1", score: 99 })).status, 400);

  const notes = await api("notifications").GET(makeReq("GET", "/api/notifications", undefined, u1));
  assert.equal(notes.status, 200);
});
