import type { Metadata, Viewport } from "next";
import { Cinzel, Montserrat, Onest, Unbounded } from "next/font/google";
import "./globals.css";
import "./ui-system.css";
import "./ag-theme.css";
import "./effects.css";
import "./ag-tag.css";
import "./ag-tag-premium.css";
import "./premium-chip.css";
import "../components/section-mark.css";
import "./rating-gold.css";
import "./next-episode.css";
import "./schedule.css";
import "./settings-premium.css";
import "./wardrobe-premium.css";
import "./store-premium.css";
import "./premium-page.css";
import "./watchbox-premium.css";
import "./backdrops.css";
import "./quests.css";
import "./frame-search.css";
import "./streak-capsule.css";
import "./nickname.css";
import "./ag-comments.css";
import "./catalog.css";
import "./watch-together.css";
import "./aniswipe.css";
import "./cosmetics-shop.css";
import "./ags-premium.css";
import "./avatar-frame.css";
import "./frame-fx.css";
import "./level-emblem.css";
import "./achievement-emblem.css";
import "./achievements.css";
import "./stats-block.css";
import "./list-stats.css";
import "./guest-sidebar.css";
import "./guest-dialogs.css";
import "./guest-follows-report.css";
import "./profile-fx.css";
import "./battle-pass.css";
import "./battlepass-premium.css";
import "./profile-custom.css";
import "./profile-premium.css";
import { AuthDialogHost } from "@/components/AuthDialogHost";
import { ChatWidget } from "@/components/ChatWidget";
import { ErrorReporter } from "@/components/ErrorReporter";
import { DailyBonusHost } from "@/components/DailyBonusHost";
import { Footer } from "@/components/Footer";
import CloudSync from "@/components/CloudSync";
import { HeaderShell } from "@/components/site/HeaderShell";
import { PwaBoot } from "@/components/PwaBoot";
import { RouteProgress } from "@/components/RouteProgress";
import { SfxBoot } from "@/components/SfxBoot";
import "@/components/site/header.css";
import "@/components/site/header-promo.css";
import "@/components/site/search.css";
import "@/components/row-highlight.css";
import "./mobile-perf.css";
import { ProgressionBoot } from "@/components/ProgressionBoot";
import { EpisodeNotifier } from "@/components/EpisodeNotifier";
import { DevPanel } from "@/components/progression/DevPanel";
import { EcoBoot } from "@/components/progression/EcoBoot";
import { LevelEmblemIO } from "@/components/progression/LevelEmblemIO";
import { AchievementEmblemIO } from "@/components/progression/AchievementEmblemIO";
import { ToastHost } from "@/components/progression/ToastHost";
import { GuestWall } from "@/components/GuestWall";
import { HideInEmbed } from "@/components/HideInEmbed";
import { ReferralPremiumFlush } from "@/components/ReferralPremiumFlush";
import { SkyBackdrop } from "@/components/design/SkyBackdrop";

/**
 * Дисплейный шрифт сайта — Montserrat 800.
 *
 * Заголовки, названия разделов, крупные числа и надпись логотипа. Раньше на
 * эту роль стояли сразу три гарнитуры (Unbounded, Outfit и Dela); теперь
 * одна на все места — она же лежит в `--font-display`.
 *
 * Подключены латиница и кириллица: русские заголовки не должны уходить в
 * системный запасной шрифт.
 */
