import { clearSessionCookie, json, route } from "@/lib/server/http";
import { SESSION_COOKIE, destroySession } from "@/lib/server/users";

export const runtime = "nodejs";

export const POST = route(
  ({ db, request }) => {
    destroySession(db, request.cookies.get(SESSION_COOKIE)?.value);
    const response = json({ ok: true });
    clearSessionCookie(response);
    return response;
  },
  { write: true },
);
