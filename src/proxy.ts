import { NextRequest, NextResponse } from "next/server";

/**
 * Прокси Next 16 (бывший middleware): защита API до того, как запрос
 * дойдёт до обработчика.
 *
 *  • лимит запросов по IP (скользящее окно) — не даёт выкачать каталог
 *    ботом и положить внешние API, на которые мы ходим;
 *  • отдельный, более жёсткий лимит для «дорогих» маршрутов (поиск по
 *    кадру, потоки, вход через Telegram);
 *  • запрет не-GET/POST методов и слишком больших тел (PATCH/DELETE —
 *    только для комнат совместного просмотра);
 *  • одинаковые защитные заголовки на ответах API.
 *
 * Счётчики живут в памяти процесса: на нескольких инстансах лимит
 * действует на каждый отдельно. Для общего лимита нужен Redis/Upstash.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

const GENERAL = { windowMs: 60_000, max: 120 };
const HEAVY = { windowMs: 60_000, max: 20 };
/**
 * Комнаты опрашиваются каждые 2 секунды (30 запросов в минуту с вкладки).
 * Несколько вкладок с одного IP не должны упираться в общий лимит.
 */
const ROOMS = { windowMs: 60_000, max: 240 };
const HEAVY_PREFIXES = ["/api/frame", "/api/kodik/stream", "/api/auth/", "/api/account/"];
/** Тело запроса больше этого не принимаем (поиск по кадру — до 4×10 МБ, берём запас) */
const MAX_BODY = 45 * 1024 * 1024;

/**
 * Комнаты совместного просмотра меняют состояние через PATCH и выходят
 * через DELETE. Остальному API эти методы не нужны, поэтому разрешаем их
 * точечно — защита от чужих сайтов всё равно проверяется в самом роуте.
 */
const EXTRA_METHODS_PREFIX = "/api/watch-together/";

function methodAllowed(pathname: string, method: string): boolean {
  if (method === "GET" || method === "POST" || method === "HEAD" || method === "OPTIONS") return true;
  return pathname.startsWith(EXTRA_METHODS_PREFIX) && (method === "PATCH" || method === "DELETE");
}

function clientKey(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || request.headers.get("x-real-ip") || "unknown";
}

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.hits.length === 0 || now - bucket.hits[bucket.hits.length - 1] > 120_000) buckets.delete(key);
  }
}

function hit(key: string, rule: { windowMs: number; max: number }, now: number): { ok: boolean; retry: number } {
  const bucket = buckets.get(key) ?? { hits: [] };
  const from = now - rule.windowMs;
  bucket.hits = bucket.hits.filter((t) => t > from);
  if (bucket.hits.length >= rule.max) {
    buckets.set(key, bucket);
    return { ok: false, retry: Math.ceil((bucket.hits[0] + rule.windowMs - now) / 1000) };
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { ok: true, retry: 0 };
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  if (!methodAllowed(pathname, method)) {
    return NextResponse.json(
      { error: "Method not allowed" },
      { status: 405, headers: { Allow: "GET, POST, HEAD, OPTIONS, PATCH, DELETE" } },
    );
  }

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const now = Date.now();
  sweep(now);
  const ip = clientKey(request);
  const rooms = pathname.startsWith(EXTRA_METHODS_PREFIX);
  const heavy = HEAVY_PREFIXES.some((p) => pathname.startsWith(p));
  const rule = rooms ? ROOMS : heavy ? HEAVY : GENERAL;
  const bucket = rooms ? "w" : heavy ? "h" : "g";
  const result = hit(`${bucket}:${ip}`, rule, now);

  if (!result.ok) {
    return NextResponse.json(
      { error: "Слишком много запросов. Подождите немного." },
      { status: 429, headers: { "Retry-After": String(result.retry), "Cache-Control": "no-store" } },
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Cache-Control", response.headers.get("Cache-Control") ?? "no-store");
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
