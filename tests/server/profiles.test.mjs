import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeUser } from "./helpers.mjs";
import { publicProfile } from "../../.tsc-tests/lib/server/profiles.js";

test("публичный профиль: новичок, место по опыту, регистр ника, неизвестный", () => {
  const db = freshDb();
  const a = makeUser(db, "Alice");
  const b = makeUser(db, "Bob");
  db.prepare("INSERT INTO player_stats (user_id, xp_total, level) VALUES (?, ?, ?)").run(a.id, 500, 3);
  db.prepare("INSERT INTO player_stats (user_id, xp_total, level) VALUES (?, ?, ?)").run(b.id, 900, 5);

  const alice = publicProfile(db, "alice");
  assert.equal(alice?.nickname, "Alice");
  assert.equal(alice?.level, 3);
  assert.equal(alice?.rank, 2);
  assert.equal(alice?.premium, false);
  assert.equal(alice?.clan, null);
  assert.equal(publicProfile(db, "Bob")?.rank, 1);

  const c = makeUser(db, "Newbie");
  const fresh = publicProfile(db, "Newbie");
  assert.equal(fresh?.level, 1);
  assert.equal(fresh?.rank, null);
  assert.ok(c.id);

  assert.equal(publicProfile(db, "Nobody"), null);
  assert.equal(publicProfile(db, "   "), null);
});
