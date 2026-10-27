import { NextRequest } from "next/server";
import { handleStreamProxy } from "@/lib/stream-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CDN, который отдаёт CVH: API, варианты HLS и сегменты */
const HOSTS = [
  "cdnvideohub.com",
  "plapi.cdnvideohub.com",
  "vkuser.net",
  "okcdn.ru",
  "mycdn.me",
  "userapi.com",
  "ok.ru",
] as const;

/**
 * GET /api/cvh/proxy?url=…
 *
 * CVH-сегменты проверяют Referer/Origin и не отдают CORS. Ставим origin
 * самого upstream — именно так работает их CDN. Плейлист переписываем,
 * Range пробрасываем.
 */
export function GET(request: NextRequest) {
  return handleStreamProxy(request, {
    hosts: HOSTS,
    proxyPath: "/api/cvh/proxy",
    referer: (target) => `${target.origin}/`,
  });
}
