import { NextRequest, NextResponse } from "next/server";
import { search, withCache } from "@/lib/kodik";

export const runtime = "nodejs";

interface Item {
  sid?: number;
  title?: string;
}

const MAX_ITEMS = 40;
const TYPES = "anime,anime-serial";
const HOUR = 3_600_000;

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

async function resolveOne(item: Item): Promise<string | null> {
  try {
    if (item.sid) {
      const id = await withCache(`imp:sid:${item.sid}`, HOUR, async () => {
        const res = await search({ shikimori_id: item.sid, types: TYPES, limit: 5, with_material_data: 0 });
        return res.results[0]?.id ?? "";
      });
      if (id) return id;
    }
    const title = (item.title ?? "").trim();
    if (title.length >= 2) {
      const id = await withCache(`imp:t:${norm(title)}`, HOUR, async () => {
        const res = await search({ title, types: TYPES, limit: 20, with_material_data: 1 });
        const want = norm(title);
        const exact = res.results.find(
          (r) => norm(r.title) === want || norm(r.title_orig ?? "") === want,
        );
        return (exact ?? res.results[0])?.id ?? "";
      });
      if (id) return id;
    }
  } catch {
    /* один тайтл не должен ронять весь перенос */
  }
  return null;
}

/** POST /api/import/resolve {items:[{sid?,title?}]} → {ids:(string|null)[]} */
export async function POST(request: NextRequest) {
  let body: { items?: Item[] };
  try {
    body = (await request.json()) as { items?: Item[] };
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const items = (body.items ?? []).slice(0, MAX_ITEMS).map((it) => ({
    sid: Number.isFinite(Number(it.sid)) && Number(it.sid) > 0 ? Math.floor(Number(it.sid)) : undefined,
    title: typeof it.title === "string" ? it.title.slice(0, 200) : undefined,
  }));

  const ids: (string | null)[] = new Array(items.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      ids[i] = await resolveOne(items[i]);
    }
  };
  await Promise.all(Array.from({ length: 5 }, worker));
  return NextResponse.json({ ids });
}
