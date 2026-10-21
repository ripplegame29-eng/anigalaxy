/**
 * Недельный итог лидерборда: места, призы, выплата через движок.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { PRIZES, botPoints, prizeFor, weekKey, weeklyRank } from "../../.tsc-tests/lib/leaderboard-prizes.js";
import { apply, at, freshDoc } from "./helpers.mjs";

test("призы покрывают места 1–100 без дыр и пересечений", () => {
  for (let rank = 1; rank <= 100; rank += 1) {
    const hits = PRIZES.filter((p) => rank >= p.from && rank <= p.to);
    assert.equal(hits.length, 1, `место ${rank}`);
  }
  assert.equal(prizeFor(101), undefined);
  assert.equal(prizeFor(null), undefined);
});

test("очки соперников убывают с местом", () => {
  for (let i = 1; i < 100; i += 1) assert.ok(botPoints(0, i - 1) > botPoints(0, i), `i=${i}`);
});

test("место за очки: лидер, середина, вне сотни, ноль очков", () => {
  assert.equal(weeklyRank(botPoints(0, 0) + 1), 1);
  assert.equal(weeklyRank(botPoints(0, 9) + 0.01) <= 10, true);
  assert.equal(weeklyRank(botPoints(0, 99) + 0.5), 100);
  assert.equal(weeklyRank(botPoints(0, 99) - 0.5), null, "ниже сотого соперника — без места");
  assert.equal(weeklyRank(0), null);
  assert.equal(weeklyRank(1), null, "1 очко — далеко за сотней");
});

test("неделя начинается в понедельник по UTC", () => {
  assert.equal(weekKey(Date.UTC(2026, 9, 21, 12)), "2026-10-19"); // среда
  assert.equal(weekKey(Date.UTC(2026, 9, 19, 0)), "2026-10-19"); // понедельник 00:00
  assert.equal(weekKey(Date.UTC(2026, 9, 25, 23, 59)), "2026-10-19"); // воскресенье
  assert.equal(weekKey(Date.UTC(2026, 9, 26, 0, 0)), "2026-10-26");
});

test("LEADERBOARD_REWARD: XP и AC начисляются один раз на неделю", () => {
  const ev = { type: "LEADERBOARD_REWARD", key: "2026-10-12", xp: 400, ac: 80 };
  const first = apply(freshDoc(), ev);
  assert.equal(first.doc.progress.xpTotal >= 400, true);
  assert.equal(first.doc.progress.acBalance >= 80, true);
  const xp = first.doc.progress.xpTotal;
  const ac = first.doc.progress.acBalance;

  const again = apply(first.doc, ev);
  assert.equal(again.doc.progress.xpTotal, xp, "повтор не платит XP");
  assert.equal(again.doc.progress.acBalance, ac, "повтор не платит AC");

  const paid = (doc) => doc.ledger.filter((e) => e.source === "LEADERBOARD" && e.currency === "AC").length;
  assert.equal(paid(again.doc), 1, "в журнале одна запись AC");
  const other = apply(first.doc, { ...ev, key: "2026-10-19" }, {}, at(13, 0));
  assert.equal(paid(other.doc), 2, "другая неделя — новая выплата");
});

test("LEADERBOARD_REWARD: отрицательные и нулевые значения ничего не дают", () => {
  const r = apply(freshDoc(), { type: "LEADERBOARD_REWARD", key: "w", xp: -50, ac: 0 });
  assert.equal(r.doc.progress.acBalance, 0);
  assert.equal(r.doc.progress.xpTotal, 0);
});
