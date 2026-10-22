import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Личные и служебные страницы, API и тестовые разделы в поиск не нужны
        disallow: ["/api/", "/profile", "/settings", "/list", "/u/", "/view/", "/admin", "/dev", "/__palette-preview", "/battlepass/buy"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
