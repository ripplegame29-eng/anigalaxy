import Link from "next/link";
import { formatRating, kindLabel, statusLabel, statusTone } from "@/lib/anime";
import type { AnimeCard as Card } from "@/lib/types";
import { Poster } from "./Poster";

/**
 * Карточка аниме: постер 2:3, рейтинг, номер последней серии,
 * плавные hover-эффекты (zoom постера, свечение рамки, кнопка Play).
 *
 * Манга с главной (`lib/mangadex`) приходит в ту же форму — отличается
 * только разметкой ссылки и значком на hover: такая карточка ведёт в
 * собственный раздел `/manga/<id>`, а не в плеер аниме.
 */
export function AnimeCard({
  card,
  priority = false,
  className = "",
}: {
  card: Card;
  priority?: boolean;
  className?: string;
}) {
  const rating = formatRating(card.rating);
  const kind = kindLabel(card.kind);
  const status = statusLabel(card.status);
  // Манга приходит из MangaDex — там id это uuid, они не пересекаются с Kodik
  const isManga = card.manga === true || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(card.id);
  const rootClass = `group relative block focus:outline-none ${className}`;

  // Тело карточки общее для обеих обёрток: у манги свой id и своя ссылка
  const body = (
    <>
      {/* Постер */}
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-card ring-1 ring-white/10 transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover:-translate-y-1 group-hover:ring-accent/60 group-hover:shadow-[0_24px_50px_-24px_rgba(31,123,255,.85)] group-focus-visible:ring-accent/70">
        <Poster
          src={card.poster}
          alt={card.title}
          title={card.title}
          priority={priority}
          className="object-cover transition-transform duration-[600ms] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.08]"
        />

        {/* Затемнение + кнопка Play на hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-transparent opacity-40 transition-opacity duration-300 group-hover:opacity-90" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="scale-50 rounded-full bg-white/95 p-3 text-ink opacity-0 shadow-xl transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-100 group-hover:opacity-100">
            {isManga ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M5 3.5A1.5 1.5 0 0 1 6.5 2H18a2 2 0 0 1 2 2v16a1 1 0 0 1-1.53.85L12 17.6l-6.47 3.25A1 1 0 0 1 4 20V4.5a1 1 0 0 1 .5-.87V3.5Zm1.5 1a.5.5 0 0 0-.5.5V20l7-3.5 7 3.5V4a.5.5 0 0 0-.5-.5h-13Z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5 translate-x-[1px]" fill="currentColor">
                <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.9-6.86a1.04 1.04 0 0 0 0-1.76L9.56 4.26A1.04 1.04 0 0 0 8 5.14Z" />
              </svg>
            )}
          </span>
        </div>

        {/* Рейтинг */}
        {rating && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-lg bg-ink/80 px-2 py-1 text-[11px] font-extrabold text-gold ring-1 ring-white/10 backdrop-blur-sm transition-colors group-hover:bg-ink/95">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
              <path d="m12 17.3-6.16 3.7 1.64-7.03L2 9.24l7.19-.61L12 2l2.81 6.63 7.19.61-5.48 4.73L18.16 21z" />
            </svg>
            {rating}
          </span>
        )}

        {/* Серии / статус */}
        <span className="absolute right-2 top-2 rounded-lg bg-ink/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/85 ring-1 ring-white/10 backdrop-blur-sm">
          {isManga
            ? card.chapterCount
              ? `${card.chapterCount} гл.`
              : "Манга"
            : card.lastEpisode
              ? `${card.lastEpisode} эп.`
              : (status ?? kind ?? "")}
        </span>

        {/* Нижняя плашка со статусом */}
        {card.lastEpisode && status && (
          <span
            className={`absolute bottom-2 left-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 backdrop-blur-sm ${statusTone(card.status)}`}
          >
            {status}
          </span>
        )}
      </div>

      {/* Титул */}
      <div className="mt-3 px-0.5">
        {/* min-h резервирует вторую строку под line-clamp-2: без неё
            метаданные карточек с коротким и длинным названием оказываются
            на разной высоте, и ряд расползается «лесенкой».
            2 × leading-snug (1.375) = 2.75em; em считается от font-size
            самого заголовка, поэтому на 13.5px и на 14px пропорция одна. */}
        <h3 className="line-clamp-2 min-h-[2.75em] text-[13.5px] font-semibold leading-snug text-bright/90 transition-colors duration-200 group-hover:text-white sm:text-sm">
          {card.title}
        </h3>
        {/* flex-wrap переносит строку, но только между смысловыми
            группами: каждая группа помечена whitespace-nowrap, а точка
            входит в следующую группу. Поэтому перенос приходится на
            границу «год · тип · оценок», а не рвёт «ТВ Сериал» на
            «ТВ» + «Сериал» и не оставляет точку в конце строки. */}
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
          {isManga ? (
            // У манги год и тип аниме не применимы — показываем жанры
            <span className="whitespace-nowrap">{card.genres.slice(0, 2).join(" · ")}</span>
          ) : (
            <>
              <span className="whitespace-nowrap">{card.year}</span>
              {kind && (
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="h-1 w-1 rounded-full bg-white/25" />
                  {kind}
                </span>
              )}
            </>
          )}
          {card.ratingVotes && card.ratingVotes > 0 && (
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="h-1 w-1 rounded-full bg-white/25" />
              <span className="tabular-nums">
                {card.ratingVotes.toLocaleString("ru-RU")} оценок
              </span>
            </span>
          )}
        </p>
      </div>
    </>
  );

  if (isManga) {
    // Свой раздел манги: тайтл и главы читаются на сайте
    return (
      <Link
        href={`/manga/${card.id}`}
        className={rootClass}
        aria-label={`${card.title}, манга`}
      >
        {body}
      </Link>
    );
  }

  return (
    <Link
      href={`/title/${card.id}`}
      className={rootClass}
      aria-label={`${card.title}${kind ? `, ${kind}` : ""}`}
    >
      {body}
    </Link>
  );
}

/** Скелетон карточки для состояния загрузки */
export function AnimeCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="skeleton aspect-[2/3] rounded-2xl" />
      <div className="skeleton mt-3 h-4 w-4/5 rounded-md" />
      <div className="skeleton mt-2 h-3 w-1/2 rounded-md" />
    </div>
  );
}
