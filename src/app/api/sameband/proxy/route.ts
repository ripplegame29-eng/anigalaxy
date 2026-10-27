import { NextRequest } from "next/server";
import { handleStreamProxy } from "@/lib/stream-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sameband/proxy?url=…
 *
 * SameBand отдаёт HLS без CORS. Referer — сам сайт, как у обычного плеера.
 */
export function GET(request: NextRequest) {
  return handleStreamProxy(request, {
    hosts: ["sameband.studio"],
    proxyPath: "/api/sameband/proxy",
    referer: "https://sameband.studio/",
  });
}
