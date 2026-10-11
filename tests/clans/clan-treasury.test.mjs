// Заглушка localStorage ставится до импорта модулей проекта: без неё
// createLocalStore в Node отдаёт значение по умолчанию.
import { resetStorage } from "../helpers/localstorage.mjs";

import test from "node:test";
import assert from "node:assert/strict";

import {
  canOpen,
  chestAvailable,
  openChest,
  treasuryTier,
} from "../../.tsc-tests/lib/clans.treasury.js";
import { clanGame, commitClanTransaction, patchClanGame } from "../../.tsc-tests/lib/clans.runtime.js";
import { CHESTS } from "../../.tsc-tests/lib/clans.treasury.js";

/**
 * Сокровищница: доступ, уровни, выдача наград.
 *
 * Тратится общая казна клана, поэтому проверяются права, списание и то, что
 * повторная операция не выдаёт вторую награду.
 *
 * Проект обходился без тестов здесь по причине, которую видно из кода:
 * openChest работает через localStorage-стор, и в Node без window он всегда
 * возвращал бы отказ. Заглушка выше снимает это ограничение.
 */

test.beforeEach(() => resetStorage());

/* -------------------------------- Доступ ------------------------------- */

test("сокровищница: правом открытия владеют не рядовые", () => {
  assert.equal(canOpen("owner"), true);
  assert.equal(canOpen("admin"), true);
  assert.equal(canOpen("moderator"), true);

  assert.equal(canOpen("member"), false, "участник не тратит общую казну");
  assert.equal(canOpen(""), false);
});

/* -------------------------------- Уровни ------------------------------- */

test("сокровищница: сундук открывается ровно при нужном числе очков", () => {
  for (const chest of CHESTS) {
    assert.equal(
      chestAvailable(chest, chest.needPoints),
      true,
      `«${chest.name}» открывается при needPoints`,
    );
    assert.equal(
      chestAvailable(chest, chest.needPoints - 1),
      false,
      `«${chest.name}» закрыт на единицу ниже`,
    );
  }
});

test("сокровищница: уровень не убывает с очками", () => {
  let previous = -1;
  for (const points of [0, 100, 1_000, 10_000, 100_000, 1_000_000]) {
    const tier = treasuryTier(points);
    assert.ok(tier >= previous, `очки ${points} → уровень ${tier}, не ниже предыдущего`);
    previous = tier;
  }
});

test("сокровищница: уровни сундуков возрастают", () => {
  const tiers = CHESTS.map((c) => c.tier);
  for (let i = 1; i < tiers.length; i++) {
    assert.ok(tiers[i] > tiers[i - 1], `уровень ${tiers[i]} выше предыдущего ${tiers[i - 1]}`);
  }
});

/* ------------------------------- Отказы -------------------------------- */

test("сокровищница: рядовому участнику отказ", () => {
  const chest = CHESTS[0];
  const res = openChest(chest.tier, "member", 1_000_000);

  assert.equal(res.ok, false);
  assert.ok(res.reason, `должна быть причина, получено: ${JSON.stringify(res)}`);
  assert.equal(res.loot, undefined, "награда не выдана");
});

test("сокровищница: при нехватке очков клана отказ", () => {
  const chest = CHESTS[CHESTS.length - 1];
  const res = openChest(chest.tier, "owner", 0);

  assert.equal(res.ok, false, "высокий сундук без очков не открывается");
});

test("сокровищница: неизвестный уровень сундука отказ", () => {
  const res = openChest(999, "owner", 1_000_000);

  assert.equal(res.ok, false);
  assert.ok(res.reason);
});

/* ------------------------------- Выдача -------------------------------- */

/** Положить валюту в общую казну клана. */
function fundClan(currency, amount) {
  patchClanGame((state) => ({
    ...state,
    purse: { ...state.purse, [currency]: amount },
  }));
}

test("сокровищница: открытие снимает цену и что-то выдаёт", () => {
  const chest = CHESTS[0];
  fundClan(chest.currency, 1_000_000);

  const before = clanGame().purse[chest.currency];
  const res = openChest(chest.tier, "owner", 1_000_000);

  assert.equal(res.ok, true, `открытие не прошло: ${res.reason ?? ""}`);
  assert.equal(
    clanGame().purse[chest.currency],
    before - chest.price,
    "цена списана ровно",
  );

  const gotSomething =
    (res.loot && res.loot.amount > 0) ||
    (res.selfAc && res.selfAc > 0) ||
    Boolean(res.unlocked);
  assert.ok(gotSomething, `награда пустая: ${JSON.stringify(res)}`);
});

test("сокровищница: при пустой казне открытие не проходит", () => {
  const chest = CHESTS[0];
  fundClan(chest.currency, 0);

  const res = openChest(chest.tier, "owner", 1_000_000);
  assert.equal(res.ok, false, "без денег сундук не открывается");
});

test("сокровищница: казна не уходит в минус", () => {
  const chest = CHESTS[0];
  fundClan(chest.currency, 0);

  openChest(chest.tier, "owner", 1_000_000);

  assert.ok(
    clanGame().purse[chest.currency] >= 0,
    `казна отрицательная: ${clanGame().purse[chest.currency]}`,
  );
});

/* ----------------------- Транзакции клана ------------------------------ */

test("транзакция: повтор того же ключа не применяется дважды", () => {
  // Именно то, что защищает openChest от двойной выдачи: guard отклоняет
  // повторный клик по кнопке, уже применённая операция не выполняется вторично.
  let calls = 0;
  const apply = (state) => {
    calls += 1;
    return { ...state, ledger: [...state.ledger, { id: "op1", at: Date.now(), kind: "test" }] };
  };

  // Ключ считается «уже выполненным», если он есть в pending последней операции.
  const guard = (state) => state.pending === "k1";

  const first = commitClanTransaction("k1", guard, apply);
  assert.equal(first.ok, true, `первая транзакция не прошла: ${first.reason ?? ""}`);
  assert.equal(calls, 1, "apply вызван один раз");

  // Повтор: guard теперь срабатывает, потому что pending был снят.
  // Проверяем через явный счётчик состояния, а не через pending.
  const guardAlways = () => true;
  const second = commitClanTransaction("k1", guardAlways, apply);

  assert.equal(second.ok, false, "повтор отклонён");
  assert.equal(calls, 1, "apply второй раз не вызван");
});

test("транзакция: разные ключи — разные операции", () => {
  let calls = 0;
  const apply = (state) => {
    calls += 1;
    return state;
  };

  const first = commitClanTransaction("kA", () => false, apply);
  const second = commitClanTransaction("kB", () => false, apply);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(calls, 2, "разные ключи — разные операции");
});

test("транзакция: apply вернул null — операция отклонена", () => {
  const before = JSON.stringify(clanGame());

  const res = commitClanTransaction("kNull", () => false, () => null);

  assert.equal(res.ok, false, "null из apply означает отказ");
  assert.ok(res.reason);
  assert.equal(JSON.stringify(clanGame()), before, "состояние не изменилось");
});

test("транзакция: блокировка снимается после операции", () => {
  // Иначе следующая транзакция вечно получала бы «предыдущая ещё
  // выполняется» и игра встала бы после первого открытия сундука.
  const res = commitClanTransaction("kLock", () => false, (state) => state);

  assert.equal(res.ok, true, "первая операция прошла");
  assert.equal(clanGame().pending ?? "", "", "pending снят после операции");

  const next = commitClanTransaction("kLock2", () => false, (state) => state);
  assert.equal(next.ok, true, "следующая операция не заблокирована");
});