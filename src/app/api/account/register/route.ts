import { clientIp, json, route, readJson, setSessionCookie } from "@/lib/server/http";
import { SIGNUP_BONUS_AC } from "@/lib/welcome-rules";
import { queueGrant } from "@/lib/server/grants";
import { attachReferral } from "@/lib/server/referrals";
import { createSession, registerUser, toPublic } from "@/lib/server/users";

export const runtime = "nodejs";

export const POST = route(
  async ({ db, request }) => {
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);
    const result = registerUser(db, {
      nickname: String(body.nickname ?? ""),
      email: String(body.email ?? ""),
      password: String(body.password ?? ""),
    });
    if (!result.ok) return json({ error: result.error, code: result.code }, result.code === "invalid" ? 400 : 409);

    try {
      queueGrant(db, result.value.id, { ac: SIGNUP_BONUS_AC, note: "Бонус за регистрацию", notice: `Бонус за регистрацию: +${SIGNUP_BONUS_AC} монет` });
    } catch (error) {
      console.error("[signup-bonus]", error);
    }
    try {
      if (body.ref) attachReferral(db, result.value.id, body.ref);
    } catch (error) {
      console.error("[referral]", error);
    }

    const { token } = createSession(db, result.value.id, {
      userAgent: request.headers.get("user-agent") ?? "",
      ip: clientIp(request),
    });
    const response = json({ ok: true, account: toPublic(result.value) }, 201);
    setSessionCookie(response, request, token);
    return response;
  },
  { write: true },
);
