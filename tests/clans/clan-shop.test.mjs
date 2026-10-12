/**
 * Магазин клана: покупка, установка, права.
 *
 * Модуль интересен не числами, а тем, какие деньги и права он НЕ даёт
 * провести. Цена берётся из каталога, повторная покупка отклоняется,
 * установка бесплатна и повторяема. Всё это проверяется здесь — иначе
 * 476 строк с четырьмя цифрами цены легко разъезжаются с интерфейсом.
 */

import { resetStorage } from "../helpers/localstorage.mjs";

import test from "node:test";
import assert from "node:assert/strict";

import {
  buyClanItem,
  canEquip,
  CLAN_SHOP_ITEMS,
  equipClanItem,
  isEquipped,
  ownedByCategory,
  shopItem,
} from "../../.tsc-tests/lib/clans.shop.js";
import { clanGame, patchClanGame } from "../../.tsc-tests/lib/clans.runtime.js";

test.beforeEach(() => resetStorage());

/** Кладёт в казну ресурс и снимает покупки, чтобы начать с чистого листа. */
function fund(resource, amount) {
  patchClanGame((s) => ({ ...s, unlocks: [], purse: { ...s.purse, [resource]: amount } }));
}

/** Первый платный предмет — на него и опираются проверки. */
function paidItem() {
  const item = CLAN_SHOP_ITEMS.find((i) => i.price > 0);
  assert.ok(item, "в каталоге есть хотя бы один платный предмет");
  return item;
}

/* -------------------------------- Каталог --------------------------------- */

test("магазин: у каждого предмета уникальный идентификатор", () => {
  const ids = CLAN_SHOP_ITEMS.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, "идентификаторы повторяются");
});

test("магазин: цена и валюта неотрицательные", () => {
  for (const item of CLAN_SHOP_ITEMS) {
    assert.ok(item.price >= 0, `${item.id}: отрицательная цена`);
    assert.ok(item.currency, `${item.id}: не задана валюта`);
  }
});

test("магазин: бесплатных предметов ровно один — базовый фон", () => {
  const free = CLAN_SHOP_ITEMS.filter((i) => i.price === 0);
  assert.equal(free.length, 1, `бесплатных предметов: ${free.map((f) => f.id).join(", ")}`);
  assert.equal(free[0].category, "background", "базовый предмет должен быть фоном");
});

test("магазин: неизвестный идентификатор не резолвится", () => {
  assert.equal(shopItem("clan-bg-такого-нет"), undefined);
});

/* --------------------------------- Покупка -------------------------------- */

test("магазин: покупка списывает цену из каталога", () => {
  const item = paidItem();
  fund(item.currency, item.price * 10);

  const before = clanGame().purse[item.currency];
  const res = buyClanItem(item.id);

  assert.equal(res.ok, true, res.reason);
  assert.equal(
    clanGame().purse[item.currency],
    before - item.price,
    "списано не по цене каталога",
  );
});

test("магазин: повторная покупка отклоняется и деньги не трогает", () => {
  const item = paidItem();
  fund(item.currency, item.price * 10);

  assert.equal(buyClanItem(item.id).ok, true);
  const afterFirst = clanGame().purse[item.currency];

  const second = buyClanItem(item.id);

  assert.equal(second.ok, false, "предмет продали повторно");
  assert.equal(
    clanGame().purse[item.currency],
    afterFirst,
    "вторая попытка списала деньги",
  );
});

test("магазин: при нехватке средств покупка не проходит", () => {
  const item = paidItem();
  fund(item.currency, item.price - 1);

  const res = buyClanItem(item.id);

  assert.equal(res.ok, false);
  assert.ok(res.reason, "не сказано, чего не хватило");
  assert.equal(clanGame().purse[item.currency], item.price - 1, "казна изменилась при отказе");
});

test("магазин: купленного предмета нет в каталоге купленных дважды", () => {
  const item = paidItem();
  fund(item.currency, item.price * 3);

  buyClanItem(item.id);

  const owned = clanGame().unlocks.filter((u) => u === item.id);
  assert.equal(owned.length, 1, `предмет попал в unlocks ${owned.length} раз(а)`);
});

test("магазин: бесплатный предмет не покупается", () => {
  const free = CLAN_SHOP_ITEMS.find((i) => i.price === 0);
  const res = buyClanItem(free.id);
  assert.equal(res.ok, false, "бесплатный предмет прошёл через оплату");
});

