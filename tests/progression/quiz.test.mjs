/**
 * Логика квиза «Угадай тайтл по opening'у»: подбор карточек, сборка раунда,
 * привязка кадров opening'ов и варианты ответа.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRound,
  parseThemeName,
  pickCards,
  quizHint,
  quizExcludeHash,
} from "../../.tsc-tests/lib/quiz.js";
import { cardKey, dedupeCards } from "../../.tsc-tests/lib/anime.js";

/** Минимальная карточка тайтла для тестов */
function card(id, title, extra = {}) {
  return {
    id,
    title,
    year: 2020,
    kind: "tv",
    genres: [],
    ...extra,
  };
}

const POOL = [
  card("serial-1", "Стальной алхимик: Братство", { year: 2009 }),
  card("serial-2", "Блич", { year: 2004 }),
  card("serial-3", "Корзинка фруктов: Финал", { year: 2021 }),
  card("serial-4", "Гинтама", { year: 2006 }),
  card("serial-5", "ДжоДжо", { year: 2012 }),
  card("serial-6", "Ван-Пис", { year: 1999 }),
];

/* ------------------------------ Подбор карточек ------------------------------ */

test("pickCards: возвращает не больше запрошенного и без дублей", () => {
  const picked = pickCards(POOL, 4);
  assert.equal(picked.length, 4);

  const keys = picked.map(cardKey);
  assert.equal(new Set(keys).size, keys.length, "все карточки уникальны");
});

test("pickCards: запрос больше пула отдаёт весь пул", () => {
  const picked = pickCards(POOL, 50);
  assert.equal(picked.length, POOL.length);
});

test("pickCards: дубли по названию/году/формату схлопываются", () => {
  const withDupes = [
    ...POOL,
    card("serial-1-dup", "Стальной алхимик: Братство", { year: 2009 }),
  ];
  assert.equal(dedupeCards(withDupes).length, POOL.length);

  const picked = pickCards(withDupes, 50);
  assert.equal(picked.length, POOL.length);
  assert.equal(
    picked.filter((c) => c.title === "Стальной алхимик: Братство").length,
    1,
  );
});

test("pickCards: карточки без названия не попадают в раунд", () => {
  const picked = pickCards([...POOL, card("serial-7", "")], 50);
  assert.ok(picked.every((c) => Boolean(c.title)));
});

/* --------------------------- Антиповторы в раундах -------------------------- */

test("quizExcludeHash: детерминирован, различает тайтлы и годится для query", () => {
  const first = quizExcludeHash(POOL[0].title);
  assert.equal(first, quizExcludeHash(POOL[0].title), "один и тот же тайтл — один хеш");
  assert.notEqual(first, quizExcludeHash(POOL[1].title), "разные тайтлы — разные хеши");
  assert.match(first, /^[0-9a-z]+$/, "короткий ASCII-хеш: помещается в ?exclude=");

  // Ключ — только название: другой формат/год того же тайтла в каталоге
  // не должен «проскакивать» антиповтор
  assert.equal(
    quizExcludeHash("Ван-Пис"),
    quizExcludeHash("  ван-пис  "),
    "регистр и пробелы не меняют хеш",
  );

  // Так роутер фильтрует недавно показанные тайтлы перед подбором
  const exclude = new Set([first, quizExcludeHash(POOL[2].title)]);
  const fresh = POOL.filter((c) => !exclude.has(quizExcludeHash(c.title)));
  assert.equal(fresh.length, POOL.length - 2, "исключённые тайтлы не возвращаются");
  assert.ok(fresh.length >= 4, "пул остаётся достаточно большим для раунда");
});

/* -------------------------------- Подсказка -------------------------------- */

test("quizHint: формат и год тайтла", () => {
  assert.equal(quizHint(card("serial-1", "Тест", { year: 2019, kind: "movie" })), "Фильм · 2019");
  assert.equal(quizHint(card("serial-1", "Тест", { year: 2024, kind: "tv" })), "ТВ Сериал · 2024");
});

test("quizHint: без формата — онгоинг или фильм, без года — без хвоста", () => {
  assert.equal(quizHint(card("serial-1", "Тест", { year: undefined, kind: undefined, status: "ongoing" })), "Онгоинг");
  assert.equal(quizHint(card("serial-1", "Тест", { year: undefined, kind: undefined })), "Фильм");
});

/* ------------------------------ Сборка раунда ------------------------------ */

test("buildRound: вопросы строятся ровно по переданным карточкам", () => {
  const picked = pickCards(POOL, 3);
  const round = buildRound(POOL, 3, new Map(), picked);

  assert.equal(round.questions.length, 3);
  assert.deepEqual(
    round.questions.map((q) => q.card.id),
    picked.map((c) => c.id),
    "порядок и состав совпадают с pickedCards",
  );
});

test("buildRound: opening привязывается по ключу карточки", () => {
  const picked = pickCards(POOL, 2);
  const openings = new Map([
    [cardKey(picked[0]), { src: "https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg", title: "OP1" }],
    [cardKey(picked[1]), { src: "https://i.ytimg.com/vi/bbbbbbbbbbb/hqdefault.jpg", title: "OP2" }],
  ]);

  const round = buildRound(POOL, 2, openings, picked);
  assert.equal(round.questions[0].op?.src, openings.get(cardKey(picked[0])).src);
  assert.equal(round.questions[1].op?.src, openings.get(cardKey(picked[1])).src);
});

