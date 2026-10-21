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
interface AniSkipResult {
  interval?: { startTime?: number; endTime?: number };
  skipType?: string;
  episodeLength?: number;
}
interface AniSkipResponse {
  found?: boolean;
  results?: AniSkipResult[];
}

export interface SkipTimes {
  /** [начало, конец] опенинга, секунды */
  op: [number, number] | null;
  /** [начало, конец] эндинга, секунды */
  ed: [number, number] | null;
  /** Метки взяты из релиза той же длины, что и наше видео (иначе возможен сдвиг) */
  exact?: boolean;
}

/** Сколько секунд расхождения в длине серии ещё считаем «тем же релизом» */
const SAME_CUT = 15;
/** Дальше этого метки из чужого релиза уже заведомо врут — не используем */
const MAX_DIFF = 90;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mal = Number(params.get("mal"));
  const ep = Number(params.get("ep"));
  const len = Number(params.get("len")) || 0;
  if (!Number.isInteger(mal) || mal <= 0 || !Number.isInteger(ep) || ep <= 0) {
    return NextResponse.json({ error: "Нужны mal и ep" }, { status: 400 });
  }

  try {
    /* В кэше лежат ВСЕ метки серии из AniSkip (у каждого релиза своя длина
       и свои тайм-коды), а нужный релиз выбираем под длину нашего видео */
    const all = await withCache<AniSkipResult[]>(`skip2:${mal}:${ep}`, 24 * 3_600_000, async () => {
      const url =
        `https://api.aniskip.com/v2/skip-times/${mal}/${ep}` +
        `?types=op&types=ed&types=mixed-op&types=mixed-ed&episodeLength=0`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      try {
        const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
        // 404 = для серии меток нет: это обычный ответ, а не сбой
        if (!res.ok) return [];
        const data = (await res.json()) as AniSkipResponse;
        return data.results ?? [];
      } finally {
        clearTimeout(timer);
      }
    });

    let exact = len <= 0;
    const pick = (...types: string[]): [number, number] | null => {
      const list = all.filter((r) => {
        const a = r.interval?.startTime;
        const b = r.interval?.endTime;
        return r.skipType && types.includes(r.skipType) && typeof a === "number" && typeof b === "number" && b > a;
      });
      if (!list.length) return null;
      // Ближайший по длине серии релиз; при равенстве — первый (с большим весом голосов в ответе)
      const diff = (r: AniSkipResult) => (len > 0 && r.episodeLength ? Math.abs(r.episodeLength - len) : 0);
      const best = [...list].sort((x, y) => diff(x) - diff(y) || types.indexOf(x.skipType!) - types.indexOf(y.skipType!))[0];
      const d = diff(best);
      if (len > 0 && d > MAX_DIFF) return null;
      if (d > SAME_CUT) exact = false;
      return [best.interval!.startTime!, best.interval!.endTime!];
    };
    const op = pick("op", "mixed-op");
    const ed = pick("ed", "mixed-ed");
    const times: SkipTimes = { op, ed, exact: op || ed ? exact : false };
    return NextResponse.json(times, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch {
    return NextResponse.json({ op: null, ed: null } satisfies SkipTimes);
  }
}
