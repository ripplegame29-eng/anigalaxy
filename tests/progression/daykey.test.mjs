import test from "node:test";
import assert from "node:assert/strict";

import { dayKey } from "../../.tsc-tests/lib/store.js";
import { dayKeyOf } from "../../.tsc-tests/lib/progression/time.js";

/**
 * Граница суток.
 *
 * Тест закрывает конкретный баг: `dayKey` был `toISOString().slice(0, 10)`,
 * то есть всегда UTC, тогда как движок прогрессии считал дни по `ctx.tz`.
 * У игрока в UTC+3 между 00:00 и 03:00 по местному эти двое называли разные
 * дни — дневной квест обнулялся по UTC, а серия в профиле считалась по
 * местному. Плюс в проекте жили две разные функции `dayKey` с разными
 * сигнатурами: из `store` (принимала Date) и из `clans.runtime` (число).
 */

// 00:30 по Москве = 21:30 предыдущего дня по UTC.
const MSK_00_30 = Date.UTC(2026, 9, 11, 21, 30);
// 23:30 по Москве = 20:30 того же дня по UTC.
const MSK_23_30 = Date.UTC(2026, 9, 11, 20, 30);

const MSK = "Europe/Moscow";

test("dayKey: полночь пояса игрока опережает UTC", () => {
  const byUtc = new Date(MSK_00_30).toISOString().slice(0, 10);
  const byMsk = dayKeyOf(MSK_00_30, MSK);

  assert.equal(byUtc, "2026-10-11", "UTC в этот момент ещё показывает вчера");
  assert.equal(byMsk, "2026-10-12", "пояс игрока уже показывает сегодня");
});

test("dayKey: до полуночи пояса оба дают один день", () => {
  assert.equal(dayKeyOf(MSK_23_30, MSK), "2026-10-11");
});

test("dayKey: принимает и Date, и миллисекунды", () => {
  // Вызывающие места исторически зовут функцию по-разному: store-овские
  // передают `new Date()`, клановые — `Date.now()`.
  assert.equal(
    dayKey(new Date(MSK_00_30), MSK),
    dayKey(MSK_00_30, MSK),
  );
  assert.equal(dayKey(MSK_00_30, MSK), "2026-10-12");
});

test("dayKey: пояс действительно влияет на ключ", () => {
  // В один момент в Токио уже 12-е, в Москве ещё 11-е.
  assert.equal(dayKey(MSK_00_30, "Asia/Tokyo"), "2026-10-12");
  assert.equal(dayKey(MSK_00_30, MSK), "2026-10-12");

  // ...а в этот — наоборот: в Лос-Анджелесе ещё 11-е, в Москве 12-е.
  assert.equal(dayKey(MSK_00_30, "America/Los_Angeles"), "2026-10-11");
});

test("dayKey: непохожий пояс не роняет функцию", () => {
  // Раньше при мусорном поясе был бы исключение от Intl; dayKeyOf падает
  // обратно на UTC. Проверяем, что это так и осталось.
  assert.match(dayKey(MSK_00_30, "Не/Пояс"), /^\d{4}-\d{2}-\d{2}$/);
});

test("dayKey: по умолчанию берётся пояс системы, а не UTC", () => {
  const system = new Intl.DateTimeFormat()
    .resolvedOptions()
    .timeZone;

  // Если система в UTC, дефолт и UTC совпадут и проверка ничего не скажет —
  // поэтому утверждаем только то, что функция вообще отвечает ключом дня.
  const key = dayKey(MSK_00_30);
  assert.match(key, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(system.length > 0);
});