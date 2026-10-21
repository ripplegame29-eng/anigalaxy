/** Задания сезона: награда выдаётся один раз, только за выполненное, с множителем Premium. */
import test from "node:test";
import assert from "node:assert/strict";

import { BP_MISSIONS } from "../../.tsc-tests/lib/battlepass/config.js";
import { applyEvent } from "../../.tsc-tests/lib/progression/engine.js";
import { at, ctx, freshDoc } from "./helpers.mjs";

const acFromQuest = (res) =>
  res.effects.filter((e) => e.type === "AC_GAINED" && e.source === "QUEST").reduce((n, e) => n + e.amount, 0);

const claim = (doc, id, mult = 1) =>
  applyEvent(doc, { type: "BP_MISSION_CLAIMED", missionId: id }, {}, ctx(at(12)), undefined, undefined, mult);

test("каждое задание сезона имеет награду", () => {
  for (const m of BP_MISSIONS) assert.ok(m.ac > 0 && m.xp > 0, m.id);
});

test("награда за выполненное задание выдаётся один раз", () => {
  const mission = BP_MISSIONS.find((m) => m.kind === "bpXp");
  const doc = freshDoc();
  doc.battlepass.xp = mission.target;
  const before = doc.progress.acBalance;

  const first = claim(doc, mission.id);
  assert.equal(first.rejected, undefined);
  assert.equal(acFromQuest(first), mission.ac);
  assert.ok(first.doc.progress.acBalance >= before + mission.ac);
  assert.ok(first.doc.battlepass.missions.includes(mission.id));

  const again = claim(first.doc, mission.id);
  assert.equal(again.rejected?.reason, "mission_already_claimed");
  assert.equal(again.doc.progress.acBalance, first.doc.progress.acBalance);
});

test("невыполненное и неизвестное задание отклоняются", () => {
  const mission = BP_MISSIONS[BP_MISSIONS.length - 1];
  const early = claim(freshDoc(), mission.id);
  assert.equal(early.rejected?.reason, "mission_not_done");
  assert.equal(claim(freshDoc(), "nope").rejected?.reason, "mission_not_found");
});

test("Premium удваивает награду за задание", () => {
  const mission = BP_MISSIONS.find((m) => m.kind === "bpXp");
  const doc = freshDoc();
  doc.battlepass.xp = mission.target;
  const res = claim(doc, mission.id, 2);
  assert.equal(acFromQuest(res), mission.ac * 2);
});
