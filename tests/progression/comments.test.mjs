/**
 * Комментарии (`src/lib/comments.ts`): ядро ленты — нормализация,
 * сортировка, ответы, каскад, голоса, лимиты, демо-посев. Плюс симметрия
 * счётчика ответов в движке (COMMENT_REPLIED ↔ COMMENT_REMOVED).
 *
 * Импортируется скомпилированный код из `.tsc-tests/` (см. tools/run-tests.mjs).
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  DEMO_PERSONAS,
  MAX_TEXT,
  applyVote,
  buildDemoSeed,
  capList,
  cascadeIds,
  hashString,
  mergeRecent,
  normalizeCommentText,
  repliesOf,
  rootsOf,
} from "../../.tsc-tests/lib/comments.js";
import { PROGRESSION_CONFIG } from "../../.tsc-tests/lib/progression/progression.config.js";
import { apply, at, freshDoc } from "./helpers.mjs";

const LONG = "Этот комментарий намного длиннее двадцати символов — валидный текст.";

/* ---------------------------- Ядро ленты -------------------------------- */

test("нормализация текста: пробелы схлопываются, лимит 300", () => {
  assert.equal(normalizeCommentText("  Привет,\n\n  мир!  "), "Привет, мир!");
  assert.equal(normalizeCommentText("x".repeat(400)).length, MAX_TEXT);
  assert.equal(normalizeCommentText("   \t "), "");
});

test("mergeRecent: общий поток сначала новые + лимит", () => {
  const wall = [{ id: "w1", author: "x", text: "1", at: 100 }];
  const titles = [
    { id: "t1", author: "y", text: "2", at: 300 },
    { id: "t2", author: "y", text: "3", at: 200 },
  ];
  assert.deepEqual(mergeRecent([wall, titles]).map((c) => c.id), ["t1", "t2", "w1"]);
  assert.equal(mergeRecent([wall, titles], 2).length, 2);
});

test("порядок ленты: новые/старые/популярные, ответы хронологически", () => {
  const list = [
    { id: "r1", author: "x", text: "старый", at: 100 },
    { id: "r2", author: "x", text: "новый", at: 300, likes: 0 },
    { id: "r3", author: "x", text: "популярный", at: 200, likes: 5 },
    { id: "c1", parentId: "r1", author: "y", text: "ответ1", at: 250 },
    { id: "c2", parentId: "r1", author: "y", text: "ответ2", at: 150 },
  ];
  assert.deepEqual(rootsOf(list, "new").map((c) => c.id), ["r2", "r3", "r1"]);
  assert.deepEqual(rootsOf(list, "old").map((c) => c.id), ["r1", "r3", "r2"]);
  assert.deepEqual(rootsOf(list, "top").map((c) => c.id), ["r3", "r2", "r1"]);
  assert.deepEqual(repliesOf(list, "r1").map((c) => c.id), ["c2", "c1"]);
});

test("каскад: удаление корня забирает его ответы", () => {
  const list = [
    { id: "root", author: "x", text: "a", at: 1 },
    { id: "rep", parentId: "root", author: "y", text: "b", at: 2 },
    { id: "other", author: "z", text: "c", at: 3 },
  ];
  assert.deepEqual(cascadeIds(list, "root").sort(), ["rep", "root"]);
  assert.deepEqual(cascadeIds(list, "other"), ["other"]);
});

test("голоса: повтор снимает голос, смена переключает", () => {
  const base = { id: "c", author: "x", text: "t", at: 1 };

  const up = applyVote(base, "up");
  assert.equal(up.likes, 1);
  assert.equal(up.myVote, "up");

  const again = applyVote(up, "up");
  assert.equal(again.likes, 0);
  assert.equal(again.myVote, undefined);

  const down = applyVote(up, "down");
  assert.equal(down.likes, 0);
  assert.equal(down.dislikes, 1);
  assert.equal(down.myVote, "down");

  const fresh = applyVote({ ...base, likes: 0, dislikes: 0 }, "down");
  assert.equal(fresh.dislikes, 1);
  assert.equal(fresh.likes, 0);
});

