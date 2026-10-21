import { publicProfile } from "@/lib/server/profiles";
import { json, route } from "@/lib/server/http";

export const runtime = "nodejs";

/** `?nickname=Имя` — публичный профиль игрока */
export const GET = route(({ db, request }) => {
  const profile = publicProfile(db, request.nextUrl.searchParams.get("nickname") ?? "");
  return profile ? json({ ok: true, profile }) : json({ ok: false, error: "Игрок не найден" }, 404);
});
