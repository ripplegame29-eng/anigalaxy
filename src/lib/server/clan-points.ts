/**
 * Очки клана: считаются из реального опыта игроков, а не со слов браузера.
 *
 * Очки игрока за неделю — это его опыт за неделю (так же считается общий
 * лидерборд). Клану засчитывается то, что игрок набрал, пока состоял в клане:
 * при вступлении запоминается точка отсчёта (`base`), при выходе вклад
 * замораживается. Вклад одного игрока ограничен `MEMBER_WEEK_CAP`, чтобы
 * решал весь состав, а не один человек.
 */

import { MEMBER_WEEK_CAP } from "../clan-rules";
import { weekKey } from "../leaderboard-prizes";
import { num, str, type Database } from "./sqlite";

export const currentSeason = (now = Date.now()): string => weekKey(now);
export const seasonStart = (season: string): number => Date.parse(`${season}T00:00:00Z`);
export const seasonEnd = (season: string): number => seasonStart(season) + 7 * 86_400_000;
export const prevSeason = (season: string): string => new Date(seasonStart(season) - 7 * 86_400_000).toISOString().slice(0, 10);
export const nextSeason = (season: string): string => new Date(seasonEnd(season)).toISOString().slice(0, 10);

/** Очки игрока за неделю `season`: живые, пока неделя идёт, и из снимка, когда она прошла */
export function weeklyPointsFor(db: Database, userId: number, season: string): number {
  const ps = db.prepare("SELECT xp_total, week_base_xp, week_key FROM player_stats WHERE user_id = ?").get(userId);
  if (ps && str(ps.week_key) === season) return Math.max(0, num(ps.xp_total) - num(ps.week_base_xp));
  const snap = db.prepare("SELECT points FROM weekly_points WHERE week_key = ? AND user_id = ?").get(season, userId);
  return snap ? num(snap.points) : 0;
}

/** Игрок вступил в клан: считаем его вклад с текущих очков недели */
export function openSeasonRow(db: Database, userId: number, clanId: number, now = Date.now()): void {
  const season = currentSeason(now);
  const points = weeklyPointsFor(db, userId, season);
  const row = db
    .prepare("SELECT gained, left_at FROM clan_season_members WHERE season = ? AND user_id = ? AND clan_id = ?")
    .get(season, userId, clanId);
  if (row) {
    // Вернулся в тот же клан в ту же неделю: вклад продолжается с замороженного значения
    db.prepare("UPDATE clan_season_members SET base = ?, left_at = 0 WHERE season = ? AND user_id = ? AND clan_id = ?").run(
      Math.max(0, points - num(row.gained)),
      season,
      userId,
      clanId,
    );
    return;
  }
  db.prepare("INSERT INTO clan_season_members (season, user_id, clan_id, base) VALUES (?, ?, ?, ?)").run(season, userId, clanId, points);
}

/** Игрок ушёл: фиксируем, сколько он принёс за эту неделю */
export function closeSeasonRow(db: Database, userId: number, clanId: number, now = Date.now()): void {
  const season = currentSeason(now);
  const row = db
    .prepare("SELECT base FROM clan_season_members WHERE season = ? AND user_id = ? AND clan_id = ? AND left_at = 0")
    .get(season, userId, clanId);
  const base = row ? num(row.base) : 0;
  const gained = Math.min(MEMBER_WEEK_CAP, Math.max(0, weeklyPointsFor(db, userId, season) - base));
  if (row) {
    db.prepare("UPDATE clan_season_members SET gained = ?, left_at = ? WHERE season = ? AND user_id = ? AND clan_id = ?").run(
      gained,
      now,
      season,
      userId,
      clanId,
    );
  } else {
    db.prepare("INSERT INTO clan_season_members (season, user_id, clan_id, base, gained, left_at) VALUES (?, ?, ?, 0, ?, ?)").run(
      season,
      userId,
      clanId,
      gained,
      now,
    );
  }
}

export interface MemberGain {
  userId: number;
  nickname: string;
  role: string;
  gain: number;
  /** Ещё в клане */
  active: boolean;
}

/** Вклад каждого игрока клана за неделю (включая ушедших — их очки остаются клану) */
export function memberGains(db: Database, clanId: number, season: string, now = Date.now()): MemberGain[] {
  // Старые участники, у которых нет записи за эту неделю, состояли в клане с её начала
  const members = db.prepare("SELECT user_id, role, joined_at FROM clan_members WHERE clan_id = ?").all(clanId);
  for (const m of members) {
    const has = db
      .prepare("SELECT 1 FROM clan_season_members WHERE season = ? AND user_id = ? AND clan_id = ?")
      .get(season, num(m.user_id), clanId);
    if (!has) {
      db.prepare("INSERT INTO clan_season_members (season, user_id, clan_id, base) VALUES (?, ?, ?, 0)").run(season, num(m.user_id), clanId);
    }
  }
  const roles = new Map(members.map((m) => [num(m.user_id), str(m.role, "member")]));
  const rows = db
    .prepare(
      `SELECT s.user_id, s.base, s.gained, s.left_at, u.nickname
       FROM clan_season_members s JOIN users u ON u.id = s.user_id
       WHERE s.season = ? AND s.clan_id = ?`,
    )
    .all(season, clanId);
  void now;
  return rows
    .map((row) => {
      const userId = num(row.user_id);
      const left = num(row.left_at) > 0;
      const live = left ? num(row.gained) : Math.max(0, weeklyPointsFor(db, userId, season) - num(row.base));
      return {
        userId,
        nickname: str(row.nickname),
        role: roles.get(userId) ?? "member",
        gain: Math.min(MEMBER_WEEK_CAP, live),
        active: !left && roles.has(userId),
      };
    })
    .sort((a, b) => b.gain - a.gain);
}

export const clanPoints = (db: Database, clanId: number, season: string): number =>
  memberGains(db, clanId, season).reduce((sum, m) => sum + m.gain, 0);
