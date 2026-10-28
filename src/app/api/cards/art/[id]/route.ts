import { readFile } from "node:fs/promises";
import path from "node:path";
import { ART_DIR } from "@/lib/server/cards-art";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  if (!/^[a-z0-9-]{1,80}$/.test(id)) return new Response("not found", { status: 404 });
  try {
    const file = await readFile(path.join(ART_DIR, `${id}.jpg`));
    return new Response(new Uint8Array(file), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400, immutable" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
