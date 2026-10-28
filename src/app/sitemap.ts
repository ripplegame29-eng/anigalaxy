import type { MetadataRoute } from "next";

import { catalog } from "@/lib/kodik";
import { mangaFilteredPage } from "@/lib/senku";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const ROUTES: Array<[string, number, MetadataRoute.Sitemap[number]["changeFrequency"]]> = [
  ["/", 1, "daily"],
  ["/catalog", 0.9, "daily"],
  ["/anime-4k", 0.8, "weekly"],
  ["/assistant", 0.6, "monthly"],
  ["/schedule", 0.8, "daily"],
  ["/aniswipe", 0.6, "weekly"],
  ["/manga", 0.7, "daily"],
  ["/collections", 0.6, "weekly"],
  ["/leaderboard", 0.5, "daily"],
  ["/map", 0.6, "weekly"],
  ["/premium", 0.6, "monthly"],
  ["/battlepass", 0.5, "weekly"],
  ["/events", 0.5, "weekly"],
  ["/updates", 0.4, "weekly"],
  ["/privacy", 0.2, "yearly"],
  ["/terms", 0.2, "yearly"],
  ["/offer", 0.2, "yearly"],
];

// Страницы тайтлов берём у внешних каталогов, поэтому карта собирается при запросе,
// а не при сборке сайта: медленный источник не должен ронять деплой
export const dynamic = "force-dynamic";

const TITLE_PAGES = 12;
const GENRES = ["боевик", "фэнтези", "романтика", "комедия", "драма", "исэкай", "школа", "приключения", "триллер", "фантастика", "мистика", "ужасы", "психология", "сёнэн", "спорт"];

let cached: { at: number; urls: MetadataRoute.Sitemap } | null = null;
const TTL = 6 * 60 * 60 * 1000;

async function collectTitles(base: Date): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  for (let i = 0; i < TITLE_PAGES; i += 1) {
    const page = await catalog({ sort: "rating", cursor }).catch(() => null);
    if (!page) break;
    for (const card of page.cards) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      urls.push({ url: `${SITE}/title/${card.id}`, lastModified: base, changeFrequency: "weekly", priority: 0.7 });
    }
    if (!page.next) break;
    cursor = page.next;
  }
  for (const sort of ["best", "hot"] as const) {
    const manga = await mangaFilteredPage(sort, 0, 40, "", {}).catch(() => null);
    for (const card of manga?.cards ?? []) {
      const url = `${SITE}/manga/${card.id}`;
      if (!urls.some((u) => u.url === url)) urls.push({ url, lastModified: base, changeFrequency: "weekly", priority: 0.5 });
    }
  }
  return urls;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const base: MetadataRoute.Sitemap = ROUTES.map(([path, priority, changeFrequency]) => ({
    url: `${SITE}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
  const genres: MetadataRoute.Sitemap = GENRES.map((g) => ({
    url: `${SITE}/catalog?genre=${encodeURIComponent(g)}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.6,
  }));
  if (!cached || Date.now() - cached.at > TTL) {
    // Дольше 8 секунд не ждём: лучше отдать базовую карту, чем повесить запрос краулера
    const titles = await Promise.race([collectTitles(now), new Promise<MetadataRoute.Sitemap>((res) => setTimeout(() => res([]), 8000))]);
    if (titles.length) cached = { at: Date.now(), urls: titles };
  }
  return [...base, ...genres, ...(cached?.urls ?? [])];
}
