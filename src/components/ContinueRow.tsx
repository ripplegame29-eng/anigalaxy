"use client";

/**
 * «Продолжить просмотр» — ряд над онгонгами на главной.
 *
 * Берёт последние открытые серии из локальной истории (`lib/history`) и
 * показывает их обложками: постер лежит прямо в записи истории, а у записей,
 * сделанных до появления поля, — в кэше тайтлов.
 *
 * Чего блок не показывает: позицию внутри серии и источник озвучки. Плеер у нас
 * встроен чужим iframe — прочитать его прогресс нельзя, поэтому вместо
 * «00:42 / 24:11» стоит время «когда смотрели», а вместо названия перевода —
 * жанр и год тайла из кэша. Выдумывать эти данные было бы враньём в
 * интерфейсе.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { timeAgo, watchStore } from "@/lib/history";
import { useTitles } from "@/lib/titles";
import { Poster } from "./Poster";
import { Reveal } from "./Reveal";
import { SectionMark } from "./SectionMark";

/** Сколько серий показываем в ленте */
const LIMIT = 10;

export function ContinueRow() {
  const watch = watchStore.useStore();
  const titles = useTitles();
  const railRef = useRef<HTMLDivElement | null>(null);
  const [edge, setEdge] = useState<"none" | "start" | "end">("none");

  /** Последние серии по каждому тайлу: тот же тайл дважды подряд не листаем */
  const items = useMemo(() => {
    const seen = new Set<string>();
    /* Один и тот же тайтл бывает под разными id (дубли в базе плеера) —
       сравниваем ещё и по названию, чтобы лента не повторялась */
    const seenTitle = new Set<string>();
    const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const out: {
      id: string;
      title: string;
      episode: number;
      season: number;
      at: number;
      poster?: string;
      total: number;
      genre: string;
    }[] = [];
    for (const record of watch.records) {
      if (seen.has(record.id)) continue;
      const meta = titles[record.id];
      const key = norm(record.title || meta?.title || "");
      if (key && seenTitle.has(key)) continue;
      seen.add(record.id);
      if (key) seenTitle.add(key);
      out.push({
        id: record.id,
        title: record.title || meta?.title || "Тайлт",
        episode: record.episode,
        season: record.season,
        at: record.at,
        poster: record.poster ?? meta?.poster,
        total: meta?.episodesTotal ?? 0,
        genre: meta?.genres?.[0] ?? (meta?.year ? String(meta.year) : ""),
      });
      if (out.length >= LIMIT) break;
    }
    return out;
  }, [watch.records, titles]);

  const syncEdge = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const slack = rail.scrollWidth - rail.clientWidth;
    if (slack <= 2) setEdge("none");
    else if (rail.scrollLeft <= 12) setEdge("start");
    else if (rail.scrollLeft >= slack - 12) setEdge("end");
    else setEdge("none");
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    syncEdge();
    rail.addEventListener("scroll", syncEdge, { passive: true });
    window.addEventListener("resize", syncEdge);
    const observer = new ResizeObserver(syncEdge);
    observer.observe(rail);
    return () => {
      rail.removeEventListener("scroll", syncEdge);
      window.removeEventListener("resize", syncEdge);
      observer.disconnect();
    };
  }, [syncEdge, items.length]);

  const scrollBy = (direction: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    const max = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const page = rail.clientWidth * 0.85;
    const remaining = direction === 1 ? max - rail.scrollLeft : rail.scrollLeft;
    rail.scrollBy({ left: direction * Math.min(page, Math.max(remaining, 0)), behavior: "smooth" });
  };

  /* Без истории блока нет: пустая лента с заголовком «Продолжить просмотр»
     обещала бы серию, которую человек не открывал */
  if (items.length === 0) return null;

  return (
    <Reveal as="section" className="group/rail">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <SectionMark kind="play" />
          <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">Продолжить просмотр</h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 opacity-100 transition-opacity duration-300 md:opacity-0 md:group-hover/rail:opacity-100">
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              disabled={edge === "start"}
              aria-label="Прокрутить назад"
              className="btn-ghost grid h-8 w-8 place-items-center rounded-full bg-white/6 text-white/70 ring-1 ring-white/10 hover:bg-white/12 hover:text-white disabled:pointer-events-none disabled:opacity-30"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              disabled={edge === "end"}
              aria-label="Прокрутить вперёд"
              className="btn-ghost grid h-8 w-8 place-items-center rounded-full bg-white/6 text-white/70 ring-1 ring-white/10 hover:bg-white/12 hover:text-white disabled:pointer-events-none disabled:opacity-30"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <Link
            href="/list"
            className="btn-ghost hidden items-center gap-1 text-sm font-semibold text-muted hover:text-white sm:flex"
          >
            Вся история
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>

      <div
        ref={railRef}
        className="rail -mx-2 flex gap-3 overflow-x-auto px-2 sm:gap-4"
      >
        {items.map((item) => {
          const progress = item.total > 0 ? Math.min(100, (item.episode / item.total) * 100) : 0;
          return (
            <Link
              key={`${item.id}-${item.season}-${item.episode}`}
              href={`/title/${item.id}?s=${item.season}&ep=${item.episode}`}
              className="cr-card group/cont"
            >
              <div className="cr-shot">
                {item.poster ? (
                  <Poster
                    src={item.poster}
                    alt=""
                    title={item.title}
                    className="h-full w-full object-cover transition duration-700 group-hover/cont:scale-[1.06]"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-[#16203f] to-card" />
                )}
                <span className="cr-veil" aria-hidden />
                {item.poster ? (
                  <span className="cr-amb" aria-hidden>
                    <Poster src={item.poster} alt="" sizes="120px" className="h-full w-full object-cover" />
                  </span>
                ) : null}
              </div>

              <div className="cr-top">
                <span className="cr-ep">Серия {item.episode}</span>
                <span className="cr-ago">{timeAgo(item.at)}</span>
              </div>

              <span className="cr-go" aria-hidden>
                <svg viewBox="0 0 24 24"><path d="M7 4.6v14.8L19 12z" /></svg>
              </span>

              <div className="cr-info">
                <p className="cr-name">{item.title}</p>
                <div className="cr-meta">
                  {item.genre ? <span className="cr-genre">{item.genre}</span> : null}
                  {item.total > 0 && <span className="cr-pct">{progress.toFixed(0)}%</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Reveal>
  );
}