import { NextResponse } from "next/server";
import { route } from "@/lib/server/http";
import { getClanMedia } from "@/lib/server/clans";

export const runtime = "nodejs";

/** `?id=<clanId>&kind=avatar|banner&v=<версия>` — своя картинка клана */
export const GET = route(({ db, request }) => {
  const sp = request.nextUrl.searchParams;
  const id = Number(sp.get("id") ?? 0);
  const kind = sp.get("kind") === "banner" ? "banner" : "avatar";
  if (!Number.isInteger(id) || id <= 0) return new NextResponse(null, { status: 404 });
  const m = getClanMedia(db, id, kind);
  if (!m) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(m.bytes), {
    headers: { "Content-Type": m.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
});
