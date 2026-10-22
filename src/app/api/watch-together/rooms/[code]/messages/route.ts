import { json, readJson, route } from "@/lib/server/http";
import { addRoomMessage, readRoom, wtStatus } from "@/lib/server/watch-together";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Новые сообщения комнаты: `?after=<id>` — только то, что новее */
export const GET = route(({ db, request, params }) => {
  const after = Number(request.nextUrl.searchParams.get("after") ?? 0) || 0;
  const result = readRoom(db, params.code, { afterId: after });
  return result.ok
    ? json({ messages: result.value.messages })
    : json({ error: result.error, code: result.code }, wtStatus(result.code));
});

/** Отправить сообщение в чат комнаты */
export const POST = route(
  async ({ db, request, params }) => {
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);

    const result = addRoomMessage(db, params.code, String(body.clientId ?? ""), String(body.body ?? ""));
    return result.ok
      ? json({ ok: true, message: result.value }, 201)
      : json({ error: result.error, code: result.code }, wtStatus(result.code));
  },
  { write: true },
);
