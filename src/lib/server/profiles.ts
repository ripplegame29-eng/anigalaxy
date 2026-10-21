/**
 * Публичный профиль игрока — только то, что не секрет: ник, уровень, опыт,
 * Premium, дата регистрации, место в рейтинге и клан. Списки, история и
 * прочие личные документы наружу не отдаются.
 */

import { num, str, type Database } from "./sqlite";

export interface PublicProfile {
  nickname: string;
  level: number;
  xpTotal: number;
  premium: boolean;
  joinedAt: number;
  /** место по общему опыту (null, если опыта ещё нет) */
  rank: number | null;
  clan: { name: string; tag: string } | null;
}

export function publicProfile(db: Database, nickname: string, now = Date.now()): PublicProfile | null {
  const name = nickname.trim();
  if (!name || name.length > 40) return null;
  const user = db
    .prepare(
      `SELECT u.id AS id, u.nickname AS nickname, u.premium_until AS premium_until, u.created_at AS created_at,
              COALESCE(ps.level, 1) AS level, COALESCE(ps.xp_total, 0) AS xp_total
       FROM users u LEFT JOIN player_stats ps ON ps.user_id = u.id
       WHERE u.nickname = ?`,
    )
    .get(name);
  if (!user) return null;

  const xp = num(user.xp_total);
  const rank =
    xp > 0
      ? num(db.prepare("SELECT COUNT(*) AS c FROM player_stats WHERE xp_total > ?").get(xp)?.c) + 1
      : null;
  const clanRow = db
    .prepare("SELECT c.name AS name, c.tag AS tag FROM clan_members m JOIN clans c ON c.id = m.clan_id WHERE m.user_id = ?")
    .get(num(user.id));

  return {
    nickname: str(user.nickname),
    level: num(user.level, 1),
    xpTotal: xp,
    premium: num(user.premium_until) > now,
    joinedAt: num(user.created_at),
    rank,
    clan: clanRow ? { name: str(clanRow.name), tag: str(clanRow.tag) } : null,
  };
}
