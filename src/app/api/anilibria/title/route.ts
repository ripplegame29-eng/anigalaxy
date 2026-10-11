import { NextRequest, NextResponse } from "next/server";
import { findByQuery, getRelease } from "@/lib/anilibria";

export const runtime = "nodejs";

/**
 * GET /api/anilibria/title?id=алиас | ?q=название — тайтл с сериями.
 * `id` — алиас/числовой id из поиска (надёжно), `q` — запасной путь
 * для старых комнат, где алиаса нет. Серии содержат HLS-ссылки (m3u8).
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!id && !q) {
    return NextResponse.json({ error: "missing_id_or_q" }, { status: 400 });
  }

  try {
    const detail = id ? await getRelease(id) : await findByQuery(q);
    if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ detail });
  } catch {
    return NextResponse.json({ error: "anilibria_failed" }, { status: 502 });
  }
}
