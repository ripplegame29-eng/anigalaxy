import { json, readJson, route } from "@/lib/server/http";
import { createRoom, listOpenRooms, wtStatus } from "@/lib/server/watch-together";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Открытые комнаты (обновляется поллингом со страницы) */
export const GET = route(({ db }) => json({ rooms: listOpenRooms(db) }));

/** Создание комнаты: сразу же добавляет создателя в участники */
export const POST = route(
  async ({ db, request }) => {
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);

    const result = createRoom(db, {
      clientId: String(body.clientId ?? ""),
      nickname: String(body.nickname ?? ""),
      title: String(body.title ?? ""),
      anime: String(body.anime ?? ""),
      alias: typeof body.alias === "string" ? body.alias : "",
      poster: typeof body.poster === "string" ? body.poster : "",
      dub: typeof body.dub === "string" ? body.dub : "",
      access: body.access === "open" ? "open" : "link",
    });

    return result.ok
      ? json(result.value, 201)
      : json({ error: result.error, code: result.code }, wtStatus(result.code));
  },
  { write: true },
);
