import { NextResponse } from "next/server";

import { createReportAction } from "@/app/admin/moderation/actions";

export const runtime = "nodejs";

/**
 * POST /api/reports — публичная кнопка «Пожаловаться».
 *
 * Проверки перебора нет намеренно: жалобы идут от анонимов, и требовать
 * капчу ради формы, которой пользуются единицы, — значит отсечь настоящие
 * жалобы. От спама защищает `createReportAction`: повторная жалоба от того же
 * аккаунта на ту же цель не создаётся, а список растёт медленно.
 *
 * Идентичность берётся из сессии на сервере (см. createReportAction) — из тела
 * запроса не берётся ничего.
 */
export async function POST(request: Request) {
  let body: { targetType?: string; targetId?: string; reason?: string; details?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const result = await createReportAction({
    targetType: String(body.targetType ?? ""),
    targetId: String(body.targetId ?? ""),
    reason: String(body.reason ?? ""),
    details: body.details ? String(body.details) : undefined,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}