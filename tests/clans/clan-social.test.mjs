/**
 * Социальный слой клана: заявки, приглашения, номинации, реликвии.
 *
 * Модуль из 440 строк, где почти всё решается детерминированно по дню.
 * Поэтому главное, что тут стоит проверить, — именно детерминированность:
 * если игрок перезагрузит страницу, он должен увидеть тех же кандидатов, что
 * и минуту назад. Недетерминированная выборка выглядит как «всё сломалось».
 */

import test from "node:test";

import { makeClan, resetClanGame, useClan, WEEKDAY } from "./helpers.mjs";

test.beforeEach(() => resetClanGame());
import assert from "node:assert/strict";

import {
  acceptApplication,
  dailyApplications,
  declineApplication,
  grantRelic,
  memberCap,
  missingRelics,
  nominees,
  NOMINATIONS,
  RELICS,
  rosterRoom,
  syncApplications,
  voteNomination,
} from "../../.tsc-tests/lib/clans.social.js";
import { clanGame, patchClanGame } from "../../.tsc-tests/lib/clans.runtime.js";

/* --------------------------------- Места ---------------------------------- */

test("состав: вместимость растёт от дерева клана", () => {
  const game = clanGame();
  const base = memberCap(game);

  patchClanGame((s) => ({ ...s, tree: { ...s.tree, community: 3 } }));
  const grown = memberCap(clanGame());

  assert.ok(grown > base, `вместимость не выросла: ${base} → ${grown}`);
  assert.equal(grown - base, 6, "каждое дерево добавляет не 2 места");
});

test("состав: свободные места не уходят в минус", () => {
  const clan = makeClan();
  const room = rosterRoom(clan, clanGame());

  assert.ok(room >= 0, `свободных мест ${room}`);

  // Клан переполнен — должно быть 0, а не минус
  const packed = { ...clan, memberCount: 99, members: Array.from({ length: 40 }, (_, i) => ({ id: `m${i}`, name: `И${i}`, role: "member", contributed: 0, joinedAt: "2026-01-01" })) };
  assert.equal(rosterRoom(packed, clanGame()), 0, "переполненный клан дал отрицательные места");
});

/* --------------------------------- Заявки --------------------------------- */

test("заявки: выборка дня детерминирована", () => {
  const clan = makeClan();
  const game = clanGame();

  const first = dailyApplications(clan, game, WEEKDAY);
  const second = dailyApplications(clan, game, WEEKDAY);

  assert.deepEqual(
    first.map((a) => a.id),
    second.map((a) => a.id),
    "в один и тот же день пришли разные кандидаты",
  );
});

test("заявки: в разные дни кандидаты различаются", () => {
  const clan = makeClan();
  const game = clanGame();

  const monday = dailyApplications(clan, game, Date.UTC(2026, 2, 9, 12));
  const tuesday = dailyApplications(clan, game, WEEKDAY);

  assert.notDeepEqual(
    monday.map((a) => a.id),
    tuesday.map((a) => a.id),
    "каждый день приходят одинаковые кандидаты",
  );
});

test("заявки: кандидат не совпадает с действующим составом", () => {
  const clan = makeClan();
  const roster = new Set(clan.members.map((m) => m.name));
  const members = clan.members;

  const apps = dailyApplications({ ...clan, members }, clanGame(), WEEKDAY);

  for (const app of apps) {
    assert.ok(!roster.has(app.name), `в заявке ${app.name} — уже в составе`);
  }
});

test("заявки: после syncApplications кандидаты материализуются в состояние", () => {
  const clan = makeClan();

  const before = clanGame().applications.length;
  syncApplications(clan, WEEKDAY);
  const after = clanGame().applications.length;

  assert.ok(after >= before, "syncApplications уменьшил число заявок");
  assert.ok(
    clanGame().applications.every((a) => typeof a.id === "string" && a.id.length > 0),
    "в состоянии заявка без идентификатора",
  );
});

test("заявки: syncApplications дважды не дублирует", () => {
  const clan = makeClan();

  syncApplications(clan, WEEKDAY);
  const once = clanGame().applications.length;
  syncApplications(clan, WEEKDAY);
  const twice = clanGame().applications.length;

  assert.equal(twice, once, `повторный вызов добавил заявки: ${once} → ${twice}`);
});

