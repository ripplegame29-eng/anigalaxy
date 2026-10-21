/**
 * Манга: источник Senku / InkStory.
 *
 * Senku сам ничего не хранит и не переводит — это агрегатор над InkStory
 * (inkstory.net). Мы ходим в его PHP-прокси, который нормализует ответ
 * InkStory под общий формат:
 *   /api/manga/inkstory_api.php?action=manga&id=<slug>
 *   /api/manga/inkstory_api.php?action=chapter&id=<slug>&chapter=<uuid>
 *
 * Картинки глав отдаются напрямую с CDN InkStory (static.inuko.me), поэтому
 * для ридера достаточно их URL.
 */

import type { AnimeCard } from "./types";

const BASE = "https://manga.senku.one/api/manga/inkstory_api.php";
const PAGE_SIZE = 20;

interface SenkuManga {
  id: string;
  slug?: string;
  name?: string;
  russian?: string;
  english?: string;
  description?: string;
  year?: number;
  status?: string;
  genres?: string[];
  tags?: string[];
  aliases?: string[];
  alternative_names?: string[];
  average_rating?: number | null;
  score?: number | null;
  bookmarks_count?: number;
  views_count?: number;
  poster?: { original?: string; preview?: string } | string;
  image?: { original?: string; preview?: string } | string;
  chapters_count?: number;
  chaptersCount?: number;
  chapters?: { list?: SenkuChapterRef[] } | SenkuChapterRef[];
}

interface SenkuChapterRef {
  id: string;
  vol?: string;
  ch?: string;
  name?: string;
  title?: string;
  branch?: string;
}

interface SenkuChapterResponse {
  response?: {
    id: string;
    pages?: { list?: { url?: string; img?: string }[] };
    chapter?: SenkuChapterRef;
  };
}

interface SenkuCatalogResponse {
  response?: Record<string, SenkuManga>;
  pageNavParams?: { page: number; limit: number; hasMore: boolean };
}

export type MangaSort = "hot" | "best";

export interface MangaChapter {
  id: string;
  chapter: string;
  volume?: string;
  title?: string;
  pages?: number;
  publishedAt?: string;
}

export interface MangaDetail extends AnimeCard {
  follows?: number;
  chapters: MangaChapter[];
  chaptersTotal: number;
  chaptersLoaded: number;
  readable: true;
}

export interface ChapterPages {
  chapterId: string;
  urls: string[];
  total?: number;
}

function posterOf(item: SenkuManga): string | undefined {
  const pick = (value: SenkuManga["poster"]) => {
    if (!value) return undefined;
    if (typeof value === "string") return value;
    return value.original || value.preview;
  };
  return pick(item.poster) || pick(item.image);
}

function statusOf(status?: string): "ongoing" | "released" | "anons" | undefined {
  switch ((status ?? "").toUpperCase()) {
    case "ONGOING":
    case "RELEASING":
      return "ongoing";
    case "DONE":
    case "FINISHED":
    case "COMPLETED":
      return "released";
    case "ANNOUNCED":
    case "ANONS":
      return "anons";
    default:
      return undefined;
  }
}

function toCard(item: SenkuManga): AnimeCard {
  return {
    id: item.slug || item.id,
    title: item.russian || item.name || item.english || "Без названия",
    titleOrig: item.english || undefined,
    year: typeof item.year === "number" ? item.year : undefined,
    poster: posterOf(item),
    rating: item.average_rating ?? item.score ?? undefined,
    kind: undefined,
    status: statusOf(item.status),
    genres: (item.genres ?? item.tags ?? []).map((g: string | { russian?: string; text?: string; slug?: string }) => (typeof g === "string" ? g : g.russian || g.text || g.slug)).filter((g): g is string => Boolean(g)),
    manga: true,
    description: item.description,
  };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { next: { revalidate: 600 } });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function mangaUrl(params: Record<string, string | number>): string {
  const search = new URLSearchParams({ action: "catalog", ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])) });
  return `${BASE}?${search.toString()}`;
}

