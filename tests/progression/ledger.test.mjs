import test from "node:test";
import assert from "node:assert/strict";

import {
  LEDGER_WINDOW,
  appendEntry,
  confirmDue,
  entryKey,
  findEntries,
  hasKey,
} from "../../.tsc-tests/lib/progression/ledger.js";

function entry(patch = {}) {
  return {
    id: "e1",
    currency: "XP",
    type: "TEST",
    source: "TEST",
    amount: 10,
    status: "confirmed",
    idempotencyKey: "K",
    createdAt: 0,
    ...patch,
  };
}

test("журнал: ключи XP и AC раздельны", () => {
  assert.equal(entryKey("K", "XP"), "K");
  assert.equal(entryKey("K", "AC"), "K:ac");

  const doc = { ledger: [entry({ idempotencyKey: entryKey("K", "XP") })] };
  assert.ok(hasKey(doc, "K", "XP"), "XP-награда найдена");
  assert.ok(!hasKey(doc, "K", "AC"), "AC-награда ещё не выдана");
  assert.ok(!hasKey(doc, "OTHER", "XP"), "чужой ключ не находится");
});

test("журнал: append-only с ограничением окна", () => {
  const doc = { ledger: [] };
  for (let i = 0; i < LEDGER_WINDOW + 70; i += 1) {
    appendEntry(doc, entry({ id: `e${i}`, idempotencyKey: `k${i}` }));
  }
  assert.equal(doc.ledger.length, LEDGER_WINDOW, "окно ограничено");
  assert.equal(doc.ledger[0].id, "e70", "вытесняются самые старые");
  assert.equal(doc.ledger.at(-1).id, `e${LEDGER_WINDOW + 69}`, "новые — в конец");
});

test("журнал: pending подтверждается по сроку", () => {
  const doc = {
    ledger: [
      entry({ id: "p", status: "pending", metadata: { confirmAt: 1_000 } }),
      entry({ id: "c", status: "confirmed", metadata: { confirmAt: 1_000 } }),
      entry({ id: "n", status: "pending" }),
    ],
  };
  assert.equal(confirmDue(doc, 999), 0, "раньше срока — не подтверждаем");
  assert.equal(doc.ledger[0].status, "pending");
  assert.equal(confirmDue(doc, 1_000), 1, "ровно в срок");
  assert.equal(doc.ledger[0].status, "confirmed");
  assert.equal(doc.ledger[1].status, "confirmed", "подтверждённые не трогаем");
  assert.equal(doc.ledger[2].status, "pending", "без срока — не подтверждается");
  assert.equal(confirmDue(doc, 2_000), 0, "повторный проход идемпотентен");
});

test("журнал: findEntries фильтрует по метаданным", () => {
  const doc = {
    ledger: [
      entry({ id: "a", metadata: { commentId: "c1" } }),
      entry({ id: "b", metadata: { commentId: "c2" } }),
      entry({ id: "c" }),
    ],
  };
  const found = findEntries(doc, (e) => e.metadata?.commentId === "c1");
  assert.equal(found.length, 1);
  assert.equal(found[0].id, "a");
});
