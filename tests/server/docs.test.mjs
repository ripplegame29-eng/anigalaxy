import test from "node:test";
import assert from "node:assert/strict";

import { putDoc, getDoc, listDocs, summarizeProgress, deleteAllDocs } from "../../.tsc-tests/lib/server/docs.js";
import {
  weeklyBoard, allTimeBoard, myWeekly, settleWeek, settlePastWeeks, pendingRewards, claimReward,
} from "../../.tsc-tests/lib/server/leaderboard.js";
import { weekKey } from "../../.tsc-tests/lib/leaderboard-prizes.js";
import { isSyncKey, PROGRESS_DOC_KEY } from "../../.tsc-tests/lib/sync-keys.js";
import { freshDb, makeUser } from "./helpers.mjs";

const doc = (xp, level = 1, ac = 0) => JSON.stringify({ schema: 1, progress: { xpTotal: xp, level, acBalance: ac } });
const MON = Date.UTC(2026, 9, 19, 12); // понедельник 19 октября 2026
const DAY = 24 * 3600 * 1000;

test("ключи синхронизации: свои да, служебные и чужие нет", () => {
  assert.equal(isSyncKey("animehub:progress:v1"), true);
  assert.equal(isSyncKey("anigalaxy.clan.v2"), true);
  assert.equal(isSyncKey("animehub:account:v1"), false);
  assert.equal(isSyncKey("animehub:devices:v1"), false);
  assert.equal(isSyncKey("evil:key"), false);
  assert.equal(isSyncKey("animehub:" + "x".repeat(200)), false);
});

test("документы: версии растут, конфликт возвращает серверную копию", () => {
  const db = freshDb();
  const u = makeUser(db);
  const r1 = putDoc(db, u.id, { key: "animehub:favorites:v1", value: "[1]" });
  assert.deepEqual(r1, { ok: true, version: 1 });
  const r2 = putDoc(db, u.id, { key: "animehub:favorites:v1", value: "[1,2]", baseVersion: 1 });
  assert.deepEqual(r2, { ok: true, version: 2 });
  const stale = putDoc(db, u.id, { key: "animehub:favorites:v1", value: "[9]", baseVersion: 1 });
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, "conflict");
  assert.equal(stale.server.value, "[1,2]");
  assert.equal(getDoc(db, u.id, "animehub:favorites:v1").value, "[1,2]");
  assert.equal(listDocs(db, u.id).length, 1);
});

test("документы изолированы между игроками и фильтруют ключи/размер", () => {
  const db = freshDb();
  const a = makeUser(db);
  const b = makeUser(db);
  putDoc(db, a.id, { key: "animehub:prefs:v1", value: "A" });
  assert.equal(getDoc(db, b.id, "animehub:prefs:v1"), null);
  assert.equal(putDoc(db, a.id, { key: "bad:key", value: "x" }).reason, "invalid");
  assert.equal(putDoc(db, a.id, { key: "animehub:account:v1", value: "x" }).reason, "invalid");
  assert.equal(putDoc(db, a.id, { key: "animehub:big:v1", value: "x".repeat(1024 * 1024 + 1) }).reason, "too_large");
});

test("прогресс: срез для рейтинга и защита от накрутки", () => {
  const db = freshDb();
  const u = makeUser(db);
  assert.deepEqual(summarizeProgress(doc(500, 3, 40)), { xpTotal: 500, level: 3, acBalance: 40 });
  assert.equal(summarizeProgress("не json"), null);
  assert.equal(summarizeProgress(JSON.stringify({ progress: { xpTotal: -5 } })), null);

  assert.equal(putDoc(db, u.id, { key: PROGRESS_DOC_KEY, value: doc(1000, 4) }, MON).ok, true);
  // за минуту +1 000 000 XP — нереально
  const cheat = putDoc(db, u.id, { key: PROGRESS_DOC_KEY, value: doc(1_001_000, 99), baseVersion: 1 }, MON + 60_000);
  assert.equal(cheat.ok, false);
  assert.equal(cheat.reason, "implausible");
  // обычный рост проходит
  assert.equal(putDoc(db, u.id, { key: PROGRESS_DOC_KEY, value: doc(1300, 4), baseVersion: 1 }, MON + 60_000).ok, true);
  // первая загрузка выше потолка не принимается
  const u2 = makeUser(db);
  assert.equal(putDoc(db, u2.id, { key: PROGRESS_DOC_KEY, value: doc(9_999_999) }, MON).reason, "invalid");
});

