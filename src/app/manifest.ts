import type { MetadataRoute } from "next";

/** Манифест веб-приложения: установка на экран «Домой» с иконкой сайта */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "AniGalaxy — аниме онлайн",
    short_name: "AniGalaxy",
    description: "Аниме онлайн в HD: релизы, онгоинги, озвучки, профиль и награды.",
    lang: "ru",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#07070c",
    theme_color: "#07070c",
    categories: ["entertainment", "video"],
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Каталог", url: "/catalog", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "Мой список", url: "/list", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "Расписание", url: "/schedule", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
