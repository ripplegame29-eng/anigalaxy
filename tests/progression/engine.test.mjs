/**
 * Ядро движка: вход/серия/ротация, зачёт просмотра, идемпотентность,
 * soft-cap, антиабьюз (§2, §4, §5, §13).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { applyEvent } from "../../.tsc-tests/lib/progression/engine.js";
import { PROGRESSION_CONFIG } from "../../.tsc-tests/lib/progression/progression.config.js";
import { dayKeyOf } from "../../.tsc-tests/lib/progression/time.js";
import { at, apply, ctx, freshDoc, sessionOf, watchEpisode, xpEffects } from "./helpers.mjs";

const cfg = PROGRESSION_CONFIG;

/* --------------------------- Вход и серия дней --------------------------- */

test("вход: первый запуск даёт XP/AC, серию и день", () => {
  const r = apply(freshDoc(), { type: "SESSION_START" }, {}, at(10, 0));

  assert.equal(r.doc.progress.streakCurrent, 1);
  assert.equal(r.doc.progress.streakBest, 1);
  assert.equal(r.doc.counters.DISTINCT_DAYS, 1);
  assert.equal(r.doc.progress.xpTotal, 25, "правило SESSION_START = 25 XP");
  assert.equal(r.doc.progress.acBalance, 10, "+10 AC");
  assert.equal(r.doc.progress.lastActiveDate, "2026-03-10");
  assert.equal(r.doc.daily.counts.DAILY_LOGIN, 1, "бакет для квеста");
  assert.equal(r.doc.quests.daily.length, 3, "3 квеста дня");
  assert.equal(r.doc.quests.weekly.length, 2, "2 квеста недели");
  assert.equal(r.doc.meta.events, 1);

  const gained = xpEffects(r.effects);
  assert.equal(gained.length, 1);
  assert.equal(gained[0].credited, 25);
  assert.equal(gained[0].reduced, false);
  assert.ok(r.effects.some((e) => e.type === "STREAK_CHANGED"));
  assert.ok(r.doc.ledger.some((e) => e.type === "SESSION_START" && e.currency === "XP"));
});

test("вход: повторно в тот же день не начисляет (идемпотентность)", () => {
  const first = apply(freshDoc(), { type: "SESSION_START" }, {}, at(10, 0));
  const second = apply(first.doc, { type: "SESSION_START" }, {}, at(11, 0));

  assert.equal(second.doc.progress.xpTotal, 25, "XP не изменился");
  assert.equal(second.doc.progress.acBalance, 10, "AC не изменился");
  assert.equal(second.doc.progress.streakCurrent, 1, "серия не задета");
  assert.equal(second.doc.daily.counts.DAILY_LOGIN, 1);
  assert.equal(second.doc.meta.events, 2, "событие обработано, но без награды");
  assert.ok(!second.effects.some((e) => e.type === "STREAK_CHANGED"));
});

test("серия: растёт по дням, сбрасывается при пропуске", () => {
  let doc = apply(freshDoc(), { type: "SESSION_START" }, {}, at(10, 0, 0)).doc;
  assert.equal(doc.progress.streakCurrent, 1);

  doc = apply(doc, { type: "SESSION_START" }, {}, at(10, 0, 1)).doc;
  assert.equal(doc.progress.streakCurrent, 2, "следующий день — +1");
  assert.equal(doc.counters.DISTINCT_DAYS, 2);

  doc = apply(doc, { type: "SESSION_START" }, {}, at(10, 0, 2)).doc;
  assert.equal(doc.progress.streakCurrent, 3);
  assert.ok(
    doc.achievements.ach_streak_3?.unlockedAt,
    "серия 3 дней разблокирует достижение",
  );

  // пропуск двух суток (день 4 после дня 2) — серия падает
  doc = apply(doc, { type: "SESSION_START" }, {}, at(10, 0, 4)).doc;
  assert.equal(doc.progress.streakCurrent, 1, "пропуск сбрасывает серию");
  assert.equal(doc.progress.streakBest, 3, "лучшая серия сохраняется");
});

