import test from "node:test";
import assert from "node:assert/strict";

import {
  EMPTY_DOC,
  PROGRESS_KEY,
  PROGRESS_SCHEMA,
  parseDoc,
} from "../../.tsc-tests/lib/progression/doc.js";
import {
  LEGACY_KEYS,
  markMigrated,
  migrateLegacy,
  needsMigration,
} from "../../.tsc-tests/lib/progression/migrate.js";
import { levelFromXp } from "../../.tsc-tests/lib/progression/curve.js";
import { PROGRESSION_CONFIG } from "../../.tsc-tests/lib/progression/progression.config.js";
import { dayKeyOf } from "../../.tsc-tests/lib/progression/time.js";

const cfg = PROGRESSION_CONFIG;
const NOW = Date.UTC(2026, 2, 10, 12, 0);

function legacyStore() {
  const map = new Map();
  map.set(
    LEGACY_KEYS.profile,
    JSON.stringify({
      xp: 1200,
      coins: 450,
      streak: 6,
      claimed: ["episodes-100", "day-3", "unknown-legacy-id"],
      avatar: "data:image/png;base64,xxx",
      bio: "Старый био",
      purchased: ["f-ice"],
      frameId: "f-ice",
      titleId: "t-elder",
      backgroundId: "preset-neon",
    }),
  );
  map.set(
    LEGACY_KEYS.history,
    JSON.stringify({
      seconds: 7200,
      records: [
        { id: 29315, season: 1, episode: 1, at: Date.UTC(2026, 1, 1, 12, 0) },
        { id: 29315, season: 1, episode: 2, at: Date.UTC(2026, 1, 1, 13, 0) },
        { id: 29316, season: 1, episode: 1, at: Date.UTC(2026, 1, 2, 12, 0) },
        // повторное открытие той же серии — не считается новой
        { id: 29315, season: 1, episode: 1, at: Date.UTC(2026, 1, 2, 12, 30) },
      ],
    }),
  );
  map.set(
    LEGACY_KEYS.account,
    JSON.stringify({ nickname: "tester", createdAt: 1_700_000_000_000 }),
  );
  map.set(LEGACY_KEYS.favorites, JSON.stringify(["a", "b"]));
  return map;
}

test("миграция: XP/AC/серия/пользователь переносятся 1:1", () => {
  const store = legacyStore();
  const doc = migrateLegacy({ read: (k) => store.get(k) ?? null, now: NOW, tz: "UTC" }, cfg);

  assert.ok(doc, "документ построен");
  assert.equal(doc.progress.xpTotal, 1200, "xp → xpTotal");
  assert.equal(doc.progress.acBalance, 450, "coins → acBalance (курс 1:1)");
  assert.equal(doc.progress.streakCurrent, 6);
  assert.equal(doc.progress.streakBest, 6);
  assert.equal(doc.progress.level, levelFromXp(1200, cfg), "уровень — по новой кривой §5");
  assert.equal(doc.progress.userId, "tester");
  assert.equal(doc.progress.createdAt, 1_700_000_000_000);
  assert.equal(doc.progress.tz, "UTC");
  assert.equal(doc.schema, PROGRESS_SCHEMA);
});

test("миграция: история → счётчики без накрутки досмотра", () => {
  const store = legacyStore();
  const doc = migrateLegacy({ read: (k) => store.get(k) ?? null, now: NOW, tz: "UTC" }, cfg);

  assert.equal(doc.counters.SECONDS_WATCHED, 7200, "секунды у плеера");
  assert.equal(doc.counters.EPISODES_OPENED, 3, "уникальные серии (повтор не в счёт)");
  assert.equal(doc.counters.DISTINCT_DAYS, 6, "не меньше серии");
  assert.equal(
    doc.progress.lastActiveDate,
    dayKeyOf(Date.UTC(2026, 1, 2, 12, 30), "UTC"),
    "последняя активность — реальный день истории (для секрета «бездна»)",
  );
  assert.equal(doc.counters.EPISODES_COMPLETED, undefined, "досмотр задним числом не накручивается");
});

test("миграция: старые достижения → migrated без повторной награды", () => {
  const store = legacyStore();
  const doc = migrateLegacy({ read: (k) => store.get(k) ?? null, now: NOW, tz: "UTC" }, cfg);

  const ep = doc.achievements.ach_episodes_100;
  assert.ok(ep, "episodes-100 → ach_episodes_100");
  assert.equal(ep.unlockedAt, NOW);
  assert.equal(ep.migrated, true);
  assert.equal(doc.achievements.ach_streak_3.migrated, true, "day-3 → ach_streak_3");

  assert.ok(!doc.achievements.ach_start_account, "account-7 не был в claimed");
  assert.ok(!doc.achievements.ach_collection_1, "fav-1 не был в claimed");
  assert.equal(
    doc.progress.trophyPoints,
    cfg.achievements.find((a) => a.id === "ach_episodes_100").trophy +
      cfg.achievements.find((a) => a.id === "ach_streak_3").trophy,
    "трофеи перенесённых достижений суммируются",
  );
  assert.equal(doc.ledger.length, 0, "миграция не платит наград — только перенос");
});

test("миграция: теги за уровень и экипировка", () => {
  const store = legacyStore();
  const doc = migrateLegacy({ read: (k) => store.get(k) ?? null, now: NOW, tz: "UTC" }, cfg);

  assert.ok(doc.tags.tag_otaku, "уровень 6 ≥ 5 → тег за уровень выдан");
  assert.equal(doc.tags.tag_otaku.source, "level");
  assert.equal(doc.progress.equippedTagId, "tag_otaku", "первый доступный тег экипирован");
  assert.ok(!doc.tags.tag_sensei, "тег за 10 уровень не выдан");
});

test("миграция: косметика и подписи не трогаются", () => {
  const store = legacyStore();
  const before = store.get(LEGACY_KEYS.profile);
  const doc = migrateLegacy({ read: (k) => store.get(k) ?? null, now: NOW, tz: "UTC" }, cfg);

  assert.equal(store.get(LEGACY_KEYS.profile), before, "старый профиль не перезаписан");
  assert.ok(doc, "документ построен");
  assert.ok(!("purchased" in doc.progress), "покупки остаются в профиле");
});

test("миграция: флаг и идемпотентность", () => {
  const store = legacyStore();
  const read = (k) => store.get(k) ?? null;
  const doc = migrateLegacy({ read, now: NOW, tz: "UTC" }, cfg);

  assert.equal(doc.meta.migrated, true);
  assert.equal(needsMigration(doc), false, "повторно не мигрирует");
  assert.equal(needsMigration(structuredClone(EMPTY_DOC)), true, "пустой документ требует миграции");

  const marked = markMigrated(structuredClone(EMPTY_DOC));
  assert.equal(marked.meta.migrated, true);
  assert.equal(markMigrated(marked), marked, "повторный вызов не создаёт новый объект");
});

test("миграция: нечего мигрировать → null", () => {
  const read = () => null;
  assert.equal(migrateLegacy({ read, now: NOW, tz: "UTC" }, cfg), null);
});
