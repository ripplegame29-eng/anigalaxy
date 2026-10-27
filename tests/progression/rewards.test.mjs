/**
 * Награды: уровни/AC, достижения, теги, квесты, магазин, комментарии,
 * секреты, dev/админ-события (§5–§10, §13).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { PROGRESSION_CONFIG } from "../../.tsc-tests/lib/progression/progression.config.js";
import { apply, at, freshDoc, watchEpisode } from "./helpers.mjs";

const cfg = PROGRESSION_CONFIG;
const LONG = "Этот комментарий намного длиннее двадцати символов — валидный текст.";

/* --------------------------------- Уровни -------------------------------- */

test("уровень: AC за каждый пройденный уровень, эра и тег за уровень", () => {
  const fast = { ...cfg, levels: { base: 10, exponent: 1, maxLevel: 100 } };

  const r = apply(
    freshDoc(),
    { type: "ADMIN_GRANT", currency: "XP", amount: 100, reason: "тест" },
    {},
    at(12, 0),
    fast,
  );

  // 100 XP → уровень 5 (пороги 10/30/60/100) → +100 XP за ach_level_5 → 200 → уровень 6
  assert.equal(r.doc.progress.xpTotal, 200, "100 админских + 100 за достижение уровня");
  assert.equal(r.doc.progress.level, 6);

  const levels = r.effects.filter((e) => e.type === "LEVEL_UP");
  assert.equal(levels.length, 2, "две волны: 1→5 и 5→6");
  assert.equal(levels[0].level, 5);
  assert.equal(levels[0].era, "Голубая аура");
  assert.equal(levels[0].eraChanged, true, "эра сменилась на 5 уровне");
  assert.equal(levels[1].level, 6);
  assert.equal(levels[1].eraChanged, false);

  const e = cfg.economy;
  const expectedAc =
    e.levelAcBase * 5 + e.levelAcPerLevel * (2 + 3 + 4 + 5 + 6) + 50;
  assert.equal(r.doc.progress.acBalance, expectedAc, "AC за уровни 2–6 + 50 за ach_level_5");
  assert.equal(r.doc.progress.trophyPoints, 10, "трофей ach_level_5");
  assert.ok(r.doc.tags.tag_otaku, "тег за 5 уровень выдан");
  assert.ok(r.effects.some((e) => e.type === "TAG_UNLOCKED" && e.tagId === "tag_otaku"));
});

/* ------------------------------ Достижения ------------------------------ */

test("достижение: разблокировка автоматическая, награда в журнале", () => {
  let doc = freshDoc();
  for (let i = 0; i < 10; i += 1) {
    doc = apply(doc, { type: "TITLE_RATED", titleId: `t${i}`, score: 8 }, {}, at(12, 0) + i * 1000).doc;
  }

  const state = doc.achievements.ach_ratings_10;
  assert.ok(state?.unlockedAt, "«Критик» разблокирован");
  assert.equal(state.progress, 10);
  assert.equal(state.migrated, undefined, "новое достижение, не миграционное");
  assert.equal(doc.progress.trophyPoints, 25);
  assert.equal(doc.progress.xpTotal, 50 + 250, "10×5 активности + 250 EXEMPT");
  assert.equal(doc.progress.acBalance, 14 + 16 + 100, "AC уровней 2–3 + 100 за «Критика»");
  assert.ok(
    doc.ledger.some((e) => e.idempotencyKey === "ACH:tester:ach_ratings_10"),
    "награда достижения записана в USER_REWARDS_LOG",
  );
  assert.ok(
    !doc.achievements.ach_ratings_50?.unlockedAt,
    "следующая ступень не открыта",
  );
});

test("достижение: DEV_ADJUST двигает метрику и разблокирует", () => {
  let doc = apply(
    freshDoc(),
    { type: "DEV_ADJUST", metric: "EPISODES_COMPLETED", delta: 25 },
    {},
    at(12, 0),
  ).doc;

  assert.equal(doc.counters.EPISODES_COMPLETED, 25);
  assert.ok(doc.achievements.ach_episodes_1?.unlockedAt, "ступень 1");
  assert.ok(doc.achievements.ach_episodes_10?.unlockedAt, "ступень 10");
  assert.ok(!doc.achievements.ach_episodes_50?.unlockedAt, "ступень 50 закрыта");

  doc = apply(
    doc,
    { type: "DEV_ADJUST", metric: "EPISODES_COMPLETED", delta: -100 },
    {},
    at(12, 1),
  ).doc;
  assert.equal(doc.counters.EPISODES_COMPLETED, 0, "счётчик не уходит в минус");
  assert.ok(doc.achievements.ach_episodes_10.unlockedAt, "полученное не отбирается");
});

