import { listNotifications, markNotificationsRead } from "@/lib/server/social";
import { json, route } from "@/lib/server/http";

export const runtime = "nodejs";

export const GET = route(({ db, user }) => json({ notifications: listNotifications(db, user!.id) }), { auth: true });

/** Отметить все прочитанными */
export const POST = route(
  ({ db, user }) => {
    markNotificationsRead(db, user!.id);
    return json({ ok: true });
  },
  { write: true, auth: true },
);