test("недельный лидерборд: очки за неделю, места и all-time", () => {
  const db = freshDb();
  const a = makeUser(db, "Alpha");
  const b = makeUser(db, "Bravo");
  const c = makeUser(db, "Charlie");
  putDoc(db, a.id, { key: PROGRESS_DOC_KEY, value: doc(1000) }, MON);
  putDoc(db, b.id, { key: PROGRESS_DOC_KEY, value: doc(5000) }, MON);
  putDoc(db, c.id, { key: PROGRESS_DOC_KEY, value: doc(200) }, MON);
  // в течение недели
  putDoc(db, a.id, { key: PROGRESS_DOC_KEY, value: doc(1900), baseVersion: 1 }, MON + 3600_000);
  putDoc(db, b.id, { key: PROGRESS_DOC_KEY, value: doc(5300), baseVersion: 1 }, MON + 3600_000);

  const board = weeklyBoard(db, MON + 7200_000);
  assert.deepEqual(board.map((r) => [r.nickname, r.points]), [["Alpha", 900], ["Bravo", 300]]);
  assert.equal(myWeekly(db, a.id, MON + 7200_000).rank, 1);
  assert.equal(myWeekly(db, b.id, MON + 7200_000).rank, 2);
  assert.deepEqual(myWeekly(db, c.id, MON + 7200_000), { points: 0, rank: null });
  assert.equal(allTimeBoard(db)[0].nickname, "Bravo");
});

test("итоги недели: снимок при смене недели, одна выплата", () => {
  const db = freshDb();
  const a = makeUser(db, "Alpha");
  const b = makeUser(db, "Bravo");
  const week1 = weekKey(MON);
  putDoc(db, a.id, { key: PROGRESS_DOC_KEY, value: doc(1000) }, MON);
  putDoc(db, b.id, { key: PROGRESS_DOC_KEY, value: doc(1000) }, MON);
  putDoc(db, a.id, { key: PROGRESS_DOC_KEY, value: doc(2500), baseVersion: 1 }, MON + DAY);
  putDoc(db, b.id, { key: PROGRESS_DOC_KEY, value: doc(1800), baseVersion: 1 }, MON + DAY);

  // Alpha заходит на следующей неделе (снимок очков прошлой), Bravo — нет
  const NEXT = MON + 7 * DAY;
  putDoc(db, a.id, { key: PROGRESS_DOC_KEY, value: doc(2600), baseVersion: 2 }, NEXT);
  assert.equal(weekKey(NEXT) !== week1, true);

  assert.deepEqual(settlePastWeeks(db, NEXT), [week1]);
  assert.equal(settleWeek(db, week1), 0, "повторный подсчёт ничего не добавляет");

  const pa = pendingRewards(db, a.id, NEXT);
  const pb = pendingRewards(db, b.id, NEXT);
  assert.deepEqual(pa.map((r) => [r.rank, r.points]), [[1, 1500]]);
  assert.deepEqual(pb.map((r) => [r.rank, r.points]), [[2, 800]]);

  assert.ok(claimReward(db, a.id, week1, NEXT));
  assert.equal(claimReward(db, a.id, week1, NEXT), null, "второй раз приз не выдаётся");
  assert.equal(pendingRewards(db, a.id, NEXT).length, 0);
  assert.equal(claimReward(db, b.id, "2000-01-03", NEXT), null);
});

test("стирание данных игрока очищает документы и срез", () => {
  const db = freshDb();
  const u = makeUser(db);
  putDoc(db, u.id, { key: PROGRESS_DOC_KEY, value: doc(100) }, MON);
  deleteAllDocs(db, u.id);
  assert.equal(listDocs(db, u.id).length, 0);
  assert.equal(allTimeBoard(db).length, 0);
});