/* -------------------------------- Квесты --------------------------------- */

test("квесты: детерминированный набор дня и недели", () => {
  const a = apply(freshDoc(), { type: "SESSION_START" }, {}, at(9, 0)).doc;
  const b = apply(freshDoc(), { type: "SESSION_START" }, {}, at(9, 0)).doc;

  assert.equal(a.quests.daily.length, 3);
  assert.equal(a.quests.weekly.length, 2);
  assert.deepEqual(
    a.quests.daily.map((q) => q.questId),
    b.quests.daily.map((q) => q.questId),
    "одинаковый день — одинаковый набор",
  );
  assert.ok(
    a.quests.daily.every((q) => q.progress === 0 && !q.done && !q.claimed),
    "свежие экземпляры",
  );
});

test("квест дня: прогресс из событий, награда один раз", () => {
  let doc = apply(freshDoc(), { type: "SESSION_START" }, {}, at(9, 0)).doc;
  doc.quests.daily = [{ questId: "qd_rate", progress: 0, done: false, claimed: false }];

  doc = apply(doc, { type: "TITLE_RATED", titleId: "q1", score: 9 }, {}, at(9, 5)).doc;
  const inst = doc.quests.daily.find((q) => q.questId === "qd_rate");
  assert.equal(inst.progress, 1, "прогресс из тех же событий, что XP");
  assert.equal(inst.done, true);

  const claimed = apply(doc, { type: "QUEST_CLAIMED", questId: "qd_rate" }, {}, at(9, 6));
  assert.equal(claimed.doc.counters.QUESTS_DONE, 1);
  assert.equal(claimed.doc.progress.xpTotal, 25 + 5 + 40, "вход + оценка + награда");
  assert.equal(claimed.doc.progress.acBalance, 10 + 14 + 20, "AC входа + уровень 2 + награда квеста");
  assert.ok(
    claimed.doc.ledger.some((e) => e.idempotencyKey === "QUEST:tester:qd_rate:2026-03-10"),
  );

  const again = apply(claimed.doc, { type: "QUEST_CLAIMED", questId: "qd_rate" }, {}, at(9, 7));
  assert.equal(again.rejected?.reason, "quest_already_claimed");

  claimed.doc.quests.daily.push({ questId: "qd_comment", progress: 0, done: false, claimed: false });
  const notDone = apply(
    claimed.doc,
    { type: "QUEST_CLAIMED", questId: "qd_comment" },
    {},
    at(9, 8),
  );
  assert.equal(notDone.rejected?.reason, "quest_not_done");

  const unknown = apply(claimed.doc, { type: "QUEST_CLAIMED", questId: "nope" }, {}, at(9, 9));
  assert.equal(unknown.rejected?.reason, "quest_not_found");
});

test("квест недели: 3 комментария → награда", () => {
  let doc = apply(freshDoc(), { type: "SESSION_START" }, {}, at(9, 0)).doc;
  doc.quests.weekly = [{ questId: "qw_comment", progress: 0, done: false, claimed: false }];

  for (let i = 0; i < 3; i += 1) {
    doc = apply(
      doc,
      { type: "COMMENT_ADDED", commentId: `w${i}`, text: `Комментарий номер ${i}. ${LONG}` },
      {},
      at(9, 10) + i * 1000,
    ).doc;
  }

  const inst = doc.quests.weekly.find((q) => q.questId === "qw_comment");
  assert.equal(inst.progress, 3, "недельный бакет копится");
  assert.equal(inst.done, true);
  const before = doc.progress.xpTotal;

  const claimed = apply(doc, { type: "QUEST_CLAIMED", questId: "qw_comment" }, {}, at(9, 20));
  assert.equal(claimed.doc.progress.xpTotal, before + 200, "+200 XP за недельный квест");
  assert.equal(claimed.doc.counters.QUESTS_DONE, 1);
});

