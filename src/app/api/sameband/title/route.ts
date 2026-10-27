import { NextRequest, NextResponse } from "next/server";
import { getSameBandDetail } from "@/lib/sameband";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sameband/title?url=https://sameband.studio/anime/…html
 *
 * Тайтл и все серии. Ссылки на HLS уже завернуты в /api/sameband/proxy,
 * поэтому клиенту не нужно знать про Referer и CORS.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")?.trim() ?? "";
  if (!url) {
    return NextResponse.json({ error: "Нужен url тайтла SameBand" }, { status: 400 });
  }

  try {
    const detail = await getSameBandDetail(url);
    return NextResponse.json({ detail });
  } catch (error) {
    console.error("[sameband] title:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SameBand не отдал тайтл" },
      { status: 502 },
    );
  }
}
