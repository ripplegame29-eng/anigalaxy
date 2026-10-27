"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { kindLabel } from "@/lib/anime";
import { Poster } from "./Poster";

export interface FranchiseItem {
  id: string;
  title: string;
  year?: number;
  kind?: string;
  poster?: string;
  /** просматриваемый сейчас тайтл */
  current: boolean;
}

/**
 * «Хронология франшизы» — горизонтальная лента всех частей (сезоны, спешлы,
 * OVA, фильмы) в порядке выхода. Текущий тайтл подсвечен и по загрузке
 * оказывается в центре ленты; по бокам — стрелки для прокрутки.
 */
export function FranchiseTimeline({ items }: { items: FranchiseItem[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLLIElement>(null);
  const [edges, setEdges] = useState({ left: false, right: true });

  /** Достигнуты ли края ленты — от этого зависит, видна ли стрелка */
  const syncEdges = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const left = list.scrollLeft > 4;
    const right = list.scrollLeft + list.clientWidth < list.scrollWidth - 4;
    setEdges((prev) =>
      prev.left === left && prev.right === right ? prev : { left, right },
    );
  }, []);

  // Центрируем активную часть ленты (без прокрутки всей страницы)
  useEffect(() => {
    const list = listRef.current;
    const active = activeRef.current;
    if (!list) return;
    if (active) list.scrollLeft = active.offsetLeft - (list.clientWidth - active.clientWidth) / 2;
    syncEdges();
  }, [items.length, syncEdges]);

  // Стрелки гаснут у краёв ленты
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const onChange = () => syncEdges();
    list.addEventListener("scroll", onChange, { passive: true });
    window.addEventListener("resize", onChange);
    syncEdges();
    return () => {
      list.removeEventListener("scroll", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, [syncEdges, items.length]);

  const scroll = useCallback((direction: -1 | 1) => {
    const list = listRef.current;
    if (!list) return;
    list.scrollBy({ left: direction * Math.max(140, Math.round(list.clientWidth * 0.6)), behavior: "smooth" });
  }, []);

  if (items.length < 2) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-6 pt-2 sm:px-6" aria-labelledby="franchise-title">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 ring-1 ring-accent/30">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-accent" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v12" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path strokeLinecap="round" d="M18 9a9 9 0 0 1-9 9" />
          </svg>
        </span>
        <h2 id="franchise-title" className="text-lg font-extrabold tracking-tight sm:text-xl">
          Хронология франшизы
        </h2>
        <span className="rounded-full bg-white/6 px-3 py-1 text-xs font-semibold text-muted ring-1 ring-white/10">
          {items.length} тайтл{items.length === 1 ? "" : items.length < 5 ? "а" : "ов"}
        </span>
      </div>

      <div className="relative">
        {/*
          Скроллится внешний div, а список — гибкий элемент с авто-полями:
          пока карточек мало и есть свободное место, `mx-auto` центрирует ряд;
          как только ряд шире контейнера, свободное место становится
          отрицательным и авто-поля обнуляются — лента листается от края
          (классический `justify-center` здесь обрезал бы левые карточки).
        */}
        <div
          ref={listRef}
          className="no-scrollbar -mx-4 flex snap-x snap-proximity overflow-x-auto scroll-px-4 px-4 pb-2 sm:-mx-1 sm:px-1 sm:scroll-px-1"
          style={{
            scrollbarWidth: "none",
            maskImage: `linear-gradient(to right, ${edges.left ? "transparent 0, #000 36px" : "#000 0"}, ${edges.right ? "#000 calc(100% - 36px), transparent 100%" : "#000 100%"})`,
            WebkitMaskImage: `linear-gradient(to right, ${edges.left ? "transparent 0, #000 36px" : "#000 0"}, ${edges.right ? "#000 calc(100% - 36px), transparent 100%" : "#000 100%"})`,
          }}
        >
          <ol className="mx-auto flex flex-none gap-3 sm:gap-4">
            {items.map((item, index) => (
              <li
                key={`${item.id}-${index}`}
                ref={item.current ? activeRef : undefined}
                className={`w-[150px] shrink-0 snap-start overflow-hidden rounded-2xl border bg-white/[0.03] transition-all duration-300 hover:-translate-y-1 sm:w-[190px] lg:w-[210px] ${
                  item.current
                    ? "border-accent/60 bg-accent/10 shadow-[0_0_24px_-8px_rgba(31,123,255,0.7)] ring-1 ring-accent/40"
                    : "border-line hover:border-accent/35 hover:bg-white/[0.07]"
                }`}
              >
                <Link
                  href={`/title/${item.id}`}
                  className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-current={item.current ? "page" : undefined}
                >
                  <div className="relative aspect-[2/3] overflow-hidden">
                    <Poster
                      src={item.poster}
                      alt={item.title}
                      title={item.title}
                      sizes="(max-width: 640px) 150px, 210px"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-transparent" />
                    {item.current && (
                      <span className="absolute left-2 top-2 rounded-md bg-accent px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-lg">
                        Сейчас
                      </span>
                    )}
                    <span className="absolute bottom-2 right-2 rounded-md bg-ink/80 px-2 py-0.5 text-xs font-bold tabular-nums text-white/90 ring-1 ring-white/15 backdrop-blur">
                      {item.year ?? "—"}
                    </span>
                  </div>

                  <div className="space-y-1.5 px-3 py-3">
                    <p
                      className={`line-clamp-2 text-[13px] font-semibold leading-snug ${
                        item.current ? "text-white" : "text-white/85"
                      }`}
                      title={item.title}
                    >
                      {item.title}
                    </p>
                    <span className="inline-block rounded bg-white/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted ring-1 ring-white/10">
                      {kindLabel(item.kind) ?? "Аниме"}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </div>

        {/* Края ленты плавно гаснут маской самой ленты: отдельные «шторки» цвета фона давали светлые полосы */}
        <EdgeArrow direction={-1} hidden={!edges.left} onClick={scroll} />
        <EdgeArrow direction={1} hidden={!edges.right} onClick={scroll} />
      </div>
    </section>
  );
}

/** Круглая стрелка прокрутки ленты: видна всегда, при крайнем положении гаснет */
function EdgeArrow({
  direction,
  hidden,
  onClick,
}: {
  direction: -1 | 1;
  hidden: boolean;
  onClick: (direction: -1 | 1) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(direction)}
      aria-label={direction === -1 ? "Листать хронологию назад" : "Листать хронологию вперёд"}
      className={`absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-ink/85 text-white ring-2 ring-white/25 shadow-[0_10px_28px_-10px_rgba(0,0,0,0.95)] backdrop-blur transition duration-200 hover:bg-accent/85 hover:ring-accent/70 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-0 disabled:hover:bg-ink/85 disabled:hover:ring-white/25 sm:grid sm:h-11 sm:w-11 ${
        direction === -1 ? "-left-2 sm:-left-3" : "-right-2 sm:-right-3"
      }`}
      disabled={hidden}
      tabIndex={hidden ? -1 : undefined}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={direction === -1 ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"}
        />
      </svg>
    </button>
  );
}
