import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeUser } from "./helpers.mjs";
import { buildProfileView } from "../../.tsc-tests/lib/server/profile-view.js";

function putDoc(db, userId, key, value) {
  db.prepare("INSERT INTO user_docs (user_id, doc_key, value, version, updated_at) VALUES (?, ?, ?, 1, 1)").run(
    userId,
    key,
    JSON.stringify(value),
  );
}

test("чужой профиль: белый список, личное вырезано, аккаунт собран из базы", () => {
  const db = freshDb();
  const owner = makeUser(db, "Owner");
  putDoc(db, owner.id, "animehub:profile:v1", {
    bio: "привет",
    coins: 999,
    gifts: [{ id: 1 }],
    blacklist: ["x"],
    notices: [{ id: 1 }],
    privacy: { scope: "public", showComments: true },
    comments: [{ id: "c" }],
  });
  putDoc(db, owner.id, "animehub:progress:v1", { progress: { xpTotal: 10, acBalance: 500 }, sessions: [1] });
  putDoc(db, owner.id, "animehub:friends:v1", [{ nick: "secret" }]);

  const res = buildProfileView(db, "owner", null);
  assert.equal(res.ok, true);
  const profile = JSON.parse(res.data["animehub:profile:v1"]);
  assert.equal(profile.bio, "привет");
  assert.equal(profile.coins, 0);
  assert.deepEqual(profile.gifts, []);
  assert.deepEqual(profile.blacklist, []);
  assert.equal(profile.comments.length, 1);
  const progress = JSON.parse(res.data["animehub:progress:v1"]);
  assert.equal(progress.progress.acBalance, 0);
  assert.equal(progress.progress.xpTotal, 10);
  assert.equal(progress.sessions, undefined);
  assert.equal(res.data["animehub:friends:v1"], undefined);
  const account = JSON.parse(res.data["animehub:account:v1"]);
  assert.equal(account.nickname, "Owner");
  assert.equal(account.passHash, "-");
});

test("приватность: закрытый и «для друзей» профили, владелец видит свой", () => {
  const db = freshDb();
  const a = makeUser(db, "Closed");
  const b = makeUser(db, "Friendly");
  const viewer = makeUser(db, "Viewer");
  putDoc(db, a.id, "animehub:profile:v1", { privacy: { scope: "private" } });
  putDoc(db, b.id, "animehub:profile:v1", { privacy: { scope: "friends" } });

  assert.deepEqual(buildProfileView(db, "Closed", viewer.id).ok, false);
  assert.equal(buildProfileView(db, "Closed", viewer.id).reason, "closed");
  assert.equal(buildProfileView(db, "Closed", a.id).ok, true);
  assert.equal(buildProfileView(db, "Friendly", null).reason, "closed");
  assert.equal(buildProfileView(db, "Friendly", viewer.id).reason, "closed");

  db.prepare("INSERT INTO friendships (user_id, friend_id, status, created_at) VALUES (?, ?, 'accepted', 1)").run(
    viewer.id,
    b.id,
  );
  assert.equal(buildProfileView(db, "Friendly", viewer.id).ok, true);

  assert.equal(buildProfileView(db, "Nobody", viewer.id).reason, "missing");
  const bare = buildProfileView(db, "Viewer", null);
  assert.equal(bare.ok, true);
});