test("серия: «Заморозка» спасает ровно один пропущенный день", () => {
  const base = freshDoc();
  base.progress.streakCurrent = 5;
  base.progress.streakBest = 5;
  base.progress.streakFreezes = 1;
  base.progress.lastActiveDate = dayKeyOf(at(10, 0, 0), "UTC");

  const withFreeze = apply(base, { type: "SESSION_START" }, {}, at(10, 0, 2));
  assert.equal(withFreeze.doc.progress.streakCurrent, 6, "день серии продолжен");
  assert.equal(withFreeze.doc.progress.streakFreezes, 0, "заморозка израсходована");
  const changed = withFreeze.effects.find((e) => e.type === "STREAK_CHANGED");
  assert.equal(changed.freezeUsed, true);

  const noFreeze = apply(
    { ...base, progress: { ...base.progress, streakFreezes: 0 } },
    { type: "SESSION_START" },
    {},
    at(10, 0, 2),
  );
  assert.equal(noFreeze.doc.progress.streakCurrent, 1, "без заморозки — сброс");
});

test("секрет «Вернулся из бездны»: 30+ дней отсутствия и досмотр", () => {
  const base = freshDoc();
  base.progress.lastActiveDate = dayKeyOf(at(10, 0, -40), "UTC");
  base.progress.streakCurrent = 10;
  base.progress.streakBest = 10;

  const started = apply(base, { type: "SESSION_START" }, {}, at(10, 0, 0));
  assert.equal(started.doc.flags.abyssPending, 1, "возвращение зафиксировано");
  assert.equal(started.doc.flags.absenceDays, 40);
  assert.equal(started.doc.progress.streakCurrent, 1, "40 дней — сброс серии");

  const doc = watchEpisode(started.doc, "abyss-t", "ep1", { start: at(11, 0, 0) });
  assert.equal(doc.flags.abyss, 1, "секрет закрыт досмотром серии");
  assert.equal(doc.flags.abyssPending, 0);
  assert.ok(doc.achievements.ach_secret_return?.unlockedAt, "достижение выдано");
  assert.ok(doc.tags.tag_void, "секретный тег выдан");
  assert.ok(
    doc.ledger.some((e) => e.idempotencyKey === "ACH:tester:ach_secret_return"),
    "награда достижения в журнале",
  );
});

/* ---------------------------- Просмотр серий ----------------------------- */

test("просмотр: серия открывается, засчитывается по heartbeat", () => {
  let doc = apply(
    freshDoc(),
    { type: "EPISODE_OPENED", titleId: "t1", episodeKey: "e1" },
    {},
    at(12, 0),
  ).doc;

  assert.equal(doc.counters.EPISODES_OPENED, 1);
  assert.ok(sessionOf(doc, "t1", "e1"), "сессия создана");
  assert.equal(sessionOf(doc, "t1", "e1").completedAt, undefined);
  assert.ok(doc.achievements.ach_start_first_anime?.unlockedAt, "«Первый шаг»");

  doc = watchEpisode(doc, "t1", "e1", { start: at(12, 1, 0) });

  const session = sessionOf(doc, "t1", "e1");
  assert.ok(session.completedAt, "серия засчитана");
  assert.equal(doc.counters.EPISODES_COMPLETED, 1);
  assert.equal(doc.counters.SECONDS_WATCHED, 480, "80% от 10-мин серии = 480 с");
  assert.ok(doc.achievements.ach_episodes_1?.unlockedAt, "«Первый просмотр»");
  assert.equal(doc.progress.xpTotal, 20 + 100 + 10 + 100, "20 тайтл + 100 + 10 + 100");
  assert.equal(doc.progress.level, 3);
  assert.equal(doc.progress.acBalance, 100 + 50 + 14 + 16, "достижения + AC за уровни 2–3");
});

test("просмотр: невидимая вкладка и скорость не засчитываются", () => {
  let doc = freshDoc();
  let t = at(12, 0);
  for (let i = 0; i < 20; i += 1) {
    t += 15_000;
    doc = apply(
      doc,
      {
        type: "EPISODE_TICK",
        titleId: "t9",
        episodeKey: "e1",
        seconds: 15,
        visible: false,
        speed: 1,
        durationSec: 600,
      },
      {},
      t,
    ).doc;
  }
  const hidden = sessionOf(doc, "t9", "e1");
  assert.equal(hidden.watchedSeconds, 0, "скрытая вкладка не копит время");

  t = at(13, 0);
  for (let i = 0; i < 40; i += 1) {
    t += 15_000;
    doc = apply(
      doc,
      {
        type: "EPISODE_TICK",
        titleId: "t9",
        episodeKey: "e1",
        seconds: 15,
        visible: true,
        speed: 5,
        durationSec: 600,
      },
      {},
      t,
    ).doc;
  }
  assert.equal(
    sessionOf(doc, "t9", "e1").watchedSeconds,
    0,
    `скорость выше ${cfg.watch.maxSpeed}× не засчитывается`,
  );
  assert.equal(doc.counters.EPISODES_COMPLETED ?? 0, 0);
});

