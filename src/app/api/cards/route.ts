import { cardsView } from "@/lib/server/cards-state";
import { json, route } from "@/lib/server/http";

export const runtime = "nodejs";

export const GET = route(
  ({ db, request, user }) => {
    const params = request.nextUrl.searchParams;
    const res = cardsView(db, user!.id, params.get("view") ?? "state", params);
    return res.ok ? json(res.value) : json({ error: res.error }, 400);
  },
  { auth: true },
);
