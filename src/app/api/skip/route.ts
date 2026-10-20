import { NextRequest, NextResponse } from "next/server";
import { withCache } from "@/lib/kodik";

export const runtime = "nodejs";

/**
 * GET /api/skip?mal=41467&ep=1
 *
 * Тайм-коды опенинга и эндинга серии из AniSkip (общая база по MAL-id —
 * им же служит `shikimori_id` Kodik). Платный API Kodik отдаёт только
 * ссылки на потоки, поэтому метки берём здесь и кэшируем на сутки.
 */
interface AniSkipResponse {
  found?: boolean;
  results?: Array<{
    interval?: { startTime?: number; endTime?: number };
    skipType?: string;
  }>;
}

export interface SkipTimes {
  /** [начало, конец] опенинга, секунды */
  op: [number, number] | null;
  /** [начало, конец] эндинга, секунды */
  ed: [number, number] | null;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mal = Number(params.get("mal"));
  const ep = Number(params.get("ep"));
  if (!Number.isInteger(mal) || mal <= 0 || !Number.isInteger(ep) || ep <= 0) {
    return NextResponse.json({ error: "Нужны mal и ep" }, { status: 400 });
  }

  try {
    const times = await withCache<SkipTimes>(`skip:${mal}:${ep}`, 24 * 3_600_000, async () => {
      const url =
        `https://api.aniskip.com/v2/skip-times/${mal}/${ep}` +
        `?types=op&types=ed&types=mixed-op&types=mixed-ed&episodeLength=0`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      try {
        const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
        // 404 = для серии меток нет: это обычный ответ, а не сбой
        if (!res.ok) return { op: null, ed: null };
        const data = (await res.json()) as AniSkipResponse;
        const pick = (...types: string[]): [number, number] | null => {
          for (const type of types) {
            const hit = data.results?.find((r) => r.skipType === type);
            const a = hit?.interval?.startTime;
            const b = hit?.interval?.endTime;
            if (typeof a === "number" && typeof b === "number" && b > a) return [a, b];
          }
          return null;
        };
        return { op: pick("op", "mixed-op"), ed: pick("ed", "mixed-ed") };
      } finally {
        clearTimeout(timer);
      }
    });
    return NextResponse.json(times, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch {
    return NextResponse.json({ op: null, ed: null } satisfies SkipTimes);
  }
}
