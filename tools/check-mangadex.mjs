/* Проверка клиента MangaDex: каталог, тайтл с главами, страницы главы.
   Запуск: node tools/check-mangadex.mjs (скрипт сам собирает tsc) */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import Module from "node:module";
import { createRequire } from "node:module";

const tsc = spawnSync("npx tsc -p tsconfig.tools.json", { stdio: "inherit", shell: true });
if (tsc.status !== 0) {
  console.error("[mangadex] сборка не удалась");
  process.exit(tsc.status ?? 1);
}

// `kodik` помечен `server-only` — вне Next этот пакет бросает ошибку
const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return load.call(this, request, parent, isMain);
};

const require = createRequire(import.meta.url);
const { mangaRow, mangaDetail, chapterPages } = require("../.tsc-tests/lib/mangadex.js");

/* ---------------- Каталог ---------------- */
let uuid = null;
for (const sort of ["hot", "best"]) {
  const cards = await mangaRow(sort, 20);
  console.log(`${sort}: ${cards.length} карточек`);
  for (const c of cards.slice(0, 3))
    console.log("  -", c.title, "| ориг:", c.titleOrig ?? "—", "|", c.rating ?? "—", "|", c.chapterCount ?? "—", "гл.");
  assert.ok(cards.length >= 15, `${sort}: ряд наполнен`);
  assert.ok(cards.every((c) => c.poster?.startsWith("https://uploads.mangadex.org/")), `${sort}: обложки`);
  assert.ok(
    cards.every((c) => /^[0-9a-f-]{36}$/.test(c.id)),
    `${sort}: id — uuid MangaDex`,
  );
  assert.ok(cards.every((c) => c.rating > 0), `${sort}: рейтинг из /statistics`);
  assert.ok(cards.some((c) => /[а-яё]/i.test(c.title)), `${sort}: русские названия из altTitles`);
  assert.ok(
    cards.every((c) => (c.chapterCount ?? 0) > 0),
    `${sort}: у каждой карточки есть число глав на русском`,
  );
  // Счётчик обязан совпадать с фидом MangaDex, а не быть числом новых глав
  const counted = await mangaRow(sort, 3);
  for (const card of counted) {
    const feed = await fetch(
      `https://api.mangadex.org/manga/${card.id}/feed?translatedLanguage[]=ru&limit=1`,
      { headers: { Accept: "application/json" } },
    ).then((r) => r.json());
    assert.equal(card.chapterCount, feed.total, `${sort}: счётчик глав = фиду (${feed.total})`);
  }
  // Главы, заявленные на карточке, должны совпадать с фидом MangaDex
  const sample = cards.slice(0, 3);
  for (const card of sample) {
    const feed = await fetch(
      `https://api.mangadex.org/manga/${card.id}/feed?translatedLanguage[]=ru&limit=1`,
      { headers: { Accept: "application/json" } },
    ).then((r) => r.json());
    assert.ok(feed.total > 0, `${sort}: ${card.title} реально читается (${feed.total} глав)`);
  }
  uuid ??= cards[0].id;
}

/* ---------------- Тайтл и главы ---------------- */
const detail = await mangaDetail(uuid);
console.log(
  `\nтайтл: "${detail.title}" | ${detail.year ?? "—"} | ${detail.rating?.toFixed(2) ?? "—"} | жанров ${detail.genres.length}`,
);
console.log("  подписчиков:", detail.follows ?? "—", "| глав всего:", detail.chaptersTotal);
console.log("  описание:", detail.description?.slice(0, 100) ?? "—");
console.log(
  "  главы:",
  detail.chapters.slice(0, 4).map((c) => `т${c.volume ?? "-"} г${c.chapter} (${c.pages ?? "?"} стр.)`).join(", "),
);
assert.ok(detail, "тайтл получен");
assert.ok(detail.chapters.length > 0, "главы на русском есть");
assert.ok(detail.poster, "обложка есть");
// Главы должны идти по возрастанию номера (нумерация сквозная по тайтлу:
// том 1 может быть главы 0.01–0.03, том 2 — 0.04)
const numbers = detail.chapters.map((c) => parseFloat(c.chapter));
assert.ok(
  numbers.every((n, i) => i === 0 || !Number.isFinite(n) || n >= numbers[i - 1]),
  "главы отсортированы по номеру",
);
assert.ok(
  !detail.chapters.some((c) => Number.isNaN(parseFloat(c.chapter))),
  "нет NaN в номерах глав",
);
assert.ok((await mangaDetail("не-uuid")) === null, "мусорный id отсекается");
assert.ok((await mangaDetail("00000000-0000-0000-0000-000000000000")) === null, "несуществующий → null");

/* ---------------- Страницы главы ---------------- */
const chapter = detail.chapters[0];
const pages = await chapterPages(chapter.id);
console.log(`\nглава г${chapter.chapter}: страниц ${pages.urls.length}`);
console.log("  первая:", pages.urls[0]?.slice(0, 90));
assert.ok(pages.urls.length > 0, "страницы главы отданы");
assert.ok(
  pages.urls.every((u) => /^https:\/\/[^/]+\.mangadex\.network\/data\//.test(u)),
  "ссылки ведут на CDN MangaDex",
);

// Первая страница реально грузится
const probe = await fetch(pages.urls[0], { headers: { Range: "bytes=0-2048" } });
console.log("  страница:", probe.status, probe.headers.get("content-type"));
assert.ok(probe.ok, "страница главы отдаётся");

// Главы без файлов не должны ронять ридер
const empty = await chapterPages("00000000-0000-0000-0000-000000000000");
console.log("битая глава:", empty === null ? "null" : `urls=${empty.urls.length}`);
assert.ok(empty === null || empty.urls.length === 0, "битая глава → пустой список, не исключение");
assert.ok((await chapterPages("мусор")) === null, "мусорный chapter id отсекается");

console.log("\nmangadex: OK");