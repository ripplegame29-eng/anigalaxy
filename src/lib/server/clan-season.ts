/** Сезоны кланов: таблица лиги, недельные цели, подведение итогов, повышения и понижения. */

import {
  GOAL_TIERS,
  MIN_CLANS_TO_MOVE,
  MIN_MEMBER_GAIN,
  MIN_RANKED_MEMBERS,
  MAX_LEAGUE,
  MOVE_FRACTION,
  clanLevelFromXp,
  goalTargets,
  rewardForRank,
} from "../clan-rules";
import { clanPoints, currentSeason, memberGains, nextSeason, prevSeason, seasonEnd } from "./clan-points";
import { logEvent } from "./clans";
import { queueGrant } from "./grants";
import { num, str, transaction, type Database } from "./sqlite";

export interface LeagueRow {
  rank: number;
  clanId: number;
  name: string;
  tag: string;
  points: number;
  members: number;
  level: number;
  /** Верхняя четверть таблицы — зона повышения, нижняя — понижения */
  zone: "up" | "down" | "stay";
}

export interface GoalState {
  targets: number[];
  claimed: number[];
  /** Какие ступени уже выполнены */
  reached: number[];
  eligible: boolean;
}

/** Таблица лиги клана: только кланы той же лиги, достаточно заполненные */
export function leagueTable(db: Database, league: number, season = currentSeason(), forClan?: number): LeagueRow[] {
  const clans = db
    .prepare(
      `SELECT c.id, c.name, c.tag, c.xp, (SELECT COUNT(*) FROM clan_members m WHERE m.clan_id = c.id) AS members
       FROM clans c WHERE c.league = ?`,
    )
    .all(league);
  const rows = clans
    .filter((c) => num(c.members) >= MIN_RANKED_MEMBERS || num(c.id) === forClan)
    .map((c) => ({
      clanId: num(c.id),
      name: str(c.name),
      tag: str(c.tag),
      points: clanPoints(db, num(c.id), season),
      members: num(c.members),
      level: clanLevelFromXp(num(c.xp)),
    }))
    .sort((a, b) => b.points - a.points || a.clanId - b.clanId);
  const ranked = rows.filter((r) => r.members >= MIN_RANKED_MEMBERS).length;
  const moves = ranked >= MIN_CLANS_TO_MOVE ? Math.max(1, Math.floor(ranked * MOVE_FRACTION)) : 0;
  return rows.map((r, i) => ({
    ...r,
    rank: i + 1,
    zone: moves && i < moves && league < MAX_LEAGUE ? "up" : moves && i >= ranked - moves && i < ranked && league > 0 ? "down" : "stay",
  }));
}

export function goalState(db: Database, clanId: number, userId: number, season = currentSeason()): GoalState {
  const clan = db.prepare("SELECT league FROM clans WHERE id = ?").get(clanId);
  const targets = goalTargets(num(clan?.league));
  const points = clanPoints(db, clanId, season);
  const claimed = db
    .prepare("SELECT tier FROM clan_goal_claims WHERE season = ? AND user_id = ?")
    .all(season, userId)
    .map((r) => num(r.tier));
  const mine = memberGains(db, clanId, season).find((m) => m.userId === userId);
  return {
    targets,
    claimed,
    reached: targets.map((t, i) => (points >= t ? i + 1 : 0)).filter(Boolean),
    eligible: !!mine && mine.active && mine.gain >= MIN_MEMBER_GAIN,
  };
}

