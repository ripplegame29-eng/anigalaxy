import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Poster } from "@/components/Poster";
import { AnimeRow } from "@/components/AnimeRow";
import { WatchBox } from "@/components/WatchBox";
import { TitleActions } from "@/components/TitleActions";
import { FranchiseTimeline, type FranchiseItem } from "@/components/FranchiseTimeline";
import { ScreenshotsGallery } from "@/components/ScreenshotsGallery";
import { CommentsBlock } from "@/components/comments/CommentsBlock";
import {
  cardKey,
  formatRating,
  formatVotes,
  kindLabel,
  statusLabel,
  statusTone,
  truncate,
} from "@/lib/anime";
import {
  franchise,
  getTranslations,
  getTitleDetail,
  similar,
} from "@/lib/kodik";
import {
  screenshots as shikimoriScreenshots,
  trailer as shikimoriTrailer,
} from "@/lib/shikimori";

interface PageParams {
  params: Promise<{ id: string }>;
}

const ID_PATTERN = /^(serial|movie)-\d+$/;

/* ------------------------------ SEO -------------------------------- */

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) return { title: "Тайтл не найден" };

  try {
    const detail = await getTitleDetail(id);
    if (!detail) return { title: "Тайтл не найден" };

    const { card } = detail;
    const meta = [
      card.year,
      kindLabel(card.kind),
      statusLabel(card.status),
      card.lastEpisode ? `${card.lastEpisode} эп.` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      title: card.title,
      description:
        truncate(card.description, 155) ??
        `${card.title}${meta ? ` — ${meta}` : ""}. Смотреть онлайн с выбором озвучки.`,
      openGraph: {
        title: card.title,
        description: truncate(card.description, 155),
        images: card.poster ? [{ url: card.poster, alt: card.title }] : undefined,
        type: "video.tv_show",
      },
    };
  } catch {
    return { title: "Тайтл" };
  }
}

/* ----------------------------- Страница ---------------------------- */

