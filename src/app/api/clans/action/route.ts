import { addWarScore, contribute, declareWar, joinClan, kickMember, leaveClan, updateClan } from "@/lib/server/clans";
import { json, route, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

const num = (v: unknown): number => (typeof v === "number" ? v : Number(v));

/**
 * Действия игрока в клане одним маршрутом:
 * join {clanId} · leave · kick {userId} · contribute {xp?, ac?} ·
 * update {description?, data?} · declare_war {clanId, stake} · war_score {points}
 */
export const POST = route(
  async ({ db, request, user }) => {
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);
    const uid = user!.id;

    let result;
    switch (body.action) {
      case "join":
        result = joinClan(db, uid, num(body.clanId));
        break;
      case "leave":
        result = leaveClan(db, uid);
        break;
      case "kick":
        result = kickMember(db, uid, num(body.userId));
        break;
      case "contribute":
        result = contribute(db, uid, { xp: num(body.xp ?? 0), ac: num(body.ac ?? 0) });
        break;
      case "update":
        result = updateClan(db, uid, {
          description: typeof body.description === "string" ? body.description : undefined,
          data:
            body.data && typeof body.data === "object" && !Array.isArray(body.data)
              ? (body.data as Record<string, unknown>)
              : undefined,
        });
        break;
      case "declare_war":
        result = declareWar(db, uid, num(body.clanId), num(body.stake ?? 0));
        break;
      case "war_score":
        result = addWarScore(db, uid, num(body.points));
        break;
      default:
        return json({ error: "Неизвестное действие" }, 400);
    }
    if (!result.ok) {
      const status = result.code === "forbidden" ? 403 : result.code === "not_found" ? 404 : 400;
      return json({ error: result.error, code: result.code }, status);
    }
    return json({ ok: true, result: result.value });
  },
  { write: true, auth: true },
);
