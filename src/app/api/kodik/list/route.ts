import { NextRequest, NextResponse } from "next/server";
import { catalog } from "@/lib/kodik";
import { handleKodikError } from "@/lib/api-helpers";

export const runtime = "nodejs";

/**
 * GET /api/kodik/list?... — карточки каталога с курсором.
 * Параметры совпадают с query-строкой страницы /catalog.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const yearFrom = Number(sp.get("yearFrom")) || undefined;
  const yearTo = Number(sp.get("yearTo")) || undefined;
  const type = sp.get("type");

  try {
    const data = await catalog({
      q: sp.get("q") ?? undefined,
      type: type === "serial" || type === "movie" ? type : undefined,
      kind: sp.get("kind") ?? undefined,
      status: sp.get("status") ?? undefined,
      genre: sp.get("genre") ?? undefined,
      yearFrom,
      yearTo,
      sort: sp.get("sort") ?? undefined,
      cursor: sp.get("cursor") ?? undefined,
    });

    return NextResponse.json(data);
  } catch (error) {
    return handleKodikError(error);
  }
}
