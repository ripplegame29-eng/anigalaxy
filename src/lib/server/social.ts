/**
 * Социальный слой: комментарии, друзья, оценки, жалобы и уведомления.
 */

import { num, str, transaction, type Database } from "./sqlite";

export type SocialResult<T> = { ok: true; value: T } | { ok: false; error: string; code: string };

function fail<T>(error: string, code: string): SocialResult<T> {
  return { ok: false, error, code };
}

const MAX_COMMENT = 2000;
const TITLE_ID_RE = /^[A-Za-z0-9._:-]{1,80}$/;

/* ----------------------------- Комментарии ----------------------------- */

export interface CommentView {
  id: number;
  titleId: string;
  userId: number;
  nickname: string;
  parentId: number | null;
  body: string;
  createdAt: number;
  editedAt: number;
  score: number;
  myVote: number;
}

export function addComment(
  db: Database,
  userId: number,
  input: { titleId: string; body: string; parentId?: number | null },
  now = Date.now(),
): SocialResult<number> {
  const body = input.body.trim();
  if (!TITLE_ID_RE.test(input.titleId)) return fail("Некорректный тайтл", "invalid");
  if (body.length < 1) return fail("Напишите комментарий", "invalid");
  if (body.length > MAX_COMMENT) return fail(`Комментарий — не длиннее ${MAX_COMMENT} символов`, "invalid");

  const parentId = input.parentId ?? null;
  if (parentId !== null) {
    const parent = db.prepare("SELECT title_id FROM comments WHERE id = ? AND deleted = 0").get(parentId);
    if (!parent || str(parent.title_id) !== input.titleId) return fail("Комментарий для ответа не найден", "not_found");
  }
  // Защита от спама: не чаще 5 комментариев в минуту
  const recent = num(
    db.prepare("SELECT COUNT(*) AS c FROM comments WHERE user_id = ? AND created_at > ?").get(userId, now - 60_000)?.c,
  );
  if (recent >= 5) return fail("Слишком часто — подождите минуту", "rate_limit");

  const info = db
    .prepare("INSERT INTO comments (title_id, user_id, parent_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(input.titleId, userId, parentId, body, now);
  return { ok: true, value: num(info.lastInsertRowid) };
}

export function listComments(db: Database, titleId: string, viewerId: number | null, limit = 100): CommentView[] {
  return db
    .prepare(
      `SELECT c.*, u.nickname AS nickname,
              COALESCE((SELECT SUM(value) FROM comment_votes v WHERE v.comment_id = c.id), 0) AS score,
              COALESCE((SELECT value FROM comment_votes v WHERE v.comment_id = c.id AND v.user_id = ?), 0) AS my_vote
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.title_id = ? AND c.deleted = 0
       ORDER BY c.id DESC LIMIT ?`,
    )
    .all(viewerId ?? 0, titleId, Math.min(Math.max(limit, 1), 300))
    .map((row) => ({
      id: num(row.id),
      titleId: str(row.title_id),
      userId: num(row.user_id),
      nickname: str(row.nickname),
      parentId: row.parent_id === null ? null : num(row.parent_id),
      body: str(row.body),
      createdAt: num(row.created_at),
      editedAt: num(row.edited_at),
      score: num(row.score),
      myVote: num(row.my_vote),
    }));
}

/** Удалить комментарий: автор или модератор/админ */
export function deleteComment(db: Database, userId: number, role: string, commentId: number): SocialResult<true> {
  const row = db.prepare("SELECT user_id FROM comments WHERE id = ? AND deleted = 0").get(commentId);
  if (!row) return fail("Комментарий не найден", "not_found");
  if (num(row.user_id) !== userId && role !== "admin" && role !== "moderator") {
    return fail("Недостаточно прав", "forbidden");
  }
  db.prepare("UPDATE comments SET deleted = 1 WHERE id = ?").run(commentId);
  return { ok: true, value: true };
}

export function voteComment(db: Database, userId: number, commentId: number, value: number): SocialResult<number> {
  if (value !== 1 && value !== -1 && value !== 0) return fail("Некорректный голос", "invalid");
  const row = db.prepare("SELECT user_id FROM comments WHERE id = ? AND deleted = 0").get(commentId);
  if (!row) return fail("Комментарий не найден", "not_found");
  if (num(row.user_id) === userId) return fail("За свой комментарий голосовать нельзя", "forbidden");
  if (value === 0) {
    db.prepare("DELETE FROM comment_votes WHERE comment_id = ? AND user_id = ?").run(commentId, userId);
  } else {
    db.prepare(
      `INSERT INTO comment_votes (comment_id, user_id, value) VALUES (?, ?, ?)
       ON CONFLICT(comment_id, user_id) DO UPDATE SET value = excluded.value`,
    ).run(commentId, userId, value);
  }
  const sum = db.prepare("SELECT COALESCE(SUM(value), 0) AS s FROM comment_votes WHERE comment_id = ?").get(commentId);
  return { ok: true, value: num(sum?.s) };
}

/* ------------------------------- Друзья -------------------------------- */

export interface FriendView {
  userId: number;
  nickname: string;
  status: "accepted" | "incoming" | "outgoing";
  since: number;
}

export function requestFriend(db: Database, userId: number, nickname: string, now = Date.now()): SocialResult<"requested" | "accepted"> {
  const target = db.prepare("SELECT id FROM users WHERE nickname = ?").get(nickname.trim());
  if (!target) return fail("Игрок не найден", "not_found");
  const friendId = num(target.id);
  if (friendId === userId) return fail("Нельзя добавить себя", "invalid");

  return transaction(db, (): SocialResult<"requested" | "accepted"> => {
    const incoming = db
      .prepare("SELECT status FROM friendships WHERE user_id = ? AND friend_id = ?")
      .get(friendId, userId);
    if (incoming) {
      if (str(incoming.status) === "pending") {
        db.prepare("UPDATE friendships SET status = 'accepted' WHERE user_id = ? AND friend_id = ?").run(friendId, userId);
        return { ok: true, value: "accepted" };
      }
      return fail("Вы уже друзья", "exists");
    }
    if (db.prepare("SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?").get(userId, friendId)) {
      return fail("Заявка уже отправлена", "exists");
    }
    db.prepare("INSERT INTO friendships (user_id, friend_id, status, created_at) VALUES (?, ?, 'pending', ?)").run(
      userId,
      friendId,
      now,
    );
    return { ok: true, value: "requested" };
  });
}

export function removeFriend(db: Database, userId: number, friendId: number): void {
  db.prepare(
    "DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
  ).run(userId, friendId, friendId, userId);
}

export function listFriends(db: Database, userId: number): FriendView[] {
  const rows = db
    .prepare(
      `SELECT f.user_id AS a, f.friend_id AS b, f.status AS status, f.created_at AS at,
              ua.nickname AS na, ub.nickname AS nb
       FROM friendships f JOIN users ua ON ua.id = f.user_id JOIN users ub ON ub.id = f.friend_id
       WHERE f.user_id = ? OR f.friend_id = ? ORDER BY f.created_at DESC`,
    )
    .all(userId, userId);
  return rows.map((row) => {
    const mine = num(row.a) === userId;
    const status = str(row.status);
    return {
      userId: mine ? num(row.b) : num(row.a),
      nickname: mine ? str(row.nb) : str(row.na),
      status: status === "accepted" ? "accepted" : mine ? "outgoing" : "incoming",
      since: num(row.at),
    } as FriendView;
  });
}

/* ----------------------- Подписки на чужом профиле ---------------------- */

export type Relation = "self" | "none" | "outgoing" | "incoming" | "friends";

export interface ProfileSocial {
  userId: number;
  nickname: string;
  /** Как зритель связан с игроком; null — зритель не вошёл */
  relation: Relation | null;
  followers: { nickname: string; since: number }[];
  following: { nickname: string; since: number }[];
  friends: { nickname: string; since: number }[];
}

/**
 * Социальный срез игрока для страницы `/u/<ник>`: подписчики — кто отправил
 * ему заявку, подписки — кому отправил он, друзья — принятые заявки.
 */
export function profileSocial(db: Database, viewerId: number | null, nickname: string): ProfileSocial | null {
  const target = db.prepare("SELECT id, nickname FROM users WHERE nickname = ?").get(nickname.trim());
  if (!target) return null;
  const id = num(target.id);
  const rows = db
    .prepare(
      `SELECT f.user_id AS a, f.friend_id AS b, f.status AS status, f.created_at AS at,
              ua.nickname AS na, ub.nickname AS nb
       FROM friendships f JOIN users ua ON ua.id = f.user_id JOIN users ub ON ub.id = f.friend_id
       WHERE f.user_id = ? OR f.friend_id = ? ORDER BY f.created_at DESC LIMIT 400`,
    )
    .all(id, id);
  const out: ProfileSocial = {
    userId: id,
    nickname: str(target.nickname),
    relation: viewerId === null ? null : viewerId === id ? "self" : "none",
    followers: [],
    following: [],
    friends: [],
  };
  for (const row of rows) {
    const mine = num(row.a) === id;
    const other = mine ? { id: num(row.b), nick: str(row.nb) } : { id: num(row.a), nick: str(row.na) };
    const entry = { nickname: other.nick, since: num(row.at) };
    const accepted = str(row.status) === "accepted";
    if (accepted) out.friends.push(entry);
    else if (mine) out.following.push(entry);
    else out.followers.push(entry);
    if (viewerId !== null && viewerId !== id && other.id === viewerId) {
      out.relation = accepted ? "friends" : mine ? "incoming" : "outgoing";
    }
  }
  return out;
}

/* ------------------------------- Оценки -------------------------------- */

export function setRating(db: Database, userId: number, titleId: string, score: number, now = Date.now()): SocialResult<{ avg: number; votes: number }> {
  if (!TITLE_ID_RE.test(titleId)) return fail("Некорректный тайтл", "invalid");
  if (!Number.isInteger(score) || score < 1 || score > 10) return fail("Оценка — от 1 до 10", "invalid");
  db.prepare(
    `INSERT INTO ratings (user_id, title_id, score, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, title_id) DO UPDATE SET score = excluded.score, updated_at = excluded.updated_at`,
  ).run(userId, titleId, score, now);
  return { ok: true, value: ratingOf(db, titleId) };
}

export function ratingOf(db: Database, titleId: string): { avg: number; votes: number } {
  const row = db.prepare("SELECT AVG(score) AS a, COUNT(*) AS c FROM ratings WHERE title_id = ?").get(titleId);
  const votes = num(row?.c);
  return { avg: votes ? Math.round(num(row?.a) * 100) / 100 : 0, votes };
}

/* ------------------------------- Жалобы -------------------------------- */

export function createReport(
  db: Database,
  reporterId: number,
  input: { kind: string; targetId: string; reason?: string },
  now = Date.now(),
): SocialResult<number> {
  if (!["comment", "user", "title", "clan"].includes(input.kind)) return fail("Некорректный тип жалобы", "invalid");
  if (!input.targetId || input.targetId.length > 80) return fail("Некорректная цель жалобы", "invalid");
  const open = num(
    db
      .prepare("SELECT COUNT(*) AS c FROM reports WHERE reporter_id = ? AND created_at > ?")
      .get(reporterId, now - 60 * 60 * 1000)?.c,
  );
  if (open >= 10) return fail("Слишком много жалоб за час", "rate_limit");
  const info = db
    .prepare("INSERT INTO reports (reporter_id, target_kind, target_id, reason, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(reporterId, input.kind, input.targetId, (input.reason ?? "").slice(0, 500), now);
  return { ok: true, value: num(info.lastInsertRowid) };
}

export function listReports(db: Database, status = "open", limit = 100) {
  return db
    .prepare(
      `SELECT r.*, u.nickname AS reporter FROM reports r JOIN users u ON u.id = r.reporter_id
       WHERE r.status = ? ORDER BY r.id DESC LIMIT ?`,
    )
    .all(status, Math.min(Math.max(limit, 1), 200))
    .map((row) => ({
      id: num(row.id),
      reporter: str(row.reporter),
      kind: str(row.target_kind),
      targetId: str(row.target_id),
      reason: str(row.reason),
      status: str(row.status),
      createdAt: num(row.created_at),
    }));
}

export function resolveReport(db: Database, moderatorId: number, role: string, reportId: number, now = Date.now()): SocialResult<true> {
  if (role !== "admin" && role !== "moderator") return fail("Недостаточно прав", "forbidden");
  const info = db
    .prepare("UPDATE reports SET status = 'resolved', resolved_by = ?, resolved_at = ? WHERE id = ? AND status = 'open'")
    .run(moderatorId, now, reportId);
  return num(info.changes) > 0 ? { ok: true, value: true } : fail("Жалоба не найдена", "not_found");
}

/* ---------------------------- Уведомления ------------------------------ */

export function addNotification(db: Database, userId: number, kind: string, payload: Record<string, unknown> = {}, now = Date.now()): void {
  db.prepare("INSERT INTO notifications (user_id, kind, payload, created_at) VALUES (?, ?, ?, ?)").run(
    userId,
    kind.slice(0, 40),
    JSON.stringify(payload).slice(0, 2000),
    now,
  );
}

export function listNotifications(db: Database, userId: number, limit = 50) {
  return db
    .prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT ?")
    .all(userId, Math.min(Math.max(limit, 1), 100))
    .map((row) => ({
      id: num(row.id),
      kind: str(row.kind),
      payload: str(row.payload, "{}"),
      createdAt: num(row.created_at),
      read: num(row.read_at) > 0,
    }));
}

export function markNotificationsRead(db: Database, userId: number, now = Date.now()): void {
  db.prepare("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at = 0").run(now, userId);
}
