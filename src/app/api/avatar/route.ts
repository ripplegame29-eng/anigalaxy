import { NextResponse } from "next/server";
import { route } from "@/lib/server/http";
import { str } from "@/lib/server/sqlite";

export const runtime = "nodejs";

/**
 * `?u=<id>` — аватар игрока картинкой. В профиле он хранится как data-URL,
 * и класть его в каждое сообщение чата было бы слишком тяжело, поэтому
 * чат ссылается сюда, а браузер кэширует ответ.
 */
export const GET = route(({ db, request }) => {
  const id = Number(request.nextUrl.searchParams.get("u") ?? 0);
  if (!Number.isInteger(id) || id <= 0) return new NextResponse(null, { status: 404 });
  const row = db.prepare("SELECT value FROM user_docs WHERE user_id = ? AND doc_key = 'animehub:profile:v1'").get(id);
  // kind=bg — свой фон профиля вместо аватара
  const field = request.nextUrl.searchParams.get("kind") === "bg" ? "backgroundCustom" : "avatar";
  let avatar = "";
  try {
    avatar = str((JSON.parse(str(row?.value)) as Record<string, unknown>)[field]);
  } catch {
    avatar = "";
  }
  const match = /^data:(image\/(?:png|jpeg|webp|gif|avif));base64,([A-Za-z0-9+/=]+)$/.exec(avatar);
  if (!match) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(match[2], "base64"), {
    headers: {
      "Content-Type": match[1],
      "Cache-Control": "public, max-age=3600, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
