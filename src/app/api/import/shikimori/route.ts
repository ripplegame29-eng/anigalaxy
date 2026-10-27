import { NextRequest, NextResponse } from "next/server";
import { userLists } from "@/lib/shikimori";
import { normStatus, type ImportEntry } from "@/lib/import-lists";

export const runtime = "nodejs";

/** GET /api/import/shikimori?nick=… — публичный список пользователя Shikimori */
export async function GET(request: NextRequest) {
  const nick = (request.nextUrl.searchParams.get("nick") ?? "").trim();
  if (!/^[\p{L}\p{N}_.\- ]{1,40}$/u.test(nick)) {
    return NextResponse.json({ error: "Введите ник с Shikimori" }, { status: 400 });
  }
  try {
    const { rates, favourites } = await userLists(nick);
    if (!rates.length && !favourites.length) {
      return NextResponse.json(
        { error: "Список пуст или закрыт: откройте его в настройках приватности на Shikimori" },
        { status: 404 },
      );
    }
    const entries: ImportEntry[] = rates.map((r) => ({
      sid: r.sid,
      title: r.title || undefined,
      status: normStatus(r.status),
      score: r.score > 0 ? r.score : undefined,
    }));
    const known = new Set(entries.map((e) => e.sid));
    for (const f of favourites) {
      const hit = entries.find((e) => e.sid === f.sid);
      if (hit) hit.fav = true;
      else if (!known.has(f.sid)) entries.push({ sid: f.sid, title: f.title || undefined, status: "planned", fav: true });
    }
    return NextResponse.json({ entries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const notFound = message.includes("404");
    return NextResponse.json(
      { error: notFound ? "Пользователь с таким ником не найден" : "Shikimori сейчас недоступен, попробуйте позже" },
      { status: notFound ? 404 : 502 },
    );
  }
}
