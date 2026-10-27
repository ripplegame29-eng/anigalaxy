/**
 * Общие помощники для серверных маршрутов с базой: ответы JSON, проверка
 * сессии, защита от чужих сайтов (Origin) и cookie сессии.
 */

import { NextResponse, type NextRequest } from "next/server";

import { dbAvailable, getDb, type Database } from "./db";
import { touchActivity } from "./analytics";
import { logError } from "./errors";
import { SESSION_COOKIE, SESSION_TTL_MS, sessionUser, type UserRow } from "./users";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

/** Запрос пришёл с нашего же сайта (или без Origin — например, curl/сервер) */
export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function isHttps(request: NextRequest): boolean {
  return request.headers.get("x-forwarded-proto") === "https" || request.nextUrl.protocol === "https:";
}

export async function readJson(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function setSessionCookie(response: NextResponse, request: NextRequest, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps(request),
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export interface Ctx {
  db: Database;
  request: NextRequest;
  /** null — гость */
  user: UserRow | null;
  /** Параметры динамического сегмента роута (`[code]`) */
  params: Record<string, string>;
}

/** Контекст, который Next передаёт вторым аргументом динамическим роутам */
interface RouteContext {
  params?: Promise<Record<string, string>>;
}

/** Маршрут с базой: 503 без базы, 403 для чужого Origin на записи, пользователь из cookie */
export function route(
  handler: (ctx: Ctx) => Promise<Response> | Response,
  opts: { write?: boolean; auth?: boolean } = {},
) {
  return async (request: NextRequest, context?: RouteContext): Promise<Response> => {
    if (opts.write && !sameOrigin(request)) return json({ error: "Запрос с чужого сайта" }, 403);
    if (!dbAvailable()) return json({ error: "База данных недоступна", code: "no_db" }, 503);
    const db = getDb();
    const user = sessionUser(db, request.cookies.get(SESSION_COOKIE)?.value);
    if (user) touchActivity(db, user.id);
    if (opts.auth && !user) return json({ error: "Нужен вход", code: "unauthorized" }, 401);
    try {
      const params = context?.params ? await context.params : {};
      return await handler({ db, request, user, params });
    } catch (error) {
      console.error("[api]", request.nextUrl.pathname, error);
      try {
        logError(db, {
          source: "server",
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : "",
          path: `${request.method} ${request.nextUrl.pathname}`,
          userId: user?.id,
        });
      } catch {
        /* журнал не должен ронять ответ */
      }
      return json({ error: "Внутренняя ошибка сервера" }, 500);
    }
  };
}