test("buildRound: без найденного opening кадр не подставляется", () => {
  const picked = pickCards(POOL, 2);
  const round = buildRound(POOL, 2, new Map(), picked);
  assert.ok(round.questions.every((q) => q.op === undefined));
});

test("buildRound: правильный ответ есть среди четырёх вариантов", () => {
  const round = buildRound(POOL, 5);

  for (const question of round.questions) {
    assert.equal(question.options.length, 4);
    assert.ok(question.options.some((o) => o.id === question.answerId));
    assert.equal(
      question.options.filter((o) => o.id === question.answerId).length,
      1,
      "правильный вариант не дублируется",
    );
  }
});

test("buildRound: дистракторы — чужие тайтлы, без дублей", () => {
  const round = buildRound(POOL, 5);

  for (const question of round.questions) {
    const ids = question.options.map((o) => o.id);
    assert.equal(new Set(ids).size, ids.length, "варианты уникальны");
    assert.equal(
      ids.filter((id) => id !== question.answerId).length,
      3,
      "три дистрактора",
    );
  }
});

test("buildRound: два вопроса не повторяют один тайтл", () => {
  const round = buildRound(POOL, 5);
  const ids = round.questions.map((q) => q.card.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("buildRound: id раунда и вопросов заполнены", () => {
  const round = buildRound(POOL, 3);
  assert.match(round.id, /^quiz-/);
  assert.deepEqual(
    round.questions.map((q) => q.id),
    ["q1", "q2", "q3"],
  );
});

test("buildRound: пустой пул даёт пустой раунд без падения", () => {
  const round = buildRound([], 5);
  assert.equal(round.questions.length, 0);
  assert.match(round.id, /^quiz-/);
});

/* ------------------------------- Песни из OP ------------------------------- */

test("parseThemeName: формат Shikimori «OP1 «Song» — Artist»", () => {
  assert.deepEqual(parseThemeName("OP1 «Yuusha» — YOASOBI"), {
    song: "Yuusha",
    artist: "YOASOBI",
  });
  assert.deepEqual(parseThemeName("OP2 «Haru» — Yorushika"), {
    song: "Haru",
    artist: "Yorushika",
  });
});

test("parseThemeName: тема без номера и с хвостом у исполнителя", () => {
  assert.deepEqual(parseThemeName("«Anytime Anywhere» — milet (SPECIAL MV)"), {
    song: "Anytime Anywhere",
    artist: "milet",
  });
});

test("parseThemeName: формат YouTube «Аниме | Song by Artist»", () => {
  assert.deepEqual(parseThemeName("Frieren | Yuusha by YOASOBI"), {
    song: "Yuusha",
    artist: "YOASOBI",
  });
});

test("parseThemeName: «Song — Artist» без кавычек", () => {
  assert.deepEqual(parseThemeName("OP1 Scar — Tatsuya Kitani"), {
    song: "Scar",
    artist: "Tatsuya Kitani",
  });
});

test("parseThemeName: трейлеры и превью серий не считаются песней", () => {
  assert.equal(parseThemeName("PV1 (ASU Media Group) Озвучка"), null);
  assert.equal(parseThemeName("Трейлер Sentai"), null);
  assert.equal(parseThemeName("OP1"), null);
  assert.equal(parseThemeName(""), null);
});

test("buildRound: песенный режим отдаёт песню и не отдаёт кадр", () => {
  const picked = pickCards(POOL, 2);
  const songs = new Map([
    [cardKey(picked[0]), { previewUrl: "https://audio.example/1.m4a", theme: "OP1 «A» — X", song: "A", artist: "X" }],
    [cardKey(picked[1]), { previewUrl: "https://audio.example/2.m4a", theme: "OP1 «B» — Y", song: "B", artist: "Y" }],
  ]);
  const openings = new Map([
    [cardKey(picked[0]), { src: "https://i.ytimg.com/vi/aaaaaaaaaaa/hq2.jpg", title: "OP1 «A» — X" }],
  ]);

  const round = buildRound(POOL, 2, openings, picked, songs, "song");
  assert.equal(round.mode, "song");
  assert.equal(round.questions[0].song?.previewUrl, "https://audio.example/1.m4a");
  assert.equal(round.questions[1].song?.previewUrl, "https://audio.example/2.m4a");
  assert.equal(round.questions[0].op, undefined, "кадр не утекает в песенный режим");
});

test("buildRound: режим кадра не отдаёт песню", () => {
  const picked = pickCards(POOL, 1);
  const songs = new Map([
    [cardKey(picked[0]), { previewUrl: "https://audio.example/1.m4a", theme: "OP1 «A» — X", song: "A", artist: "X" }],
  ]);
  const round = buildRound(POOL, 1, new Map(), picked, songs, "frame");
  assert.equal(round.mode, "frame");
  assert.equal(round.questions[0].song, undefined);
});
