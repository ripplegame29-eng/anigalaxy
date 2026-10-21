import { clearLoginFailures, createSession, loginAllowed, recordLoginFailure, toPublic, verifyLogin } from "@/lib/server/users";
import { clientIp, json, route, readJson, setSessionCookie } from "@/lib/server/http";

export const runtime = "nodejs";

export const POST = route(
  async ({ db, request }) => {
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);
    const login = String(body.login ?? "").trim();
    const ip = clientIp(request);
    const keys = [`ip:${ip}`, `login:${login.toLowerCase()}`];

    if (!keys.every((key) => loginAllowed(db, key))) {
      return json({ error: "Слишком много попыток входа. Подождите 10 минут.", code: "rate_limit" }, 429);
    }
    const result = verifyLogin(db, login, String(body.password ?? ""));
    if (!result.ok) {
      keys.forEach((key) => recordLoginFailure(db, key));
      const status = result.code === "banned" ? 403 : result.code === "invalid" ? 400 : 401;
      return json({ error: result.error, code: result.code }, status);
    }
    keys.forEach((key) => clearLoginFailures(db, key));

    const { token } = createSession(db, result.value.id, {
      userAgent: request.headers.get("user-agent") ?? "",
      ip,
    });
    const response = json({ ok: true, account: toPublic(result.value) });
    setSessionCookie(response, request, token);
    return response;
  },
  { write: true },
);
