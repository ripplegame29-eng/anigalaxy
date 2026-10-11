import test from "node:test";
import assert from "node:assert/strict";

import {
  eraFor,
  levelAcReward,
  levelFromXp,
  levelProgress,
  totalXpFor,
  xpToNext,
} from "../../.tsc-tests/lib/progression/curve.js";
import { PROGRESSION_CONFIG } from "../../.tsc-tests/lib/progression/progression.config.js";

const cfg = PROGRESSION_CONFIG;

test("кривая: xpToNext(L) = round(base × L^exponent)", () => {
  assert.equal(xpToNext(1, cfg), 50);
  assert.equal(xpToNext(50, cfg), Math.round(50 * Math.pow(50, 1.2)));
  assert.equal(xpToNext(0, cfg), 0, "уровень вне диапазона не даёт XP");
  assert.equal(xpToNext(cfg.levels.maxLevel, cfg), 0, "maxLevel — потолок");
});

test("кривая: пороги монотонны, levelFromXp обратна", () => {
  assert.equal(totalXpFor(1, cfg), 0);
  for (let level = 2; level <= cfg.levels.maxLevel; level += 1) {
    assert.ok(
      totalXpFor(level, cfg) > totalXpFor(level - 1, cfg),
      `порог уровня ${level} больше предыдущего`,
    );
    assert.equal(levelFromXp(totalXpFor(level, cfg), cfg), level, `ровно на пороге — уровень ${level}`);
    assert.equal(
      levelFromXp(totalXpFor(level, cfg) - 1, cfg),
      level - 1,
      `на 1 XP меньше порога — уровень ${level - 1}`,
    );
  }
  assert.equal(levelFromXp(0, cfg), 1);
  assert.equal(levelFromXp(1e12, cfg), cfg.levels.maxLevel, "XP сверх максимума не ломает уровень");
});

test("кривая: ориентиры баланса из конфига (±5%)", () => {
  const l5 = totalXpFor(5, cfg);
  const l50 = totalXpFor(50, cfg);
  const l100 = totalXpFor(100, cfg);
  assert.ok(Math.abs(l5 - 620) <= 620 * 0.05, `ур.5 = ${l5}`);
  assert.ok(Math.abs(l50 - 121_500) <= 121_500 * 0.05, `ур.50 = ${l50}`);
  assert.ok(Math.abs(l100 - 564_600) <= 564_600 * 0.05, `ур.100 = ${l100}`);
});

test("уровни: levelProgress закрыт в 0…100 и согласован с кривой", () => {
  for (const xp of [0, 1, 49, 50, 617, 5_000, 100_000]) {
    const p = levelProgress(xp, cfg);
    assert.ok(p.percent >= 0 && p.percent <= 100, `percent=${p.percent} при xp=${xp}`);
    assert.equal(p.into + p.start, xp, "into + start = xp");
    assert.ok(p.left >= 0);
    assert.equal(p.level, levelFromXp(xp, cfg));
  }
  const max = levelProgress(1e12, cfg);
  assert.equal(max.percent, 100, "на максимуме бар полный");
});

test("эры: границы берутся из конфига", () => {
  assert.equal(eraFor(1, cfg).name, cfg.eras[0].name);
  for (let i = 0; i < cfg.eras.length; i += 1) {
    const era = cfg.eras[i];
    assert.equal(eraFor(era.from, cfg).name, era.name, `уровень ${era.from} — «${era.name}»`);
    if (i > 0) {
      assert.equal(
        eraFor(era.from - 1, cfg).name,
        cfg.eras[i - 1].name,
        `уровень ${era.from - 1} — предыдущая эра`,
      );
    }
  }
});

test("AC за уровень: база + за уровень + бонус каждый 10-й", () => {
  const e = cfg.economy;
  assert.equal(levelAcReward(1, cfg), e.levelAcBase + e.levelAcPerLevel);
  assert.equal(levelAcReward(9, cfg), e.levelAcBase + e.levelAcPerLevel * 9);
  assert.equal(
    levelAcReward(10, cfg),
    e.levelAcBase + e.levelAcPerLevel * 10 + e.levelAcEvery10,
    "десятый уровень даёт бонус",
  );
  assert.equal(levelAcReward(11, cfg), e.levelAcBase + e.levelAcPerLevel * 11);
  assert.equal(
    levelAcReward(100, cfg),
    e.levelAcBase + e.levelAcPerLevel * 100 + e.levelAcEvery10 * 10,
  );
});
