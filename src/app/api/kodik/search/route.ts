import { NextRequest, NextResponse } from "next/server";
import { quickSearch } from "@/lib/kodik";
import { handleKodikError } from "@/lib/api-helpers";

export const runtime = "nodejs";

/** GET /api/kodik/search?q=наруто&limit=8 — быстрый поиск для шапки */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const limitRaw = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 8, 1), 20);

  try {
    const results = await quickSearch(q, limit);
    return NextResponse.json({ results });
  } catch (error) {
    return handleKodikError(error);
  }
}
