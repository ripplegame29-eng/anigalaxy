import { WORLD_RADIUS, clanColor } from "@/lib/clan-world";
import { currentSeason, seasonEnd } from "@/lib/server/clan-points";
import { settleSeasons } from "@/lib/server/clan-season";
import { influenceOf, ownedCount, settleWorld, worldFeed, worldStandings, worldTiles } from "@/lib/server/clan-world";
import { clanData, clanIdOfUser } from "@/lib/server/clans";
import { json, route } from "@/lib/server/http";
import { num, str } from "@/lib/server/sqlite";

export const runtime = "nodejs";

/** Карта мира: владельцы клеток, мой клан и его влияние, рейтинг владений, лента событий */
export const GET = route(({ db, user }) => {
  settleSeasons(db);
  settleWorld(db);
  const tiles = worldTiles(db);
  const standings = worldStandings(db);
  const ids = [...new Set(tiles.map((t) => t.clanId))];
  const clans = ids.map((id) => {
    const row = db.prepare("SELECT name, tag, league FROM clans WHERE id = ?").get(id);
    const data = clanData(db, id) as Record<string, unknown>;
    return { id, name: str(row?.name), tag: str(row?.tag), league: num(row?.league), color: clanColor(id, data?.color ?? data?.accent) };
  });
  const myId = user ? clanIdOfUser(db, user.id) : null;
  let mine: unknown = null;
  if (myId !== null) {
    const role = str(db.prepare("SELECT role FROM clan_members WHERE user_id = ?").get(user!.id)?.role, "member");
    const row = db.prepare("SELECT name, tag FROM clans WHERE id = ?").get(myId);
    const data = clanData(db, myId) as Record<string, unknown>;
    mine = {
      id: myId,
      name: str(row?.name),
      tag: str(row?.tag),
      role,
      color: clanColor(myId, data?.color ?? data?.accent),
      owned: ownedCount(db, myId),
      ...influenceOf(db, myId),
    };
  }
  const season = currentSeason();
  return json({ radius: WORLD_RADIUS, season, endsAt: seasonEnd(season), tiles, clans, standings: standings.slice(0, 30), feed: worldFeed(db, 40), mine });
});
