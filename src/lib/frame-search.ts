import "server-only";
import { dedupeCards, toCard } from "./anime";
import { search } from "./kodik";
import type { FrameMatch, FrameResult } from "./frame-types";

/**
 * Поиск аниме по кадру через trace.moe (бесплатный открытый сервис).
 * Он возвращает тайтл (AniList + MAL id), серию и секунду сцены. MAL id
 * совпадает с id Shikimori, а по нему Kodik находит наш тайтл в каталоге.
 */

const TRACE = "https://api.trace.moe/search?anilistInfo";

interface TraceRow {
  anilist?: { id?: number; idMal?: number | null; title?: { native?: string; romaji?: string; english?: string } } | number;
  episode?: number | string | null;
  from?: number;
  to?: number;
  at?: number;
  similarity?: number;
  video?: string;
  image?: string;
}

export class FrameError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

async function callTrace(input: { bytes: ArrayBuffer; type: string } | { url: string }, cut: boolean): Promise<TraceRow[]> {
  const base = cut ? `${TRACE}&cutBorders` : TRACE;
  // Ключ trace.moe (необязателен) снимает жёсткие лимиты бесплатного доступа
  const key = process.env.TRACE_MOE_KEY;
  const init: RequestInit = {
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
    headers: key ? { "x-trace-key": key } : undefined,
  };
  let res: Response;
  try {
    res =
      "url" in input
        ? await fetch(`${base}&url=${encodeURIComponent(input.url)}`, init)
        : await fetch(base, { ...init, method: "POST", headers: { ...(key ? { "x-trace-key": key } : {}), "Content-Type": input.type }, body: input.bytes });
  } catch {
    throw new FrameError("Сервис поиска по кадру сейчас недоступен. Попробуйте ещё раз.", 504);
  }
  if (res.status === 429) throw new FrameError("Слишком много запросов — подождите несколько секунд.", 429);
  if (res.status === 402) throw new FrameError("Лимит поиска по кадру на сегодня исчерпан. Попробуйте позже.", 429);
  if (!res.ok) throw new FrameError("Не получилось разобрать это изображение. Нужен именно кадр из аниме.", 422);
  const data = (await res.json()) as { result?: TraceRow[]; error?: string };
  if (data.error) throw new FrameError("Не получилось разобрать это изображение.", 422);
  return data.result ?? [];
}

/** Тот же тайтл у нас в каталоге: по MAL id (= Shikimori id) */
const norm = (value: string | undefined) => (value ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

async function catalogCard(
  malId: number | null,
  names: FrameMatch["names"],
): Promise<FrameMatch["card"]> {
  try {
    // Нет MAL id — ищем по названию и берём только точное совпадение
    if (!malId) {
      const wanted = [names.romaji, names.english].map(norm).filter(Boolean);
      const query = names.romaji ?? names.english;
      if (!query || wanted.length === 0) return null;
      const res = await search({ title: query, types: "anime,anime-serial", limit: 20, with_material_data: 1 });
      const cards = dedupeCards(res.results.map(toCard));
      return (
        cards.find((card) =>
          [card.titleOrig, ...(card.otherTitles ?? [])].some((title) => wanted.includes(norm(title))),
        ) ?? null
      );
    }
    const res = await search({
      shikimori_id: malId,
      types: "anime,anime-serial",
      limit: 20,
      with_material_data: 1,
    });
    return dedupeCards(res.results.map(toCard))[0] ?? null;
  } catch {
    return null;
  }
}

export type FrameInput = { bytes: ArrayBuffer; type: string } | { url: string };

const SURE = 0.93;

/**
 * Несколько вариантов одного кадра (целый, без нижней полосы с субтитрами,
 * центральная часть) прогоняем по очереди и берём лучшее по каждому тайтлу.
 * Одновременно не шлём — у trace.moe ограничение на число запросов.
 */
export async function searchByFrame(inputs: FrameInput[]): Promise<FrameResult> {
  let all: TraceRow[] = [];
  let firstError: unknown = null;

  for (const input of inputs.slice(0, 4)) {
    try {
      all = [...all, ...(await callTrace(input, true))];
    } catch (error) {
      firstError ??= error;
      if (error instanceof FrameError && error.status === 429) break;
    }
    if (Math.max(0, ...all.map((row) => row.similarity ?? 0)) >= SURE) break;
  }

  // Всё ещё нет уверенности — целый кадр без обрезки полос
  if (Math.max(0, ...all.map((row) => row.similarity ?? 0)) < 0.9 && inputs[0]) {
    try {
      all = [...all, ...(await callTrace(inputs[0], false))];
    } catch (error) {
      firstError ??= error;
    }
  }

  if (all.length === 0 && firstError) throw firstError;

  // Лучшая сцена по каждому тайтлу, затем по убыванию похожести
  const best = new Map<string, TraceRow>();
  for (const row of all) {
    const info = typeof row.anilist === "object" ? row.anilist : undefined;
    const key = `${info?.id ?? info?.idMal ?? row.anilist ?? row.video}`;
    const prev = best.get(key);
    if (!prev || (row.similarity ?? 0) > (prev.similarity ?? 0)) best.set(key, row);
  }
  const unique = [...best.values()].sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0)).slice(0, 5);

  const matches = await Promise.all(
    unique.map(async (row): Promise<FrameMatch> => {
      const info = typeof row.anilist === "object" ? row.anilist : undefined;
      const malId = info?.idMal ?? null;
      return {
        similarity: Math.max(0, Math.min(1, row.similarity ?? 0)),
        episode: row.episode == null || row.episode === "" ? null : Number(row.episode) || null,
        from: row.from ?? 0,
        to: row.to ?? 0,
        at: row.at ?? row.from ?? 0,
        image: row.image ?? "",
        video: row.video ?? "",
        names: info?.title ?? {},
        malId,
        card: await catalogCard(malId, info?.title ?? {}),
      };
    }),
  );
  return { matches };
}
