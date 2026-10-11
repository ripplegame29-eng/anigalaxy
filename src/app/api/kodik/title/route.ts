import { NextRequest, NextResponse } from "next/server";
import { getTitleDetail } from "@/lib/kodik";
import { handleKodikError } from "@/lib/api-helpers";

export const runtime = "nodejs";

/**
 * GET /api/kodik/title?id=serial-75224 — детали тайтла вместе с
 * сезонами и сериями. Используется при переключении озвучки
 * и на странице просмотра.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";

  try {
    const detail = await getTitleDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Тайтл не найден" }, { status: 404 });
    }
    return NextResponse.json({ detail });
  } catch (error) {
    return handleKodikError(error);
  }
}
