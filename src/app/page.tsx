import { GenreStrip } from "@/components/GenreStrip";
import { RecommendRow } from "@/components/RecommendRow";
import { Suspense } from "react";
import { ContinueRow } from "@/components/ContinueRow";
import { HomeTabsRow } from "@/components/HomeTabsRow";
import { TopTenRow } from "@/components/TopTenRow";
import { WideFilmRow } from "@/components/WideFilmRow";
import { HeroSlider } from "@/components/HeroSlider";
import { getTitleDetail, row } from "@/lib/kodik";
import { mangaRow } from "@/lib/senku";
import { HomePromo } from "@/components/HomePromo";
import { GachaBanner } from "@/components/GachaBanner";
import { TelegramCta } from "@/components/TelegramCta";
import { HomeTopUsers } from "@/components/HomeTopUsers";

/** Страница кэшируется на 5 минут — Kodik обновляет данные нечасто */
// Главная тянет внешние каталоги (Kodik, манга): при сборке на сервере они бывают медленными,
// поэтому страница строится по запросу, а данные кэшируются внутри.
export const dynamic = "force-dynamic";

/* Аниме-жанры (Shikimori), а не киношные: названия как в фильтре каталога */
const GENRES = [
  { title: "Сёнен" },
  { title: "Исэкай" },
  { title: "Экшен" },
  { title: "Фэнтези" },
  { title: "Романтика" },
  { title: "Комедия" },
  { title: "Сверхъестественное" },
  { title: "Повседневность" },
  { title: "Школа" },
  { title: "Меха" },
  { title: "Психологическое" },
  { title: "Сэйнэн" },
  { title: "Сёдзё" },
  { title: "Реинкарнация" },
  { title: "Драма" },
  { title: "Приключения" },
];

/* ------------------------------------------------------------------ */
/* Асинхронные секции (стримятся параллельно через Suspense)           */
/* ------------------------------------------------------------------ */

/**
 * Закреплённый состав hero: каждому тайтлу соответствует свой локальный
 * фоновый ролик из `public/video` (имя файла = имя тайтла).
 */
const HERO_SLIDES = [
  { id: "serial-56366", video: "/video/solo-leveling.mp4" }, // Поднятие уровня в одиночку
  { id: "serial-27443", video: "/video/rezero.mp4" }, // Re:Zero. Жизнь с нуля…
  { id: "serial-29315", video: "/video/jujutsu-kaisen.mp4" }, // Магическая битва
  { id: "serial-68228", video: "/video/gachiakuta.mp4" }, // Гатиакута
  { id: "serial-46220", video: "/video/bleach.mp4" }, // Блич: Тысячелетняя кровавая война
];

async function Hero() {
  // Ошибка Kodik не должна ронять главную — гасим её до конструирования JSX
  const details = await Promise.all(HERO_SLIDES.map((s) => getTitleDetail(s.id))).catch(
    () => null,
  );
  if (!details) return null;

  // Порядок сохраняется: details[i] <-> HERO_SLIDES[i]
  const items = details.flatMap((d, i) =>
    d ? [{ ...d.card, heroVideo: HERO_SLIDES[i].video }] : [],
  );
  if (!items.length) return null;

  return <HeroSlider items={items} />;
}

function RowSkeleton({ title }: { title: string }) {
  return (
    <section>
      <div className="mb-5 flex items-center gap-3">
        <span className="skeleton h-8 w-8 rounded-[10px]" />
        <div className="skeleton h-5 w-44 rounded-md" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton aspect-[2/3] rounded-2xl" />
        ))}
      </div>
      <span className="sr-only">{title}</span>
    </section>
  );
}

/* ------------------------------------------------------------------ */

/**
 * «Сейчас выходит»: онгоинги и новинки сезона — два среза одного и того же,
 * поэтому это одна лента с вкладками, а тайтлы из «Новинок» не повторяют
 * уже показанные в «Онгоингах».
 */
