import { NextRequest, NextResponse } from "next/server";
import { matchAniBoom } from "@/lib/aniboom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/aniboom/match?q=…&q2=…&year=2023
 *
 * Ищет точное совпадение на AnimeGO и возвращает только те дорожки,
 * которые реально отдаёт AniBoom. Названия q/q2/q3 — русское,
 * оригинальное и альтернативные названия из карточки Kodik.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const names = ["q", "q2", "q3", "q4"]
    .map((key) => params.get(key)?.trim() ?? "")
    .filter(Boolean)
    .filter((name) => name.length <= 200);

  if (!names.length) {
    return NextResponse.json(
      { error: "Нужно хотя бы одно название" },
      { status: 400 },
    );
  }

  const rawYear = Number(params.get("year"));
  const year =
    Number.isFinite(rawYear) && rawYear >= 1900 && rawYear <= 2100
      ? Math.trunc(rawYear)
      : undefined;

  try {
    const match = await matchAniBoom(names, year);
    return NextResponse.json({ match });
  } catch (error) {
    console.error("[aniboom] match:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AniBoom недоступен" },
      { status: 502 },
    );
  }
}
