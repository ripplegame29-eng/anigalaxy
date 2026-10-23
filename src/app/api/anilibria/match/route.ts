import { NextRequest, NextResponse } from "next/server";
import { matchRelease } from "@/lib/anilibria";

export const runtime = "nodejs";

/**
 * GET /api/anilibria/match?id=<shikimori/mal>&q=…&q2=…
 *
 * Отдаёт релиз AniLiberty, только когда его id Shikimori/MAL совпал с id
 * нашего тайтла. Нет совпадения — `match: null`, и озвучка AniLiberty в
 * списке не появляется: раньше подбор по названию подсовывал чужое аниме.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const id = Number(sp.get("id"));
  const names = [sp.get("q"), sp.get("q2"), sp.get("q3")].filter(
    (name): name is string => Boolean(name),
  );
  if (!Number.isFinite(id) || id <= 0 || !names.length) {
    return NextResponse.json({ match: null });
  }

  try {
    const card = await matchRelease(id, names);
    return NextResponse.json({
      match: card
        ? { alias: card.alias, title: card.title, episodesTotal: card.episodesTotal ?? null }
        : null,
    });
  } catch {
    // Чужой каталог недоступен — просто не предлагаем озвучку
    return NextResponse.json({ match: null });
  }
}
