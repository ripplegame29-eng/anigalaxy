import { NextRequest, NextResponse } from "next/server";
import { getCvhStream } from "@/lib/cvh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function positiveInt(value: string | null, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : fallback;
}

/**
 * GET /api/cvh/stream?shikimori=52991&season=1&episode=1&studio=AnilibriaTV
 *
 * Возвращает `sources` (1080/720/480 → прокси-ссылки на HLS-варианты),
 * постер и название озвучки. Подписанные URL CVH наружу не уходят.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const id = params.get("shikimori")?.trim() ?? "";
  if (!/^\d+$/.test(id)) {
    return NextResponse.json(
      { error: "Нужен числовой shikimori id" },
      { status: 400 },
    );
  }

  const season = positiveInt(params.get("season"), 1);
  const episode = positiveInt(params.get("episode"), 1);
  const studio = params.get("studio")?.trim() || null;

  try {
    const stream = await getCvhStream(id, season, episode, studio);
    if (!Object.keys(stream.sources).length) {
      return NextResponse.json(
        { error: "CVH не отдал ни одного качества" },
        { status: 502 },
      );
    }
    return NextResponse.json(stream);
  } catch (error) {
    console.error("[cvh] stream:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "CVH не отдал поток" },
      { status: 502 },
    );
  }
}
