import { json, route } from "@/lib/server/http";
import { bonusStatus, claimTelegramBonus } from "@/lib/server/tg-bonus";

export const runtime = "nodejs";

/** Что уже выполнено: привязка Telegram и получен ли бонус */
export const GET = route(
  ({ db, user }) => {
    const s = bonusStatus(db, user!);
    return json({ linked: s.linked, claimed: s.claimed });
  },
  { auth: true },
);

/** «Проверить»: сервер сам проверяет привязку и подписку и выдаёт награду */
export const POST = route(
  async ({ db, user }) => {
    const r = await claimTelegramBonus(db, user!);
    return json(r, r.ok ? 200 : 400);
  },
  { write: true, auth: true },
);
