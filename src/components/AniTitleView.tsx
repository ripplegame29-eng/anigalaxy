import Link from "next/link";
import { Poster } from "@/components/Poster";
import { WatchBox } from "@/components/WatchBox";
import { ReadMore } from "@/components/ReadMore";
import { AnimeRow } from "@/components/AnimeRow";
import { NextEpisode } from "@/components/NextEpisode";
import { WatchButton } from "@/components/WatchButton";
import { TitleActions } from "@/components/TitleActions";
import { ScreenshotsGallery } from "@/components/ScreenshotsGallery";
import { CommentsBlock } from "@/components/comments/CommentsBlock";
import { formatRating, kindLabel, statusLabel, statusTone, truncate } from "@/lib/anime";
import type { AniTitleDetail } from "@/lib/anilibria-map";
import type { AnimeCard } from "@/lib/types";
import type { NextEpisode as NextEp, Shot, Trailer } from "@/lib/shikimori";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-xl bg-white/[0.05] px-3.5 py-2 text-sm font-bold tabular-nums text-white/85 ring-1 ring-white/[0.09]">
      {children}
    </span>
  );
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-4 flex items-center gap-2.5 font-display text-[13px] font-extrabold uppercase tracking-[0.16em] text-white">
      <span className="h-4 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" />
      {children}
    </h2>
  );
}

/** Дополнительные данные страницы: Shikimori (кадры, трейлер, график) и похожие тайтлы */
export interface AniExtras {
  shots: Shot[];
  trailer: Trailer | null;
  upcoming: NextEp | null;
  similar: AnimeCard[];
}

/**
 * Страница тайтла из AniLiberty — для аниме, которых нет в Kodik.
 * Та же раскладка, что у обычной страницы: шапка с действиями, описание,
 * особенности, вопросы, плеер, кадры, похожие и комментарии.
 * Чистый вывод без запросов: данные приносит сервер (`AniTitlePage`)
 * или браузер (`AniTitleClient`, если сервер релиз не увидел).
 */
