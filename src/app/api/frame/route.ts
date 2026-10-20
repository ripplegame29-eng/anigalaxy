import { NextRequest, NextResponse } from "next/server";
import { FrameError, searchByFrame } from "@/lib/frame-search";

export const runtime = "nodejs";
export const maxDuration = 40;

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

/**
 * POST /api/frame — multipart: `file` (картинка до 10 МБ) или `url` (ссылка
 * на картинку). Отвечает { matches: FrameMatch[] }.
 */
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const files = form.getAll("file").filter((item): item is File => item instanceof File);
    const url = form.get("url");

    if (files.length > 0) {
      const inputs = [];
      for (const file of files.slice(0, 4)) {
        if (!TYPES.has(file.type)) throw new FrameError("Подходят JPG, PNG, WebP, GIF и AVIF.", 415);
        if (file.size > MAX_BYTES) throw new FrameError("Файл больше 10 МБ.", 413);
        inputs.push({ bytes: await file.arrayBuffer(), type: file.type });
      }
      return NextResponse.json(await searchByFrame(inputs));
    }

    if (typeof url === "string" && url.trim()) {
      let parsed: URL;
      try {
        parsed = new URL(url.trim());
      } catch {
        throw new FrameError("Это не похоже на ссылку.", 400);
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new FrameError("Нужна ссылка http или https.", 400);
      return NextResponse.json(await searchByFrame([{ url: parsed.toString() }]));
    }

    throw new FrameError("Добавьте картинку или ссылку на неё.", 400);
  } catch (error) {
    if (error instanceof FrameError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[frame] unexpected error:", error);
    return NextResponse.json({ error: "Не удалось выполнить поиск." }, { status: 502 });
  }
}