test("магазин: покупка пишет в журнал цену из каталога", () => {
  const item = paidItem();
  fund(item.currency, item.price * 3);

  buyClanItem(item.id);

  const entry = clanGame().ledger.find((e) => e.kind === "shop" && e.subject === item.name);
  assert.ok(entry, "записи о покупке нет в журнале");
  assert.deepEqual(entry.cost, { resource: item.currency, amount: item.price });
});

/* -------------------------------- Установка ------------------------------- */

test("магазин: установить можно только купленное", () => {
  const item = paidItem();
  fund(item.currency, item.price * 3);
  // Покупки нет — только деньги
  patchClanGame((s) => ({ ...s, unlocks: [] }));

  const res = equipClanItem(item.id, "owner");
  assert.equal(res.ok, false, "установили некупленное");
});

test("магазин: установка бесплатна — деньги не меняются", () => {
  const item = paidItem();
  fund(item.currency, item.price * 3);
  buyClanItem(item.id);
  const afterBuy = clanGame().purse[item.currency];

  const res = equipClanItem(item.id, "owner");

  assert.equal(res.ok, true, res.reason);
  assert.equal(
    clanGame().purse[item.currency],
    afterBuy,
    "установка оформления списала деньги",
  );
});

test("магазин: установку можно повторять сколько угодно раз", () => {
  const item = paidItem();
  fund(item.currency, item.price * 3);
  buyClanItem(item.id);

  for (let i = 0; i < 5; i += 1) {
    equipClanItem(item.id, "owner");
  }

  assert.equal(isEquipped(clanGame(), item.id), true, "предмет слетел после повторов");
});

test("магазин: предмет не пропадает из коллекции после снятия", () => {
  const item = paidItem();
  fund(item.currency, item.price * 3);
  buyClanItem(item.id);
  equipClanItem(item.id, "owner");

  const base = CLAN_SHOP_ITEMS.find((i) => i.price === 0);
  equipClanItem(base.id, "owner");

  assert.ok(
    clanGame().unlocks.includes(item.id),
    "снятый предмет исчез из коллекции — вернуть его будет нечем",
  );
});

/* ---------------------------------- Права -------------------------------- */

test("магазин: рядовой участник ничего не устанавливает", () => {
  const item = paidItem();
  fund(item.currency, item.price * 3);
  buyClanItem(item.id);

  for (const category of ["background", "emblem", "decoration"]) {
    assert.equal(canEquip(category, "member"), false, `${category} доступен рядовому`);
  }
});

test("магазин: декором управляет админ, оформлением — только владелец", () => {
  assert.equal(canEquip("decoration", "admin"), true, "админ не может менять декор");
  assert.equal(canEquip("background", "admin"), false, "админ может менять фон");
  assert.equal(canEquip("emblem", "admin"), false, "админ может менять эмблему");
  assert.equal(canEquip("background", "owner"), true, "владелец не может менять фон");
});

test("магазин: установка проверяет права роли", () => {
  const decoration = CLAN_SHOP_ITEMS.find((i) => i.category === "decoration");
  fund(decoration.currency, decoration.price * 3);
  buyClanItem(decoration.id);

  assert.equal(
    equipClanItem(decoration.id, "member").ok,
    false,
    "рядовой установил декор",
  );
  assert.equal(
    equipClanItem(decoration.id, "admin").ok,
    true,
    "админ не смог установить декор",
  );
});

/* ------------------------------- Коллекция ------------------------------- */

test("магазин: ownedByCategory отдаёт только купленное своей категории", () => {
  const bg = CLAN_SHOP_ITEMS.find((i) => i.category === "background" && i.price > 0);
  const emblem = CLAN_SHOP_ITEMS.find((i) => i.category === "emblem" && i.price > 0);

  patchClanGame((s) => ({
    ...s,
    unlocks: [bg.id],
    purse: { ...s.purse, [bg.currency]: bg.price * 3, [emblem.currency]: emblem.price * 3 },
  }));
  buyClanItem(bg.id);

  const backgrounds = ownedByCategory(clanGame(), "background");
  assert.ok(backgrounds.some((b) => b.id === bg.id), "купленный фон не найден");
  assert.ok(
    !backgrounds.some((b) => b.category !== "background"),
    "в выдачу попал предмет другой категории",
  );
  assert.ok(
    !ownedByCategory(clanGame(), "emblem").some((e) => e.id === bg.id),
    "фон числится эмблемой",
  );
});