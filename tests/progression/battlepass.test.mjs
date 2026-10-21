/**
 * Юнит-тесты боевого пропуска (§15 ТЗ): кривая, конфиг наград,
 * идемпотентная выдача, премиум-гейт, дубли предметов, смена сезона.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { FRAMES } from "../../.tsc-tests/lib/cosmetics.js";
import { BATTLEPASS, bpCost, bpKey, bpLevelFromXp, bpLevelStatus, bpLineTotals, bpTotalFor } from "../../.tsc-tests/lib/battlepass/logic.js";
import { EMPTY_DOC, parseDoc } from "../../.tsc-tests/lib/progression/doc.js";
import { applyEvent } from "../../.tsc-tests/lib/progression/engine.js";
import { PROGRESSION_CONFIG } from "../../.tsc-tests/lib/progression/progression.config.js";
import { at, ctx, freshDoc } from "./helpers.mjs";

const EXTRAS_NONE = { premium: false, purchased: [] };
const EXTRAS_PREMIUM = { premium: true, purchased: [] };

/** Выдать пакет наград с заданным XP пропуска и контекстом */
function claim(doc, line, level, extras = EXTRAS_NONE, xpOverride) {
  const source = structuredClone(doc);
  if (xpOverride !== undefined) source.battlepass.xp = xpOverride;
  return applyEvent(
    source,
    { type: "BATTLEPASS_CLAIMED", line, level },
    {},
    ctx(at(12)),
    undefined,
    extras,
  );
}

const REWARD_LEVELS = [
  1, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15,
  16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
  28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
  40, 41, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52,
  53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64,
  65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76,
  77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88,
  89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 100,
];

/* ------------------------------ Кривая ---------------------------------- */

test("кривая: 100 уровней, стоимость растёт, потолок выдержан", () => {
  assert.equal(BATTLEPASS.maxLevel, 100);
  assert.equal(bpCost(1), BATTLEPASS.cost.base);
  assert.equal(bpCost(100), 0);

  let prev = 0;
  for (let level = 1; level < 100; level += 1) {
    const cost = bpCost(level);
    assert.ok(cost > prev, `уровень ${level}: стоимость должна расти`);
    prev = cost;
  }

  assert.equal(bpLevelFromXp(0), 1);
  assert.equal(bpLevelFromXp(bpTotalFor(100)), 100);
  assert.equal(bpLevelFromXp(10_000_000), 100);
  for (const level of REWARD_LEVELS) {
    assert.equal(bpLevelFromXp(bpTotalFor(level)), level, `порог уровня ${level}`);
  }
});

/* ---------------------------- Конфиг наград ----------------------------- */

test("конфиг: награды только на заданных уровнях, предметы реальные", () => {
  const levels = BATTLEPASS.levels.map((def) => def.level);
  assert.deepEqual([...levels].sort((a, b) => a - b), REWARD_LEVELS, "ровно 95 уровней наград");

  for (const def of BATTLEPASS.levels) {
    assert.ok(def.level >= 1 && def.level <= 100);
    for (const line of ["free", "premium"]) {
      const rewards = def[line];
      if (!rewards) continue;
      assert.ok(rewards.length > 0, `${line} L${def.level}: пустой пакет не должен существовать`);
      for (const reward of rewards) {
        if (reward.kind === "ac" || reward.kind === "bpXp") {
          assert.ok(reward.amount > 0, `${line} L${def.level}: сумма > 0`);
        } else {
          assert.ok(reward.dupeAc > 0, `${line} L${def.level}: компенсация за дубль > 0`);
        }
        if (reward.kind === "tag") {
          const tag = PROGRESSION_CONFIG.tags.find((item) => item.id === reward.itemId);
          assert.ok(tag, `тег ${reward.itemId} должен существовать в каталоге`);
          assert.equal(tag.enabled !== false, true);
        }
        if (reward.kind === "frame") {
          assert.ok(
            FRAMES.some((frame) => frame.id === reward.itemId),
            `рамка ${reward.itemId} должна существовать в гардеробе`,
          );
        }
        if (reward.kind === "framePick") {
          for (const id of reward.candidates) {
            assert.ok(
              FRAMES.some((frame) => frame.id === id),
              `кандидат ${reward.itemId ?? id} должен существовать`,
            );
          }
        }
      }
    }
    // на наградных уровнях есть хотя бы одна линия
    assert.ok(def.free || def.premium, `уровень ${def.level}: нет наград`);
  }

  // пустые уровни наград не создают
  for (const level of [2, 3, 11, 42, 99]) {
    const def = BATTLEPASS.levels.find((item) => item.level === level);
    assert.equal(def, undefined, `уровень ${level} не должен иметь наград`);
  }
});

