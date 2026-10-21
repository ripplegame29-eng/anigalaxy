import { listFriends, removeFriend, requestFriend } from "@/lib/server/social";
import { json, route, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

export const GET = route(({ db, user }) => json({ friends: listFriends(db, user!.id) }), { auth: true });

/** request {nickname} · remove {userId} */
export const POST = route(
  async ({ db, request, user }) => {
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);
    if (body.action === "request") {
      const result = requestFriend(db, user!.id, String(body.nickname ?? ""));
      return result.ok ? json({ ok: true, status: result.value }) : json({ error: result.error, code: result.code }, result.code === "not_found" ? 404 : 400);
    }
    if (body.action === "remove") {
      removeFriend(db, user!.id, Number(body.userId));
      return json({ ok: true });
    }
    return json({ error: "Неизвестное действие" }, 400);
  },
  { write: true, auth: true },
);
