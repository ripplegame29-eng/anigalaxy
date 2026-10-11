import { NextRequest, NextResponse } from "next/server";
import { searchReleases } from "@/lib/anilibria";

export const runtime = "nodejs";

/**
 * GET /api/anilibria/search?q=наруто&limit=6 — поиск по каталогу AniLiberty.
 * Публичный API (api key не нужен), карточки отдаём в форме AnimeCard.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const limitRaw = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 6, 1), 20);

  try {
    const results = await searchReleases(q, limit);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "anilibria_failed" }, { status: 502 });
  }
}
