"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Shot, Trailer } from "@/lib/shikimori";

interface Props {
  shots: Shot[];
  trailer?: Trailer | null;
  title: string;
}

type Slide =
  | { type: "trailer"; trailer: Trailer }
  | { type: "shot"; shot: Shot };

/**
 * «Кадры из аниме»: сетка скриншотов (+ трейлер первым слотом).
 *
 * По умолчанию показано только 4 кадра, под ними — кнопка «Показать все
 * кадры» (как на референсе). Клик открывает полноэкранный лайтбокс:
 * перелистывание стрелками ←/→, закрытие по Escape или клику по фону,
 * счётчик «3 / 12». Кадры тянутся с Shikimori, трейлер — YouTube.
 */
export function ScreenshotsGallery({ shots, trailer, title }: Props) {
  /** Сколько слайдов видно до нажатия «Показать все кадры» */
  const COLLAPSED = 4;

  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [];
    if (trailer) list.push({ type: "trailer", trailer });
    for (const shot of shots) list.push({ type: "shot", shot });
    return list;
  }, [shots, trailer]);

  const [expanded, setExpanded] = useState(false);
  const [index, setIndex] = useState<number | null>(null);
  const open = index !== null;
  const active = index === null ? null : slides[index];
  const visible = expanded ? slides : slides.slice(0, COLLAPSED);
  const collapsible = slides.length > COLLAPSED;

  const close = useCallback(() => setIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setIndex((current) =>
        current === null ? null : (current + delta + slides.length) % slides.length,
      ),
    [slides.length],
  );

  useEffect(() => {
    if (index === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [index, close, step]);

  if (slides.length === 0) return null;

  const thumbOf = (slide: Slide) =>
    slide.type === "trailer" ? slide.trailer.poster : slide.shot.thumb;
  const altOf = (slide: Slide, position: number) =>
    slide.type === "trailer"
      ? `Трейлер: ${title}`
      : `${title} — кадр ${position + 1}`;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6" aria-labelledby="shots-title">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-6 w-1.5 rounded-full bg-accent" />
        <h2 id="shots-title" className="text-lg font-extrabold tracking-tight sm:text-xl">
          Кадры из аниме
        </h2>
        <span className="rounded-full bg-white/6 px-3 py-1 text-xs font-semibold text-muted ring-1 ring-white/10">
          {shots.length + (trailer ? 1 : 0)}
        </span>
      </div>

      <div
        className={`grid gap-2.5 ${
          expanded
            ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            : "grid-cols-2 sm:grid-cols-4"
        }`}
      >
        {visible.map((slide, position) => (
          <button
            key={slide.type === "trailer" ? `trailer-${slide.trailer.id}` : slide.shot.url}
            type="button"
            onClick={() => setIndex(position)}
            aria-label={`Открыть: ${altOf(slide, position)}`}
            className="group relative aspect-video overflow-hidden rounded-xl bg-card ring-1 ring-white/10 transition duration-200 hover:ring-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Image
              src={thumbOf(slide)}
              alt={altOf(slide, position)}
              width={480}
              height={270}
              loading="lazy"
              // Превью трейлера грузим из браузера напрямую: серверу YouTube-картинки часто недоступны
              unoptimized={slide.type === "trailer"}
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent opacity-60 transition-opacity group-hover:opacity-90" />

            {slide.type === "trailer" ? (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-2/90 text-white shadow-[0_0_30px_-4px_rgba(31,123,255,0.8)] transition-transform duration-300 group-hover:scale-110">
                  <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" fill="currentColor">
                    <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.9-6.86a1.04 1.04 0 0 0 0-1.76L9.56 4.26A1.04 1.04 0 0 0 8 5.14Z" />
                  </svg>
                </span>
                <span className="rounded-md bg-ink/80 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white ring-1 ring-white/15 backdrop-blur">
                  Трейлер
                </span>
              </span>
            ) : (
              <span className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-ink/70 text-white ring-1 ring-white/25 backdrop-blur">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                  </svg>
                </span>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* --------------------- Показать все кадры --------------------- */}
      {collapsible && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="group inline-flex items-center gap-2 rounded-xl bg-white/6 px-5 py-2.5 text-sm font-bold text-white/90 ring-1 ring-white/12 transition duration-200 hover:bg-accent/20 hover:text-white hover:ring-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {expanded ? "Свернуть кадры" : "Показать все кадры"}
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums text-muted ring-1 ring-white/10 transition group-hover:bg-accent/30 group-hover:text-white">
              {slides.length}
            </span>
            <svg
              viewBox="0 0 24 24"
              className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      )}

      {/* --------------------------- Лайтбокс --------------------------- */}
      {open && index !== null && active &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-ink/95 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-label={`Просмотр: ${title}`}
          >
            <div className="mx-auto flex h-full max-w-6xl flex-col px-3 py-3 sm:px-6 sm:py-5">
              {/* Шапка просмотрщика */}
              <header className="flex items-center justify-between gap-3 pb-3">
                <p className="min-w-0 truncate text-sm font-semibold text-white/90">
                  {active.type === "trailer" ? active.trailer.title : `${title} — кадр`}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-white/8 px-2.5 py-1 text-xs font-bold tabular-nums text-muted ring-1 ring-white/10">
                    {index + 1} / {slides.length}
                  </span>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Закрыть просмотр"
                    className="grid h-9 w-9 place-items-center rounded-lg text-white/80 ring-1 ring-white/15 transition hover:bg-white/10 hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </div>
              </header>
  
              {/* Кадр / плеер */}
              <div className="relative min-h-0 flex-1">
                {active.type === "shot" ? (
                  <div className="absolute inset-0">
                    <Image
                      src={active.shot.url}
                      alt={`${title} — кадр ${index + 1}`}
                      fill
                      sizes="100vw"
                      className="object-contain"
                      priority
                    />
                  </div>
                ) : (
                  <div className="absolute inset-0 overflow-hidden rounded-xl bg-black">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${active.trailer.id}?autoplay=1&rel=0&hl=ru&modestbranding=1`}
                      title={`Трейлер: ${title}`}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  </div>
                )}
  
                {/* Большие стрелки поверх кадра */}
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Предыдущий кадр"
                  className="absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-ink/60 text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-ink/90 sm:grid"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15 6-6 6 6 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Следующий кадр"
                  className="absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-ink/60 text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-ink/90 sm:grid"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
                  </svg>
                </button>
              </div>
  
              {/* Управление (видно и на мобильных) */}
              <footer className="flex items-center justify-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Предыдущий кадр"
                  className="grid h-10 w-10 place-items-center rounded-full bg-white/8 text-white ring-1 ring-white/15 transition hover:bg-white/16"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15 6-6 6 6 6" />
                  </svg>
                </button>
                <span className="hidden text-xs text-muted sm:block">
                  ← / → — листать, Esc — закрыть
                </span>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Следующий кадр"
                  className="grid h-10 w-10 place-items-center rounded-full bg-white/8 text-white ring-1 ring-white/15 transition hover:bg-white/16"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
                  </svg>
                </button>
              </footer>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