export async function mangaRow(sort: MangaSort, limit = 30): Promise<AnimeCard[]> {
  const pages = Math.ceil(limit / PAGE_SIZE);
  const results = await Promise.all(
    Array.from({ length: pages }, (_, index) =>
      fetchJson<SenkuCatalogResponse>(mangaUrl({ page: index + 1, limit: PAGE_SIZE })),
    ),
  );
  const items = results.flatMap((result) => Object.values(result?.response ?? {}));
  const sorted =
    sort === "best"
      ? items.sort((a, b) => (b.average_rating ?? b.score ?? 0) - (a.average_rating ?? a.score ?? 0))
      : items.sort((a, b) => (b.views_count ?? 0) - (a.views_count ?? 0));
  return sorted.slice(0, limit).map(toCard);
}

export async function mangaCatalogPage(
  sort: MangaSort,
  offset: number,
  perPage: number,
  query = "",
): Promise<{ cards: AnimeCard[]; hasMore: boolean; total: number }> {
  const needle = query.trim().toLowerCase();
  const startApiPage = Math.floor(offset / PAGE_SIZE) + 1;
  const [first, second] = await Promise.all([
    fetchJson<SenkuCatalogResponse>(mangaUrl({ page: startApiPage, limit: PAGE_SIZE })),
    fetchJson<SenkuCatalogResponse>(mangaUrl({ page: startApiPage + 1, limit: PAGE_SIZE })),
  ]);

  const combined = [...Object.values(first?.response ?? {}), ...Object.values(second?.response ?? {})];
  const filtered = needle
    ? combined.filter((item) => {
        const haystack = [item.russian, item.name, item.english, ...(item.aliases ?? [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
    : combined;

  const pageOffset = offset % PAGE_SIZE;
  const pageItems = filtered.slice(pageOffset, pageOffset + perPage).map(toCard);
  const hasMore = Boolean(first?.pageNavParams?.hasMore || second?.pageNavParams?.hasMore);

  return {
    cards: pageItems,
    hasMore,
    total: filtered.length,
  };
}

export async function mangaDetail(id: string): Promise<MangaDetail | null> {
  const data = await fetchJson<{ response?: SenkuManga; source?: string }>(
    `${BASE}?action=manga&id=${encodeURIComponent(id)}`,
  );
  const item = data?.response;
  if (!item) return null;

  const poster = posterOf(item);
  if (!poster) return null;

  const refs = Array.isArray(item.chapters) ? item.chapters : item.chapters?.list ?? [];
  const seenChapters = new Set<string>();
  const uniqueRefs = refs.filter((chapter) => {
    const key = chapter.ch || chapter.id;
    if (seenChapters.has(key)) return false;
    seenChapters.add(key);
    return true;
  });
  const chapters: MangaChapter[] = uniqueRefs.map((chapter) => ({
    id: chapter.id,
    chapter: chapter.ch || chapter.vol || "",
    volume: chapter.vol,
    title: chapter.title || chapter.name || undefined,
  }));

  const byChapter = (value?: string) => {
    const parsed = parseFloat(value ?? "");
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
  };
  chapters.sort((a, b) => {
    const diff = byChapter(a.chapter) - byChapter(b.chapter);
    if (diff !== 0) return diff;
    return (a.volume ?? "").localeCompare(b.volume ?? "", "ru");
  });

  return {
    ...toCard(item),
    id: item.slug || item.id,
    follows: item.bookmarks_count,
    chapters,
    chaptersTotal: uniqueRefs.length,
    chaptersLoaded: chapters.length,
    readable: true,
  };
}

export async function chapterPages(mangaId: string, chapterId: string): Promise<ChapterPages | null> {
  const data = await fetchJson<SenkuChapterResponse>(
    `${BASE}?action=chapter&id=${encodeURIComponent(mangaId)}&chapter=${encodeURIComponent(chapterId)}`,
  );
  const pages = data?.response?.pages?.list ?? [];
  const urls = pages.map((page) => page.url || page.img).filter((url): url is string => Boolean(url));

  return {
    chapterId,
    urls,
    total: pages.length,
  };
}
