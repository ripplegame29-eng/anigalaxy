import {
  addChatMessage,
  chatPatches,
  decorate,
  deleteChatMessage,
  editChatMessage,
  listChatMessages,
  toggleChatReaction,
  withAuthors,
} from "@/lib/server/chat";
import { isAdmin } from "@/lib/server/admin";
import { json, route, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

/**
 * `?after=123` — только сообщения новее этого id (для поллинга).
 * `patches` — лёгкая сводка по последним сообщениям (реакции, правки,
 * удаления), чтобы они доезжали до уже показанных сообщений.
 */
export const GET = route(({ db, request, user }) => {
  const after = Number(request.nextUrl.searchParams.get("after") ?? 0) || 0;
  const viewer = user?.id ?? 0;
  return json({
    messages: decorate(db, withAuthors(db, listChatMessages(db, 60, after)), viewer),
    patches: chatPatches(db, viewer),
  });
});

const STATUS: Record<string, number> = { rate_limit: 429, not_found: 404, forbidden: 403 };

export const POST = route(
  async ({ db, request, user }) => {
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);
    const action = typeof body.action === "string" ? body.action : "send";
    const id = Number(body.id) || 0;
    let result;
    if (action === "react") {
      result = toggleChatReaction(db, user!.id, id, String(body.emoji ?? ""));
    } else if (action === "edit") {
      result = editChatMessage(db, user!.id, id, String(body.body ?? ""));
    } else if (action === "delete") {
      result = deleteChatMessage(db, user!.id, isAdmin(user), id);
    } else {
      const sent = addChatMessage(db, user!.id, user!.nickname, {
        body: String(body.body ?? ""),
        tagId: typeof body.tagId === "string" ? body.tagId : undefined,
        replyTo: Number(body.replyTo) || 0,
      });
      return sent.ok
        ? json({ ok: true, message: sent.value }, 201)
        : json({ error: sent.error, code: sent.code }, STATUS[sent.code] ?? 400);
    }
    return result.ok ? json({ ok: true, value: result.value }) : json({ error: result.error, code: result.code }, STATUS[result.code] ?? 400);
  },
  { write: true, auth: true },
);
