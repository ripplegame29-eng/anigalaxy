import { NextRequest, NextResponse } from "next/server";
import { getAniBoomStream } from "@/lib/aniboom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function positiveInt(value: string | null, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : fallback;
}

/**
 * GET /api/aniboom/stream?url=<embed>&episode=2
 *
 * Возвращает `sources` (1080/720/480 → прокси-ссылки на HLS-варианты).
 * Подписанные URL AniBoom наружу не уходят: браузер тянет только
 * /api/aniboom/proxy, где стоит Referer/Origin aniboom.one.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const url = params.get("url")?.trim() ?? "";
  if (!url || url.length > 2048) {
    return NextResponse.json(
      { error: "Нужна ссылка на embed AniBoom" },
      { status: 400 },
    );
  }

  const episode = positiveInt(params.get("episode"), 1);

  try {
    const stream = await getAniBoomStream(url, episode);
    return NextResponse.json(stream);
  } catch (error) {
    console.error("[aniboom] stream:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AniBoom недоступен" },
      { status: 502 },
    );
  }
}
