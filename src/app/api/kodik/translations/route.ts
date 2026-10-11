import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "@/lib/kodik";
import { handleKodikError } from "@/lib/api-helpers";

export const runtime = "nodejs";

/**
 * GET /api/kodik/translations?id=serial-75224 — список студий озвучки
 * тайтла (парсится со страницы плеера Kodik, т.к. в публичном API
 * отдельного метода «переводы материала» нет).
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";

  try {
    const translations = await getTranslations(id);
    return NextResponse.json({ translations });
  } catch (error) {
    return handleKodikError(error);
  }
}
