import { json, readJson, route } from "@/lib/server/http";
import { joinRoom, wtStatus } from "@/lib/server/watch-together";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Вход в комнату по коду: проверка мест и запоминание ника */
export const POST = route(
  async ({ db, request, params }) => {
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);

    const result = joinRoom(db, params.code, {
      clientId: String(body.clientId ?? ""),
      nickname: String(body.nickname ?? ""),
    });

    return result.ok
      ? json(result.value)
      : json({ error: result.error, code: result.code }, wtStatus(result.code));
  },
  { write: true },
);
