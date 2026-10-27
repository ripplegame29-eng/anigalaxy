import { clientIp, json, route, setSessionCookie } from "@/lib/server/http";
import { toPublic } from "@/lib/server/users";
import { loginStatus } from "@/lib/server/telegram-login";

export const runtime = "nodejs";

/** Опрос входа: ?token=… . Когда вход подтверждён, один раз выдаёт сессию */
export const GET = route(({ db, request }) => {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return json({ ok: false, status: "unknown" }, 400);
  const r = loginStatus(db, token, { ip: clientIp(request), ua: request.headers.get("user-agent") ?? "" });
  if (r.status !== "ok") return json({ ok: true, status: r.status });
  const response = json({
    ok: true,
    status: "ok",
    nickname: r.user.nickname,
    telegram: r.telegram,
    account: toPublic(r.user),
  });
  setSessionCookie(response, request, r.session.token);
  return response;
});