test("квесты: смена дня перекручивает набор, награды не тащатся", () => {
  const day1 = apply(freshDoc(), { type: "SESSION_START" }, {}, at(9, 0, 0)).doc;
  day1.quests.daily = [
    { questId: "qd_rate", progress: 1, done: true, claimed: true },
  ];

  const day2 = apply(day1, { type: "SESSION_START" }, {}, at(9, 0, 1)).doc;
  assert.notEqual(day2.quests.day, day1.quests.day, "день другой — набор новый");
  assert.equal(day2.quests.daily.length, 3, "снова 3 квеста");
  assert.ok(
    day2.quests.daily.every((q) => q.progress === 0 && !q.done && !q.claimed),
    "прогресс сброшен",
  );
  assert.equal(day2.progress.streakCurrent, 2, "серия продолжилась");
});

/* -------------------------------- Магазин -------------------------------- */

test("магазин: покупка списывает AC, ошибки отклоняются", () => {
  const base = freshDoc();
  base.progress.acBalance = 1000;

  const bought = apply(base, { type: "SHOP_PURCHASED", itemId: "frame-13", price: 600 }, {}, at(14, 0));
  assert.equal(bought.doc.progress.acBalance, 400);
  assert.equal(bought.doc.purchases.length, 1);
  assert.equal(bought.doc.purchases[0].price, 600);
  assert.ok(bought.effects.some((e) => e.type === "AC_SPENT" && e.amount === 600));
  assert.ok(bought.effects.some((e) => e.type === "ITEM_GRANTED" && e.itemId === "frame-13"));
  assert.ok(
    bought.doc.ledger.some((e) => e.currency === "AC" && e.amount === -600),
    "трата в журнале",
  );

  const poor = apply(
    bought.doc,
    { type: "SHOP_PURCHASED", itemId: "frame-18", price: 5000 },
    {},
    at(14, 1),
  );
  assert.equal(poor.rejected?.reason, "insufficient_ac");
  assert.equal(poor.doc.progress.acBalance, 400, "баланс не тронут");

  const wrong = apply(
    bought.doc,
    { type: "SHOP_PURCHASED", itemId: "frame-13", price: 999 },
    {},
    at(14, 2),
  );
  assert.equal(wrong.rejected?.reason, "price_mismatch", "цена берётся только из конфига");

  const unknown = apply(
    bought.doc,
    { type: "SHOP_PURCHASED", itemId: "nope", price: 1 },
    {},
    at(14, 3),
  );
  assert.equal(unknown.rejected?.reason, "unknown_item");
});

test("магазин: «Заморозка» — максимум 2", () => {
  let doc = freshDoc();
  doc.progress.acBalance = 1000;

  for (let i = 0; i < 2; i += 1) {
    doc = apply(
      doc,
      { type: "SHOP_PURCHASED", itemId: "svc_freeze", price: 300 },
      {},
      at(14, 0) + i * 1000,
    ).doc;
  }
  assert.equal(doc.progress.streakFreezes, 2);
  assert.equal(doc.progress.acBalance, 400);

  const third = apply(doc, { type: "SHOP_PURCHASED", itemId: "svc_freeze", price: 300 }, {}, at(14, 1));
  assert.equal(third.rejected?.reason, "limit_reached");
  assert.equal(third.doc.progress.streakFreezes, 2);
});

/* ------------------------------ Комментарии ------------------------------ */

