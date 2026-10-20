import test from "node:test";
import assert from "node:assert/strict";

import { EMPTY_DOC } from "../../.tsc-tests/lib/progression/doc.js";
import { applyEvent } from "../../.tsc-tests/lib/progression/engine.js";
import { levelFromXp, totalXpFor } from "../../.tsc-tests/lib/progression/curve.js";
import { PROGRESSION_CONFIG } from "../../.tsc-tests/lib/progression/progression.config.js";

const cfg = PROGRESSION_CONFIG;
const NOW = Date.UTC(2026, 9, 12, 12, 0);
const CTX = { now: NOW, tz: "UTC", userId: "u1" };

/** Документ с заданным балансом AC */
function docWithAc(ac, xp = 0) {
  const doc = structuredClone(EMPTY_DOC);
  doc.progress.acBalance = ac;
  doc.progress.xpTotal = xp;
  return doc;
}

function buy(doc, tomeId, price, now = NOW) {
  return applyEvent(
    doc,
    { type: "TOME_PURCHASED", tomeId, price },
    {},
    { now, tz: "UTC", userId: "u1" },
    cfg,
  );
}

/** Списания AC именно за том (без наград за повышение уровня) */
function tomeSpend(doc) {
  return doc.ledger
    .filter((e) => e.type === "TOME_PURCHASED" && e.currency === "AC")
    .reduce((sum, e) => sum + e.amount, 0);
}

/* ------------------------------- Тесты ---------------------------------- */

test("покупка тома списывает цену и капает XP", () => {
  const doc = docWithAc(1000);
  const tome = cfg.tomes.find((t) => t.id === "tome_small");

  const res = buy(doc, tome.id, tome.price);

  assert.equal(res.rejected, undefined);
  assert.equal(res.doc.progress.xpTotal, tome.xp);
  // Баланс меняется ещё и за повышение уровня, поэтому сверяем списание
  assert.equal(tomeSpend(res.doc), -tome.price);
  assert.ok(res.doc.progress.acBalance < 1000);
});

test("цена из клиента не принимается: списание идёт по конфигу", () => {
  const doc = docWithAc(1000);
  const tome = cfg.tomes.find((t) => t.id === "tome_small");

  // клиент прислал заниженную цену — покупка обязана отклониться
  const res = buy(doc, tome.id, 1);

  assert.equal(res.rejected?.reason, "price_mismatch");
  assert.equal(res.doc.progress.acBalance, 1000, "баланс не тронут");
  assert.equal(res.doc.progress.xpTotal, 0, "XP не начислен");
});

test("повторная покупка в те же сутки отклоняется", () => {
  const doc = docWithAc(5000);
  const tome = cfg.tomes.find((t) => t.id === "tome_small");

  const first = buy(doc, tome.id, tome.price);
  const second = buy(first.doc, tome.id, tome.price);

  assert.equal(second.rejected?.reason, "tome_daily_limit");
  assert.equal(tomeSpend(second.doc), -tome.price, "списано ровно один раз");
  assert.equal(second.doc.progress.xpTotal, tome.xp, "XP начислен ровно один раз");
});

test("на следующие сутки тот снова доступен", () => {
  const doc = docWithAc(5000);
  const tome = cfg.tomes.find((t) => t.id === "tome_small");

  const day1 = buy(doc, tome.id, tome.price).doc;
  const day2 = buy(day1, tome.id, tome.price, NOW + 86_400_000);

  assert.equal(day2.rejected, undefined);
  assert.equal(day2.doc.progress.xpTotal, tome.xp * 2);
});

test("при нехватке AC покупка отклоняется", () => {
  const doc = docWithAc(10);
  const tome = cfg.tomes.find((t) => t.id === "tome_small");

  const res = buy(doc, tome.id, tome.price);

  assert.equal(res.rejected?.reason, "insufficient_ac");
  assert.equal(res.doc.progress.acBalance, 10);
  assert.equal(res.doc.progress.xpTotal, 0);
});

test("закрытый по уровню том не купить", () => {
  const locked = cfg.tomes.find((t) => t.fromLevel !== undefined);
  const doc = docWithAc(99999, 0); // уровень 1

  const res = buy(doc, locked.id, locked.price);

  assert.equal(res.rejected?.reason, "tome_locked");
  assert.equal(res.doc.progress.acBalance, 99999);
});

test("XP тома идёт мимо суточного soft-cap", () => {
  const doc = docWithAc(99999);
  // выжигаем ACTIVITY-кап: 1500 XP — жёсткий потолок суток
  doc.daily.xpActivity = cfg.softCap.hardCap;
  const tome = cfg.tomes.find((t) => t.id === "tome_small");

  const res = buy(doc, tome.id, tome.price);

  assert.equal(res.rejected, undefined);
  assert.equal(res.doc.progress.xpTotal, tome.xp, "кап не срезал платный XP");
});

test("несуществующий том отклоняется", () => {
  const doc = docWithAc(1000);
  const res = buy(doc, "tome_nope", 10);
  assert.equal(res.rejected?.reason, "unknown_tome");
});

test("журнал содержит обе операции: списание AC и начисление XP", () => {
  const doc = docWithAc(1000);
  const tome = cfg.tomes.find((t) => t.id === "tome_small");

  const res = buy(doc, tome.id, tome.price);
  const entries = res.doc.ledger.filter((e) => e.type === "TOME_PURCHASED");

  assert.equal(entries.length, 2);
  const ac = entries.find((e) => e.currency === "AC");
  const xp = entries.find((e) => e.currency === "XP");
  assert.equal(ac.amount, -tome.price);
  assert.equal(xp.amount, tome.xp);
});

test("уровень пересчитывается от купленного XP", () => {
  // Гримдар открывается с 50 уровня — стартуем ровно с его порога
  const startXp = totalXpFor(50);
  const doc = docWithAc(99999, startXp);
  const tome = cfg.tomes.find((t) => t.id === "tome_grimdor");

  const res = buy(doc, tome.id, tome.price);

  assert.equal(res.rejected, undefined);
  assert.equal(res.doc.progress.level, levelFromXp(res.doc.progress.xpTotal));
  assert.ok(res.effects.some((e) => e.type === "LEVEL_UP"), "эффект повышения есть");
});