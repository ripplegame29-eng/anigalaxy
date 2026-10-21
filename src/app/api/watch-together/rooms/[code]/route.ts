import { json, readJson, route } from "@/lib/server/http";
import { leaveRoom, readRoom, setRoomState, wtStatus } from "@/lib/server/watch-together";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Срез комнаты: состояние плеера, участники, новые сообщения.
 *
 * `client` — отметиться присутствием (heartbeat), `after` — отдать только
 * сообщения новее указанного id. Оба параметра необязательны: без них это
 * просто просмотр комнаты по ссылке-приглашению.
 */
export const GET = route(({ db, request, params }) => {
  const url = request.nextUrl.searchParams;
  const after = Number(url.get("after") ?? 0) || 0;
  const clientId = url.get("client") ?? undefined;

  const result = readRoom(db, params.code, { clientId, afterId: after });
  return result.ok
    ? json(result.value)
    : json({ error: result.error, code: result.code }, wtStatus(result.code));
});

/** Обновление состояния плеера (пауза/перемотка/серия) */
export const PATCH = route(
  async ({ db, request, params }) => {
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);

    const result = setRoomState(db, params.code, String(body.clientId ?? ""), {
      episode: Number(body.episode ?? 1),
      position: Number(body.position ?? 0),
      playing: Boolean(body.playing),
    });

    return result.ok
      ? json(result.value)
      : json({ error: result.error, code: result.code }, wtStatus(result.code));
  },
  { write: true },
);

/** Выход из комнаты */
export const DELETE = route(
  ({ db, request, params }) => {
    const clientId = request.nextUrl.searchParams.get("client") ?? "";
    const result = leaveRoom(db, params.code, clientId);
    return result.ok
      ? json({ ok: true })
      : json({ error: result.error, code: result.code }, wtStatus(result.code));
  },
  { write: true },
);
