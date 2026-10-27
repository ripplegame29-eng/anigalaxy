import { claimGoal } from "@/lib/server/clan-season";
import { buyItem, buySlots, donateAc, equipItem } from "@/lib/server/clan-economy";
import { clanIdOfUser, joinClan, kickMember, leaveClan, setRole, updateClan } from "@/lib/server/clans";
import { json, route, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

const num = (v: unknown): number => (typeof v === "number" ? v : Number(v));
const SLOTS = ["banner", "aura", "frame"] as const;

/**
 * Действия игрока в клане:
 * join {clanId} · leave · kick {userId} · role {userId, role} · donate {ac} ·
 * claim_goal {tier} · buy {itemId, currency} · equip {slot, itemId|null} · slots · update {description?, data?}
 */
export const POST = route(
  async ({ db, request, user }) => {
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);
    const uid = user!.id;
    const done = (r: { ok: boolean; error?: string; code?: string; value?: unknown }) =>
      r.ok ? json({ ok: true, result: r.value ?? null }) : json({ error: r.error, code: r.code }, r.code === "forbidden" ? 403 : 400);

    switch (body.action) {
      case "join":
        return done(joinClan(db, uid, num(body.clanId)));
      case "leave":
        return done(leaveClan(db, uid));
      case "kick":
        return done(kickMember(db, uid, num(body.userId)));
      case "role":
        return done(setRole(db, uid, num(body.userId), body.role === "officer" ? "officer" : "member"));
      case "donate":
        return done(donateAc(db, uid, num(body.ac)));
      case "claim_goal": {
        const clanId = clanIdOfUser(db, uid);
        if (clanId === null) return json({ error: "Вы не состоите в клане" }, 400);
        const r = claimGoal(db, uid, clanId, num(body.tier));
        return r.ok ? json({ ok: true, result: { ac: r.ac } }) : json({ error: r.error }, 400);
      }
      case "buy":
        return done(buyItem(db, uid, String(body.itemId ?? ""), body.currency === "crystals" ? "crystals" : "treasury"));
      case "equip": {
        const slot = SLOTS.find((s) => s === body.slot);
        if (!slot) return json({ error: "Нет такой ячейки" }, 400);
        return done(equipItem(db, uid, slot, typeof body.itemId === "string" ? body.itemId : null));
      }
      case "slots":
        return done(buySlots(db, uid));
      case "update":
        return done(
          updateClan(db, uid, {
            description: typeof body.description === "string" ? body.description : undefined,
            data:
              body.data && typeof body.data === "object" && !Array.isArray(body.data)
                ? (body.data as Record<string, unknown>)
                : undefined,
          }),
        );
      default:
        return json({ error: "Неизвестное действие" }, 400);
    }
  },
  { write: true, auth: true },
);
