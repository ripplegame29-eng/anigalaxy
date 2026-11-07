import { NextResponse } from "next/server";
import { quickSearch } from "@/lib/kodik";
import { SERIES_ALIASES } from "@/lib/cards/series-match";

export const runtime = "nodejs";

const HOUR = 3_600_000;
const norm = (s: string): string => s.toLowerCase().replace(/ё/g, "е");

/** Постер одной серии: ищем по главному написанию, берём первый тайтл с обложкой, в названии которого оно есть */
async function posterOf(series: string): Promise<string | null> {
  const names = SERIES_ALIASES[series] ?? [series.toLowerCase()];
  const q = names.find((n) => /[а-яa-z]/i.test(n) && !/[/:;]$/.test(n)) ?? series;
  try {
    const found = await quickSearch(q, 12);
    const key = norm(q);
    const hit = found.find((c) => c.poster && norm(c.title).includes(key)) ?? found.find((c) => c.poster);
    return hit?.poster ?? null;
  } catch {
    return null;
  }
}

let cache: { at: number; posters: Record<string, string> } | null = null;

async function build(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const names = Object.keys(SERIES_ALIASES);
  let i = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (i < names.length) {
        const s = names[i++];
        const p = await posterOf(s);
        if (p) out[s] = p;
      }
    }),
  );
  return out;
}

/** GET /api/cards/series-posters — { posters: { «Блич»: «https://…», … } }; сутки в кэше, неполный набор (Kodik лёг) — лишь на минуту */
export async function GET(): Promise<Response> {
  if (!cache || Date.now() - cache.at > (Object.keys(cache.posters).length >= 30 ? 24 * HOUR : 60_000)) {
    cache = { at: Date.now(), posters: await build() };
  }
  return NextResponse.json({ posters: cache.posters }, { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=86400" } });
}
