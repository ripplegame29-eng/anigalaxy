import { json, route } from "@/lib/server/http";
import { referralState } from "@/lib/server/referrals";

export const runtime = "nodejs";

/** Мой код, приглашённые друзья, выданные рубежи и топ месяца. Заодно засчитывает созревших друзей */
export const GET = route(({ db, user }) => json(referralState(db, user!)), { auth: true });
