import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { ART_DIR } from "@/lib/server/cards-art";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  if (!/^[a-z0-9-]{1,80}$/.test(id)) return new Response("not found", { status: 404 });
  try {
    const full = path.join(ART_DIR, `${id}.jpg`);
    const st = await stat(full);
    // ETag по размеру и времени файла: заменили арт — браузер получит новый сразу, без ожидания кэша
    const etag = `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
    if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": "no-cache" } });
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