export function AniTitleView({ id, detail, extras }: { id: string; detail: AniTitleDetail; extras: AniExtras }) {
  const { episodes } = detail;
  // id тайтла на сайте — «ani-алиас»: по нему работают избранное, подборки, комментарии и история
  const card = { ...detail.card, id };
  const rating = formatRating(card.rating);
  const { shots, trailer: trailerVideo, upcoming, similar: similarCards } = extras;

  const total = card.episodesTotal;
  const aired = episodes.length;
  const episodesLine = total
    ? card.status === "ongoing" && aired < total
      ? `вышло ${aired} из ${total} серий`
      : `${total} серий`
    : aired
      ? `вышло ${aired} серий`
      : null;

  const metaRows: { label: string; value: string }[] = [
    ...(kindLabel(card.kind) ? [{ label: "Тип", value: kindLabel(card.kind)! }] : []),
    { label: "Озвучка", value: "AniLiberty" },
  ];

  const features: string[] = [];
  if (episodesLine)
    features.push(card.status === "ongoing" ? `Выходит прямо сейчас: ${episodesLine}` : `Доступно: ${episodesLine}`);
  if (card.duration) features.push(`Длительность серии — около ${card.duration} мин.`);
  features.push("Озвучка и потоки — AniLiberty, качество до 1080p");
  if (rating) features.push(`Оценка зрителей ${rating} из 10`);
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
  faq.push({
    q: `Где смотреть «${card.title}» онлайн?`,
    a: "Прямо на этой странице: плеер ниже с выбором серии и качества. Место просмотра запоминается, поэтому можно продолжить с нужной серии.",
  });
  if (similarCards.length)
    faq.push({ q: "Что посмотреть после этого аниме?", a: `Ниже на странице — подборка похожих тайтлов (${similarCards.length}).` });

  const galleryShots = shots.length ? shots : [];
  const backdrop = galleryShots[0]?.url ?? card.poster;

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10" aria-hidden>
          {backdrop && <Poster src={backdrop} alt="" priority sizes="100vw" className="scale-110 object-cover opacity-25 blur-3xl" />}
          <div className="absolute inset-0 bg-gradient-to-b from-ink/55 via-ink/90 to-ink" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-8 pt-8 sm:px-6 sm:pb-10 sm:pt-10">
          <div className="grid gap-7 md:grid-cols-[260px_minmax(0,1fr)] md:gap-9 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-12">
            <aside className="mx-auto w-full max-w-[460px] space-y-3 md:mx-0 md:max-w-none">
              <div className="mb-1 text-center md:hidden" aria-hidden>
                <p className="font-display text-[26px] font-extrabold leading-[1.1] tracking-[-0.03em] text-white">{card.title}</p>
                {card.titleOrig && card.titleOrig !== card.title && <p className="mt-1 text-sm font-semibold text-white/55">{card.titleOrig}</p>}
              </div>
              <div className="group relative mx-auto aspect-[2/3] w-[210px] overflow-hidden rounded-3xl bg-card shadow-[0_40px_90px_-40px_rgba(0,0,0,1)] ring-1 ring-white/12 transition duration-300 hover:shadow-[0_50px_110px_-45px_rgba(43,127,255,0.55)] hover:ring-accent/45 sm:w-[240px] md:w-full">
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

              <WatchButton id={card.id} />
              <TitleActions anime={{ id: card.id, title: card.title, poster: card.poster, genres: card.genres, year: card.year, rating: card.rating, episodesTotal: card.episodesTotal }} />

              {upcoming && <NextEpisode at={upcoming.at} episode={upcoming.episode} total={upcoming.total} title={card.title} />}

              <dl className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-[#0d0d14] ring-1 ring-white/[0.07]">
                {metaRows.map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                    <dt className="shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-muted">{row.label}</dt>
                    <dd className="min-w-0 truncate text-right text-sm font-bold text-white/90" title={row.value}>
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </aside>

            <div className="min-w-0 animate-fade-up">
              <div className="mb-4 flex flex-wrap items-center gap-2.5 text-xs font-bold uppercase tracking-[0.14em]">
                {statusLabel(card.status) && (
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ring-1 backdrop-blur ${statusTone(card.status)}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
                    {statusLabel(card.status)}
                  </span>
                )}
                {kindLabel(card.kind) && <span className="text-muted">{kindLabel(card.kind)}</span>}
              </div>

              <h1 className="font-display text-[clamp(30px,5vw,58px)] font-extrabold leading-[1.05] tracking-[-0.035em] text-white max-md:sr-only">{card.title}</h1>
              {card.titleOrig && card.titleOrig !== card.title && <p className="mt-3 text-lg font-semibold text-white/60 max-md:hidden sm:text-xl">{card.titleOrig}</p>}

              <div className="mt-6 flex flex-wrap items-center gap-2">
                {rating && (
                  <span className="inline-flex items-center gap-2 rounded-xl bg-accent/12 px-3.5 py-2 text-sm font-extrabold text-white ring-1 ring-accent/35">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-gold" fill="currentColor" aria-hidden>
                      <path d="m12 2.5 2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8L12 2.5Z" />
                    </svg>
                    <span className="tabular-nums">{rating}</span>
                  </span>
                )}
                {card.year && <Chip>{card.year}</Chip>}
                {card.duration ? <Chip>{card.duration} мин.</Chip> : null}
                {aired ? <Chip>{total ? `${aired} / ${total} эп.` : `${aired} эп.`}</Chip> : null}
              </div>

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

              {card.description && (
                <div className="mt-7 max-w-3xl border-t border-white/[0.07] pt-6">
                  <ReadMore text={truncate(card.description, 1200) ?? card.description} />
                </div>
              )}

              <section className="mt-9 max-w-3xl" aria-labelledby="tp-features">
                <SectionTitle id="tp-features">Особенности</SectionTitle>
                <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                  {features.map((text) => (
                    <li key={text} className="flex items-start gap-3 text-[14.5px] leading-snug text-white/80">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-2 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                      {text}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mt-9 max-w-3xl" aria-labelledby="tp-faq">
                <SectionTitle id="tp-faq">Частые вопросы</SectionTitle>
                <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
                  {faq.map((item) => (
                    <details key={item.q} className="group py-1">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 text-[15px] font-bold text-white/90 transition hover:text-white [&::-webkit-details-marker]:hidden">
                        {item.q}
                        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted transition-transform duration-300 group-open:rotate-180 group-open:text-accent-2" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </summary>
                      <p className="pb-3 pr-8 text-sm leading-relaxed text-muted">{item.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-4 flex items-center gap-3">
          <span className="h-6 w-1.5 rounded-full bg-accent" />
          <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">Смотреть онлайн</h2>
        </div>
        {episodes.length ? (
          <WatchBox
            initialDetail={{
              card,
              isSerial: true,
              seasons: [{ number: 1, episodes: episodes.map((e) => ({ number: e.number, link: "", title: e.name })) }],
            }}
            translations={[]}
            aniStart={{ alias: card.alias, episodesTotal: card.episodesTotal ?? null }}
          />
        ) : (
          <p className="rounded-2xl bg-white/[0.04] p-6 text-white/70 ring-1 ring-white/10">
            Серии этого тайтла пока недоступны. <Link href="/catalog" className="text-accent underline">Вернуться в каталог</Link>
          </p>
        )}
      </div>

      <ScreenshotsGallery shots={galleryShots} trailer={trailerVideo} title={card.title} />

      {similarCards.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
          <AnimeRow title="Похожие тайтлы" cards={similarCards} href={`/catalog?genre=${encodeURIComponent(card.genres[0] ?? "")}`} />
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        <CommentsBlock scope={{ kind: "title", titleId: card.id }} />
      </div>
    </>
  );
}
