import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const ROUTES: Array<[string, number, MetadataRoute.Sitemap[number]["changeFrequency"]]> = [
  ["/", 1, "daily"],
  ["/catalog", 0.9, "daily"],
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
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ROUTES.map(([path, priority, changeFrequency]) => ({
    url: `${SITE}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