test("комментарии: pending 15 минут → подтверждение → реверс при удалении", () => {
  let doc = freshDoc();
  const t0 = at(12, 0);

  doc = apply(
    doc,
    { type: "COMMENT_ADDED", commentId: "c1", text: `Первый комментарий. ${LONG}` },
    {},
    t0,
  ).doc;
  assert.equal(doc.counters.COMMENTS_VALID, 1);
  assert.equal(doc.daily.counts.COMMENT, 1, "бакет для квестов");
  assert.equal(doc.progress.xpTotal, 15 + 100, "первый коммент + достижение");
  assert.equal(doc.progress.acBalance, 14 + 100, "AC уровня 2 + 100 за «Первый шаг»");

  const e1 = doc.ledger.find((e) => e.metadata?.commentId === "c1" && e.currency === "XP");
  assert.equal(e1.status, "pending", "награда отложена на 15 минут");
  assert.equal(e1.amount, 15);
  assert.equal(e1.metadata.confirmAt, t0 + 15 * 60_000);
  const ach = doc.ledger.find((e) => e.idempotencyKey === "ACH:tester:ach_comments_1");
  assert.equal(ach.status, "confirmed", "награда достижения не отложена");
  assert.equal(ach.metadata, undefined, "и не откатится вместе с комментарием");

  doc = apply(
    doc,
    { type: "COMMENT_ADDED", commentId: "c2", text: `Второй комментарий. ${LONG}` },
    {},
    t0 + 120_000,
  ).doc;
  assert.equal(doc.progress.xpTotal, 120, "второй комментарий — правило COMMENT_NEXT");
  const e2 = doc.ledger.find((e) => e.metadata?.commentId === "c2" && e.currency === "XP");
  assert.equal(e2.amount, 5);

  doc = apply(doc, { type: "EASTER_EGG", target: "check" }, {}, t0 + 16 * 60_000).doc;
  assert.equal(doc.ledger.find((e) => e.id === e1.id).status, "confirmed", "срок вышел");
  assert.equal(
    doc.ledger.find((e) => e.id === e2.id).status,
    "pending",
    "срок второго комментария (t0+17м) ещё не наступил",
  );

  const removed1 = apply(doc, { type: "COMMENT_REMOVED", commentId: "c1" }, {}, t0 + 17 * 60_000);
  assert.equal(removed1.doc.progress.xpTotal, 105, "120 − 15, но не ниже порога уровня");
  assert.equal(removed1.doc.counters.COMMENTS_VALID, 1);
  assert.equal(removed1.doc.ledger.find((e) => e.id === e1.id).status, "reversed");
  const rev1 = removed1.doc.ledger.find((e) => e.reversesId === e1.id);
  assert.equal(rev1.amount, -15, "реверс — НОВАЯ запись, оригинал не удалён");
  assert.ok(removed1.effects.some((e) => e.type === "REWARD_REVERSED"));

  const removed2 = apply(
    removed1.doc,
    { type: "COMMENT_REMOVED", commentId: "c2" },
    {},
    t0 + 18 * 60_000,
  );
  assert.equal(removed2.doc.progress.xpTotal, 100, "105 − 5");
  assert.equal(removed2.doc.counters.COMMENTS_VALID, 0);
  assert.equal(removed2.doc.ledger.find((e) => e.id === e2.id).status, "reversed");
  assert.equal(removed2.doc.progress.level, 2, "уровень от реверса не падает");
});

/* -------------------------------- Секреты -------------------------------- */

test("секрет «Час быка»: вход в 04:04", () => {
  const r = apply(freshDoc(), { type: "SESSION_START" }, {}, at(4, 4));
  assert.equal(r.doc.flags.secret0404, 1);
  assert.ok(r.doc.achievements.ach_secret_0404?.unlockedAt);
  assert.ok(r.doc.tags.tag_faceless, "секретный тег выдан");
  assert.ok(r.doc.progress.xpTotal >= 1000, "25 за вход + 1000 за секрет (+ каскад уровней)");
  assert.ok(r.doc.progress.trophyPoints >= 500);
});

test("секрет «Хранитель пасхалок»: 7 скрытых кликов", () => {
  let doc = freshDoc();
  for (let i = 0; i < 7; i += 1) {
    doc = apply(doc, { type: "EASTER_EGG", target: "logo" }, {}, at(12, 0) + i * 1000).doc;
  }
  assert.equal(doc.flags["egg:logo"], 7);
  assert.ok(doc.achievements.ach_secret_easter?.unlockedAt);
  assert.equal(doc.progress.xpTotal, 500, "только награда секрета");
  assert.equal(doc.progress.acBalance, 14 + 16 + 18 + 250, "AC уровней 2–4 + 250 за секрет");
  assert.equal(doc.progress.trophyPoints, 300);
});

