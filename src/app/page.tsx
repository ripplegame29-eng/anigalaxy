import Link from "next/link";
import { Suspense } from "react";
import { AnimeRow } from "@/components/AnimeRow";
import { HeroSlider } from "@/components/HeroSlider";
import { Reveal } from "@/components/Reveal";
import { getActiveBlocks } from "@/lib/admin/content";
import { getTitleDetail, row } from "@/lib/kodik";
import { mangaRow, type MangaSort } from "@/lib/mangadex";
import { DonateWidget } from "@/components/DonateWidget";

/** Страница кэшируется на 5 минут — Kodik обновляет данные нечасто */
export const revalidate = 300;

const GENRES = [
  { title: "Фэнтези", count: 16769 },
  { title: "Экшен", count: 19868 },
  { title: "Драма", count: 23691 },
  { title: "Комедия", count: 20839 },
  { title: "Романтика", count: 18834 },
  { title: "Приключения", count: 8726 },
  { title: "Фантастика", count: 7681 },
  { title: "Детектив", count: 5756 },
  { title: "Ужасы", count: 3558 },
  { title: "Спорт", count: 1571 },
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
  { id: "serial-5310", video: "/video/bleach.mp4" }, // Блич
];

async function Hero() {
  // Блоки из панели «Контент» добавляются к зашитым слайдам. Раньше слайды
  // жили только в коде, а `getActiveBlocks` просто не был вызван нигде —
  // редактор в панели менял флаг в базе, а на сайте ничего не менялось.
  const extra = await getActiveBlocks("hero_slide")
    .then((blocks) =>
      blocks.flatMap((block) => {
        // Ссылка админа вида «/title/serial-56366» → id тайтла для Kodik
        const match = /^(\/(?:title|manga)\/[^/]+)/.exec(block.payload.link ?? "");
        const id = match ? (match[1].split("/").pop() ?? "") : "";
        return id ? [{ id, video: block.payload.video ?? "" }] : [];
      }),
    )
    .catch(() => []);

  const slides = [...HERO_SLIDES, ...extra];

  // Ошибка Kodik не должна ронять главную — гасим её до конструирования JSX
  const details = await Promise.all(slides.map((s) => getTitleDetail(s.id))).catch(
    () => null,
  );
  if (!details) return null;

  // Порядок сохраняется: details[i] <-> slides[i]
  const items = details.flatMap((d, i) =>
    d ? [{ ...d.card, heroVideo: slides[i].video }] : [],
  );
  if (!items.length) return null;

  return <HeroSlider items={items} />;
}

/**
 * Объявления и баннеры из панели «Контент».
 *
 * Если ничего не пришло — не рендерим ничего: пустые отступы от отсутствия
 * блоков на главной выглядят как поломка вёрстки.
 */