test("просмотр: пауза дольше 60 с не идёт в зачёт", () => {
  let doc = apply(
    freshDoc(),
    {
      type: "EPISODE_TICK",
      titleId: "t8",
      episodeKey: "e1",
      seconds: 15,
      visible: true,
      speed: 1,
      durationSec: 600,
    },
    {},
    at(12, 0),
  ).doc;
  assert.equal(sessionOf(doc, "t8", "e1").watchedSeconds, 15);

  // пришли через 10 минут — зазор не начисляется
  doc = apply(
    doc,
    {
      type: "EPISODE_TICK",
      titleId: "t8",
      episodeKey: "e1",
      seconds: 15,
      visible: true,
      speed: 1,
      durationSec: 600,
    },
    {},
    at(12, 10),
  ).doc;
  assert.equal(
    sessionOf(doc, "t8", "e1").watchedSeconds,
    15,
    "сам зазор не считается, но текущий тик засчитан",
  );
});

test("просмотр: без duration берётся номинал 24 мин", () => {
  let doc = freshDoc();
  let t = at(14, 0);
  const required = Math.round(cfg.watch.nominalEpisodeSec * cfg.watch.requiredFraction);
  for (let i = 0; i < Math.ceil(required / 15) + 2; i += 1) {
    t += 15_000;
    doc = apply(
      doc,
      { type: "EPISODE_TICK", titleId: "t7", episodeKey: "e1", seconds: 15, visible: true, speed: 1 },
      {},
      t,
    ).doc;
  }
  assert.ok(sessionOf(doc, "t7", "e1")?.completedAt, "номинальный порог пройден");
  assert.ok(doc.counters.SECONDS_WATCHED >= required);
});

/* ------------------------------ Идемпотентность -------------------------- */

test("рейтинг: повторная оценка того же тайтла XP не даёт", () => {
  let doc = apply(freshDoc(), { type: "TITLE_RATED", titleId: "a", score: 8 }, {}, at(12, 0)).doc;
  assert.equal(doc.progress.xpTotal, 5);
  assert.equal(doc.counters.RATINGS, 1);

  doc = apply(doc, { type: "TITLE_RATED", titleId: "a", score: 10 }, {}, at(12, 1)).doc;
  assert.equal(doc.progress.xpTotal, 5, "изменение оценки не платит");
  assert.equal(doc.counters.RATINGS, 1, "счётчик — уникальные тайтлы");

  const bad = apply(doc, { type: "TITLE_RATED", titleId: "b", score: 0 }, {}, at(12, 2));
  assert.equal(bad.rejected?.reason, "score_out_of_range");
  assert.equal(bad.doc.progress.xpTotal, 5, "неверная оценка не начисляет");
  assert.ok(bad.doc.rejected.some((r) => r.reason === "score_out_of_range"));
});

test("списки: каждый тайтл один раз, счётчик-бакет для квестов", () => {
  let doc = apply(freshDoc(), { type: "LIST_ADD", list: "favorite", titleId: "t1" }, {}, at(12, 0)).doc;
  assert.equal(doc.progress.xpTotal, 5);
  assert.equal(doc.daily.counts.LIST_FAVORITE, 1);
  assert.equal(doc.daily.counts.LIST_ADD, 1, "бакет LIST_ADD");
  assert.equal(doc.daily.weekCounts.LIST_ADD, 1, "недельный бакет");

  doc = apply(doc, { type: "LIST_ADD", list: "favorite", titleId: "t1" }, {}, at(12, 1)).doc;
  assert.equal(doc.progress.xpTotal, 5, "тот же тайтл — без награды");

  doc = apply(doc, { type: "LIST_ADD", list: "planned", titleId: "t1" }, {}, at(12, 2)).doc;
  assert.equal(doc.progress.xpTotal, 8, "другой список — своё правило (3 XP)");
});

