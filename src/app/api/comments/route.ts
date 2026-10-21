import { addComment, deleteComment, listComments, voteComment } from "@/lib/server/social";
import { json, route, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

/** `?title=serial-123` — комментарии тайтла (с моими голосами, если вы вошли) */
export const GET = route(({ db, request, user }) => {
  const titleId = request.nextUrl.searchParams.get("title") ?? "";
  return json({ comments: listComments(db, titleId, user?.id ?? null) });
});

/** add {titleId, body, parentId?} · delete {id} · vote {id, value: 1|-1|0} */
export const POST = route(
  async ({ db, request, user }) => {
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);
    const uid = user!.id;

    if (body.action === "add") {
      const result = addComment(db, uid, {
        titleId: String(body.titleId ?? ""),
        body: String(body.body ?? ""),
        parentId: typeof body.parentId === "number" ? body.parentId : null,
      });
      return result.ok ? json({ ok: true, id: result.value }, 201) : json({ error: result.error, code: result.code }, result.code === "rate_limit" ? 429 : 400);
    }
    if (body.action === "delete") {
      const result = deleteComment(db, uid, user!.role, Number(body.id));
      return result.ok ? json({ ok: true }) : json({ error: result.error, code: result.code }, result.code === "forbidden" ? 403 : 404);
    }
    if (body.action === "vote") {
      const result = voteComment(db, uid, Number(body.id), Number(body.value));
      return result.ok ? json({ ok: true, score: result.value }) : json({ error: result.error, code: result.code }, 400);
    }
    return json({ error: "Неизвестное действие" }, 400);
  },
  { write: true, auth: true },
);
