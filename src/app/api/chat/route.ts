import { addChatMessage, listChatMessages } from "@/lib/server/chat";
import { json, route, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

/** `?after=123` — только сообщения новее этого id (для поллинга) */
export const GET = route(({ db, request }) => {
  const after = Number(request.nextUrl.searchParams.get("after") ?? 0) || 0;
  return json({ messages: listChatMessages(db, 60, after) });
});

export const POST = route(
  async ({ db, request, user }) => {
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);
    const result = addChatMessage(db, user!.id, user!.nickname, {
      body: String(body.body ?? ""),
      tagId: typeof body.tagId === "string" ? body.tagId : undefined,
    });
    return result.ok ? json({ ok: true, message: result.value }, 201) : json({ error: result.error, code: result.code }, result.code === "rate_limit" ? 429 : 400);
  },
  { write: true, auth: true },
);
