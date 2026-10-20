import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Значок Next.js в углу dev-страницы: в проде его нет, и на 3100 он
  // выглядит как «лишний элемент» рядом со страницей
  devIndicators: false,
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
      { protocol: "https", hostname: "static.inuko.me" },
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
        // Рамки аватаров — их перерисовывают генераторы в tools/, а адрес
        // при этом не меняется. Кеш на год с immutable оставлял у браузера
        // старые файлы: после правки SVG (например, сняли внешнее свечение)
        // картинка не обновлялась даже после перезагрузки страницы.
        // Поэтому max-age=0 + must-revalidate: на неизменный файл придёт
        // лёгкий 304, на изменённый — свежая версия.
        source: "/frames/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
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