test("секрет «Ранняя пташка»: 7 дней подряд до 07:00", () => {
  let doc = freshDoc();
  for (let d = 0; d < 7; d += 1) {
    doc = apply(doc, { type: "SESSION_START" }, {}, at(5, 0, d)).doc;
    doc = watchEpisode(doc, `early${d}`, "ep1", {
      start: at(5, 1, d),
    });
  }
  assert.equal(doc.flags.earlyStreak, 7, "7 утренних досмотров подряд");
  assert.ok(doc.achievements.ach_secret_early?.unlockedAt, "секрет выдан");
  assert.equal(doc.progress.streakCurrent, 7);
  assert.ok(doc.achievements.ach_days_7?.unlockedAt, "попутно «Постоянный»");
  assert.ok(doc.achievements.ach_streak_7?.unlockedAt, "попутно «Неделя»");
});

test("секрет «Смена облика»: 10 смен тега за сутки", () => {
  const ids = ["tag_otaku", "tag_ronin", "tag_outcast", "tag_sensei", "tag_tengu", "tag_oni"];
  let doc = freshDoc();
  for (let i = 0; i < 10; i += 1) {
    doc = apply(doc, { type: "TAG_EQUIPPED", tagId: ids[i % ids.length] }, {}, at(12, 0) + i * 1000).doc;
  }
  assert.equal(doc.counters.MAX_TAG_SWAPS_IN_DAY, 10);
  assert.equal(doc.progress.equippedTagId, ids[9 % ids.length]);
  assert.ok(doc.achievements.ach_secret_restyle?.unlockedAt);
  assert.equal(doc.progress.xpTotal, 500, "только награда секрета");

  const bad = apply(doc, { type: "TAG_EQUIPPED", tagId: "tag_missing" }, {}, at(12, 5));
  assert.equal(bad.rejected?.reason, "unknown_tag");
});

test("тайтл завершён: жанры, счётчик и секрет «Жатва»", () => {
  let doc = freshDoc();
  for (let i = 0; i < 3; i += 1) {
    doc = watchEpisode(doc, `fin${i}`, "e1", {
      start: at(15, 0) + i * 900_000,
      isFinal: true,
      genres: [`Жанр${i}`, "Боевик"],
    });
  }

  assert.equal(doc.counters.TITLES_COMPLETED, 3);
  assert.equal(doc.counters.MAX_TITLES_IN_DAY, 3, "3 финала за день");
  assert.equal(doc.sets.genres.filter((g) => g === "Боевик").length, 1, "жанры без дублей");
  assert.ok(doc.sets.genres.includes("Жанр0"));
  assert.ok(doc.achievements.ach_titles_1?.unlockedAt, "«Первый финал»");
  assert.ok(doc.achievements.ach_secret_harvest?.unlockedAt, "секрет «Жатва»");
  assert.ok(doc.tags.tag_shinigami);
  assert.ok(!doc.achievements.ach_genres_5?.unlockedAt, "4 жанра — ещё не 5");
});

/* ----------------------------- Прочие события ---------------------------- */

test("Premium не даёт XP/AC (§1)", () => {
  const r = apply(freshDoc(), { type: "PREMIUM_ACTIVATED" }, {}, at(12, 0));
  assert.equal(r.doc.progress.xpTotal, 0);
  assert.equal(r.doc.progress.acBalance, 0);
  assert.equal(r.doc.counters.PREMIUM_ACTIVATED, 1);
});

test("админ-выдача: XP мимо капа, AC можно и в минус до нуля", () => {
  const xp = apply(
    freshDoc(),
    { type: "ADMIN_GRANT", currency: "XP", amount: 500, reason: "тест" },
    {},
    at(12, 0),
  );
  assert.equal(xp.doc.progress.xpTotal, 500);
  assert.equal(xp.doc.counters.MAX_XP_IN_DAY, 500, "перегрузка видит админ-XP");
  assert.ok(xp.doc.ledger.some((e) => e.type === "ADMIN_GRANT" && e.currency === "XP"));

  const ac = apply(
    xp.doc,
    { type: "ADMIN_GRANT", currency: "AC", amount: -5000, reason: "тест" },
    {},
    at(12, 1),
  );
  assert.equal(ac.doc.progress.acBalance, 0, "баланс не уходит в минус");
});
