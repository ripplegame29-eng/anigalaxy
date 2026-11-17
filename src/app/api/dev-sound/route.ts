import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/** Только для разработки: сохраняет отрендеренный звук в data/_sounds */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return new Response("no", { status: 404 });
  const name = new URL(req.url).searchParams.get("name") ?? "";
  if (!/^[a-z0-9_-]{1,60}$/i.test(name)) return new Response("bad name", { status: 400 });
  const dir = path.join(process.cwd(), "data", "_sounds");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${name}.wav`), Buffer.from(await req.arrayBuffer()));
  return new Response("ok");
}
