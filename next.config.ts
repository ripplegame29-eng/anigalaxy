import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Хосты, откуда приходят постеры/кадры (Shikimori, Кинопоиск, Kodik)
    remotePatterns: [
      { protocol: "https", hostname: "shikimori.io" },
      { protocol: "https", hostname: "www.shikimori.one" },
      { protocol: "https", hostname: "shikimori.one" },
      { protocol: "https", hostname: "st.kp.yandex.net" },
      { protocol: "https", hostname: "i.kodikres.com" },
      { protocol: "https", hostname: "kodik-res.com" },
      // Постеры каталога AniLiberty (совместный просмотр)
      { protocol: "https", hostname: "anilibria.top" },
      { protocol: "https", hostname: "cdn.anilibria.top" },
      // Обложки манги из раздела «Манга» (MangaDex)
      { protocol: "https", hostname: "uploads.mangadex.org" },
      // Превью трейлеров с YouTube (фоллбэк, если Shikimori не ответил)
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
    formats: ["image/avif", "image/webp"],
    // Постеры приходят разных пропорций — отдаём как есть, обрезаем CSS-ом
    dangerouslyAllowSVG: false,
  },
  // Небольшой кэш роутов: данные каталога меняются нечасто
  outputFileTracingIncludes: {},
  async headers() {
    return [
      {
        // Рамки аватаров — статические SVG без перезаписи: браузер держит
        // их год и не ходит за ними при каждой загрузке профиля
        source: "/frames/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // Остальная статика (иконки, превью): сутки, дальше условный запрос
        source: "/:file*.{svg|png|jpg|jpeg|webp|avif|ico}",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
