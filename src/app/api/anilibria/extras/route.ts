import { NextRequest, NextResponse } from "next/server";
import { similar } from "@/lib/kodik";
import { screenshots, trailer, nextEpisode } from "@/lib/shikimori";
import type { AnimeCard } from "@/lib/types";

export const runtime = "nodejs";

/**
 * GET /api/anilibria/extras?id=ani-алиас&sid=<shikimori>&title=…&genres=a,b&kind=tv
 *
 * Всё, что страница тайтла AniLiberty берёт не из AniLiberty: кадры и трейлер
 * Shikimori, график следующей серии и похожие тайтлы. Нужен странице, которую
 * собирает браузер (сервер релиз не видит), — серверная версия считает то же самое сама.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const id = sp.get("id")?.trim() || "ani-title";
  const sidRaw = Number(sp.get("sid"));
  const sid = Number.isFinite(sidRaw) && sidRaw > 0 ? sidRaw : undefined;
  const title = sp.get("title")?.trim() ?? "";
  const genres = (sp.get("genres") ?? "").split(",").map((g) => g.trim()).filter(Boolean).slice(0, 6);
  const kind = sp.get("kind")?.trim() || undefined;

  const probe = { id, title, genres, kind, shikimoriId: sid } as AnimeCard;
  const [shots, trailerVideo, upcoming, similarCards] = await Promise.all([
    screenshots(sid).catch(() => []),
    trailer(sid, title).catch(() => null),
    nextEpisode(sid).catch(() => null),
    genres.length ? similar(probe).catch(() => []) : Promise.resolve([]),
  ]);
  return NextResponse.json({ shots, trailer: trailerVideo, upcoming, similar: similarCards });
}
