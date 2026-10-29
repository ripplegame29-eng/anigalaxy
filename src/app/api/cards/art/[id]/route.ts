import { readFile } from "node:fs/promises";
import path from "node:path";
import { ART_DIR } from "@/lib/server/cards-art";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  if (!/^[a-z0-9-]{1,80}$/.test(id)) return new Response("not found", { status: 404 });
  try {
    const file = await readFile(path.join(ART_DIR, `${id}.jpg`));
    // AniList иногда отдаёт PNG, а файл всё равно лежит как .jpg: тип берём по содержимому
    const png = file.length > 4 && file[0] === 0x89 && file[1] === 0x50;
    const webp = file.length > 12 && file.subarray(8, 12).toString("ascii") === "WEBP";
    return new Response(new Uint8Array(file), {
      headers: { "Content-Type": png ? "image/png" : webp ? "image/webp" : "image/jpeg", "Cache-Control": "public, max-age=300, must-revalidate" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
