"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ensureLoaded, useCards } from "@/lib/cards/client";
import { GameCard } from "@/components/cards/GameCard";
import "../app/cards-card.css";
import "../app/cards-v2.css";

export interface TcHero { id: string; name: string; num: number; rank: number; blurb: string }
type RankInfo = { key: string; short: string; name: string; color: string };

/** Лента героев тайтла с личным прогрессом: собранные — в цвете, недостающие — приглушены. */
export function TitleCardsRow({ series, heroes, counts, ranks, poster }: {
  series: string; heroes: TcHero[]; counts: { id: number; short: string; color: string; n: number }[]; ranks: RankInfo[]; poster?: string;
}) {
  const { state, error } = useCards();
  useEffect(() => ensureLoaded(), []);
  const guest = error === "auth";
  const own = useMemo(() => {
    const m = new Map<string, { n: number; lv: number; foil: boolean }>();
    for (const c of state?.inventory ?? []) {
      const o = m.get(c.cardId) ?? { n: 0, lv: 0, foil: false };
      m.set(c.cardId, { n: o.n + 1, lv: Math.max(o.lv, c.level), foil: o.foil || c.foil });
    }
    return m;
  }, [state]);
  // собранные — первыми, внутри — по редкости
  const list = useMemo(() => [...heroes].sort((a, b) => Number(own.has(b.id)) - Number(own.has(a.id))), [heroes, own]);
  const got = heroes.filter((h) => own.has(h.id)).length;
  const pct = Math.round((got / heroes.length) * 100);
  const done = got === heroes.length && got > 0;

  const row = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ l: false, r: true });
  const upd = () => { const el = row.current; if (el) setEdge({ l: el.scrollLeft > 8, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 8 }); };
  useEffect(() => { upd(); }, [list]);
  const go = (d: number) => row.current?.scrollBy({ left: d * row.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <section className="tcx mx-auto max-w-7xl px-4 pb-8 sm:px-6" aria-labelledby="tcx-title">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="h-6 w-1.5 rounded-full bg-accent" />
        <h2 id="tcx-title" className="text-lg font-extrabold tracking-tight sm:text-xl">Герои этого тайтла</h2>
        <span className="rounded-full bg-white/6 px-3 py-1 text-xs font-semibold text-muted ring-1 ring-white/10">{heroes.length}</span>
        <div className="tcx-side">
          {!guest && state && <span className="tcx-got">Собрано <b>{got}</b> из {heroes.length}</span>}
          <button type="button" className="tcx-nav" aria-label="Назад" disabled={!edge.l} onClick={() => go(-1)}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <button type="button" className="tcx-nav" aria-label="Вперёд" disabled={!edge.r} onClick={() => go(1)}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>
          <Link href="/cards" className="tcx-cta">{done ? "К коллекции" : "Открыть пак"}</Link>
        </div>
      </div>
      <div className="tcx-row" ref={row} onScroll={upd}>
        {list.map((c) => {
          const r = ranks[c.rank];
          const o = own.get(c.id);
          const miss = !o && !guest && !!state;
          return (
            <Link key={c.id} href="/cards" className={`tcx-item${miss ? " is-miss" : ""}`} title={`${c.name} — ${r.name}`}>
              <span className="tcx-card">
                <GameCard cardId={c.id} stats={false} foil={o?.foil} level={o?.lv ?? 1} count={o && o.n > 1 ? o.n : undefined} sizes="160px" />
              </span>
              <b>{c.name}</b>
              <small>{o ? `${r.short} · ур. ${o.lv}` : miss ? "Нет в коллекции" : `${r.short} · ${r.name}`}</small>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