test("состояния уровней (§4): LOCKED / CURRENT / REACHED / CLAIMABLE / COMPLETED", () => {
  const set = (keys) => new Set(keys);
  const key = (line, level) => bpKey(BATTLEPASS.seasonId, line, level);

  // уровень выше достигнутого — LOCKED
  assert.equal(bpLevelStatus(20, { xp: bpTotalFor(5), premium: false, claimed: set() }), "LOCKED");

  // текущий уровень без наград на доступных линиях — CURRENT
  assert.equal(bpLevelStatus(3, { xp: bpTotalFor(3), premium: false, claimed: set() }), "CURRENT");

  // достигнут, есть незабранная бесплатная награда — CLAIMABLE
  assert.equal(bpLevelStatus(5, { xp: bpTotalFor(5), premium: false, claimed: set() }), "CLAIMABLE");

  // достигнут, но доступна только премиум-награда без подписки — REACHED
  assert.equal(
    bpLevelStatus(5, {
      xp: bpTotalFor(5),
      premium: false,
      claimed: set([key("free", 5)]),
    }),
    "REACHED",
  );

  // всё доступное забрано, уровень позади текущего — COMPLETED
  assert.equal(
    bpLevelStatus(5, {
      xp: bpTotalFor(10),
      premium: true,
      claimed: set([key("free", 5), key("premium", 5)]),
    }),
    "COMPLETED",
  );

  // текущий уровень, всё забрано — CURRENT («вы здесь» важнее)
  assert.equal(
    bpLevelStatus(5, {
      xp: bpTotalFor(5),
      premium: true,
      claimed: set([key("free", 5), key("premium", 5)]),
    }),
    "CURRENT",
  );

  // с премиумом та же линия снова CLAIMABLE
  assert.equal(
    bpLevelStatus(5, { xp: bpTotalFor(5), premium: true, claimed: set([key("free", 5)]) }),
    "CLAIMABLE",
  );
});

test("баланс: премиум-ветка заметно ценнее бесплатной", () => {
  const free = bpLineTotals("free");
  const premium = bpLineTotals("premium");

  assert.ok(premium.ac > free.ac * 1.5, "AC премиум заметно больше");
  assert.ok(premium.bpXp > free.bpXp, "XP премиум больше");
  assert.ok(premium.items > free.items, "предметов премиум больше");
  assert.ok(free.ac > 0 && free.items > 0, "бесплатная ветка тоже ощутима");
});

/* ------------------------------ Выдача ---------------------------------- */

test("бесплатная награда выдаётся ровно один раз (идемпотентность)", () => {
  const doc = freshDoc();

  const first = claim(doc, "free", 1);
  assert.equal(first.rejected, undefined);
  assert.equal(first.doc.progress.acBalance, 100);
  const effect = first.effects.find((item) => item.type === "BATTLEPASS_CLAIMED");
  assert.ok(effect, "эффект выдачи должен вернуться");
  assert.equal(effect.ac, 100);
  assert.ok(first.doc.battlepass.claimed.includes(bpKey(BATTLEPASS.seasonId, "free", 1)));

  const again = claim(first.doc, "free", 1);
  assert.equal(again.rejected?.reason, "bp_already_claimed");
  assert.equal(again.doc.progress.acBalance, 100, "повтор не меняет баланс");
  assert.equal(again.effects.some((item) => item.type === "BATTLEPASS_CLAIMED"), false);
});

test("недостигнутый уровень — отказ, награда не выдаётся", () => {
  const res = claim(freshDoc(), "free", 5);
  assert.equal(res.rejected?.reason, "bp_level_locked");
  assert.equal(res.doc.progress.acBalance, 0);
  assert.equal(res.doc.battlepass.claimed.length, 0);
});

