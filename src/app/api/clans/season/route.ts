import { LEAGUES } from "@/lib/clan-rules";
import { currentSeason, seasonEnd } from "@/lib/server/clan-points";
import { leagueTable, settleSeasons } from "@/lib/server/clan-season";
import { json, route } from "@/lib/server/http";

export const runtime = "nodejs";

/** Публичный рейтинг лиги: ?league=0..5 */
export const GET = route(({ db, request }) => {
  settleSeasons(db);
  const league = Math.min(Math.max(Number(request.nextUrl.searchParams.get("league") ?? 0) | 0, 0), LEAGUES.length - 1);
  const season = currentSeason();
  return json({ league, season, endsAt: seasonEnd(season), table: leagueTable(db, league, season).slice(0, 50) });
});
