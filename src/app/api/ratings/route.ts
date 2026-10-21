import { ratingOf, setRating } from "@/lib/server/social";
import { json, route, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

/** `?title=serial-123` — средняя оценка и число голосов */
export const GET = route(({ db, request }) => json(ratingOf(db, request.nextUrl.searchParams.get("title") ?? "")));

/** `{ titleId, score: 1..10 }` */
export const POST = route(
  async ({ db, request, user }) => {
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);
    const result = setRating(db, user!.id, String(body.titleId ?? ""), Number(body.score));
    return result.ok ? json({ ok: true, ...result.value }) : json({ error: result.error, code: result.code }, 400);
  },
  { write: true, auth: true },
);
