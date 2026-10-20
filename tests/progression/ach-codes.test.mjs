/**
 * Коды достижений «Семья {N} — Титул {N}» (§коды, по макетам 1:1).
 *
 * Проверяем три вещи, на которых держится вся выгода от кодов:
 *   1. формат текста совпадает с макетами;
 *   2. лестница титулов дотягивается до последней ступени каждого семейства;
 *   3. цифра слева и справа одна и та же — иначе код перестаёт быть кодом.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { PROGRESSION_CONFIG } from "../../.tsc-tests/lib/progression/progression.config.js";
import { tierOf } from "../../.tsc-tests/lib/progression/achievements-view.js";
import {
  FAMILY_TITLES,
  achievementCode,
  achievementCodeShort,
  roman,
} from "../../.tsc-tests/lib/progression/achievement-codes.js";

const cfg = PROGRESSION_CONFIG;

test("римские цифры: I..X", () => {
  assert.equal(roman(1), "I");
  assert.equal(roman(4), "IV");
  assert.equal(roman(7), "VII");
  assert.equal(roman(10), "X");
});

test("формат кода — как в макетах", () => {
  assert.equal(achievementCode("night", 2).text, "Ночные серии II — Страж II");
  assert.equal(achievementCode("streak", 3).text, "Дней подряд III — Наставник III");
  assert.equal(achievementCode("episodes", 6).text, "Серии просмотра VI — Магистр VI");
  assert.equal(achievementCode("episodes", 7).text, "Серии просмотра VII — Архонт VII");
  assert.equal(achievementCode("streak", 4).text, "Дней подряд IV — Кицунэ IV");
});

test("короткий код — только левая часть", () => {
  assert.equal(achievementCodeShort("night", 2), "Ночные серии II");
});

test("лестница титулов дотягивается до последней ступени каждого семейства", () => {
  const lastTier = new Map();
  for (const def of cfg.achievements) {
    const tier = tierOf(cfg, def);
    const prev = lastTier.get(def.family) ?? 0;
    if (tier > prev) lastTier.set(def.family, tier);
  }
  for (const [family, tier] of lastTier) {
    const ladder = FAMILY_TITLES[family];
    assert.ok(ladder, `нет лестницы титулов для семейства «${family}»`);
    assert.ok(
      ladder.length >= tier,
      `в семействе «${family}» ${tier} ступеней, а титулов ${ladder.length}`,
    );
  }
});

test("у каждого достижения есть непустой титул, и цифры совпадают", () => {
  for (const def of cfg.achievements) {
    const tier = tierOf(cfg, def);
    const code = achievementCode(def.family, tier);
    assert.ok(code.title, `у «${def.id}» (${def.family}, ступень ${tier}) пустой титул`);
    const numerals = code.parts.filter((p) => p.roman).map((p) => p.text);
    assert.equal(numerals.length, 2, `у «${def.id}» ожидалось две римские цифры`);
    assert.equal(
      numerals[0],
      numerals[1],
      `у «${def.id}» цифры разошлись: ${code.text}`,
    );
  }
});

test("ступени идут подряд, без пропусков и повторов", () => {
  for (const family of new Set(cfg.achievements.map((d) => d.family))) {
    const tiers = cfg.achievements
      .filter((d) => d.family === family)
      .map((d) => tierOf(cfg, d))
      .sort((a, b) => a - b);
    const expected = tiers.map((_, i) => i + 1);
    assert.deepEqual(tiers, expected, `семейство «${family}»: ступени ${tiers}`);
  }
});