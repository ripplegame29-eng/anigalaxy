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
      seen.add(record.id);
      const meta = titles[record.id];
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
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="h-7 w-1.5 rounded-full bg-violet-400" aria-hidden />
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
              className="group/cont relative flex w-[240px] shrink-0 flex-col overflow-hidden rounded-2xl border border-line bg-card transition duration-300 hover:-translate-y-1 hover:border-accent/50 sm:w-[268px]"
            >
              <div className="relative aspect-video overflow-hidden">
                {item.poster ? (
                  <Poster
                    src={item.poster}
                    alt=""
                    title={item.title}
                    className="h-full w-full object-cover transition duration-500 group-hover/cont:scale-105"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#16203f] to-card" />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" aria-hidden />
                <span className="absolute left-3 top-3 rounded-lg bg-black/70 px-2 py-1 text-[11px] font-extrabold text-white backdrop-blur-sm">
                  Серия {item.episode}
                </span>
                <span className="absolute right-3 top-3 rounded-lg bg-accent/90 px-2 py-1 text-[11px] font-extrabold tabular-nums text-white">
                  {timeAgo(item.at)}
                </span>
              </div>

              {/* Подвал карточки: жанр и доля просмотренного прижаты к низу, чтобы
                  карточки в ленте были одной высоты — у части тайлов нет
                  общего числа серий и полоски прогресса, у части есть. */}
              <div className="relative -mt-6 flex flex-1 flex-col px-3 pb-3">
                <p className="truncate text-sm font-extrabold text-white">{item.title}</p>
                <div className="mt-auto pt-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted">
                    {item.genre ? (
                      <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="5" width="18" height="14" rx="2.5" />
                          <path d="M3 10h18" />
                        </svg>
                        {item.genre}
                      </span>
                    ) : null}
                    {item.total > 0 && <span className="shrink-0 tabular-nums">{progress.toFixed(0)}%</span>}
                  </div>
                  {item.total > 0 && (
                    <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/10">
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-accent to-accent-2"
                        style={{ width: `${progress}%` }}
                      />
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Reveal>
  );
}