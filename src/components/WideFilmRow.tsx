import Link from "next/link";
import { formatRating } from "@/lib/anime";
import type { AnimeCard as Card } from "@/lib/types";
import { Poster } from "./Poster";
import { Reveal } from "./Reveal";
import { SectionMark } from "./SectionMark";

/** Фильмы широкими карточками: кадр, название, год, длительность, оценка */
export function WideFilmRow({ title, cards, href }: { title: string; cards: Card[]; href: string }) {
  const list = cards.slice(0, 12);
  if (!list.length) return null;
  return (
    <Reveal as="section">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <SectionMark kind="film" />
          <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">{title}</h2>
        </div>
        <Link href={href} className="btn-ghost text-sm font-semibold text-muted hover:text-white">
          Все фильмы →
        </Link>
      </div>
      <div className="rail -mx-2 flex gap-3 overflow-x-auto px-2 pb-4 pt-2 sm:gap-4">
        {list.map((card) => {
          const rating = formatRating(card.rating);
          const frame = card.screenshots?.[0] ?? card.poster;
          const meta = [card.year, card.duration ? `${card.duration} мин` : null, card.genres[0]]
            .filter(Boolean)
            .join(" · ");
          return (
            <Link key={card.id} href={`/title/${card.id}`} className="wf group shrink-0">
              <span className="wf-img">
                <Poster
                  src={frame}
                  alt={card.title}
                  title={card.title}
                  sizes="(max-width: 640px) 80vw, 360px"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                />
                <span className="wf-shade" aria-hidden />
                {rating && <b className="wf-r">★ {rating}</b>}
                <span className="wf-t">{card.title}</span>
              </span>
              <span className="wf-m">{meta}</span>
            </Link>
          );
        })}
      </div>
    </Reveal>
  );
}
