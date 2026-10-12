/**
 * Кэш со stale-while-revalidate.
 *
 * Проверяем ровно то свойство, ради которого модуль выделен: протукшее
 * значение отдаётся немедленно, а не после ожидания источника. Именно это
 * превращало шесть рядов главной в полуминутное открытие страницы.
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

// Скомпилированный код лежит в CommonJS (tsconfig.tools.json), а тест —
// ESM. Node не даёт require'нуть относительный путь из ESM-модуля, поэтому
// опора идёт на корень репозитория.
const { clearCache, withCache } = createRequire(join(process.cwd(), "package.json"))(
  "./.tsc-tests/lib/ttlcache.js",
);

/** Прокручивает время, не тратя реальные секунды. */
function tick(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

afterEach(() => clearCache());

describe("withCache", () => {
  it("отдаёт значение из кэша, не вызывая источник повторно", async () => {
    let calls = 0;
    const produce = async () => {
      calls += 1;
      return "свежее";
    };

    assert.equal(await withCache("hit", 60_000, produce), "свежее");
    assert.equal(await withCache("hit", 60_000, produce), "свежее");
    assert.equal(calls, 1, "источник дёргается один раз");
  });

  it("не ждёт источника, когда значение протукло, и обновляет в фоне", async () => {
    let calls = 0;
    const produce = async () => {
      calls += 1;
      return `вызов-${calls}`;
    };

    await withCache("stale", 40, produce);
    assert.equal(calls, 1);

    await tick(80); // TTL истёк

    // Источник заведомо медленный: если бы withCache его ждал, тест бывал.
    const slow = async () => {
      calls += 1;
      await tick(150);
      return "обновлённое";
    };

    const t0 = Date.now();
    const value = await withCache("stale", 60_000, slow);
    const elapsed = Date.now() - t0;

    assert.equal(value, "вызов-1", "отдано протукшее, а не новое");
    assert.ok(elapsed < 100, `ответ мгновенный, а не через ${elapsed} мс`);

    await tick(250); // фоновое обновление успело завершиться
    assert.equal(await withCache("stale", 60_000, produce), "обновлённое");
  });

  it("не запускает два фоновых обновления одного ключа подряд", async () => {
    let calls = 0;
    const produce = async () => {
      calls += 1;
      await tick(80);
      return calls;
    };

    await withCache("dedupe", 30, produce);
    await tick(60);

    // Пять запросов подряд к протукшему значению — источник должен быть
    // дёрнут один раз, а не пять.
    await Promise.all([
      withCache("dedupe", 60_000, produce),
      withCache("dedupe", 60_000, produce),
      withCache("dedupe", 60_000, produce),
      withCache("dedupe", 60_000, produce),
      withCache("dedupe", 60_000, produce),
    ]);

    assert.equal(calls, 2, "первый вызов плюс ровно одно фоновое обновление");
  });

  it("отдаёт последнее значение, если источник лежит", async () => {
    await withCache("down", 30, async () => "рабочее");
    await tick(60);

    const broken = async () => {
      throw new Error("Kodik недоступен");
    };

    // Протукшая запись есть, фоновое обновление упадёт — страница всё равно
    // получает данные, а не ошибку.
    assert.equal(await withCache("down", 60_000, broken), "рабочее");
  });

  it("пробрасывает ошибку, когда в кэше нет ничего", async () => {
    const broken = async () => {
      throw new Error("Kodik недоступен");
    };

    // Первое обращение ждать обязано: показать нечего, а молча вернуть
    // пустоту значило бы отдать пользователю страницу без каталога.
    await assert.rejects(() => withCache("пусто", 60_000, broken), /Kodik недоступен/);
  });

  it("переходит на свежее значение после фонового обновления", async () => {
    await withCache("refresh", 30, async () => "старое");
    await tick(60); // TTL истёк, значение стало протукшим

    const stale = await withCache("refresh", 60_000, async () => "новое");
    assert.equal(stale, "старое", "первый запрос после истечения отдаёт протукшее");

    // Фоновое обновление асинхронно: пока оно идёт, запросы по определению
    // видят старое значение — это и есть цена SWR.
    await tick(200);

    assert.equal(
      await withCache("refresh", 60_000, async () => "ещё раз"),
      "новое",
      "после фонового обновления отдаётся свежее",
    );
  });
});