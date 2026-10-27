import { NextRequest, NextResponse } from "next/server";
import { matchSameBand } from "@/lib/sameband";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sameband/match?q=…&q2=…&year=2023
 *
 * SameBand не отдаёт Shikimori id, поэтому подбор идёт по нормализованному
 * названию и году. Нет точного совпадения — `match: null`, и источник не
 * предлагается, чтобы не открыть соседний сезон.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const names = [params.get("q"), params.get("q2"), params.get("q3")].filter(
    (name): name is string => Boolean(name?.trim()),
  );
  const yearNumber = Number(params.get("year"));
  const year = Number.isFinite(yearNumber) && yearNumber > 0 ? yearNumber : undefined;

  if (!names.length) return NextResponse.json({ match: null });

  try {
    const match = await matchSameBand(names, year);
    return NextResponse.json({ match });
  } catch (error) {
    console.error("[sameband] match:", error);
    // 502, а не 200 с match: null — клиент повторяет временные сбои в фоне.
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SameBand недоступен" },
      { status: 502 },
    );
  }
}
