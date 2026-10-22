import { profileSocial } from "@/lib/server/social";
import { json, route } from "@/lib/server/http";

export const runtime = "nodejs";

/** `?nickname=Имя` — подписчики, подписки, друзья и связь зрителя с игроком */
export const GET = route(({ db, request, user }) => {
  const data = profileSocial(db, user?.id ?? null, request.nextUrl.searchParams.get("nickname") ?? "");
  return data ? json({ ok: true, social: data }) : json({ ok: false, error: "Игрок не найден" }, 404);
});
