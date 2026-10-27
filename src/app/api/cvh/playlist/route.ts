import { NextRequest, NextResponse } from "next/server";
import { getCvhPlaylist } from "@/lib/cvh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cvh/playlist?shikimori=52991
 *
 * Сезоны и озвучки CVH. `cvh_id` совпадает с `shikimori_id`, поэтому
 * вызывается со страницы тайтла, где этот id уже есть.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("shikimori")?.trim() ?? "";
  if (!/^\d+$/.test(id)) {
    return NextResponse.json(
      { error: "Нужен числовой shikimori id" },
      { status: 400 },
    );
  }

  try {
    const playlist = await getCvhPlaylist(id);
    return NextResponse.json({ playlist });
  } catch (error) {
    console.error("[cvh] playlist:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "CVH недоступен" },
      { status: 502 },
    );
  }
}
