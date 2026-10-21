import { createClan, listClans, settleWars } from "@/lib/server/clans";
import { json, route, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

/** Список кланов: `?q=поиск` */
export const GET = route(({ db, request }) => {
  settleWars(db);
  const query = request.nextUrl.searchParams.get("q") ?? "";
  return json({ clans: listClans(db, { query, limit: 50 }) });
});

/** Создать клан: `{ name, tag, description? }` */
export const POST = route(
  async ({ db, request, user }) => {
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);
    const result = createClan(db, user!.id, {
      name: String(body.name ?? ""),
      tag: String(body.tag ?? ""),
      description: typeof body.description === "string" ? body.description : "",
    });
    return result.ok ? json({ ok: true, clan: result.value }, 201) : json({ error: result.error, code: result.code }, 400);
  },
  { write: true, auth: true },
);
