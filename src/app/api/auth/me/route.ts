import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { can } from "@/lib/roles";

export const runtime = "nodejs";

/**
 * GET /api/auth/me — кто я с точки зрения сервера.
 *
 * Нужен клиенту для одного: показать ссылку «Панель управления» тем, кому
 * она положена, не ломая статический рендер страниц.
 *
 * Почему так, а не `cookies()` прямо в подвале: обращение к cookies
 * переводит страницу из «статическая, отдаётся с CDN» в «считается на
 * каждый запрос». Проверка в подвале стоила бы сайту одиннадцати
 * закешированных страниц — `/clans`, `/store`, `/battlepass`, `/premium`
 * и другим. Здесь же сервер трогается только на явно запрошенный ответ,
 * а сама страница остаётся статической.
 *
 * Ответ кэшировать нельзя: он зависит от cookie. `no-store` — по умолчанию,
 * но пишем явно, потому что сюда пойдут все клиенты по умолчанию.
 */
export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { authenticated: false, canPanel: false, nickname: null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      canPanel: can(session.user.role, "panel"),
      nickname: session.user.nickname,
      role: session.user.role,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}