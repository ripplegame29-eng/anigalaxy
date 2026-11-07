import Link from "next/link";
import "../app/title-cards.css";
import { CATALOG } from "@/lib/cards/catalog";
import { RANKS } from "@/lib/cards/config";
import { seriesForTitle } from "@/lib/cards/series-match";
import { artIds } from "@/lib/server/cards-art";

/**
 * Блок «Карточки из этого аниме» на странице тайтла: герои серии с артом, от самых редких.
 * Если у тайтла нет своей серии в гаче — блока нет.
 */
export function TitleCards({ title, alt = [], poster }: { title: string; alt?: string[]; poster?: string }) {
  const series = seriesForTitle(title, alt);
  if (!series) return null;
  const have = new Set(artIds());
  const all = CATALOG.filter((c) => c.series === series && have.has(c.id));
  if (all.length < 2) return null;
  const list = [...all].sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name, "ru")).slice(0, 12);
  const counts = RANKS.map((r) => ({ r, n: all.filter((c) => c.rank === r.id).length })).filter((x) => x.n > 0).reverse();
  return (
    <section className="tc" aria-label={`Карточки: ${series}`}>
      <div className="tc-in">
  {poster && <div className="tc-bg" style={{ backgroundImage: `url(${poster})` }} aria-hidden />}
        <header className="tc-head">
          <div>
            <span className="tc-eye">Коллекция AniGalaxy</span>
            <h2>Карточки из аниме «{series}»</h2>
            <p>
              {all.length} {all.length % 10 === 1 && all.length % 100 !== 11 ? "герой" : "героев"} · собери набор и получи награду
            </p>
          </div>
          <div className="tc-chips">
            {counts.map(({ r, n }) => (
              <span key={r.id} style={{ ["--c" as string]: r.color }}>
                <i />
                {r.short} · {n}
              </span>
            ))}
          </div>
        </header>
        <div className="tc-row">
          {list.map((c) => {
            const r = RANKS[c.rank];
            return (
              <Link key={c.id} href="/cards" className="tc-card" style={{ ["--c" as string]: r.color }} title={`${c.name} — ${r.name}`}>
                <span className="tc-art">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/cards/art/${c.id}`} alt="" loading="lazy" draggable={false} />
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="tc-frame" src={`/cards/frames/${r.key}.webp`} alt="" loading="lazy" draggable={false} />
                <span className="tc-rank">{r.short}</span>
                <span className="tc-plate">
                  <b>{c.name}</b>
                  <small>{r.name}</small>
                </span>
              </Link>
            );
          })}
        </div>
        <Link href="/cards" className="tc-cta">
          Открыть гачу и собрать героев
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
