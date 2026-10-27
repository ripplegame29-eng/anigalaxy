import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Политика безопасности контента. Внешние хосты (Kodik, AniLibria, Shikimori,
 * MangaDex, YouTube) меняются, поэтому для картинок, видео, запросов и фреймов
 * разрешён любой https; жёстко закрыты объекты, <base>, чужие формы и
 * встраивание сайта в чужие фреймы. Скрипты — только свои и виджет Telegram.
 */
function buildCsp(httpsOnly: boolean): string {
  return [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' blob: https:",
  "frame-src 'self' https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  // Только если сайт отдаётся по HTTPS (SITE_HTTPS=1): по голому http://IP:3000
  // браузер иначе «апгрейдит» CSS/JS до https и страница ломается
  ...(httpsOnly ? ["upgrade-insecure-requests"] : []),
].join("; ");
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
    const httpsOnly = process.env.SITE_HTTPS === "1";
    const CSP = buildCsp(httpsOnly);
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
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          ...(httpsOnly
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
            : []),
          ...(isProd ? [{ key: "Content-Security-Policy", value: CSP }] : []),
        ],
      },
      {
        // Service worker не должен залипать в кэше браузера
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