test("премиум-ветка без подписки недоступна, с подпиской — открывается", () => {
  const xp = bpTotalFor(10);

  const locked = claim(freshDoc(), "premium", 10, EXTRAS_NONE, xp);
  assert.equal(locked.rejected?.reason, "bp_premium_required");
  assert.equal(locked.doc.tags.tag_shadow_clan, undefined);

  const opened = claim(freshDoc(), "premium", 10, EXTRAS_PREMIUM, xp);
  assert.equal(opened.rejected, undefined);
  assert.ok(opened.doc.tags.tag_shadow_clan, "тег выдан в собрание документа");
  const effect = opened.effects.find((item) => item.type === "BATTLEPASS_CLAIMED");
  assert.deepEqual(effect.items, [{ id: "tag_shadow_clan", kind: "tag", duplicate: false }]);
});

test("XP сайта продвигает пропуск один в один", () => {
  const res = applyEvent(
    freshDoc(),
    { type: "LIST_ADD", titleId: "t-bp-1", list: "favorite" },
    {},
    ctx(at(12)),
  );
  const xpGain = res.effects
    .filter((item) => item.type === "XP_GAINED")
    .reduce((sum, item) => sum + item.credited, 0);
  assert.ok(xpGain > 0, "правило списка должно дать XP");
  assert.equal(res.doc.battlepass.xp, xpGain, "XP пропуска =credited XP сайта");
  assert.ok(res.doc.progress.xpTotal >= xpGain, "XP профиля не пострадал");
});

test("XP-награда пропуска начисляется в XP сезона, не в XP профиля", () => {
  const start = bpTotalFor(13);
  const res = claim(freshDoc(), "free", 13, EXTRAS_NONE, start);
  assert.equal(res.rejected, undefined);

  const effect = res.effects.find((item) => item.type === "BATTLEPASS_CLAIMED");
  assert.equal(effect.bpXp, 150);
  assert.equal(effect.xpAfter, start + 150);
  assert.equal(res.doc.battlepass.xp, start + 150);
  assert.equal(res.doc.progress.xpTotal, 0, "XP профиля не изменился");
  assert.equal(effect.levelAfter, bpLevelFromXp(start + 150));
});

test("дубль предмета → компенсация AC вместо выдачи", () => {
  const xp = bpTotalFor(20);

  // уже есть в гардеробе (куплено)
  const duplicate = claim(freshDoc(), "free", 20, { premium: false, purchased: ["frame-12"] }, xp);
  assert.equal(duplicate.rejected, undefined);
  assert.equal(duplicate.doc.progress.acBalance, 600, "компенсация по конфигу");
  const dupEffect = duplicate.effects.find((item) => item.type === "BATTLEPASS_CLAIMED");
  assert.equal(dupEffect.ac, 600);
  assert.equal(dupEffect.items[0].duplicate, true);
  assert.equal(
    duplicate.effects.some((item) => item.type === "ITEM_GRANTED"),
    false,
    "дубль не попадает в гардероб",
  );

  // предмета ещё нет — выдаётся настоящая рамка
  const fresh = claim(freshDoc(), "free", 20, EXTRAS_NONE, xp);
  const grant = fresh.effects.find((item) => item.type === "ITEM_GRANTED");
  assert.ok(grant, "рамка должна попасть в гардероб");
  assert.equal(grant.itemId, "frame-12");
  assert.equal(grant.kind, "frame");
  assert.equal(fresh.doc.progress.acBalance, 0, "AC без дубля не начисляется");
});

