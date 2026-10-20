/**
 * Расписание выхода серий.
 *
 * Даты берём из календаря Shikimori, а тайтлы и ссылки — из Kodik: у нас
 * плеер и страница тайтла живут на Kodik-id, поэтому в расписание попадают
 * только те онгоинги, которые можно открыть и смотреть. Склейка идёт по
 * `shikimori_id`, который Kodik отдаёт вместе с материалом.
 */
import "server-only";
import { row } from "@/lib/kodik";
import { calendar } from "@/lib/shikimori";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export interface ScheduleItem {
  /** id тайтла на сайте (Kodik) */
  id: string;
  title: string;
  poster?: string;
  /** Момент выхода серии, ISO */
  at: string;
  episode: number;
  total?: number;
  rating?: number;
  genres: string[];
  kind?: string;
}

export async function getSchedule(): Promise<ScheduleItem[]> {
  const [entries, cards] = await Promise.all([
    calendar().catch(() => []),
    row(
      "schedule:ongoing",
      {
        types: "anime,anime-serial",
        anime_status: "ongoing",
        sort: "updated_at",
        order: "desc",
        limit: 300,
      },
      15 * MINUTE,
    ).catch(() => []),
  ]);

  const byShiki = new Map<number, (typeof cards)[number]>();
  for (const card of cards) {
    if (!card.shikimoriId) continue;
    const prev = byShiki.get(card.shikimoriId);
    // На один тайтл Kodik держит несколько записей: берём ту, где есть постер
    if (!prev || (!prev.poster && card.poster)) byShiki.set(card.shikimoriId, card);
  }

  const now = Date.now();
  const seen = new Set<string>();
  const out: ScheduleItem[] = [];
  for (const entry of entries) {
    const card = byShiki.get(entry.shikimoriId);
    if (!card || seen.has(card.id)) continue;
    const at = new Date(entry.at).getTime();
    if (Number.isNaN(at) || at < now - 3 * 60 * MINUTE || at > now + 8 * DAY) continue;
    seen.add(card.id);
    out.push({
      id: card.id,
      title: card.title || entry.title,
      poster: card.poster ?? entry.image,
      at: entry.at,
      episode: entry.episode,
      total: entry.total ?? card.episodesTotal,
      rating: card.rating ?? entry.score,
      genres: card.genres.slice(0, 3),
      kind: card.kind,
    });
  }
  return out.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}
