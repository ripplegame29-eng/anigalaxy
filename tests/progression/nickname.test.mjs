/**
 * Отображаемое имя и его оформление: правила макета, цена и приёмка
 * движком.
 *
 * Проверяется СКОМПИЛИРОВАННЫЙ код из `.tsc-tests/` (см. tools/run-tests.mjs).
 * Цены сверяются с реальным конфигом проекта: если цена услуги в
 * `progression.config.ts` изменится, тест упадёт, а не окно будет обещать
 * один счёт, а списывать другой.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_NICK_STYLE,
  NICK_ADDONS,
  NICK_MAX,
  NICK_PALETTE,
  checkNickname,
  displayNameError,
  nickBonusState,
  nickBonusText,
  nickColorTotal,
  nickCostLines,
  nickSignature,
  nickStyleProps,
  normalizeNickStyle,
} from "../../.tsc-tests/lib/nickname.js";
import { applyEvent } from "../../.tsc-tests/lib/progression/engine.js";
import { PROGRESSION_CONFIG } from "../../.tsc-tests/lib/progression/progression.config.js";
import { at, ctx, freshDoc } from "./helpers.mjs";

const shop = PROGRESSION_CONFIG.shop;
const price = (id) => shop.find((item) => item.id === id).price;
const NICK_PRICE = price("svc_nick");
const COLOR_PRICE = price("svc_color");

/** Документ с AC на счётчике (иначе любая услуга отклоняется) */
function withAc(amount) {
  return applyEvent(freshDoc(), { type: "ADMIN_GRANT", currency: "AC", amount }, {}, ctx(at(9, 0))).doc;
}

test("правила имени — как в макете: 3–20 символов, буквы, цифры и «_»", () => {
  assert.equal(checkNickname("", "old").state, "idle");
  assert.equal(checkNickname("ab", "old").message, `Минимум 3 символа`);
  assert.equal(checkNickname("has space", "old").message, "Только буквы, цифры и «_», без пробелов");
  assert.equal(checkNickname("has-dash", "old").message, "Только буквы, цифры и «_», без пробелов");
  assert.equal(checkNickname("a".repeat(NICK_MAX + 1), "old").message, `Максимум ${NICK_MAX} символов`);
  assert.equal(checkNickname("Star_Walker", "old").state, "ok");
  assert.equal(checkNickname("Звёздный", "old").state, "ok", "кириллица разрешена");
  assert.equal(checkNickname("StarWalker", "StarWalker").message, "Это твой текущий ник");
  assert.equal(checkNickname(" starwalker ", "StarWalker").message, "Это твой текущий ник");
  assert.equal(displayNameError("норм"), null, "проверка движка проходит валидное имя");
  assert.ok(displayNameError("норм!"), "проверка движка отвергает мусор");
});

test("цена цвета ника: база плюс наценки макета", () => {
  const solid = { ...DEFAULT_NICK_STYLE, mode: "solid" };
  assert.equal(nickColorTotal(COLOR_PRICE, NICK_ADDONS, solid), COLOR_PRICE);

  const grad = { ...solid, mode: "grad" };
  assert.equal(
    nickColorTotal(COLOR_PRICE, NICK_ADDONS, grad),
    COLOR_PRICE + NICK_ADDONS.gradient,
    "градиент дороже",
  );
  const flow = { ...grad, anim: true };
  assert.equal(
    nickColorTotal(COLOR_PRICE, NICK_ADDONS, flow),
    COLOR_PRICE + NICK_ADDONS.gradient + NICK_ADDONS.flow,
    "переливание дороже",
  );
  const glow = { ...solid, glow: true };
  assert.equal(
    nickColorTotal(COLOR_PRICE, NICK_ADDONS, glow),
    COLOR_PRICE + NICK_ADDONS.glow,
    "свечение дороже",
  );
  assert.equal(
    nickColorTotal(COLOR_PRICE, NICK_ADDONS, { ...flow, glow: true }),
    COLOR_PRICE + NICK_ADDONS.gradient + NICK_ADDONS.flow + NICK_ADDONS.glow,
    "все опции вместе",
  );
});

