/**
 * Лидерборд из базы: недельные очки, место игрока, итоги недели и выплаты.
 *
 * Очки недели = опыт игрока минус опыт на начало недели (UTC, понедельник).
 * Итоги прошлых недель считаются один раз, а приз игрок забирает один раз
 * (`claimReward`) — даже если зайдёт с двух устройств.
 */

import { PRIZE_DEPTH, weekKey } from "../leaderboard-prizes";
import { num, str, transaction, type Database } from "./sqlite";

export interface BoardRow {
  rank: number;
  userId: number;
  nickname: string;
  level: number;
  points: number;
  premium: boolean;
}

export function weeklyBoard(db: Database, now = Date.now(), limit = 100): BoardRow[] {
  const rows = db
    .prepare(
      `SELECT ps.user_id AS user_id, u.nickname AS nickname, ps.level AS level, u.premium_until AS premium_until,
              (ps.xp_total - ps.week_base_xp) AS pts
       FROM player_stats ps JOIN users u ON u.id = ps.user_id
       WHERE ps.week_key = ? AND (ps.xp_total - ps.week_base_xp) > 0
       ORDER BY pts DESC, ps.updated_at ASC
       LIMIT ?`,
    )
    .all(weekKey(now), Math.min(Math.max(limit, 1), 200));
  return rows.map((row, i) => ({
    rank: i + 1,
    userId: num(row.user_id),
    nickname: str(row.nickname),
    level: num(row.level, 1),
    points: num(row.pts),
    premium: num(row.premium_until) > now,
  }));
}

export function allTimeBoard(db: Database, limit = 100, now = Date.now()): BoardRow[] {
  const rows = db
    .prepare(
      `SELECT ps.user_id AS user_id, u.nickname AS nickname, ps.level AS level, u.premium_until AS premium_until, ps.xp_total AS pts
       FROM player_stats ps JOIN users u ON u.id = ps.user_id
       WHERE ps.xp_total > 0
       ORDER BY ps.xp_total DESC, ps.updated_at ASC
       LIMIT ?`,
    )
    .all(Math.min(Math.max(limit, 1), 200));
  return rows.map((row, i) => ({
    rank: i + 1,
    userId: num(row.user_id),
    nickname: str(row.nickname),
    level: num(row.level, 1),
    points: num(row.pts),
    premium: num(row.premium_until) > now,
  }));
}

/** Очки и место игрока на текущей неделе (место null, если очков нет) */
export function myWeekly(db: Database, userId: number, now = Date.now()): { points: number; rank: number | null } {
  const row = db
    .prepare("SELECT (xp_total - week_base_xp) AS pts FROM player_stats WHERE user_id = ? AND week_key = ?")
    .get(userId, weekKey(now));
  const points = Math.max(0, num(row?.pts));
  if (points <= 0) return { points: 0, rank: null };
  const ahead = num(
    db
      .prepare(
        "SELECT COUNT(*) AS c FROM player_stats WHERE week_key = ? AND (xp_total - week_base_xp) > ?",
      )
      .get(weekKey(now), points)?.c,
  );
  return { points, rank: ahead + 1 };
}

/** Подвести итоги недели `week` (один раз; повторный вызов ничего не меняет) */
export function settleWeek(db: Database, week: string): number {
  return transaction(db, () => {
    const done = db.prepare("SELECT 1 FROM leaderboard_results WHERE week_key = ? LIMIT 1").get(week);
    if (done) return 0;

    const scores = new Map<number, number>();
    for (const row of db.prepare("SELECT user_id, points FROM weekly_points WHERE week_key = ?").all(week)) {
      scores.set(num(row.user_id), num(row.points));
    }
    for (const row of db
      .prepare(
        "SELECT user_id, (xp_total - week_base_xp) AS pts FROM player_stats WHERE week_key = ?",
      )
      .all(week)) {
      const pts = num(row.pts);
      if (pts > 0) scores.set(num(row.user_id), Math.max(scores.get(num(row.user_id)) ?? 0, pts));
    }

    const ranked = [...scores.entries()]
      .filter(([, points]) => points > 0)
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, PRIZE_DEPTH);

    const insert = db.prepare(
      "INSERT OR IGNORE INTO leaderboard_results (week_key, user_id, rank, points) VALUES (?, ?, ?, ?)",
    );
    ranked.forEach(([userId, points], i) => insert.run(week, userId, i + 1, points));
    return ranked.length;
  });
}

/** Подвести итоги всех завершённых недель, по которым ещё нет результатов */
export function settlePastWeeks(db: Database, now = Date.now()): string[] {
  const current = weekKey(now);
  const weeks = new Set<string>();
  for (const row of db.prepare("SELECT DISTINCT week_key FROM weekly_points WHERE week_key < ?").all(current)) {
    weeks.add(str(row.week_key));
  }
  for (const row of db
    .prepare("SELECT DISTINCT week_key FROM player_stats WHERE week_key <> '' AND week_key < ?")
    .all(current)) {
    weeks.add(str(row.week_key));
  }
  const settled: string[] = [];
  for (const week of [...weeks].sort()) {
    if (settleWeek(db, week) > 0) settled.push(week);
  }
  return settled;
}

export interface PendingReward {
  weekKey: string;
  rank: number;
  points: number;
}

/** Невыплаченные призы игрока за прошедшие недели */
export function pendingRewards(db: Database, userId: number, now = Date.now()): PendingReward[] {
  settlePastWeeks(db, now);
  return db
    .prepare(
      `SELECT week_key, rank, points FROM leaderboard_results
       WHERE user_id = ? AND claimed_at = 0 AND week_key < ? ORDER BY week_key`,
    )
    .all(userId, weekKey(now))
    .map((row) => ({ weekKey: str(row.week_key), rank: num(row.rank), points: num(row.points) }));
}

/** Забрать приз: true один раз, повторно и для чужой недели — false */
export function claimReward(db: Database, userId: number, week: string, now = Date.now()): PendingReward | null {
  return transaction(db, () => {
    const row = db
      .prepare("SELECT week_key, rank, points FROM leaderboard_results WHERE week_key = ? AND user_id = ? AND claimed_at = 0")
      .get(week, userId);
    if (!row) return null;
    db.prepare("UPDATE leaderboard_results SET claimed_at = ? WHERE week_key = ? AND user_id = ?").run(
      now,
      week,
      userId,
    );
    return { weekKey: str(row.week_key), rank: num(row.rank), points: num(row.points) };
  });
}
