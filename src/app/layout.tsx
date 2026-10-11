import type { Metadata, Viewport } from "next";
import { Unbounded } from "next/font/google";
import "./globals.css";
import "./effects.css";
import "./ag-tag.css";
import "./ag-comments.css";
import "./level-emblem.css";
import "./achievement-emblem.css";
import "./stats-block.css";
import "./battle-pass.css";
import "./clans.css";
import "./clans-game.css";
import { AuthDialogHost } from "@/components/AuthDialogHost";
import { ChatWidget } from "@/components/ChatWidget";
import { DailyBonusHost } from "@/components/DailyBonusHost";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getFeatures } from "@/lib/features";
import { ProgressionBoot } from "@/components/ProgressionBoot";
import { DevPanel } from "@/components/progression/DevPanel";
import { EcoBoot } from "@/components/progression/EcoBoot";
import { LevelEmblemIO } from "@/components/progression/LevelEmblemIO";
import { AchievementEmblemIO } from "@/components/progression/AchievementEmblemIO";
import { ToastHost } from "@/components/progression/ToastHost";

/** Крупные числа статистики профиля — только цифры, weight 900 */
const unbounded = Unbounded({
  weight: "900",
  variable: "--font-unbounded",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "AniGalaxy — смотреть аниме онлайн в HD",
    template: "%s · AniGalaxy",
  },
  description:
    "Большая библиотека аниме онлайн: свежие релизы, онгоинги, фильмы и OVA. Удобный выбор серий и озвучек, быстрый поиск и фильтры.",
  keywords: ["аниме", "смотреть аниме", "онгоинги", "аниме онлайн", "Kodik"],
  openGraph: {
    type: "website",
    siteName: "AniGalaxy",
    locale: "ru_RU",
    title: "AniGalaxy — смотреть аниме онлайн в HD",
    description: "Свежие релизы, онгоинги и классика аниме. Смотрите онлайн с выбором озвучки.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#07070c",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Флаги читаются здесь, а не в Header: тот — клиентский компонент и сам
  // базу открыть не может. Снимок на запрос кэшируется внутри getFeatures,
  // поэтому шапка и подвал не делают по два одинаковых запроса.
  const features = await getFeatures().catch(() => undefined);
  return (
    <html
      lang="ru"
      data-scroll-behavior="smooth"
      className={`${unbounded.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/*
          SVG-фильтр «живого» искажения для клановых эмблем.

          Он был определён в исходном HTML-макете и на него ссылался CSS
          через filter: url(#cl-heat). В проекте определения не было —
          и Chrome молча игнорировал правило, из-за чего часть эмблем
          выпадала из сетки и ломала ряд. Определение вынесено сюда,
          один раз на документ: это дешёвый способ раздать id всем.
        */}
        <svg
          width="0"
          height="0"
          aria-hidden="true"
          focusable="false"
          style={{ position: "absolute" }}
        >
          <defs>
            <filter id="cl-heat" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency=".012 .02"
                numOctaves="2"
                seed="2"
                result="n"
              >
                <animate
                  attributeName="baseFrequency"
                  dur="7s"
                  values=".012 .02;.018 .03;.012 .02"
                  repeatCount="indefinite"
                />
              </feTurbulence>
              <feDisplacementMap
                in="SourceGraphic"
                in2="n"
                scale="5"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
        >
          Перейти к содержимому
        </a>
        <Header features={features} />
        {/* min-w-0 обязателен: main — флекс-элемент колоночного body, а у
            флекс-элементов min-width:auto. Без него любой широкий потомок
            (лента разделов магазина, карусели) растягивал всю страницу, и
            фиксированная шапка становилась шире экрана. */}
        <main id="main" className="relative z-[1] min-w-0 flex-1 pt-16">
          {children}
        </main>
        <Footer features={features} />
        {/* Модалка авторизации живёт в layout, а не в шапке: у <header> есть
          backdrop-blur, а элементы с backdrop-filter/filter становятся
          containing block для position:fixed — панель тогда центрируется по
          64-пиксельной шапке и открывается с перекосом. Хост ленивый: сам
          модуль диалога подгружается только при первом клике «Войти».
        */}
        <AuthDialogHost />

        {/* Модалка «Ежедневный бонус» — тот же приём, что у авторизации */}
        <DailyBonusHost />

        {/* Тосты наград (§12.6): подписка должна встать до ежедневного входа,
            иначе первые эффекты сессии уходят в никуда */}
        <ToastHost />

        {/* Ежедневный вход прогрессии: событие шлётся только в браузере (useEffect) */}
        <ProgressionBoot />

        {/* Dev-панель прогрессии (§15 этап 7): рендерится только в dev-сборке
            и только с ?dev=1 — в production условие вырезается на этапе сборки */}
        <DevPanel />

        {/* Режим «экономия» (§14): применяет <html data-eco> после гидратации */}
        <EcoBoot />

        {/* Пауза анимаций эмблем уровней вне экрана */}
        <LevelEmblemIO />

        {/* Пауза анимаций эмблем достижений вне экрана */}
        <AchievementEmblemIO />

        {/* Общий чат: плавающая кнопка + боковая панель (локальная симуляция) */}
        <ChatWidget showChat={features?.chat !== false} showClans={features?.clans !== false} />

        {/*
          Апскейл плеера живёт в самом WatchBox: кадры чужого iframe Kodik
          захватываются через Element Capture и обрабатываются WebGL-шейдером
          прямо поверх плеера (см. lib/live-upscale + lib/upscale-shader).
          SVG-фильтр здесь был удалён: Chromium молча не применяет url(#…)-
          фильтры к кадрам кросс-доменного iframe (проверено замерами — 0/255),
          оставалась только цветокоррекция CSS-функциями.
        */}
      </body>
    </html>
  );
}
