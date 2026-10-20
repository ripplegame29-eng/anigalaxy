import { NextResponse } from "next/server";
import { getSchedule } from "@/lib/schedule";

export const runtime = "nodejs";

/** GET /api/schedule — выходы серий на неделю; питает уведомления на сайте */
export async function GET() {
  try {
    const items = await getSchedule();
    return NextResponse.json(
      { items: items.map(({ id, title, at, episode }) => ({ id, title, at, episode })) },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
    );
  } catch {
    return NextResponse.json({ items: [] }, { status: 502 });
  }
}
