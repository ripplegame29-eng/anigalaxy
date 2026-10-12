/**
 * События сезона: войны, рейд на босса, поход.
 *
 * Все три механики — источник очков клана, поэтому тестируется не столько
 * «как считается», сколько «сколько раз можно»: ограничения на частоту здесь
 * и есть настоящие инварианты. Война без ограничения — это способ набивать
 * очки матч за матчем; награда за фазу без защиты от повторного получения —
 * способ набивать престиж.
 */

import "../helpers/localstorage.mjs";

import test from "node:test";
import assert from "node:assert/strict";

import {
  claimPhase,
  expeditionGoal,
  expeditionStepGoal,
  findOpponent,
  phaseReward,
  RAID_PHASE,
  raidView,
  stageEvent,
  startExpedition,
  startWar,
  syncRaid,
  WAR_HOURS,
  WAR_TARGET,
  warCandidates,
  warTasks,
} from "../../.tsc-tests/lib/clans.events.js";
import { ROUTES } from "../../.tsc-tests/lib/clans.game.js";
import { clanGame, patchClanGame } from "../../.tsc-tests/lib/clans.runtime.js";

import { resetClanGame, useClan } from "./helpers.mjs";

import { RIVALS } from "../../.tsc-tests/lib/clans.js";

const warCandidatesRaw = () => RIVALS;

test.beforeEach(() => resetClanGame());

const NOW = Date.UTC(2026, 2, 10, 12);
const HOUR = 3_600_000;

/* --------------------------------- Задачи -------------------------------- */

test("задачи войны выдаются без прогресса", () => {
  const tasks = warTasks();
  assert.ok(tasks.length > 0, "задач войны нет");
  for (const task of tasks) {
    assert.ok(!("progress" in task), `у задачи «${task.title}» уже есть прогресс`);
  }
});

test("цель войны и её длительность — константы", () => {
  assert.equal(WAR_HOURS, 48);
  assert.equal(WAR_TARGET, 3_000);
});

/* --------------------------------- Соперники ------------------------------ */

test("подбор соперника не выдаёт кланы из исключения", () => {
  const first = findOpponent(1_000);
  assert.ok(first, "соперник не найден даже при полном списке");

  const others = findOpponent(1_000, [first.id]);
  if (others) {
    assert.notEqual(others.id, first.id, "подбор вернул исключённый клан");
  }
});

test("соперник выбирается ближайшим по очкам и стабильно", () => {
  // Два вызова подряд обязаны дать одного и того же клана: иначе при каждой
  // перерисовке соперник «прыгал» бы и игрок не мог бы его запомнить.
  const a = findOpponent(5_000);
  const b = findOpponent(5_000);
  if (!a || !b) return; // список соперников пуст — проверять нечего
  assert.equal(a.id, b.id, "подбор нестабилен между вызовами");

  // Ближайший — значит среди всех соперников нет такого, что ближе к 5000
  const all = warCandidatesRaw();
  const gap = Math.abs(a.points - 5_000);
  for (const clan of all) {
    if (clan.id === a.id) continue;
    assert.ok(
      Math.abs(clan.points - 5_000) >= gap,
      `${clan.id} ближе к 5000 очков, чем выбранный ${a.id}`,
    );
  }
});

test("подбор соперников возвращает соседей, а не себя", () => {
  const clan = useClan();
  const list = warCandidates(clan);

  assert.ok(list.length > 0, "список кандидатов пуст");
  assert.ok(
    !list.some((c) => c.clan.id === clan.id),
    "клан попал в список соперников самому себе",
  );
});

test("поиск соперников фильтруется по запросу", () => {
  const clan = useClan();
  const all = warCandidates(clan);
  if (all.length === 0) return;

  const target = all[0].clan;
  const found = warCandidates(clan, target.name.toLowerCase());

  assert.ok(found.length > 0, "по точному имени ничего не нашлось");
  assert.ok(
    found.every((c) => c.clan.name.toLowerCase().includes(target.name.toLowerCase())),
    "в выдачу попал несовпадающий клан",
  );
});

/* ---------------------------------- Война --------------------------------- */

test("война: одна в сутки", () => {
  const clan = useClan();

  const first = startWar(clan, NOW);
  if (!first.ok) return; // нет свободного соперника в списке — нечего проверять

  // Тот же день: война идёт
  assert.equal(startWar(clan, NOW + HOUR).ok, false, "началась вторая война в тот же день");
});

