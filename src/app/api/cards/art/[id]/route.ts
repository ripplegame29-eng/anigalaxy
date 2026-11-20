import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { ART_DIR } from "@/lib/server/cards-art";

export const runtime = "nodejs";

/**
 * Уменьшенные копии арта (`?w=320|480|720`): в сетке карта занимает
 * 150–250 px, а оригинал 1000×1512 весит ~200 КБ и в памяти распаковывается
 * в 6 МБ. На телефоне сотня таких карт грела устройство. Копии считаются
 * один раз через sharp и лежат на диске рядом с артами.
 */
const WIDTHS = new Set([320, 480, 720]);
const CACHE_DIR = path.join(ART_DIR, "..", "cards-art-cache");

async function resized(full: string, id: string, w: number, mtimeMs: number): Promise<Buffer | null> {
  const out = path.join(CACHE_DIR, `${id}-${w}.webp`);
  const cached = await stat(out).catch(() => null);
  if (cached && cached.mtimeMs >= mtimeMs) return readFile(out);
  try {
    const sharp = (await import("sharp")).default;
    const buf = await sharp(await readFile(full)).resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(out, buf).catch(() => undefined);
    return buf;
  } catch {
    return null; // sharp недоступен — отдадим оригинал
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  if (!/^[a-z0-9-]{1,80}$/.test(id)) return new Response("not found", { status: 404 });
  try {
    // HD-версия (после scripts/upscale-art.ps1) важнее оригинала; нет её — отдаём обычный арт
    let full = path.join(ART_DIR, `${id}.jpg`);
    const hd = path.join(ART_DIR, "..", "cards-art-hd", `${id}.jpg`);
    const hdSt = await stat(hd).catch(() => null);
    if (hdSt) full = hd;
    const st = hdSt ?? (await stat(full));
    // ETag по размеру и времени файла: заменили арт — браузер получит новый сразу, без ожидания кэша
    const etag = `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
    if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": "no-cache" } });
    const w = Number(new URL(req.url).searchParams.get("w"));
    if (WIDTHS.has(w)) {
      const small = await resized(full, id, w, st.mtimeMs);
      if (small) {
        return new Response(new Uint8Array(small), {
          headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400", ETag: `${etag.slice(0, -1)}-${w}"` },
        });
      }
    }
    const file = await readFile(full);
    // AniList иногда отдаёт PNG, а файл всё равно лежит как .jpg: тип берём по содержимому
    const png = file.length > 4 && file[0] === 0x89 && file[1] === 0x50;
    const webp = file.length > 12 && file.subarray(8, 12).toString("ascii") === "WEBP";
    return new Response(new Uint8Array(file), {
      headers: { "Content-Type": png ? "image/png" : webp ? "image/webp" : "image/jpeg", "Cache-Control": "no-cache", ETag: etag },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