const montserrat = Montserrat({
  weight: ["800"],
  variable: "--font-display",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

/**
 * Основной шрифт — Onest.
 *
 * Весь текст: интерфейс, меню, кнопки, формы, описания. Лежит в
 * `--font-body`; размеры начертаний не менялись, менялась только гарнитура.
 *
 * Начертаний шесть, а не четыре (400/500/600/700): по коду идёт 116
 * `font-extrabold`, 199 `font-black` и 226 CSS-правил на 800/900 — без
 * этих двух файлов браузер рисовал бы на них синтетический жирный, и
 * начертание «плавало» по толщине. Сами объявления весов в разметке не
 * трогались.
 */
const onest = Onest({
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-body",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

/**
 * Шрифты новых разделов: Unbounded — заголовки совместного просмотра,
 * Cinzel — логотип AniSwipe. Подключены через next/font, поэтому
 * self-hosted и без внешних запросов в рантайме.
 */
const unbounded = Unbounded({
  weight: ["500", "700", "800"],
  variable: "--font-unbounded",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const cinzel = Cinzel({
  weight: ["600"],
  variable: "--font-cinzel",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "AniGalaxy — смотреть аниме онлайн в HD и 4K",
    template: "%s · AniGalaxy",
  },
  description:
    "Большая библиотека аниме онлайн: свежие релизы, онгоинги, фильмы и OVA. Плеер с 4K, выбор озвучек, быстрый поиск и фильтры.",
  keywords: ["аниме", "смотреть аниме", "онгоинги", "аниме онлайн", "аниме в 4K", "аниме 4K"],
  openGraph: {
    type: "website",
    siteName: "AniGalaxy",
    locale: "ru_RU",
    title: "AniGalaxy — смотреть аниме онлайн в HD и 4K",
    description: "Свежие релизы, онгоинги и классика аниме. Смотрите онлайн с выбором озвучки.",
  },
  robots: { index: true, follow: true },
  applicationName: "AniGalaxy",
  appleWebApp: { capable: true, title: "AniGalaxy", statusBarStyle: "black-translucent" },
  icons: { apple: "/pwa/icon-192.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#07070c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      data-scroll-behavior="smooth"
      className={`${montserrat.variable} ${onest.variable} ${unbounded.variable} ${cinzel.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "AniGalaxy",
              url: SITE_URL,
              inLanguage: "ru",
              potentialAction: {
                "@type": "SearchAction",
                target: `${SITE_URL}/catalog?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            }).replace(/</g, "\\u003c"),
          }}
        />
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
        {/* Шапка перенесена из прототипа Header_AniGalaxy_flat: стили лежат в
            components/site/header.css (под контейнером .agh), состояние
            палитры поиска держит HeaderShell. Старый Header импортирован
            ниже на время отката и в разметку не выводится. */}
        <HeaderShell />
        <PwaBoot />
        <RouteProgress />
        <SfxBoot />
        {/* Фон макетов: один на весь сайт, показывается только под .ag-root —
            см. body:has(.ag-root) в ag-theme.css. Идёт до <main>, чтобы лежать
            под содержимым, и без участия в раскладке: обе картинки fixed. */}
        <SkyBackdrop />
        {/* min-w-0 обязателен: main — флекс-элемент колоночного body, а у
            флекс-элементов min-width:auto. Без него любой широкий потомок
            (лента разделов магазина, карусели) растягивал всю страницу, и
            фиксированная шапка становилась шире экрана. */}
        {/* Отступ сверху больше не нужен: новая шапка (.agh .hd) — sticky,
            то есть сама занимает место в потоке. pt-16 остался от прежней
            фиксированной шапки и давал пустую полосу под шапкой. */}
        <main id="main" className="relative z-[1] min-w-0 flex-1">
          {children}
        </main>
        <Footer />
        <CloudSync />
        {/* Модалка авторизации живёт в layout, а не в шапке: у <header> есть
          backdrop-blur, а элементы с backdrop-filter/filter становятся
          containing block для position:fixed — панель тогда центрируется по
          64-пиксельной шапке и открывается с перекосом. Хост ленивый: сам
          модуль диалога подгружается только при первом клике «Войти».
        */}
        <AuthDialogHost />

        {/* Модалка «Ежедневный бонус» — тот же приём, что у авторизации */}
        <HideInEmbed><DailyBonusHost /></HideInEmbed>

        {/* Тосты наград (§12.6): подписка должна встать до ежедневного входа,
            иначе первые эффекты сессии уходят в никуда */}
        <HideInEmbed><ToastHost /></HideInEmbed>

        {/* Ежедневный вход прогрессии: событие шлётся только в браузере (useEffect) */}
        <ProgressionBoot />

        {/* Уведомления о выходе серий: расписание → тост, колокольчик, браузер */}
        <EpisodeNotifier />

        {/* Dev-панель прогрессии (§15 этап 7): рендерится только в dev-сборке
            и только с ?dev=1 — в production условие вырезается на этапе сборки */}
        <HideInEmbed><DevPanel /></HideInEmbed>

        {/* Режим «экономия» (§14): применяет <html data-eco> после гидратации */}
        <EcoBoot />

        {/* Пауза анимаций эмблем уровней вне экрана */}
        <LevelEmblemIO />

        {/* Пауза анимаций эмблем достижений вне экрана */}
        <AchievementEmblemIO />

        {/* Дни Premium за приглашённых: начисляются при первом открытии */}
        <ReferralPremiumFlush />
        <HideInEmbed><GuestWall /></HideInEmbed>

        {/* Общий чат: плавающая кнопка + боковая панель (локальная симуляция) */}
        <HideInEmbed><ChatWidget /></HideInEmbed>
        <ErrorReporter />

        {/*
          Обработки картинки плеера здесь нет и не было: у Kodik кадр
          чужого iframe, SVG url(#…)-фильтры Chromium к нему молча не
          применяет (проверено замерами — 0/255), CSS остаётся цветокоррекцией,
          а WebGL-апскейл поверх iframe требовал от браузера разрешения
          показывать вкладку — кнопку с ним убрали. Свой апскейл с целями
          2K/4K живёт у альтернативного плеера AniLiberty (см. AltPlayer).
        */}
      </body>
    </html>
  );
}
