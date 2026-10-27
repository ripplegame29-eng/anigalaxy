import { NextRequest, NextResponse } from "next/server";
import { searchSameBand } from "@/lib/sameband";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/sameband/search?q=Фрирен — карточки каталога SameBand */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchSameBand(query);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("[sameband] search:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SameBand недоступен" },
      { status: 502 },
    );
  }
}