test("лимит ленты: старые вон, осиротевшие ответы подчищаются", () => {
  const many = [];
  for (let i = 1; i <= 60; i++) many.push({ id: `c${i}`, author: "x", text: String(i), at: i });

  const capped = capList(many, 10);
  assert.equal(capped.length, 10);
  assert.equal(capped[0].id, "c60", "новые остаются");

  // ответ пережил свой корень по времени — выпал из лимита → подчищается
  const orphan = [
    { id: "old-root", author: "x", text: "a", at: 0 },
    { id: "old-reply", parentId: "old-root", author: "y", text: "b", at: 100 },
    ...many,
  ];
  const cappedOrphan = capList(orphan, 5);
  assert.ok(!cappedOrphan.some((c) => c.id === "old-reply"), "ответ без корня не остаётся");
  assert.ok(!cappedOrphan.some((c) => c.id === "old-root"));
});

/* ---------------------------- Демо-посев -------------------------------- */

test("демо-посев: детерминирован, один ответ, спойлер, прошлые времена", () => {
  const now = Date.UTC(2026, 5, 1, 12, 0);
  const seed = buildDemoSeed("serial-12345", now);

  assert.equal(seed.length, 4);
  const again = buildDemoSeed("serial-12345", now);
  assert.deepEqual(
    seed.map((c) => c.id),
    again.map((c) => c.id),
    "одинаковый тайтл → одинаковые id",
  );
  assert.notDeepEqual(
    seed.map((c) => c.id),
    buildDemoSeed("serial-99999", now).map((c) => c.id),
    "другой тайтл → другие id (без коллизий)",
  );

  assert.ok(seed.every((c) => c.demo === true), "все посевные помечены demo");
  assert.ok(seed.every((c) => c.at < now), "времена в прошлом");
  assert.ok(seed.some((c) => c.spoiler === true), "спойлер-комментарий есть");

  const reply = seed.find((c) => c.parentId);
  const root = seed.find((c) => c.id === reply.parentId);
  assert.ok(root && !root.parentId, "ответ висит на корне из того же посева");

  const authors = new Set(seed.map((c) => c.author));
  for (const author of authors) {
    assert.ok(
      DEMO_PERSONAS.some((p) => p.name === author),
      `автор ${author} — из каталога персон`,
    );
  }
});

test(`демо-персоны: теги из каталога §8 (${PROGRESSION_CONFIG.tags.length} тегов не тронуты)`, () => {
  const ids = new Set(PROGRESSION_CONFIG.tags.map((tag) => tag.id));
  for (const persona of DEMO_PERSONAS) {
    assert.ok(ids.has(persona.tagId), `${persona.name}: тег ${persona.tagId} существует`);
    assert.ok(persona.level >= 1, "уровень положительный");
  }
});

test("хеш: стабилен и разный для разных строк", () => {
  assert.equal(hashString("serial-1"), hashString("serial-1"));
  assert.notEqual(hashString("serial-1"), hashString("serial-2"));
});

/* -------------------- Движок: симметрия ответов ------------------------- */

test("ответы: COMMENT_REPLIED идёт в пару к реверсу счётчика", () => {
  let doc = freshDoc();
  const t0 = at(12, 0);

  doc = apply(
    doc,
    { type: "COMMENT_ADDED", commentId: "c1", text: `Первый комментарий. ${LONG}` },
    {},
    t0,
  ).doc;
  assert.equal(doc.counters.COMMENTS_VALID, 1);

  doc = apply(
    doc,
    { type: "COMMENT_REPLIED", commentId: "r1", targetId: "c1", text: `Ответ в разговоре. ${LONG}` },
    {},
    t0 + 60_000,
  ).doc;
  assert.equal(doc.counters.COMMENTS_VALID, 2, "ответ — тоже комментарий");

  const reply = doc.ledger.find((e) => e.metadata?.commentId === "r1" && e.currency === "XP");
  assert.ok(reply, "награда за ответ записана (правило COMMENT_REPLY)");
  assert.equal(reply.amount, 3);
  assert.equal(reply.status, "pending", "отложена на 15 минут");

  const removed = apply(doc, { type: "COMMENT_REMOVED", commentId: "r1" }, {}, t0 + 17 * 60_000);
  assert.equal(removed.doc.counters.COMMENTS_VALID, 1, "реверс ответа возвращает счётчик");
  assert.equal(removed.doc.ledger.find((e) => e.id === reply.id).status, "reversed");

  const removedRoot = apply(
    removed.doc,
    { type: "COMMENT_REMOVED", commentId: "c1" },
    {},
    t0 + 18 * 60_000,
  );
  assert.equal(removedRoot.doc.counters.COMMENTS_VALID, 0, "полный откат пары");
});
