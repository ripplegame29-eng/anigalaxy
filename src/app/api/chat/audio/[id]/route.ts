import { chatAudio } from "@/lib/server/chat";
import { route } from "@/lib/server/http";

export const runtime = "nodejs";

/** Отдаёт голосовое с поддержкой Range — без него Safari не проигрывает аудио */
export const GET = route(({ db, request, params }) => {
  const audio = chatAudio(db, Number(params.id) || 0);
  if (!audio) return new Response("not found", { status: 404 });
  const size = audio.data.byteLength;
  const headers: Record<string, string> = {
    "Content-Type": audio.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range) {
    let start = range[1] ? Number(range[1]) : 0;
    let end = range[2] ? Number(range[2]) : size - 1;
    if (!range[1] && range[2]) {
      start = Math.max(0, size - Number(range[2]));
      end = size - 1;
    }
    end = Math.min(end, size - 1);
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const part = audio.data.subarray(start, end + 1);
    return new Response(part as unknown as BodyInit, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(part.byteLength) },
    });
  }
  return new Response(audio.data as unknown as BodyInit, { headers: { ...headers, "Content-Length": String(size) } });
});