async function AiringSection() {
  const [ongoing, fresh] = await Promise.all([
    row("Онгоинги", {
      types: "anime,anime-serial",
      anime_status: "ongoing",
      sort: "updated_at",
      order: "desc",
      limit: 20,
    }).catch(() => []),
    row("Новинки сезона", {
      types: "anime,anime-serial",
      sort: "created_at",
      order: "desc",
      year: "2025,2026",
      limit: 24,
    }).catch(() => []),
  ]);
  const seen = new Set(ongoing.map((card) => card.id));
  const freshOnly = fresh.filter((card) => !seen.has(card.id));
  return (
    <HomeTabsRow
      title="Сейчас выходит"
      mark="flame"
      tabs={[
        { id: "ongoing", label: "Онгоинги", cards: ongoing, href: "/catalog?status=ongoing" },
        { id: "fresh", label: "Новинки сезона", cards: freshOnly, href: "/catalog?sort=fresh" },
      ]}
    />
  );
}

/** Топ-10 (с цифрами) и фильмы (широкие карточки), без повторов между ними */
async function TopAndFilmsSection() {
  const [top, films] = await Promise.all([
    row("Топ рейтинга", {
      types: "anime,anime-serial",
      sort: "shikimori_rating",
      order: "desc",
      limit: 20,
    }).catch(() => []),
    row("Аниме-фильмы", {
      types: "anime",
      sort: "kinopoisk_rating",
      order: "desc",
      limit: 20,
    }).catch(() => []),
  ]);
  const topIds = new Set(top.slice(0, 10).map((card) => card.id));
  return (
    <>
      <TopTenRow title="Топ-10 по рейтингу" cards={top} href="/catalog?sort=rating" />
      <WideFilmRow
        title="Аниме-фильмы"
        cards={films.filter((card) => !topIds.has(card.id))}
        href="/catalog?type=movie"
      />
    </>
  );
}

/** Манга: «Горячие новинки» и «Лучшее» — одна лента с вкладками */
async function MangaSection() {
  const [hot, best] = await Promise.all([
    mangaRow("hot", 30).catch(() => null),
    mangaRow("best", 30).catch(() => null),
  ]);
  return (
    <HomeTabsRow
      title="Манга"
      mark="book"
      tabs={[
        { id: "hot", label: "Горячие новинки", cards: hot ?? [], href: "/manga" },
        { id: "best", label: "Лучшее", cards: best ?? [], href: "/manga" },
      ]}
    />
  );
}

export default function HomePage() {
  return (
    <>
      {/* Слайдер новинок */}
      <Suspense fallback={<div className="skeleton h-[74vh] min-h-[520px] w-full sm:h-[78vh]" />}>
        <Hero />
      </Suspense>

      <div className="mx-auto max-w-7xl space-y-14 px-4 pb-6 pt-12 sm:px-6 sm:pt-16">
        {/* Плашки: Premium и Боевой пропуск */}
        <section aria-label="Premium и боевой пропуск">
          <HomePromo />
        </section>

        {/* Гача: витрина карточек сразу под Premium-плашками */}
        <GachaBanner />

        {/* Продолжить просмотр — прямо над онгоингами, как в макете. Блок
            клиентский и пуст без истории просмотра: без записей он ничего
            не рисует. */}
        <ContinueRow />

        {/* Быстрый переход по жанрам — компактной полосой, без отдельной секции */}
        <GenreStrip genres={GENRES.map((g) => g.title)} />

        <Suspense fallback={<RowSkeleton title="Сейчас выходит" />}>
          <AiringSection />
        </Suspense>

        <RecommendRow />

        <Suspense fallback={<RowSkeleton title="Топ-10" />}>
          <TopAndFilmsSection />
        </Suspense>


        <Suspense fallback={<RowSkeleton title="Манга" />}>
          <MangaSection />
        </Suspense>

        {/* Закрытый канал в Telegram — финальный акцент главной */}
        <TelegramCta />

        {/* Лидеры сообщества — самый низ главной */}
        <HomeTopUsers />
      </div>
    </>
  );
}
