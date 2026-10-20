import Link from "next/link";
import { formatRating } from "@/lib/anime";
import type { AnimeCard as Card } from "@/lib/types";
import { Poster } from "./Poster";
import { Reveal } from "./Reveal";
import { SectionMark } from "./SectionMark";

/**
 * «Топ-10»: крупные контурные цифры за постерами. Отличается от обычной
 * ленты формой, поэтому главная не выглядит набором одинаковых рядов.
 */
export function TopTenRow({ title, cards, href }: { title: string; cards: Card[]; href: string }) {
  const list = cards.slice(0, 10);
  if (!list.length) return null;
  return (
    <Reveal as="section">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <SectionMark kind="crown" />
          <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">{title}</h2>
        </div>
        <Link href={href} className="btn-ghost text-sm font-semibold text-muted hover:text-white">
          Весь рейтинг →
        </Link>
      </div>
      <div className="rail -mx-2 flex gap-1 overflow-x-auto px-2 pb-4 pt-2 sm:gap-2">
        {list.map((card, i) => {
          const rating = formatRating(card.rating);
          return (
            <Link key={card.id} href={`/title/${card.id}`} className="top10 group shrink-0">
              <span className="top10-n" aria-hidden>
                {i + 1}
              </span>
              <span className="top10-p">
                <Poster
                  src={card.poster}
                  alt={card.title}
                  title={card.title}
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.07]"
                />
                {rating && <b className="top10-r">★ {rating}</b>}
              </span>
              <span className="top10-t">{card.title}</span>
            </Link>
          );
        })}
      </div>
    </Reveal>
  );
}
