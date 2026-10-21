import { activeWar, clanData, clanEvents, clanIdOfUser, clanMembers, getClan, settleWars, warHistory } from "@/lib/server/clans";
import { json, route } from "@/lib/server/http";

export const runtime = "nodejs";

/** Мой клан: состав, оформление, активная война, события и история войн */
export const GET = route(
  ({ db, user }) => {
    settleWars(db);
    const clanId = clanIdOfUser(db, user!.id);
    const clan = clanId === null ? null : getClan(db, clanId);
    if (!clan) return json({ clan: null });
    return json({
      clan,
      data: clanData(db, clan.id),
      members: clanMembers(db, clan.id),
      war: activeWar(db, clan.id),
      history: warHistory(db, clan.id, 10),
      events: clanEvents(db, clan.id, 30),
    });
  },
  { auth: true },
);
