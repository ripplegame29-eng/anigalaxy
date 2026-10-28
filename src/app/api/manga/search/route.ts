import { NextRequest, NextResponse } from "next/server";
import { mangaFilteredPage } from "@/lib/senku";

export const runtime = "nodejs";

/** GET /api/manga/search?q=…&limit=6 — быстрый поиск манги для диалогов (подборки и т.п.) */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  const limitRaw = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 6, 1), 12);
  if (q.length < 2) return NextResponse.json({ results: [] });
  try {
    const { cards } = await mangaFilteredPage("hot", 0, limit, q, {});
    return NextResponse.json({ results: cards.slice(0, limit) });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