test("профиль: поля и завершение платятся один раз", () => {
  let doc = apply(freshDoc(), { type: "PROFILE_FIELD", field: "bio" }, {}, at(12, 0)).doc;
  assert.equal(doc.progress.xpTotal, 25);
  assert.equal(doc.daily.counts.PROFILE_FIELD, 1);

  doc = apply(doc, { type: "PROFILE_FIELD", field: "bio" }, {}, at(12, 1)).doc;
  assert.equal(doc.progress.xpTotal, 25, "то же поле — повторно без XP");

  doc = apply(doc, { type: "PROFILE_FIELD", field: "showcase" }, {}, at(12, 2)).doc;
  assert.equal(doc.progress.xpTotal, 45, "другое поле: 25 + 20");

  doc = apply(doc, { type: "PROFILE_COMPLETED" }, {}, at(12, 3)).doc;
  assert.equal(doc.progress.xpTotal, 145, "+100 за полный профиль");
});

test("external-метрики: избранное из стора разблокирует достижение", () => {
  const r = apply(
    freshDoc(),
    { type: "LIST_ADD", list: "favorite", titleId: "t1" },
    { DISTINCT_TITLES_IN_LISTS: 1 },
    at(12, 0),
  );
  assert.ok(r.doc.achievements.ach_collection_1?.unlockedAt, "метрика из стора учтена");
  assert.equal(r.doc.progress.xpTotal, 5 + 100, "5 за список + 100 за достижение");
});

/* -------------------------------- Soft-cap ------------------------------- */

test("soft-cap: 100% до предела, дальше доля, потолок 1500 не пройти", () => {
  const small = {
    ...cfg,
    softCap: { dailyXp: 100, overRate: 0.25, hardCap: 150 },
    rules: { ...cfg.rules, EP_COMPLETE: { ...cfg.rules.EP_COMPLETE, xp: 50 } },
  };

  let doc = freshDoc();
  for (let i = 0; i < 8; i += 1) {
    doc = watchEpisode(doc, `sc${i}`, "ep1", {
      start: at(10, 0) + i * 600_000,
      durationSec: 600,
      cfg: small,
    });
  }

  assert.equal(doc.counters.EPISODES_COMPLETED, 8, "все серии засчитаны");
  assert.equal(doc.daily.xpActivity, 150, "активность упёрлась в hardCap");
  assert.ok(doc.progress.xpTotal > 150, "EXEMPT-награды идут мимо капа");
  assert.ok(
    xpEffects(
      applyEvent(doc, { type: "TITLE_RATED", titleId: "zz", score: 9 }, {}, ctx(at(11, 30)), small)
        .effects,
    ).some((e) => e.reduced || e.credited === 0),
    "после капа новые активности режутся до 0",
  );
});

/* ------------------------------- Антиабьюз ------------------------------- */

test("rate-limit: больше 90 событий в минуту отсекается", () => {
  let doc = freshDoc();
  const start = at(12, 0);
  let last = null;
  for (let i = 0; i < 150; i += 1) {
    last = apply(doc, { type: "EASTER_EGG", target: "logo" }, {}, start + i * 10);
    doc = last.doc;
  }

  assert.equal(doc.flags["egg:logo"], 90, "приняты первые 90");
  assert.equal(doc.meta.events, 90, "отклонённые не считаются обработанными");
  assert.equal(last.rejected?.reason, "rate_limited");
  assert.equal(doc.rejected.length, 50, "антиабьюз-лог ограничен окном");
  assert.ok(doc.rejected.every((r) => r.reason === "rate_limited"));
});

test("откат часов назад отклоняется", () => {
  const first = apply(freshDoc(), { type: "EASTER_EGG", target: "logo" }, {}, at(12, 0));
  const rolled = apply(first.doc, { type: "EASTER_EGG", target: "logo" }, {}, at(11, 0));

  assert.equal(rolled.rejected?.reason, "clock_rollback");
  assert.equal(rolled.doc.flags["egg:logo"], 1, "событие в прошлое не применено");
});

test("выключение правила (лайки) не платит в режиме local", () => {
  const r = apply(freshDoc(), { type: "LIKE_GIVEN", commentId: "c1" }, {}, at(12, 0));
  assert.equal(r.doc.progress.xpTotal, 0, "LIKE_GIVEN выключен");
  assert.equal(r.doc.counters.LIKES_GIVEN, undefined, "даже счётчик не растёт");
});
