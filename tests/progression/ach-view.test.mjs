/**
 * Модель представления достижений (§12.2): ступени семейств, состояния,
 * режим «???» для секретов, ранги/сегменты, «самое редкое».
 */

import test from "node:test";
import assert from "node:assert/strict";

import { PROGRESSION_CONFIG } from "../../.tsc-tests/lib/progression/progression.config.js";
import {
  buildAchievements,
  familyChips,
  rankAt,
  rankSegment,
  rankToNext,
  rarestUnlocked,
  segmentFills,
  tierOf,
  unlockedLabel,
} from "../../.tsc-tests/lib/progression/achievements-view.js";
import { romanTier, tierBand, particlesFor } from "../../.tsc-tests/lib/progression/visual.js";
import { EMPTY_DOC } from "../../.tsc-tests/lib/progression/doc.js";

const cfg = PROGRESSION_CONFIG;

function doc() {
  return structuredClone(EMPTY_DOC);
}

const episodes = cfg.achievements.filter((item) => item.family === "episodes");
const secret = cfg.achievements.find((item) => item.hidden);

test("ступени: позиция в семействе 1..N, римская цифра и полоса цвета", () => {
  assert.equal(tierOf(cfg, episodes[0]), 1, "первая ступень семейства");
  assert.equal(tierOf(cfg, episodes[episodes.length - 1]), episodes.length, "последняя ступень");
  assert.equal(romanTier(1), "I");
  assert.equal(romanTier(10), "X");
  assert.equal(tierBand(1), 1, "I–III зелёный");
  assert.equal(tierBand(4), 2, "IV–VI синий");
  assert.equal(tierBand(7), 3, "VII–VIII фиолетовый");
  assert.equal(tierBand(9), 4, "IX–X золотой");
});

test("прогресс: locked → progress → unlocked, прогресс не выше порога", () => {
  const metric = episodes[0].condition.metric;
  const threshold = episodes[0].condition.threshold;

  const empty = buildAchievements(doc(), {}, cfg);
  const start = empty.find((item) => item.def.id === episodes[0].id);
  assert.equal(start.status, "locked", "без метрики — закрыто");
  assert.equal(start.percent, 0);

  const half = buildAchievements(doc(), { [metric]: threshold }, cfg);
  const part = half.find((item) => item.def.id === episodes[0].id);
  assert.equal(part.status, "progress", "метрика есть — в процессе");
  assert.equal(part.progress, threshold, "прогресс равен порогу");
  assert.equal(part.percent, 100);

  const done = doc();
  done.achievements[episodes[0].id] = { progress: threshold, unlockedAt: 1_700_000_000_000 };
  const unlocked = buildAchievements(done, { [metric]: 0 }, cfg);
  const got = unlocked.find((item) => item.def.id === episodes[0].id);
  assert.equal(got.status, "unlocked", "разблокировка важнее метрики");
  assert.equal(got.unlockedAt, 1_700_000_000_000);
  assert.equal(unlockedLabel(got.unlockedAt).length > 0, true, "дата по-русски");
});

test("секреты: до получения показываются как «???»", () => {
  const before = buildAchievements(doc(), {}, cfg);
  const hidden = before.find((item) => item.def.id === secret.id);
  assert.equal(hidden.disguised, true, "неполученный секрет скрыт");
  assert.equal(hidden.familyLabel, "Тайные знаки");

  const after = doc();
  after.achievements[secret.id] = { progress: 1, unlockedAt: 1_700_000_000_000 };
  const shown = buildAchievements(after, {}, cfg);
  assert.equal(shown.find((item) => item.def.id === secret.id).disguised, false, "после получения видно");
});

test("фильтры: семейства в порядке конфига, секреты отдельно", () => {
  const items = buildAchievements(doc(), {}, cfg);
  const chips = familyChips(items, false);
  assert.equal(
    chips.some((chip) => chip.id === "secret"),
    false,
    "секреты не в общих фильтрах",
  );
  assert.equal(chips.find((chip) => chip.id === "episodes").count, episodes.length);
  assert.equal(familyChips(items, true).some((chip) => chip.id === "secret"), true);
});

test("ранги: порог, сегмент и остаток до следующего ранга", () => {
  assert.equal(rankAt(0, cfg).name, cfg.ranks[0].name, "до первого порога — первый ранг");
  assert.equal(rankAt(1, cfg).name, cfg.ranks[0].name);
  const mid = cfg.ranks[1].from;
  assert.equal(rankAt(mid, cfg).name, cfg.ranks[1].name, "ровно на пороге — второй ранг");
  assert.equal(rankAt(1e9, cfg).next, null, "верхний ранг без следующего");
  assert.equal(rankToNext(1e9, cfg), 0);

  assert.equal(rankSegment(0, cfg), 0, "негативный сегмент зажат в 0");
  assert.equal(rankSegment(mid, cfg), 0, "сразу после ранга сегмент с нуля");
  assert.equal(rankSegment(cfg.ranks[0].from, cfg), 0);

  const fills = segmentFills(25);
  assert.equal(fills.length, 10, "10 сегментов");
  assert.equal(fills[0], 100);
  assert.equal(fills[2], 50, "третий сегмент наполовину");
  assert.equal(fills[9], 0);
  assert.deepEqual(segmentFills(-5).every((v) => v === 0), true);
  assert.deepEqual(segmentFills(100).every((v) => v === 100), true);
});

test("самое редкое: сортировка по редкости, затем по трофеям, с лимитом", () => {
  const mk = (id, rarity, trophy) => ({
    def: { id, rarity, trophy },
    family: "x",
    familyLabel: "x",
    tier: 1,
    status: "unlocked",
    progress: 1,
    percent: 100,
    unlockedAt: 1,
    disguised: false,
  });
  const items = [
    mk("a", "COMMON", 10),
    mk("b", "SECRET", 100),
    mk("c", "LEGENDARY", 400),
    mk("d", "LEGENDARY", 500),
    mk("e", "MYTHIC", 300),
    mk("f", "RARE", 60),
  ];
  const locked = mk("g", "MYTHIC", 1000);
  locked.status = "locked";

  const rare = rarestUnlocked([locked, ...items], 4);
  assert.deepEqual(
    rare.map((item) => item.def.id),
    ["b", "e", "d", "c"],
    "секрет → мифик → легендарные по трофеям; закрытые не участвуют",
  );
});

test("частицы детерминированы: одинаковый id → одинаковые значения", () => {
  const first = particlesFor("tag_god", 16);
  const second = particlesFor("tag_god", 16);
  assert.equal(first.length, 16, "лимит 16 частиц");
  assert.deepEqual(first, second, "нет Math.random — рендер стабилен");
  assert.notDeepEqual(first, particlesFor("tag_void", 16), "разные теги — разные точки");
  assert.equal(particlesFor("tag_void", 99).length, 16, "сверх бюджета обрезается");
});