test("заявки: принятая заявка попадает в состав и исчезает из списка", () => {
  // Кладём клан в стор: addMember смотрит в state.own, а не в аргумент.
  const clan = useClan();
  syncApplications(clan, WEEKDAY);

  const apps = clanGame().applications;
  assert.ok(apps.length > 0, `в этот день кандидатов нет: ${JSON.stringify(clanGame().applications)}`);

  const target = apps[0];
  const res = acceptApplication(target.id, clan, clanGame());

  assert.equal(res.ok, true, res.reason);
  assert.ok(
    !clanGame().applications.some((a) => a.id === target.id),
    "принятая заявка осталась в списке",
  );
});

test("заявки: отклонение убирает заявку из списка", () => {
  const clan = useClan();
  syncApplications(clan, WEEKDAY);

  const apps = clanGame().applications;
  assert.ok(apps.length > 0, "в этот день кандидатов нет");

  const target = apps[apps.length - 1];
  const res = declineApplication(target.id, clan);

  assert.equal(res.ok, true, res.reason);
  assert.ok(
    !clanGame().applications.some((a) => a.id === target.id),
    "отклонённая заявка осталась",
  );
});

test("заявки: неизвестную заявку не принять", () => {
  const clan = useClan();
  const res = acceptApplication("app-такой-нет", clan, clanGame());
  assert.equal(res.ok, false, "принята несуществующая заявка");
});

/* -------------------------------- Реликвии -------------------------------- */

test("реликвии: выдача работает один раз", () => {
  const relic = RELICS[0];

  const first = grantRelic(relic.id);
  const second = grantRelic(relic.id);

  assert.equal(first, true, "первая выдача не прошла");
  assert.equal(second, false, "реликвия выдана повторно");
  assert.equal(
    clanGame().collection.filter((r) => r.id === relic.id).length,
    1,
    "реликвия продублировалась в коллекции",
  );
});

test("реликвии: неизвестная реликвия не выдаётся", () => {
  assert.equal(grantRelic("relic-такой-нет"), false);
});

test("реликвии: счётчик недостающих уменьшается после находки", () => {
  const before = missingRelics(clanGame()).length;
  grantRelic(RELICS[0].id);
  const after = missingRelics(clanGame()).length;

  assert.equal(after, before - 1, `недостающих было ${before}, стало ${after}`);
});

test("реликвии: у каждой реликвии уникальный идентификатор", () => {
  const ids = RELICS.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, "идентификаторы реликвий повторяются");
});

/* -------------------------------- Номинации ------------------------------ */

test("номинации: игрока нельзя номинировать", () => {
  const clan = makeClan();
  const roster = nominees(clan);

  assert.ok(
    !roster.some((m) => m.isPlayer),
    "в номинанты попал игрок",
  );
});

test("номинации: каждый участник состава номинируется", () => {
  const clan = makeClan();
  clan.members = [
    ...clan.members,
    { id: "m1", name: "Первый", role: "member", contributed: 0, joinedAt: "2026-01-01" },
  ];

  const roster = nominees(clan);
  assert.equal(roster.length, 1, "номинантов неверное число");
  assert.equal(roster[0].name, "Первый");
});

test("номинации: один голос на номинацию, повтор меняет выбор", () => {
  const clan = makeClan();
  clan.members = [
    ...clan.members,
    { id: "m1", name: "Первый", role: "member", contributed: 0, joinedAt: "2026-01-01" },
    { id: "m2", name: "Второй", role: "member", contributed: 0, joinedAt: "2026-01-01" },
  ];

  const id = NOMINATIONS[0].id;
  assert.equal(voteNomination(id, "m1", clan).ok, true, "первый голос не принят");
  assert.equal(clanGame().nomination.votes[id], "m1");

  assert.equal(voteNomination(id, "m2", clan).ok, true, "смена голоса не принята");
  assert.equal(
    clanGame().nomination.votes[id],
    "m2",
    "голос не переключился — остались два голоса",
  );
});

test("номинации: за неизвестную номинацию не голосуют", () => {
  const clan = makeClan();
  assert.equal(voteNomination("nomination-такой-нет", "m1", clan).ok, false);
});

test("номинации: нельзя голосовать за того, кто не номинируется", () => {
  const clan = makeClan();
  const id = NOMINATIONS[0].id;

  // Игрок в номинанты не входит — голос за него обязан быть отклонён
  const res = voteNomination(id, "p1", clan);
  assert.equal(res.ok, false, "прошёл голос за игрока, который не номинируется");
});