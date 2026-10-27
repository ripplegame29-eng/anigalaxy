import { NextRequest } from "next/server";
import { handleStreamProxy } from "@/lib/stream-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CDN AniBoom. Домены вида ya-low1.site / ya-ligh123.site меняются,
 * поэтому список держим с запасом; поддомены разрешены автоматически.
 */
const HOSTS = [
  "aniboom.one",
  "ya-low1.site",
  "ya-low2.site",
  "ya-ligh123.site",
  "ya-high.site",
  "ya-high1.site",
  "ya-high2.site",
  "boom-img.com",
] as const;

/**
 * GET /api/aniboom/proxy?url=…
 *
 * AniBoom/CDN не отдают CORS и проверяют Referer/Origin. Плейлист
 * переписываем, Range пробрасываем.
 */
export function GET(request: NextRequest) {
  return handleStreamProxy(request, {
    hosts: HOSTS,
    proxyPath: "/api/aniboom/proxy",
    referer: "https://aniboom.one/",
  });
}
