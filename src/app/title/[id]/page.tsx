import { NextEpisode } from "@/components/NextEpisode";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReadMore } from "@/components/ReadMore";
import { Poster } from "@/components/Poster";
import { AnimeRow } from "@/components/AnimeRow";
import { WatchBox } from "@/components/WatchBox";
import { WatchButton } from "@/components/WatchButton";
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
  nextEpisode as shikimoriNextEpisode,
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
      alternates: { canonical: `/title/${id}` },
      twitter: {
        card: "summary_large_image",
        title: card.title,
        description: truncate(card.description, 155),
        images: card.poster ? [card.poster] : undefined,
      },
    };
  } catch {
    return { title: "Тайтл" };
  }
}

/** Нейтральный чип показателя (год, длительность, серии) */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-xl bg-white/[0.05] px-3.5 py-2 text-sm font-bold tabular-nums text-white/85 ring-1 ring-white/[0.09]">
      {children}
    </span>
  );
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
  const [translations, similarCards, franchiseCards, shots, trailerVideo, upcoming] =
    await Promise.all([
      getTranslations(id).catch(() => []),
      similar(detail.card).catch(() => []),
      franchise(detail.card).catch(() => []),
      shikimoriScreenshots(detail.card.shikimoriId).catch(() => []),
      shikimoriTrailer(detail.card.shikimoriId, detail.card.title).catch(() => null),
      shikimoriNextEpisode(detail.card.shikimoriId).catch(() => null),
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

  // Год, длительность и серии показаны чипами справа, статус — плашкой над
  // названием; здесь только то, чего нигде больше нет.
  const metaRows: { label: string; value: string }[] = [
    ...(kindLabel(card.kind) ? [{ label: "Тип", value: kindLabel(card.kind)! }] : []),
    ...(card.studios?.length ? [{ label: "Студия", value: card.studios.join(", ") }] : []),
    ...(card.translation ? [{ label: "Озвучка", value: card.translation }] : []),
  ];

  /* ---------- «Особенности» и «Частые вопросы» — только из реальных данных ---------- */
  const voices = translations.filter((t) => t.type === "voice");
  const episodesNow = card.episodesAired ?? card.lastEpisode;
  const episodesLine = card.episodesTotal
    ? card.status === "released"
      ? `${card.episodesTotal} серий`
      : `вышло ${episodesNow ?? 0} из ${card.episodesTotal} серий`
    : episodesNow
      ? `вышло ${episodesNow} серий`
      : null;

  const features: string[] = [];
  if (episodesLine)
    features.push(
      card.status === "ongoing"
        ? `Выходит прямо сейчас: ${episodesLine}`
        : card.status === "anons"
          ? "Анонсировано — серии появятся после выхода"
          : `Завершено: ${episodesLine}`,
    );
  if (card.duration) features.push(`Длительность серии — около ${card.duration} мин.`);
  if (card.studios?.length) features.push(`Студия: ${card.studios.join(", ")}`);
  if (voices.length)
    features.push(`Доступно озвучек: ${voices.length} — выбирайте в плеере ниже`);
  if (rating)
    features.push(
      `Оценка зрителей ${rating} из 10${votes ? ` (${votes} оценок)` : ""}`,
    );
  if (franchiseItems.length > 1) features.push(`Часть франшизы из ${franchiseItems.length} тайтлов`);
  if (card.genres.length) features.push(`Жанры: ${card.genres.slice(0, 4).join(", ")}`);

  const faq: { q: string; a: string }[] = [];
  if (episodesLine)
    faq.push({
      q: `Сколько серий в аниме «${card.title}»?`,
      a:
        card.status === "ongoing"
          ? `Сейчас ${episodesLine}. Аниме ещё выходит — новые серии появляются на странице по мере выхода.`
          : `${episodesLine[0].toUpperCase()}${episodesLine.slice(1)}.`,
    });
  if (card.status)
    faq.push({
      q: "Завершено ли аниме?",
      a:
        card.status === "ongoing"
          ? "Нет, тайтл ещё выходит. Добавьте его в «Смотрю», чтобы не потерять место."
          : card.status === "anons"
            ? "Пока это анонс: серии ещё не вышли."
            : "Да, тайтл завершён — все серии доступны для просмотра.",
    });
  if (voices.length)
    faq.push({
      q: "Какие озвучки доступны?",
      a: `${voices
        .slice(0, 8)
        .map((v) => v.title)
        .join(", ")}${voices.length > 8 ? ` и ещё ${voices.length - 8}` : ""}. Переключать озвучку можно в плеере.`,
    });
  faq.push({
    q: `Где смотреть «${card.title}» онлайн?`,
    a: "Прямо на этой странице: плеер ниже с выбором источника, озвучки и серии. Место просмотра запоминается, поэтому можно продолжить с нужной серии.",
  });
  if (similarCards.length)
    faq.push({
      q: "Что посмотреть после этого аниме?",
      a: `Ниже на странице — подборка похожих тайтлов (${similarCards.length}).`,
    });

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
      <section className="relative isolate overflow-hidden">
        {/* Фон: кадр/постер, сильно размытый и затемнённый до цвета сайта */}
        <div className="absolute inset-0 -z-10" aria-hidden>
          {backdrop && (
            <Poster
              src={backdrop}
              alt=""
              priority
              sizes="100vw"
              className="scale-110 object-cover opacity-25 blur-3xl"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-ink/55 via-ink/90 to-ink" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-8 pt-8 sm:px-6 sm:pb-10 sm:pt-10">
          <div className="grid gap-7 md:grid-cols-[260px_minmax(0,1fr)] md:gap-9 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-12">
            {/* ===== Левая колонка: постер, действия, сведения ===== */}
            {/* На телефоне ширину колонки задаёт не постер: кнопки и карточки
                растягиваются во всю страницу (иначе «Избранное» и «Подборки»
                обрезались многоточием), а сам постер остаётся по центру. */}
            <aside className="mx-auto w-full max-w-[460px] space-y-3 md:mx-0 md:max-w-none">
              {/* Телефон: название сразу над постером — а не в конце экрана после кнопок */}
              <div className="mb-1 text-center md:hidden" aria-hidden>
                <p className="font-display text-[26px] font-extrabold leading-[1.1] tracking-[-0.03em] text-white">{card.title}</p>
                {card.titleOrig && card.titleOrig !== card.title && (
                  <p className="mt-1 text-sm font-semibold text-white/55">{card.titleOrig}</p>
                )}
              </div>
              <div className="group relative mx-auto aspect-[2/3] w-[210px] overflow-hidden rounded-3xl sm:w-[240px] md:w-full bg-card ring-1 ring-white/12 shadow-[0_40px_90px_-40px_rgba(0,0,0,1)] transition duration-300 hover:ring-accent/45 hover:shadow-[0_50px_110px_-45px_rgba(43,127,255,0.55)]">
                <Poster
                  src={card.poster}
                  alt={card.title}
                  title={card.title}
                  priority
                  sizes="(max-width: 768px) 240px, (max-width: 1024px) 260px, 320px"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />
              </div>

              {/* Главное действие — во всю ширину, остальное — под ним */}
              <WatchButton id={card.id} />
              <TitleActions anime={{ id: card.id, title: card.title, poster: card.poster }} />

              {/* Идущий тайтл: живой отсчёт до следующей серии (данные Shikimori) */}
              {upcoming && (
                <NextEpisode
                  at={upcoming.at}
                  episode={upcoming.episode}
                  total={upcoming.total}
                  title={card.title}
                />
              )}

              {/* Сведения: нейтрально-тёмная карточка, как остальные блоки */}
              {metaRows.length > 0 && (
                <dl className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-[#0d0d14] ring-1 ring-white/[0.07]">
                  {metaRows.map((row) => (
                    <div key={row.label} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                      <dt className="shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                        {row.label}
                      </dt>
                      <dd className="min-w-0 truncate text-right text-sm font-bold text-white/90" title={row.value}>
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </aside>

            {/* ===== Правая колонка: название, показатели, описание ===== */}
            <div className="min-w-0 animate-fade-up">
              {/* Строка-ярлык: статус · тип */}
              <div className="mb-4 flex flex-wrap items-center gap-2.5 text-xs font-bold uppercase tracking-[0.14em]">
                {statusLabel(card.status) && (
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ring-1 backdrop-blur ${statusTone(card.status)}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
                    {statusLabel(card.status)}
                  </span>
                )}
                {kindLabel(card.kind) && <span className="text-muted">{kindLabel(card.kind)}</span>}
              </div>

              <h1 className="font-display text-[clamp(30px,5vw,58px)] max-md:sr-only font-extrabold leading-[1.05] tracking-[-0.035em] text-white">
                {card.title}
              </h1>

              {card.titleOrig && card.titleOrig !== card.title && (
                <p className="mt-3 text-lg font-semibold text-white/60 max-md:hidden sm:text-xl">{card.titleOrig}</p>
              )}
              {card.otherTitles && card.otherTitles.length > 0 && (
                <p className="mt-1.5 line-clamp-1 text-sm text-muted">
                  {card.otherTitles.slice(0, 3).join(" / ")}
                </p>
              )}

              {/* Показатели чипами */}
              <div className="mt-6 flex flex-wrap items-center gap-2">
                {rating && (
                  <span className="inline-flex items-center gap-2 rounded-xl bg-accent/12 px-3.5 py-2 text-sm font-extrabold text-white ring-1 ring-accent/35">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-gold" fill="currentColor" aria-hidden>
                      <path d="m12 2.5 2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8L12 2.5Z" />
                    </svg>
                    <span className="tabular-nums">{rating}</span>
                    {votes && <span className="text-xs font-semibold text-muted">{votes}</span>}
                  </span>
                )}
                {card.year && <Chip>{card.year}</Chip>}
                {card.duration ? <Chip>{card.duration} мин.</Chip> : null}
                {card.lastEpisode ? (
                  <Chip>
                    {card.episodesTotal
                      ? `${card.episodesAired ?? card.lastEpisode} / ${card.episodesTotal} эп.`
                      : `${card.lastEpisode} эп.`}
                  </Chip>
                ) : null}
              </div>

              {/* Жанры */}
              {card.genres.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {card.genres.slice(0, 8).map((genre) => (
                    <Link
                      key={genre}
                      href={`/catalog?genre=${encodeURIComponent(genre)}`}
                      className="rounded-full bg-white/[0.05] px-3.5 py-1.5 text-[13px] font-semibold text-white/80 ring-1 ring-white/[0.09] transition hover:bg-accent/15 hover:text-white hover:ring-accent/45"
                    >
                      {genre}
                    </Link>
                  ))}
                </div>
              )}

              {/* Описание */}
              {card.description && (
                <div className="mt-7 max-w-3xl border-t border-white/[0.07] pt-6">
                  <ReadMore text={card.description} />
                </div>
              )}

              {/* Особенности */}
              {features.length > 0 && (
                <section className="mt-9 max-w-3xl" aria-labelledby="tp-features">
                  <h2
                    id="tp-features"
                    className="mb-4 flex items-center gap-2.5 font-display text-[13px] font-extrabold uppercase tracking-[0.16em] text-white"
                  >
                    <span className="h-4 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" />
                    Особенности
                  </h2>
                  <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                    {features.map((text) => (
                      <li key={text} className="flex items-start gap-3 text-[14.5px] leading-snug text-white/80">
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-2 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                        {text}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Частые вопросы */}
              {faq.length > 0 && (
                <section className="mt-9 max-w-3xl" aria-labelledby="tp-faq">
                  <h2
                    id="tp-faq"
                    className="mb-3 flex items-center gap-2.5 font-display text-[13px] font-extrabold uppercase tracking-[0.16em] text-white"
                  >
                    <span className="h-4 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" />
                    Частые вопросы
                  </h2>
                  <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
                    {faq.map((item) => (
                      <details key={item.q} className="group py-1">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 text-[15px] font-bold text-white/90 transition hover:text-white [&::-webkit-details-marker]:hidden">
                          {item.q}
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4 shrink-0 text-muted transition-transform duration-300 group-open:rotate-180 group-open:text-accent-2"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </summary>
                        <p className="pb-3 pr-8 text-sm leading-relaxed text-muted">{item.a}</p>
                      </details>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------- Плеер --------------------------- */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