test("100-й уровень премиум: тег + AC + лучшая рамка магазина", () => {
  const xp = bpTotalFor(100);
  const res = claim(freshDoc(), "premium", 100, EXTRAS_PREMIUM, xp);
  assert.equal(res.rejected, undefined);

  assert.ok(res.doc.tags.tag_shogun, "«Шогун» выдан");
  // 2 500 — награда пакета; сверху набегают достижения, открытые попутно.
  // Раньше сумма совпадала с наградой, теперь нет: доведя пропуск до
  // последнего уровня, игрок проходит сезон и получает «Хранителя врат».
  // Поэтому сверяем по вкладу пакета, а не по итоговому балансу.
  const effect = res.effects.find((item) => item.type === "BATTLEPASS_CLAIMED");
  assert.equal(effect.ac, 2500);
  assert.ok(res.doc.progress.acBalance >= 2500, "баланс не меньше награды пакета");
  assert.ok(
    res.doc.achievements.ach_seasons_all?.unlockedAt,
    "100 уровней пропуска = пройденный сезон",
  );
  const frame = effect.items.find((item) => item.kind === "frame");
  assert.equal(frame?.id, "frame-18", "выбрана лучшая невыданная рамка");
  assert.equal(effect.items.filter((item) => item.kind === "tag").length, 1);

  // все рамки уже есть → компенсация
  const owned = claim(
    freshDoc(),
    "premium",
    100,
    { premium: true, purchased: ["frame-18", "frame-30", "frame-24", "frame-13"] },
    xp,
  );
  const ownedEffect = owned.effects.find((item) => item.type === "BATTLEPASS_CLAIMED");
  assert.equal(ownedEffect.ac, 2500 + 5000, "вместо рамки начислено 5000 AC");
  assert.equal(ownedEffect.items.find((item) => item.kind === "frame")?.duplicate, true);

  const again = claim(res.doc, "premium", 100, EXTRAS_PREMIUM, xp);
  assert.equal(again.rejected?.reason, "bp_already_claimed");
});

test("смена сезона очищает XP и отметки прошлого сезона", () => {
  const doc = freshDoc();
  doc.battlepass = { season: "season-0", xp: 99_999, claimed: ["season-0:free:1"] };

  const res = applyEvent(doc, { type: "SESSION_START" }, {}, ctx(at(12)));
  assert.equal(res.doc.battlepass.season, BATTLEPASS.seasonId);
  assert.deepEqual(res.doc.battlepass.claimed, []);

  const earned = res.effects
    .filter((item) => item.type === "XP_GAINED")
    .reduce((sum, item) => sum + item.credited, 0);
  assert.equal(res.doc.battlepass.xp, earned, "новый сезон стартует с чистого XP");
});

test("parseDoc доводит документ без раздела боевого пропуска", () => {
  const parsed = parseDoc(JSON.stringify({ schema: 1, progress: { userId: "x" } }));
  assert.ok(parsed);
  assert.equal(parsed.battlepass.season, BATTLEPASS.seasonId);
  assert.equal(parsed.battlepass.xp, 0);
  assert.deepEqual(parsed.battlepass.claimed, []);

  // битые поля вычищаются, валидные — сохраняются
  const dirty = parseDoc(
    JSON.stringify({
      schema: 1,
      battlepass: { season: "season-1", xp: -5, claimed: ["season-1:free:1", 42, null] },
    }),
  );
  assert.ok(dirty);
  assert.equal(dirty.battlepass.xp, 0);
  assert.deepEqual(dirty.battlepass.claimed, ["season-1:free:1"]);
});

test("пустой документ содержит раздел боевого пропуска", () => {
  assert.equal(EMPTY_DOC.battlepass.season, BATTLEPASS.seasonId);
  assert.equal(EMPTY_DOC.battlepass.xp, 0);
  assert.deepEqual(EMPTY_DOC.battlepass.claimed, []);
});

test("супер-приз 100 уровня: оформление профиля выдаётся один раз, дубль даёт AC", () => {
  const xp = bpTotalFor(100);

  const fresh = claim(freshDoc(), "premium", 100, EXTRAS_PREMIUM, xp);
  assert.equal(fresh.rejected, undefined);
  const grants = fresh.effects.filter((item) => item.type === "ITEM_GRANTED");
  assert.ok(
    grants.some((item) => item.itemId === "decor-hueco-mundo" && item.kind === "effect"),
    "оформление попадает в гардероб профиля",
  );
  const done = fresh.effects.find((item) => item.type === "BATTLEPASS_CLAIMED");
  assert.ok(done.items.some((item) => item.kind === "decor" && item.duplicate === false));

  const duplicate = claim(freshDoc(), "premium", 100, { premium: true, purchased: ["decor-hueco-mundo"] }, xp);
  assert.equal(duplicate.rejected, undefined);
  const dup = duplicate.effects.find((item) => item.type === "BATTLEPASS_CLAIMED");
  assert.ok(dup.items.some((item) => item.kind === "decor" && item.duplicate === true));
  assert.equal(
    duplicate.effects.some((item) => item.type === "ITEM_GRANTED" && item.itemId === "decor-hueco-mundo"),
    false,
    "дубль не выдаётся второй раз",
  );
});