test("разбивка «К оплате» повторяет строки макета", () => {
  const style = { ...DEFAULT_NICK_STYLE, mode: "grad", anim: true, glow: true };
  const lines = nickCostLines(COLOR_PRICE, NICK_ADDONS, style);
  assert.deepEqual(
    lines.map((line) => line.label),
    ["Цвет ника", "Градиент", "Переливание", "Свечение"],
  );
  assert.equal(lines[0].value, `${COLOR_PRICE} АС`);

  const withBonus = nickCostLines(COLOR_PRICE, NICK_ADDONS, style, true);
  const bonus = withBonus.at(-1);
  assert.equal(bonus.label, "Бонус Premium");
  assert.equal(bonus.minus, true);
  assert.equal(bonus.value, `−${nickColorTotal(COLOR_PRICE, NICK_ADDONS, style)} АС`);
});

test("оформление нормализуется: мусор из хранилища не ломает профиль", () => {
  assert.deepEqual(normalizeNickStyle(undefined), DEFAULT_NICK_STYLE);
  const fixed = normalizeNickStyle({ mode: "бред", c1: "red", c2: "#ABCDEF", anim: true, sp: -3, glow: 1 });
  assert.equal(fixed.mode, "def");
  assert.equal(fixed.c1, DEFAULT_NICK_STYLE.c1, "не-цвет заменён");
  assert.equal(fixed.c2, "#abcdef", "цвет приведён к нижнему регистру");
  assert.equal(fixed.anim, false, "переливание без градиента выключается");
  assert.equal(fixed.sp, 3.5, "неположительная скорость заменена");
  assert.equal(fixed.glow, false, "свечение — только true");
});

test("подпись стиля: одинаковое оформление — одна строка", () => {
  const a = { ...DEFAULT_NICK_STYLE, mode: "grad", anim: true, c1: "#22d3ee", c2: "#2563eb" };
  const b = { ...a };
  assert.equal(nickSignature(a), nickSignature(b));
  assert.notEqual(nickSignature(a), nickSignature({ ...a, glow: true }));
  assert.notEqual(nickSignature({ ...DEFAULT_NICK_STYLE, mode: "solid" }), nickSignature(DEFAULT_NICK_STYLE));

  const props = nickStyleProps(a);
  assert.ok(props.className.includes("nick-grad"), "градиент даёт свой класс");
  assert.ok(props.className.includes("nick-flow"), "переливание даёт свой класс");
  assert.equal(props.vars["--sp"], "3.5s", "скорость уходит в переменную");
  assert.equal(props.vars.color, undefined, "у градиента нет сплошного цвета");
  assert.equal(nickStyleProps({ ...a, glow: true }).vars.color, undefined);
});

test("бонус Premium: одна бесплатная услуга, дальше за AC", () => {
  assert.equal(nickBonusState(false, false), "none");
  assert.equal(nickBonusState(true, false), "available");
  assert.equal(nickBonusState(true, true), "used");
  assert.equal(nickBonusText("available", "смена ника").note, "1 бесплатная смена ника");
  assert.equal(nickBonusText("used", "цвет ника").note, "Дальше цвет ника за АС");
  assert.equal(nickBonusText("none", "смена ника").title, "С Premium — бесплатно");
});

