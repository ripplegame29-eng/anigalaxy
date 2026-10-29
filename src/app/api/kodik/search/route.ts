import { NextRequest, NextResponse } from "next/server";
import { quickSearch } from "@/lib/kodik";
import { handleKodikError } from "@/lib/api-helpers";
import { withAniFallback } from "@/lib/ani-fallback";

export const runtime = "nodejs";

/** GET /api/kodik/search?q=наруто&limit=8 — быстрый поиск для шапки */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const limitRaw = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 8, 1), 20);

  // Kodik может не отдавать часть тайтлов (лицензия) — добираем из AniLiberty
  let kodik: Awaited<ReturnType<typeof quickSearch>> = [];
  let kodikError: unknown = null;
  try {
    kodik = await quickSearch(q, limit);
  } catch (error) {
    kodikError = error;
  }
  const merged = await withAniFallback(q, kodik, limit);
  const extras = merged.slice(kodik.length);
  const keep = Math.max(limit - Math.min(3, extras.length), 0);
  const results = [...kodik.slice(0, keep), ...extras.slice(0, limit - keep)];
  if (kodikError && !results.length) return handleKodikError(kodikError);
  return NextResponse.json({ results });
}
