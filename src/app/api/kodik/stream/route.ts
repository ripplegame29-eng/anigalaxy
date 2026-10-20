import { NextRequest, NextResponse } from "next/server";
import { getTitleDetail } from "@/lib/kodik";
import { KodikStreamError, clientIp, resolveKodikStream } from "@/lib/kodik-stream";

export const runtime = "nodejs";

/** Kodik отдаёт id вида `serial-75224` / `movie-116675` — больше ничего не берём */
const ID_PATTERN = /^(serial|movie)-(\d+)$/;

/** Сезон по умолчанию — первый */
const DEFAULT_SEASON = 1;

/**
 * GET /api/kodik/stream?id=serial-3566&season=1&episode=1
 *
 * Отдаёт прямые HLS-манифесты для серии: подпись считается здесь,
 * на сервере, и наружу уходит лишь готовый адрес потока. Браузер
 * получает то, что нужно hls.js, без плеера Kodik и без iframe.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const id = params.get("id") ?? "";
  const match = ID_PATTERN.exec(id);

  if (!match) {
    return NextResponse.json(
      { error: "Нужен id Kodik вида serial-123 или movie-123" },
      { status: 400 },
    );
  }

  const season = positiveInt(params.get("season"), DEFAULT_SEASON);
  const episode = positiveInt(params.get("episode"), 1);

  try {
    const detail = await getTitleDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Тайтл не найден" }, { status: 404 });
    }

    const link = episodeLink(detail, season, episode);
    if (!link) {
      return NextResponse.json(
        { error: `Серия ${episode} не найдена` },
        { status: 404 },
      );
    }

    const ip = clientIp(request.headers);
    const stream = await resolveKodikStream(link, ip);

    return NextResponse.json(
      {
        links: stream.links,
        qualities: Object.keys(stream.links).sort((a, b) => Number(a) - Number(b)),
        deadline: stream.deadline,
      },
      {
        // Подпись привязана к IP и дедлайну — кэшировать ответ нельзя
        headers: { "Cache-Control": "private, max-age=0, must-revalidate" },
      },
    );
  } catch (error) {
    if (error instanceof KodikStreamError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[kodik/stream] неожиданная ошибка:", error);
    return NextResponse.json({ error: "Не удалось получить поток" }, { status: 502 });
  }
}

/** Положительное целое из строки запроса, иначе значение по умолчанию */
function positiveInt(raw: string | null, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * Ссылка на плеер для конкретной серии.
 *
 * У сериала ссылка лежит в сезоне, и промах по номеру — это 404, а не
 * запасная ссылка: ссылка всего тайтла у сериала ведёт не на конкретную
 * серию, и Kodik на ней падает. Резерв `playerLink` нужен только фильмам
 * и материалам, у которых сезоны не пришли.
 */
function episodeLink(
  detail: {
    seasons: Array<{ number: number; episodes: Array<{ number: number; link: string }> }>;
    playerLink?: string;
  },
  season: number,
  episode: number,
): string | undefined {
  // Сезонов нет — это фильм, играем по ссылке тайтла
  if (detail.seasons.length === 0) return detail.playerLink;

  const seasonRef =
    detail.seasons.find((s) => s.number === season) ??
    (season === DEFAULT_SEASON ? detail.seasons[0] : undefined);
  if (!seasonRef) return undefined;

  const exact = seasonRef.episodes.find((ep) => ep.number === episode);
  if (exact?.link) return exact.link;

  // В части сериалов нумерация с нуля — если спросили первую, а её нет
  if (episode === 1) {
    const zero = seasonRef.episodes.find((ep) => ep.number === 0);
    if (zero?.link) return zero.link;
  }

  return undefined;
}