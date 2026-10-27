/**
 * Награда за приглашённого друга — событие REFERRAL_REGISTERED.
 *
 * Движок тестируется напрямую (§15.2). Важно: `applyEvent` клонирует документ
 * и возвращает новый — читать результат нужно из `res.doc`, иначе все
 * начисления выглядят нулями (на этом уже обожглись).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { PROGRESSION_CONFIG } from "../../.tsc-tests/lib/progression/progression.config.js";
import { activatePremium, saveAccount } from "../../.tsc-tests/lib/auth.js";
import { at, apply, freshDoc } from "./helpers.mjs";

const { referralXp, referralAc, referralPremiumDays } = PROGRESSION_CONFIG.economy;

/**
 * Заглушка localStorage под аккаунт.
 *
 * `activatePremium` читает аккаунт через `readAccount()`, а тот требует
 * `window.localStorage` — в node его нет, и функция молча возвращала null.
 * Достаточно одного аккаунта на весь прогон: тесты ниже только продлевают
 * подписку, данные пользователя не трогаем.
 */
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
  },
};
saveAccount({
  nickname: "Тест",
  email: "t@e.com",
  passHash: "eA==",
  createdAt: Date.now(),
  premiumUntil: 0,
});

/** Сброс аккаунта перед тестом: store живёт на весь файл, дни бы складывались */
function resetAccount() {
  store.clear();
  saveAccount({
    nickname: "Тест",
    email: "t@e.com",
    passHash: "eA==",
    createdAt: Date.now(),
    premiumUntil: 0,
  });
}

test("REFERRAL_REGISTERED: награда начисляется по конфигу", () => {
  const doc = freshDoc();
  const before = { xp: doc.progress.xpTotal, ac: doc.progress.acBalance };
  const res = apply(doc, { type: "REFERRAL_REGISTERED", refCode: "IVAN7YVC", newNick: "Друг" }, {}, at(12, 0));

  assert.equal(res.rejected, undefined, "событие не отклонено");
  // Не «ровно», а «не меньше»: +100 XP с нуля поднимает уровень, а уровень
  // даёт свои AC — это правильная работа движка, а не лишняя награда
  assert.ok(res.doc.progress.acBalance - before.ac >= referralAc, `AC: ${before.ac} → ${res.doc.progress.acBalance}`);
  assert.ok(res.doc.progress.xpTotal - before.xp >= referralXp, `XP: ${before.xp} → ${res.doc.progress.xpTotal}`);
  // Сама награда за приглашение — ровно по конфигу, в журнале
  const entry = res.doc.ledger.find((l) => l.type === "REFERRAL_REGISTERED");
  assert.equal(entry.amount, referralAc);
  assert.equal(entry.metadata.xp, referralXp);
});

test("REFERRAL_REGISTERED: запись в журнал с ключом идемпотентности", () => {
  const res = apply(freshDoc(), { type: "REFERRAL_REGISTERED", refCode: "IVAN7YVC", newNick: "Друг" }, {}, at(12, 0));
  const entry = res.doc.ledger.find((l) => l.type === "REFERRAL_REGISTERED");

  assert.ok(entry, "запись есть");
  assert.equal(entry.source, "REFERRAL");
  assert.equal(entry.status, "confirmed");
  assert.equal(entry.metadata.refCode, "IVAN7YVC");
  assert.equal(entry.metadata.newNick, "Друг");
  assert.ok(entry.idempotencyKey, "ключ идемпотентности заполнен");
});

test("REFERRAL_REGISTERED: повторная регистрация того же ника не начисляет дважды", () => {
  const first = apply(freshDoc(), { type: "REFERRAL_REGISTERED", refCode: "IVAN7YVC", newNick: "Друг" }, {}, at(12, 0));
  const afterFirst = { xp: first.doc.progress.xpTotal, ac: first.doc.progress.acBalance };

  const second = apply(first.doc, { type: "REFERRAL_REGISTERED", refCode: "IVAN7YVC", newNick: "Друг" }, {}, at(13, 0));

  assert.equal(second.rejected?.reason, "already_referred");
  assert.equal(second.doc.progress.xpTotal, afterFirst.xp, "XP не изменился");
  assert.equal(second.doc.progress.acBalance, afterFirst.ac, "AC не изменился");
  assert.equal(
    second.doc.ledger.filter((l) => l.type === "REFERRAL_REGISTERED").length,
    1,
    "записей по-прежнему одна",
  );
});

test("REFERRAL_REGISTERED: тот же ник по чужому коду — новое приглашение", () => {
  const first = apply(freshDoc(), { type: "REFERRAL_REGISTERED", refCode: "IVAN7YVC", newNick: "Друг" }, {}, at(12, 0));
  const second = apply(first.doc, { type: "REFERRAL_REGISTERED", refCode: "ANTON1234", newNick: "Друг" }, {}, at(13, 0));

  assert.equal(second.rejected, undefined);
  assert.equal(
    second.doc.ledger.filter((l) => l.type === "REFERRAL_REGISTERED").length,
    2,
    "второе приглашение учтено",
  );
});

test("REFERRAL_REGISTERED: без кода или ника — отказ, награды нет", () => {
  for (const event of [
    { type: "REFERRAL_REGISTERED", refCode: "", newNick: "Друг" },
    { type: "REFERRAL_REGISTERED", refCode: "IVAN7YVC", newNick: "" },
  ]) {
    const res = apply(freshDoc(), event, {}, at(12, 0));
    assert.equal(res.rejected?.reason, "missing_field");
    assert.equal(res.doc.progress.acBalance, 0);
    assert.equal(res.doc.ledger.length, 0);
  }
});

test("REFERRAL_REGISTERED: за приглашение ещё и дни Premium", () => {
  resetAccount();
  // Дни начисляются отдельно от XP/AC: через activatePremium, которая
  // продлевает подписку от текущего момента или от существующей даты
  const before = Date.now();
  const account = activatePremium(referralPremiumDays);
  assert.ok(account, "аккаунт есть");
  const days = Math.round((account.premiumUntil - before) / 86_400_000);
  assert.equal(days, referralPremiumDays);
  assert.equal(referralPremiumDays, 3, "страница обещает +3 дня Premium за друга");
});

test("REFERRAL_REGISTERED: два приглашения = 10 дней, а не 5", () => {
  resetAccount();
  activatePremium(referralPremiumDays);
  const second = activatePremium(referralPremiumDays);
  const days = Math.round((second.premiumUntil - Date.now()) / 86_400_000);
  assert.equal(days, referralPremiumDays * 2);
});

test("REFERRAL_REGISTERED: при активной подписке дни добавляются к концу", () => {
  resetAccount();
  const first = activatePremium(30);
  const base = first.premiumUntil;
  const second = activatePremium(referralPremiumDays);
  // От даты окончания, а не «сейчас»: иначе дни сгорели бы раньше срока
  assert.equal(Math.round((second.premiumUntil - base) / 86_400_000), referralPremiumDays);
});

test("REFERRAL_REGISTERED: награда ровно из конфига, без надбавок", () => {
  const res = apply(freshDoc(), { type: "REFERRAL_REGISTERED", refCode: "IVAN7YVC", newNick: "Друг" }, {}, at(12, 0));
  // Сумма в записи журнала — ровно конфиг: движок не прибавляет ничего своего
  const entry = res.doc.ledger.find((l) => l.type === "REFERRAL_REGISTERED");
  assert.equal(entry.amount, referralAc);
  assert.equal(entry.metadata.xp, referralXp);
});