import Link from "next/link";
import { formatRating, kindLabel } from "@/lib/anime";
import type { AnimeCard as Card } from "@/lib/types";
import { Poster } from "./Poster";
import { Reveal } from "./Reveal";
import { SectionMark } from "./SectionMark";
import "./top-ten.css";

/**
 * «Зал славы»: лидер рейтинга — крупная витрина с лавровым венком и
 * шкалой оценки, остальные девять — ранжированные карточки с металлическими
 * медалями для призовой тройки. Форма отличается от обычной ленты и от
 * привычных «цифр за постерами».
 */

const MEDALS = ["gold", "silver", "bronze"] as const;

function Laurel() {
  return (
    <svg className="tt2-laurel" viewBox="0 0 80 80" aria-hidden>
      <defs>
        <linearGradient id="tt2-cr" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd9a0" />
          <stop offset=".45" stopColor="#ff4d6d" />
          <stop offset="1" stopColor="#8f0f2c" />
        </linearGradient>
        <linearGradient id="tt2-cf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a0a18" />
          <stop offset="1" stopColor="#14030a" />
        </linearGradient>
      </defs>
      <circle className="tt2-halo" cx="40" cy="40" r="37" fill="none" stroke="url(#tt2-cr)" strokeWidth="1" strokeDasharray="1.5 5" strokeLinecap="round" />
      <path d="M40 6 69 22v36L40 74 11 58V22z" fill="url(#tt2-cf)" stroke="url(#tt2-cr)" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M40 14 62 26.5v27L40 66 18 53.5v-27z" fill="none" stroke="#ffd9a0" strokeOpacity=".45" strokeWidth="1" />
      <path d="M40 0l5 8h-10z" fill="url(#tt2-cr)" />
      <path d="M2 40l8-4v8zM78 40l-8-4v8z" fill="url(#tt2-cr)" />
    </svg>
  );
}

export function TopTenRow({ title, cards, href }: { title: string; cards: Card[]; href: string }) {
  const list = cards.slice(0, 10);
  if (!list.length) return null;
  const [lead, ...rest] = list;
  const leadRating = formatRating(lead.rating);

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

      <div className="tt2">
        {/* Лидер */}
        <Link href={`/title/${lead.id}`} className="tt2-lead group">
          <span className="tt2-lead-bg" aria-hidden>
            <Poster src={lead.poster} alt="" sizes="600px" className="object-cover" />
          </span>
          <span className="tt2-lead-shade" aria-hidden />
          <span className="tt2-rays" aria-hidden />
          <span className="tt2-sparks" aria-hidden>
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} style={{ ["--i" as string]: i }} />
            ))}
          </span>
          <span className="tt2-big" aria-hidden>1</span>
          <span className="tt2-topbar">
            <span className="tt2-ribbon">
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M3 8l4.5 4L12 4l4.5 8L21 8l-2 11H5z" fill="currentColor" />
              </svg>
              Лидер рейтинга
            </span>
            {lead.ratingVotes ? (
              <span className="tt2-votes">{lead.ratingVotes.toLocaleString("ru-RU")} оценок</span>
            ) : null}
          </span>
          <span className="tt2-lead-poster">
            <Poster src={lead.poster} alt={lead.title} title={lead.title} sizes="220px" priority className="object-cover" />
            <span className="tt2-sheen" aria-hidden />
          </span>
          <span className="tt2-lead-body">
            <span className="tt2-crest">
              <i aria-hidden />
              Первое место
            </span>
            <span className="tt2-lead-title">{lead.title}</span>
            <span className="tt2-lead-meta">
              {[lead.year, kindLabel(lead.kind)].filter(Boolean).join(" · ")}
            </span>
            {lead.genres?.length ? (
              <span className="tt2-chips">
                {lead.genres.slice(0, 3).map((g) => (
                  <em key={g}>{g}</em>
                ))}
                {lead.episodesTotal ? <em>{lead.episodesTotal} эп.</em> : null}
              </span>
            ) : null}
            {lead.description ? <span className="tt2-desc">{lead.description}</span> : null}
            {leadRating && (
              <span className="tt2-score">
                <b>{leadRating}</b>
                <span className="tt2-bar">
                  <i style={{ width: `${Math.min(100, (lead.rating ?? 0) * 10)}%` }} />
                </span>
              </span>
            )}
            <span className="tt2-cta">
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
              Смотреть
            </span>
          </span>
        </Link>

        {/* Остальные */}
        <ol className="tt2-list">
          {rest.map((card, i) => {
            const rank = i + 2;
            const medal = MEDALS[i + 1] ?? "plain";
            const rating = formatRating(card.rating);
            return (
              <li key={card.id}>
                <Link href={`/title/${card.id}`} className={`tt2-item tt2-${medal} group`}>
                  <span className="tt2-rank" aria-label={`Место ${rank}`}>
                    {rank}
                  </span>
                  <span className="tt2-thumb">
                    <Poster src={card.poster} alt="" title={card.title} sizes="72px" className="object-cover transition-transform duration-500 group-hover:scale-[1.08]" />
                  </span>
                  <span className="tt2-info">
                    <span className="tt2-name">{card.title}</span>
                    <span className="tt2-sub">{[card.year, kindLabel(card.kind)].filter(Boolean).join(" · ")}</span>
                  </span>
                  {rating && (
                    <span className="tt2-rate">
                      <b>{rating}</b>
                      <span className="tt2-bar">
                        <i style={{ width: `${Math.min(100, (card.rating ?? 0) * 10)}%` }} />
                      </span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </Reveal>
  );
}