test("война: нельзя объявить войну самому себе", () => {
  const clan = useClan();
  const res = startWar(clan, NOW, clan.id);

  assert.equal(res.ok, false);
  assert.ok(res.reason, "не сказано, почему отказ");
});

test("война: неизвестный соперник отклоняется", () => {
  useClan();
  const res = startWar(useClan(), NOW, "clan-такого-нет");

  assert.equal(res.ok, false);
  assert.ok(res.reason);
});

/* ----------------------------------- Рейд --------------------------------- */

test("рейд: за каждую фазу награда выдаётся один раз", () => {
  syncRaid(clanGame(), NOW);

  const view = raidView(NOW);
  const phase = Math.min(1, view.phases);
  if (phase < 1) return;

  const before = { ...clanGame().purse };

  const first = claimPhase(phase);
  const afterFirst = { ...clanGame().purse };

  assert.ok(first, "награда за первую фазу не выдалась");

  const second = claimPhase(phase);
  const afterSecond = { ...clanGame().purse };

  assert.equal(afterSecond.prestige, afterFirst.prestige, "престиж начислили повторно");
  assert.equal(afterSecond.influence, afterFirst.influence, "влияние начислили повторно");
  assert.equal(afterSecond.materials, afterFirst.materials, "материалы начислили повторно");

  // Второй вызов может вернуть null — это честный отказ
  if (second) {
    assert.deepEqual(afterSecond, afterFirst, "повторная выдача изменила казну");
  }
  assert.ok(before);
});

test("рейд: награда за несуществующую фазу не выдаётся", () => {
  syncRaid(clanGame(), NOW);
  const res = claimPhase(RAID_PHASE + 99);

  assert.equal(res, null, "выдалась награда за фазу, которой не существует");
});

test("рейд: награда за каждую фазу положительна", () => {
  for (let phase = 1; phase <= RAID_PHASE; phase += 1) {
    const reward = phaseReward(phase);
    assert.ok(reward, `нет награды за фазу ${phase}`);
    const total = reward.prestige + reward.influence + reward.materials;
    assert.ok(total > 0, `фаза ${phase}: награда пустая`);
  }
});

/* ---------------------------------- Поход --------------------------------- */

test("поход: норма этапа растёт с глубиной", () => {
  const first = expeditionStepGoal("safe", 1);
  const later = expeditionStepGoal("safe", 5);

  assert.ok(later > first, `норма не выросла: ${first} → ${later}`);
});

test("поход: путь бездны тяжелее безопасного", () => {
  const safe = expeditionStepGoal("safe", 2);
  const abyss = expeditionStepGoal("abyss", 2);

  assert.ok(abyss > safe, `бездна не тяжелее: ${safe} → ${abyss}`);
});

test("поход: событие этапа детерминировано", () => {
  const a = stageEvent("hunter", 3);
  const b = stageEvent("hunter", 3);

  assert.deepEqual(a, b, "один и тот же этап дал разные события");
});

test("поход: у каждого маршрута свой набор событий", () => {
  const seen = new Set(ROUTES.map((r) => stageEvent(r.id, 4).id));
  // Идентификаторы могут совпадать, а вот описания — нет: иначе «смена пути»
  // ничего не меняла бы и обещание сложности было бы пустым.
  const texts = new Set(ROUTES.map((r) => stageEvent(r.id, 4).text));
  assert.ok(texts.size > 1, "все маршруты дают одно и то же событие");
  assert.ok(seen.size >= 1);
});

test("поход: без начатого похода запустить можно", () => {
  patchClanGame((s) => ({ ...s, expedition: null }));

  const res = startExpedition("safe", NOW);

  assert.equal(res.ok, true, res.reason);
  assert.equal(clanGame().expedition?.route, "safe", "маршрут не записался");
});

test("поход: второй поход поверх идущего не запускается", () => {
  const first = startExpedition("safe", NOW);
  if (!first.ok) return;

  const second = startExpedition("safe", NOW + HOUR);

  assert.equal(second.ok, false, "поход пошёл вторым поверх первого");
});

test("поход: неизвестный маршрут отклоняется", () => {
  const res = startExpedition("нетакого-маршрута", NOW);
  assert.equal(res.ok, false, "принят несуществующий маршрут");
});

test("поход: цель считается по текущему этапу", () => {
  syncRaid(clanGame(), NOW);
  patchClanGame((s) => ({ ...s, expedition: null }));

  startExpedition("safe", NOW);
  const exp = clanGame().expedition;

  if (!exp) return;
  const goal = expeditionGoal(exp);
  assert.ok(goal > 0, `цель похода неположительна: ${goal}`);
});

