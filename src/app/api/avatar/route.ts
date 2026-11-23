import { NextResponse } from "next/server";
import { route } from "@/lib/server/http";
import { str } from "@/lib/server/sqlite";

export const runtime = "nodejs";

/**
 * `?u=<id>` — аватар игрока картинкой. В профиле он хранится как data-URL,
 * и класть его в каждое сообщение чата было бы слишком тяжело, поэтому
 * чат ссылается сюда, а браузер кэширует ответ.
 *
 * `&s=<px>` — уменьшенная копия (WebP, гифки остаются анимированными).
 * В чате и рейтингах аватар рисуется 36–52 px, а в профиле лежит оригинал
 * до 512 px и сотен килобайт: на телефоне главная тянула мегабайт ради
 * десятка кружков. Готовые копии держим в памяти, ключ — игрок, вид,
 * размер и версия профиля (`v`), так что после смены аватара кэш не мешает.
 */

const CACHE = new Map<string, { body: Buffer; type: string }>();
const CACHE_MAX = 400;

function remember(key: string, value: { body: Buffer; type: string }) {
  CACHE.set(key, value);
  if (CACHE.size > CACHE_MAX) {
    const first = CACHE.keys().next().value;
    if (first !== undefined) CACHE.delete(first);
  }
}

async function shrink(src: Buffer, type: string, size: number, bg: boolean): Promise<{ body: Buffer; type: string } | null> {
  try {
    const sharp = (await import("sharp")).default;
    const animated = type === "image/gif" || type === "image/webp";
    const img = sharp(src, { animated, limitInputPixels: 40_000_000 });
    const resized = bg
      ? img.resize({ width: size, withoutEnlargement: true })
      : img.resize({ width: size, height: size, fit: "cover", withoutEnlargement: true });
    const body = await resized.webp({ quality: bg ? 78 : 82, effort: 3 }).toBuffer();
    // Если копия вдруг вышла тяжелее оригинала — отдаём оригинал
    return body.length < src.length ? { body, type: "image/webp" } : null;
  } catch {
    return null;
  }
}

export const GET = route(async ({ db, request }) => {
  const q = request.nextUrl.searchParams;
  const id = Number(q.get("u") ?? 0);
  if (!Number.isInteger(id) || id <= 0) return new NextResponse(null, { status: 404 });
  // kind=bg — свой фон профиля вместо аватара
  const bg = q.get("kind") === "bg";
  const sRaw = Number(q.get("s") ?? 0);
  const size = Number.isFinite(sRaw) && sRaw > 0 ? Math.min(bg ? 1600 : 512, Math.max(32, Math.round(sRaw))) : 0;
  const key = `${id}:${bg ? "bg" : "av"}:${size}:${q.get("v") ?? ""}`;
  const headers = {
    "Cache-Control": "public, max-age=3600, immutable",
    "X-Content-Type-Options": "nosniff",
  };

  const hit = q.get("v") ? CACHE.get(key) : undefined;
  if (hit) return new NextResponse(new Uint8Array(hit.body), { headers: { ...headers, "Content-Type": hit.type } });

  const row = db.prepare("SELECT value FROM user_docs WHERE user_id = ? AND doc_key = 'animehub:profile:v1'").get(id);
  const field = bg ? "backgroundCustom" : "avatar";
  let avatar = "";
  try {
    avatar = str((JSON.parse(str(row?.value)) as Record<string, unknown>)[field]);
  } catch {
    avatar = "";
  }
  const match = /^data:(image\/(?:png|jpeg|webp|gif|avif));base64,([A-Za-z0-9+/=]+)$/.exec(avatar);
  if (!match) return new NextResponse(null, { status: 404 });
  const original = Buffer.from(match[2], "base64");
  let out: { body: Buffer; type: string } = { body: original, type: match[1] };
  if (size) out = (await shrink(original, match[1], size, bg)) ?? out;
  if (q.get("v")) remember(key, out);
  return new NextResponse(new Uint8Array(out.body), { headers: { ...headers, "Content-Type": out.type } });
});
