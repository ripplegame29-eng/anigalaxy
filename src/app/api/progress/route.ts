import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { readProgress, saveProgress } from "@/lib/admin/progress";

export const runtime = "nodejs";

/**
 * GET /api/progress — документ прогресса текущего пользователя.
 *
 * Отдаёт 200 с пустым документом, а не 404: у гостя без серверной сессии
 * прогресса просто нет, и это нормальное состояние, а не ошибка.
 */
export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { doc: null },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const doc = await readProgress(session.user.id);

  return NextResponse.json(
    { doc },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

/**
 * PUT /api/progress — отправка документа на зеркало.
 *
 * Пока хранилище браузерное, это именно зеркало: локальная копия остаётся
 * рабочей, а сюда уезжает копия для админки. Отсюда и название метода PUT,
 * идемпотентность — повторная отправка того же документа ничего не портит.
 *
 * При переходе на серверное хранилище этот эндпоинт перестанет принимать
 * готовый документ: события надо будет слать по одному и применять
 * движком на сервере, иначе накрутка останется возможной.
 */
export async function PUT(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Нужен вход" }, { status: 401 });
  }

  let body: { doc?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  if (typeof body.doc !== "string") {
    return NextResponse.json({ error: "Ожидается строка doc" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const result = await saveProgress(session.user.id, body.doc, { ip });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}