import { CLAN_ITEMS } from "@/lib/clan-rules";
import { ownedItems, donorRub } from "@/lib/server/clan-economy";
import { currentSeason, memberGains, seasonEnd } from "@/lib/server/clan-points";
import { goalState, leagueTable, settleSeasons } from "@/lib/server/clan-season";
import { clanData, clanEvents, clanIdOfUser, clanMembers, getClan } from "@/lib/server/clans";
import { json, route } from "@/lib/server/http";

export const runtime = "nodejs";

/** Мой клан: состав, сезон, лига, цели, казна, покупки и мой титул спонсора */
export const GET = route(
  ({ db, user }) => {
    settleSeasons(db);
    const clanId = clanIdOfUser(db, user!.id);
    const clan = clanId === null ? null : getClan(db, clanId);
    if (!clan) return json({ clan: null });
    const season = currentSeason();
    const gains = new Map(memberGains(db, clan.id, season).map((m) => [m.userId, m.gain]));
    const members = clanMembers(db, clan.id).map((m) => ({ ...m, gain: gains.get(m.userId) ?? 0 }));
    const table = leagueTable(db, clan.league, season, clan.id);
    const results = db
      .prepare("SELECT season, league, rank, points, trophies, move FROM clan_season_results WHERE clan_id = ? ORDER BY season DESC LIMIT 8")
      .all(clan.id);
    return json({
      clan,
      uid: user!.id,
      data: clanData(db, clan.id),
      members,
      season: { key: season, endsAt: seasonEnd(season) },
      table,
      goals: goalState(db, clan.id, user!.id, season),
      points: table.find((r) => r.clanId === clan.id)?.points ?? 0,
      results,
      owned: ownedItems(db, clan.id),
      catalog: CLAN_ITEMS,
      donorRub: donorRub(db, user!.id),
      events: clanEvents(db, clan.id, 30),
    });
  },
  { auth: true },
);
