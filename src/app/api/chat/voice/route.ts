import { addVoiceMessage, VOICE_MAX_BYTES } from "@/lib/server/chat";
import { json, route } from "@/lib/server/http";

export const runtime = "nodejs";

/**
 * Голосовое сообщение: сырое тело запроса — аудио (`audio/webm` и др.),
 * метаданные — в заголовках: `x-audio-ms`, `x-audio-wave`, `x-reply-to`, `x-tag-id`.
 */
export const POST = route(
  async ({ db, request, user }) => {
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > VOICE_MAX_BYTES + 2000) return json({ error: "Запись слишком большая", code: "invalid" }, 413);
    const data = new Uint8Array(await request.arrayBuffer());
    const result = addVoiceMessage(db, user!.id, user!.nickname, {
      data,
      mime: request.headers.get("content-type") ?? "",
      ms: Number(request.headers.get("x-audio-ms") ?? 0),
      wave: request.headers.get("x-audio-wave") ?? "",
      replyTo: Number(request.headers.get("x-reply-to") ?? 0) || 0,
      tagId: request.headers.get("x-tag-id") ?? undefined,
    });
    return result.ok
      ? json({ ok: true, message: result.value }, 201)
      : json({ error: result.error, code: result.code }, result.code === "rate_limit" ? 429 : 400);
  },
  { write: true, auth: true },
);