export default async function TitlePage({ params }: PageParams) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) notFound();

  let detail;
  try {
    detail = await getTitleDetail(id);
  } catch {
    detail = null;
  }
  if (!detail) notFound();

  // Озвучки, похожие, франшиза, кадры и трейлер грузим параллельно с деталями
  const [translations, similarCards, franchiseCards, shots, trailerVideo] =
    await Promise.all([
      getTranslations(id).catch(() => []),
      similar(detail.card).catch(() => []),
      franchise(detail.card).catch(() => []),
      shikimoriScreenshots(detail.card.shikimoriId).catch(() => []),
      shikimoriTrailer(detail.card.shikimoriId, detail.card.title).catch(() => null),
    ]);

  const card = detail.card;
  const rating = formatRating(card.rating);
  const votes = formatVotes(card.ratingVotes);
  const backdrop = card.screenshots?.[0] ?? card.poster;

  const franchiseItems: FranchiseItem[] = franchiseCards.map((item) => ({
    id: item.id,
    title: item.title,
    year: item.year,
    kind: item.kind,
    poster: item.poster,
    current: cardKey(item) === cardKey(card),
  }));

  // Кадры Shikimori — основной источник; если API недоступен, берём те,
  // что Kodik уже отдал вместе с material_data (тоже кадры Shikimori)
  const galleryShots = shots.length
    ? shots
    : (card.screenshots ?? []).map((url) => ({ url, thumb: url }));

  const metaRows: { label: string; value: string }[] = [
    ...(card.year ? [{ label: "Год выпуска", value: String(card.year) }] : []),
    ...(kindLabel(card.kind) ? [{ label: "Тип", value: kindLabel(card.kind)! }] : []),
    ...(statusLabel(card.status) ? [{ label: "Статус", value: statusLabel(card.status)! }] : []),
    ...(card.lastEpisode
      ? [
          {
            label: "Эпизоды",
            value: card.episodesTotal
              ? `${card.episodesAired ?? card.lastEpisode} / ${card.episodesTotal}`
              : `вышло ${card.lastEpisode}`,
          },
        ]
      : []),
    ...(card.duration ? [{ label: "Длительность", value: `${card.duration} мин.` }] : []),
    ...(card.studios?.length ? [{ label: "Студии", value: card.studios.join(", ") }] : []),
    ...(card.translation ? [{ label: "Озвучка", value: card.translation }] : []),
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    name: card.title,
    alternateName: card.titleOrig,
    datePublished: card.year ? String(card.year) : undefined,
    description: truncate(card.description, 300),
    image: card.poster,
    genre: card.genres,
    aggregateRating:
      card.rating != null
        ? {
            "@type": "AggregateRating",
            ratingValue: card.rating,
            bestRating: 10,
            ratingCount: card.ratingVotes ?? undefined,
          }
        : undefined,
  };

  return (
    <>
      {/* ------------------------- Шапка тайтла ------------------------- */}
      <section className="relative isolate overflow-hidden border-b border-line">
        {/* Размытый фон из кадров/постера */}
        <div className="absolute inset-0 -z-10" aria-hidden>
          {backdrop && (
            <Poster
              src={backdrop}
              alt=""
              priority
              sizes="100vw"
              className="scale-110 object-cover opacity-30 blur-2xl"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-ink/60 via-ink/85 to-ink" />
        </div>

        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9">
          <Breadcrumbs
            items={[
              ...(kindLabel(card.kind) ? [{ label: kindLabel(card.kind)!, href: `/catalog?kind=${card.kind}` }] : []),
              { label: card.title },
            ]}
          />

          <div className="grid gap-6 md:grid-cols-[280px_minmax(0,1fr)] md:gap-8 lg:grid-cols-[330px_minmax(0,1fr)]">
            {/* Постер — крупный акцентный блок, как на референсе */}
            <div className="w-[170px] sm:w-[210px] md:w-full">
              <div className="group relative aspect-[2/3] overflow-hidden rounded-2xl bg-card ring-1 ring-white/12 shadow-[0_40px_90px_-40px_rgba(0,0,0,1)] transition duration-300 hover:ring-accent/45 hover:shadow-[0_50px_110px_-45px_rgba(31,123,255,0.6)]">
                <Poster
                  src={card.poster}
                  alt={card.title}
                  title={card.title}
                  priority
                  sizes="(max-width: 768px) 210px, (max-width: 1024px) 280px, 330px"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                />

                {/* Оверлей при наведении */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </div>
            </div>

            {/* Информация */}
            <div className="min-w-0 animate-fade-up">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {statusLabel(card.status) && (
                  <span className={`rounded-md px-2.5 py-1 text-xs font-bold ring-1 backdrop-blur ${statusTone(card.status)}`}>
                    {statusLabel(card.status)}
                  </span>
                )}
                {kindLabel(card.kind) && (
                  <span className="rounded-md bg-white/8 px-2.5 py-1 text-xs font-semibold text-white/75 ring-1 ring-white/10">
                    {kindLabel(card.kind)}
                  </span>
                )}
                {card.year && (
                  <span className="rounded-md bg-white/8 px-2.5 py-1 text-xs font-semibold text-white/75 ring-1 ring-white/10">
                    {card.year}
                  </span>
                )}
                {card.lastEpisode ? (
                  <span className="rounded-md bg-white/8 px-2.5 py-1 text-xs font-semibold text-white/75 ring-1 ring-white/10">
                    {card.lastEpisode} серий
                  </span>
                ) : null}
              </div>

              <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                <span className="text-gradient">{card.title}</span>
              </h1>

              {card.titleOrig && card.titleOrig !== card.title && (
                <p className="mt-2 text-sm text-muted">{card.titleOrig}</p>
              )}

              {/* Рейтинг и мета */}
              <div className="mt-5 flex flex-wrap items-center gap-5">
                {rating && (
                  <div className="flex items-center gap-3 rounded-2xl bg-white/6 px-4 py-3 ring-1 ring-white/10">
                    <span className="text-3xl font-extrabold tabular-nums text-gold">{rating}</span>
                    <span className="text-xs leading-tight text-muted">
                      {card.ratingSource === "shikimori"
                        ? "Shikimori"
                        : card.ratingSource === "kinopoisk"
                          ? "Кинопоиск"
                          : "IMDb"}
                      {votes && (
                        <>
                          <br />
                          {votes} оценок
                        </>
                      )}
                    </span>
                  </div>
                )}

                <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
                  {metaRows.map((row) => (
                    <div key={row.label} className="min-w-0">
                      <dt className="text-xs text-muted">{row.label}</dt>
                      <dd className="truncate font-semibold text-white/90" title={row.value}>
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Жанры */}
              {card.genres.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {card.genres.slice(0, 8).map((genre) => (
                    <Link
                      key={genre}
                      href={`/catalog?genre=${encodeURIComponent(genre)}`}
                      className="btn-ghost rounded-lg bg-white/6 px-3 py-1.5 text-xs font-semibold text-white/80 ring-1 ring-white/10 hover:bg-accent/15 hover:text-white hover:ring-accent/40"
                    >
                      {genre}
                    </Link>
                  ))}
                </div>
              )}

              {/* Описание */}
              {card.description && (
                <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted sm:text-[15px]">
                  {card.description}
                </p>
              )}

              {/* Действия */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a href="#watch" className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.9-6.86a1.04 1.04 0 0 0 0-1.76L9.56 4.26A1.04 1.04 0 0 0 8 5.14Z" />
                  </svg>
                  Смотреть онлайн
                </a>

                {/* «В избранное» и «В подборку» (localStorage + модалка) */}
                <TitleActions anime={{ id: card.id, title: card.title, poster: card.poster }} />

                <Link
                  href="/catalog"
                  className="btn-ghost inline-flex items-center gap-2 rounded-xl bg-white/8 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/12 hover:bg-white/14"
                >
                  В каталог
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------- Плеер --------------------------- */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="h-6 w-1.5 rounded-full bg-accent" />
          <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">Смотреть онлайн</h2>
        </div>

        <WatchBox initialDetail={detail} translations={translations} />
      </div>

      {/* -------------------- Хронология франшизы -------------------- */}
      <FranchiseTimeline items={franchiseItems} />

      {/* ------------------ Кадры из аниме + трейлер ----------------- */}
      <ScreenshotsGallery
        shots={galleryShots}
        trailer={trailerVideo}
        title={card.title}
      />

      {/* ------------------------- Похожие --------------------------- */}
      {similarCards.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
          <AnimeRow
            title="Похожие тайтлы"
            cards={similarCards}
            href={`/catalog?genre=${encodeURIComponent(card.genres[0] ?? "")}`}
          />
        </div>
      )}

      {/* ------------------------ Комментарии ------------------------ */}
      <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        <CommentsBlock scope={{ kind: "title", titleId: card.id }} />
      </div>

      {/* JSON-LD для поисковиков */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