test("палитра из макета: 12 цветов и hex-формат", () => {
  assert.equal(NICK_PALETTE.length, 12);
  assert.ok(NICK_PALETTE.every((color) => /^#[0-9a-f]{6}$/.test(color)));
});

test("смена ника: цена из конфига списывается, неверная — отклоняется", () => {
  const doc = withAc(NICK_PRICE + 100);
  const before = doc.progress.acBalance;

  const res = applyEvent(
    doc,
    { type: "NICKNAME_RENAMED", nickname: "StarWalker", price: NICK_PRICE },
    {},
    ctx(at(10, 0)),
  );
  assert.equal(res.rejected, undefined, "цена макета принята");
  assert.equal(res.doc.progress.acBalance, before - NICK_PRICE, "AC списаны");
  assert.ok(res.doc.purchases.some((p) => p.itemId === "svc_nick"), "услуга записана в покупки");
  assert.ok(res.doc.ledger.some((e) => e.source === "SHOP"), "строка журнала есть");

  const cheap = applyEvent(
    res.doc,
    { type: "NICKNAME_RENAMED", nickname: "Другой_Ник", price: 1 },
    {},
    ctx(at(10, 1)),
  );
  assert.equal(cheap.rejected?.reason, "price_mismatch", "своя цена не принимается");
  assert.equal(cheap.doc.progress.acBalance, res.doc.progress.acBalance, "без списания");
});

test("смена ника: без AC и с кривым именем — отказ", () => {
  const empty = applyEvent(
    freshDoc(),
    { type: "NICKNAME_RENAMED", nickname: "StarWalker", price: NICK_PRICE },
    {},
    ctx(at(10, 0)),
  );
  assert.equal(empty.rejected?.reason, "insufficient_ac");

  const bad = applyEvent(
    withAc(NICK_PRICE),
    { type: "NICKNAME_RENAMED", nickname: "не ник!", price: NICK_PRICE },
    {},
    ctx(at(10, 1)),
  );
  assert.equal(bad.rejected?.reason, "invalid_nickname", "правила имени проверяет движок");
});

test("цвет ника: подписка покрывает услугу один раз и это запоминается", () => {
  const doc = withAc(0);
  const style = { ...DEFAULT_NICK_STYLE, mode: "solid", c1: "#ff5d73", glow: true };
  const total = nickColorTotal(COLOR_PRICE, NICK_ADDONS, style);

  const free = applyEvent(
    doc,
    { type: "NICK_COLOR_SET", style, price: 0 },
    {},
    { ...ctx(at(11, 0)), premium: true },
  );
  assert.equal(free.rejected, undefined, "бонус применён");
  assert.equal(free.doc.progress.acBalance, 0, "за бонус не списывают");
  assert.equal(free.doc.flags["bonus:svc_color"], 1, "бонус помечен использованным");
  assert.ok(
    !free.doc.ledger.some((e) => e.metadata?.itemId === "svc_color"),
    "нулевая покупка не пишет строку журнала",
  );

  const paid = applyEvent(
    free.doc,
    { type: "NICK_COLOR_SET", style, price: total },
    {},
    { ...ctx(at(11, 1)), premium: true },
  );
  assert.equal(paid.rejected?.reason, "insufficient_ac", "второй раз — уже за AC");

  const noPremium = applyEvent(
    doc,
    { type: "NICK_COLOR_SET", style, price: 0 },
    {},
    ctx(at(11, 2)),
  );
  assert.equal(noPremium.rejected?.reason, "price_mismatch", "без подписки ноль не принимается");
});

test("цвет ника: движок считает цену сам, стиль без оформления — отказ", () => {
  const doc = withAc(COLOR_PRICE + NICK_ADDONS.gradient);
  const grad = { ...DEFAULT_NICK_STYLE, mode: "grad" };

  const res = applyEvent(
    doc,
    { type: "NICK_COLOR_SET", style: grad, price: COLOR_PRICE + NICK_ADDONS.gradient },
    {},
    ctx(at(12, 0)),
  );
  assert.equal(res.rejected, undefined, "цена посчитана верно");
  assert.equal(
    res.doc.progress.acBalance,
    doc.progress.acBalance - COLOR_PRICE - NICK_ADDONS.gradient,
  );

  const empty = applyEvent(
    res.doc,
    { type: "NICK_COLOR_SET", style: DEFAULT_NICK_STYLE, price: COLOR_PRICE },
    {},
    ctx(at(12, 1)),
  );
  assert.equal(empty.rejected?.reason, "empty_style", "без оформления платить не за что");
});