async function SiteBanners() {
  const [notices, banners] = await Promise.all([
    getActiveBlocks("notice").catch(() => []),
    getActiveBlocks("banner").catch(() => []),
  ]);

  if (!notices.length && !banners.length) return null;

  return (
    <>
      {notices.map((block) => (
        <div key={block.id} className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">
            <span className="font-extrabold">{block.payload.title}</span>
            {block.payload.text ? (
              <span className="text-gold/80">{block.payload.text}</span>
            ) : null}
            {block.payload.link ? (
              <a href={block.payload.link} className="ml-auto underline hover:opacity-80">
                Подробнее
              </a>
            ) : null}
          </div>
        </div>
      ))}

      {banners.map((block) => (
        <div key={block.id} className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6">
          <a
            href={block.payload.link}
            className="flex items-center justify-between gap-4 rounded-2xl border border-accent/30 bg-accent/10 px-5 py-4 transition hover:border-accent/60"
          >
            <span>
              <span className="block font-bold">{block.payload.title}</span>
              {block.payload.description ? (
                <span className="mt-0.5 block text-sm text-white/60">
                  {block.payload.description}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-sm text-accent-2">→</span>
          </a>
        </div>
      ))}
    </>
  );
}

async function RowSection({
  title,
  params,
  href,
  accent = false,
}: {
  title: string;
  params: Record<string, string | number | undefined>;
  href?: string;
  accent?: boolean;
}) {
  // Ошибка Kodik не должна ронять главную: гасим её до конструирования JSX
  const cards = await row(title, params).catch(() => null);
  if (!cards) return null;
  return <AnimeRow title={title} cards={cards} href={href} accent={accent} />;
}

function RowSkeleton({ title }: { title: string }) {
  return (
    <section>
      <div className="mb-5 flex items-center gap-3">
        <span className="h-7 w-1.5 rounded-full bg-white/15" />
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

/**
 * Ряд манги. Kodik мангу не отдаёт, поэтому источник отдельный — MangaDex
 * (`lib/mangadex`): ошибка сети гасится внутри, и страница живёт дальше.
 * Карточки ведут в собственный раздел `/manga`, где читается глава.
 */
async function MangaRowSection({
  title,
  sort,
  accent = false,
}: {
  title: string;
  sort: MangaSort;
  accent?: boolean;
}) {
  const cards = await mangaRow(sort, 30).catch(() => null);
  if (!cards?.length) return null;
  return <AnimeRow title={title} cards={cards} accent={accent} href="/manga" />;
}

/* ------------------------------------------------------------------ */

export default function HomePage() {
  return (
    <>
      {/* Слайдер новинок */}
      <Suspense fallback={<div className="skeleton h-[74vh] min-h-[520px] w-full sm:h-[78vh]" />}>
        <Hero />
      </Suspense>

      {/* Объявления и баннеры из панели «Контент». Ошибка чтения не должна
          ронять главную, поэтому компонент гасит её сам и возвращает null. */}
      <Suspense fallback={null}>
        <SiteBanners />
      </Suspense>

      <div className="mx-auto max-w-7xl space-y-14 px-4 pb-6 pt-12 sm:px-6 sm:pt-16">
        {/* Два виджета под плеером (донат + «Боевой пропуск») — iframe с
            копией HTML-файла; прозрачный фон + container-type, чтобы рамки
            и скроллбаров не было, а вокруг виджета был фон сайта.
            marginInline −12px компенсирует padding body виджета (12px):
            баннеры становятся в ширину ровно как ряды онгоингов */}
        <section
          aria-label="Донат и боевой пропуск"
          style={{ containerType: "inline-size", marginInline: "-12px" }}
        >
          <DonateWidget />
        </section>

        <Suspense fallback={<RowSkeleton title="Онгоинги" />}>
          <RowSection
            title="Онгоинги"
            accent
            href="/catalog?status=ongoing"
            params={{
              types: "anime,anime-serial",
              anime_status: "ongoing",
              sort: "updated_at",
              order: "desc",
              limit: 20,
            }}
          />
        </Suspense>

        <Suspense fallback={<RowSkeleton title="Новинки сезона" />}>
          <RowSection
            title="Новинки сезона"
            href="/catalog?sort=fresh"
            params={{
              types: "anime,anime-serial",
              sort: "created_at",
              order: "desc",
              year: "2025,2026",
              limit: 20,
            }}
          />
        </Suspense>

        <Suspense fallback={<RowSkeleton title="Топ рейтинга" />}>
          <RowSection
            title="Топ рейтинга"
            href="/catalog?sort=rating"
            params={{
              types: "anime,anime-serial",
              sort: "shikimori_rating",
              order: "desc",
              limit: 20,
            }}
          />
        </Suspense>

        <Suspense fallback={<RowSkeleton title="Аниме-фильмы" />}>
          <RowSection
            title="Аниме-фильмы"
            href="/catalog?type=movie"
            params={{
              types: "anime",
              sort: "kinopoisk_rating",
              order: "desc",
              limit: 20,
            }}
          />
        </Suspense>

        {/* ------------------------------- Манга ---------------------------- */}
        {/* Внизу, под аниме-фильмами: два среза как в манга-референсе —
            свежие тайтлы каталога и топ по рейтингу сообщества. */}
        <Suspense fallback={<RowSkeleton title="Манга · Горячие новинки" />}>
          <MangaRowSection title="Манга · Горячие новинки" sort="hot" accent />
        </Suspense>

        <Suspense fallback={<RowSkeleton title="Манга · Лучшее" />}>
          <MangaRowSection title="Манга · Лучшее" sort="best" />
        </Suspense>

        {/* Быстрый переход по жанрам */}
        <Reveal as="section">
          <div className="mb-5 flex items-center gap-3">
            <span className="h-7 w-1.5 rounded-full bg-accent" />
            <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">Популярные жанры</h2>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {GENRES.map((g, i) => (
              <Link
                key={g.title}
                href={`/catalog?genre=${encodeURIComponent(g.title)}`}
                style={{ animationDelay: `${i * 35}ms` }}
                className="btn-ghost animate-fade-up rounded-xl bg-white/6 px-4 py-2.5 text-sm font-semibold text-white/80 ring-1 ring-white/10 hover:bg-accent/15 hover:text-white hover:ring-accent/40"
              >
                {g.title}
                <span className="ml-2 text-xs text-muted">{g.count.toLocaleString("ru-RU")}</span>
              </Link>
            ))}
          </div>
        </Reveal>
      </div>
    </>
  );
}
