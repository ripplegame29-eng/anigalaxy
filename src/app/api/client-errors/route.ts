import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * POST /api/client-errors — приём ошибок границы React.
 *
 * Ошибки рендера в браузере до сервера не доходят: страница уже отдана, и
 * падение случается на гидрации или в обработчике. Без этого эндпоинта
 * такие сбои не видны вообще — а это ровно тот класс ошибок, который
 * проявляется у части пользователей и больше нигде.
 *
 * Приём без проверок и без лимита, и это осознанно:
 * - эндпоинт ничего не меняет, только пишет в журнал, поэтому подделать
 *   запись бесполезно — максимум, засорить журнал;
 * - ограничение по IP потребовало бы хранилища счётчиков ради вещи,
 *   которая по определению редка.
 *   Защита от засорения — схлопывание по отпечатку в logError: одинаковые
 *   ошибки дают одну строку со счётчиком.
 */
export async function POST(request: Request) {
  let body: { message?: unknown; stack?: unknown; digest?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const message = String(body.message ?? "").slice(0, 2000);
  if (!message) {
    return NextResponse.json({ error: "Пустое сообщение" }, { status: 400 });
  }

  // digest прикладывает Next — он уникален на конкретный прогон рендера,
  // поэтому добавляем его к сообщению: без него одинаковые тексты от
  // разных страниц сливались бы в одну запись.
  const digest = typeof body.digest === "string" ? body.digest.slice(0, 40) : null;

  const session = await getSession();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  await logError({
    level: "error",
    source: "client",
    operation: "render",
    message: digest ? `${message} [${digest}]` : message,
    stack: typeof body.stack === "string" ? body.stack.slice(0, 8000) : null,
    userId: session?.user.id ?? null,
    ip,
    userAgent: request.headers.get("user-agent"),
  });

  // Всегда 200: отправителю нечего исправлять, а не-200 заставит браузер
  // писать ещё одну ошибку в консоль поверх той, что уже случилась.
  return NextResponse.json({ ok: true });
}