/** Забрать сундук недельной цели: нужна выполненная ступень и личный вклад */
export function claimGoal(
  db: Database,
  userId: number,
  clanId: number,
  tier: number,
  now = Date.now(),
): { ok: true; ac: number } | { ok: false; error: string } {
  const info = GOAL_TIERS.find((t) => t.id === tier);
  if (!info) return { ok: false, error: "Нет такой ступени" };
  return transaction(db, () => {
    const season = currentSeason(now);
    const state = goalState(db, clanId, userId, season);
    if (!state.reached.includes(tier)) return { ok: false as const, error: "Клан ещё не набрал нужных очков" };
    if (!state.eligible) return { ok: false as const, error: `Нужно принести клану хотя бы ${MIN_MEMBER_GAIN} очков за неделю` };
    const done = db
      .prepare("INSERT OR IGNORE INTO clan_goal_claims (season, user_id, tier, claimed_at) VALUES (?, ?, ?, ?)")
      .run(season, userId, tier, now);
    if (!num((done as { changes?: number }).changes)) return { ok: false as const, error: "Сундук уже забран" };
    queueGrant(db, userId, { ac: info.ac, note: `Клановая цель: ${info.name}`, notice: `Клановая цель: ${info.name} — +${info.ac} AC` }, now);
    return { ok: true as const, ac: info.ac };
  });
}

/* ------------------------------ Итоги недели --------------------------- */

function settleOne(db: Database, season: string, now: number): void {
  const done = db.prepare("INSERT OR IGNORE INTO clan_seasons (season, settled_at) VALUES (?, ?)").run(season, now);
  if (!num((done as { changes?: number }).changes)) return;
  // Сначала собираем все таблицы, чтобы поднявшиеся клан не попали в следующую лигу повторно
  const tables = Array.from({ length: MAX_LEAGUE + 1 }, (_, league) =>
    leagueTable(db, league, season).filter((r) => r.members >= MIN_RANKED_MEMBERS),
  );
  for (let league = 0; league <= MAX_LEAGUE; league += 1) {
    const table = tables[league];
    const moves = table.length >= MIN_CLANS_TO_MOVE ? Math.max(1, Math.floor(table.length * MOVE_FRACTION)) : 0;
    table.forEach((row, i) => {
      const points = row.points;
      let move = 0;
      if (points > 0 && moves && i < moves && league < MAX_LEAGUE) move = 1;
      else if (moves && i >= table.length - moves && league > 0) move = -1;
      else if (points === 0 && league > 0) move = -1;
      const reward = points > 0 ? rewardForRank(row.rank) : undefined;
      db.prepare(
        `INSERT INTO clan_season_results (season, clan_id, league, rank, points, members, treasury_ac, trophies, move)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(season, row.clanId, league, row.rank, points, row.members, reward?.treasuryAc ?? 0, reward?.trophies ?? 0, move);
      db.prepare("UPDATE clans SET xp = xp + ?, treasury = treasury + ?, trophies = trophies + ?, league = ? WHERE id = ?").run(
        points,
        reward?.treasuryAc ?? 0,
        reward?.trophies ?? 0,
        Math.min(MAX_LEAGUE, Math.max(0, league + move)),
        row.clanId,
      );
      if (reward) {
        for (const m of memberGains(db, row.clanId, season)) {
          if (!m.active || m.gain < MIN_MEMBER_GAIN) continue;
          queueGrant(
            db,
            m.userId,
            { ac: reward.memberAc, note: `Награда сезона клана (${reward.label})`, notice: `Клан занял ${row.rank} место — +${reward.memberAc} AC` },
            now,
          );
        }
      }
      logEvent(db, row.clanId, null, "season", row.rank, { season, points, move }, now);
    });
  }
}

/** Подвести итоги всех прошедших недель; безопасно вызывать многократно */
export function settleSeasons(db: Database, now = Date.now()): number {
  return transaction(db, () => {
    const current = currentSeason(now);
    const last = db.prepare("SELECT MAX(season) AS s FROM clan_seasons").get();
    let season = str(last?.s) ? nextSeason(str(last?.s)) : prevSeason(current);
    let count = 0;
    while (seasonEnd(season) <= now && count < 8) {
      settleOne(db, season, now);
      season = nextSeason(season);
      count += 1;
    }
    return count;
  });
}
