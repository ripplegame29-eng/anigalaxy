import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "@/lib/kodik";
import { handleKodikError } from "@/lib/api-helpers";

export const runtime = "nodejs";

/**
 * GET /api/kodik/translations?id=serial-75224 — список студий озвучки
 * тайтла (парсится со страницы плеера Kodik, т.к. в публичном API
 * отдельного метода «переводы материала» нет).
 *
 * `&fresh=1` — в обход кэша. Нужен самому плееру: если список с сервера
 * пришёл урезанным (страница плеера не отдалась), клиент перезапрашивает
 * его напрямую, а не ждёт истечения кэша.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const fresh = request.nextUrl.searchParams.get("fresh") === "1";

  try {
    const translations = await getTranslations(id, { fresh });
    return NextResponse.json({ translations });
  } catch (error) {
    return handleKodikError(error);
  }
}
