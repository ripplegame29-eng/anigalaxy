/**
 * Общие фикстуры для тестов кланов.
 *
 * Главное здесь — resetClanGame. `resetStorage()` очищает localStorage, но
 * `createLocalStore` (lib/store.ts) держит разобранное значение в замыкании и
 * больше в localStorage не ходит. Поэтому одиночная очистка хранилища не
 * возвращает тест к исходному состоянию: предыдущий тест оставляет после себя
 * покупки, коллекцию и состав, и следующий стартует не с нуля.
 *
 * Лечится снимком чистого состояния, снятым при загрузке модуля — до того,
 * как что-либо успело измениться.
 */

// Заглушка localStorage поднимается раньше модулей проекта: createLocalStore
// при первом обращении решает, есть ли window, и без заглушки отдаёт пустое
// состояние вместо того, что пишет тест.
import "../helpers/localstorage.mjs";

import assert from "node:assert/strict";

import { createClan } from "../../.tsc-tests/lib/clans.js";
import { clanGame, patchClanGame } from "../../.tsc-tests/lib/clans.runtime.js";

/** Состояние на момент импорта — заведомо нетронутое. */
const pristine = structuredClone(clanGame());

/** Возвращает игровое состояние клана к исходному. */
export function resetClanGame() {
  patchClanGame(() => structuredClone(pristine));
}

/**
 * Клан с игроком во главе и одним участником — база для проверок прав,
 * состава и номинаций.
 */
export function makeClan(overrides = {}) {
  return {
    id: "clan-test",
    name: "Тестовый клан",
    tag: "ТЕСТ",
    emblem: "⚔",
    color: "#ffcc00",
    description: "Клан для проверок",
    points: 0,
    memberCount: 1,
    mine: true,
    members: [
      {
        id: "p1",
        name: "Ты",
        role: "owner",
        isPlayer: true,
        contributed: 0,
        joinedAt: "2026-01-01",
      },
    ],
    ...overrides,
  };
}

/**
 * Кладёт клан в стор списка кланов (`clans.ts`), а не в игровой стор.
 *
 * Нужен там, где код смотрит в `state.own` самого клана: addMember и
 * acceptApplication пишут именно туда, поэтому игрового стора
 * недостаточно — отказ «Клана нет» пришёл бы из хранилища, а не от
 * проверяемого поведения.
 *
 * Идём через createClan, а не правкой стора: он создаёт состав, уровень и
 * клетки так же, как это делает интерфейс, и тест проверяет настоящий поток.
 */
export function useClan(overrides = {}) {
  const created = createClan({
    name: "Тестовый клан",
    tag: "ТЕСТ",
    emblem: "⚔",
    color: "#ffcc00",
    description: "Клан для проверок",
    ...overrides,
  });

  const own = created.own;
  assert.ok(own, "клан не создался");
  return own;
}

/** Обычный рабочий день: вторник, полдень UTC. */
export const WEEKDAY = Date.UTC(2026, 2, 10, 12);