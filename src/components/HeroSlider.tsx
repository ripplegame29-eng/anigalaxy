"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatRating, kindLabel, statusLabel, statusTone, truncate } from "@/lib/anime";
import { SHADER_CONTRAST, SHADER_STRENGTH, useQuality } from "@/lib/quality";
import { attachSharpen } from "@/lib/video-shader";
import type { AnimeCard } from "@/lib/types";
import { Poster } from "./Poster";

const SLIDE_MS = 7000;

/**
 * Главный слайдер (Hero): кадры/постеры на фоне с Ken-Burns эффектом,
 * кроссфейд-переходы, автопрокрутка с паузой при наведении,
 * строгие индикаторы-прогресс и стрелки.
 */
export function HeroSlider({ items }: { items: AnimeCard[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Фоновые ролики по индексу слайда (у слайда может не быть своего видео) */
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  /** Канвасы под WebGL-шейдер апскейла (по одному на ролик) */
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  /** Глобальное качество: оригинал выключает шейдер, HD/4K — включает */
  const quality = useQuality();
  const shaderStrength = SHADER_STRENGTH[quality];

  const slides = items.filter((i) => i.poster || i.screenshots?.length).slice(0, 6);

  const go = useCallback(
    (next: number) => setIndex((next + slides.length) % slides.length),
    [slides.length],
  );

  // Автопрокрутка
  useEffect(() => {
    if (paused || slides.length < 2) return;
    timer.current = setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused, slides.length]);

  // Фон: играет только ролик активного слайда, остальные ставим на паузу.
  // Наведение (`paused`) рулит только автопрокруткой — видео не останавливаем.
  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (!video) return;
      if (i === index) void video.play().catch(() => {});
      else video.pause();
    });
  }, [index]);

  // Апскейл активного ролика: шейдер забирает кадры у <video> (звук и
  // декодирование остаются там) и рисует результат поверх. Контекст один —
  // при перелистовании старый освобождается, новый навешивается на слайд.
  // Без WebGL или при качестве «Оригинал» канвас остаётся прозрачным.
  useEffect(() => {
    if (shaderStrength <= 0) return;
    const canvas = canvasRefs.current[index];
    const video = videoRefs.current[index];
    if (!canvas || !video) return;
    return attachSharpen(canvas, video, {
      strength: shaderStrength,
      contrast: SHADER_CONTRAST[quality],
    });
  }, [index, quality, shaderStrength]);

  if (!slides.length) return null;

  const active = slides[index];

  return (
    <section
      className="relative isolate h-[74vh] min-h-[520px] w-full overflow-hidden sm:h-[78vh] lg:h-[82vh]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Рекомендуемые тайтлы"
    >
      {/* Слои-слайды */}
      {slides.map((slide, i) => {
        const isActive = i === index;
        const bg = slide.screenshots?.[0] ?? slide.poster;
        return (
          <div
            key={slide.id + i}
            className={`absolute inset-0 transition-opacity duration-[900ms] ease-out ${
              isActive ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-hidden={!isActive}
          >
            {/* Фоновый кадр */}
            <div className="absolute inset-0">
              {bg && (
                <Poster
                  src={bg}
                  alt=""
                  sizes="100vw"
                  priority={i === 0}
                  className={`object-cover ${isActive ? "animate-kenburns" : ""}`}
                />
              )}

              {/* Ролик тайтла: без звука, без органов управления, без focusa.
                  Постер остаётся под ним, пока видео грузится. */}
              {slide.heroVideo && (
                <video
                  ref={(el) => {
                    videoRefs.current[i] = el;
                  }}
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                  src={slide.heroVideo}
                  poster={bg}
                  muted
                  loop
                  playsInline
                  preload={isActive ? "auto" : "none"}
                  tabIndex={-1}
                  aria-hidden
                />
              )}

              {/* Слой апскейла: прозрачный, пока к нему не прикреплён шейдер */}
              {slide.heroVideo && (
                <canvas
                  ref={(el) => {
                    canvasRefs.current[i] = el;
                  }}
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  aria-hidden
                />
              )}

              <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/25" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-ink/70" />
            </div>
          </div>
        );
      })}

      {/* Контент активного слайда */}
      <div className="relative z-10 mx-auto flex h-full max-w-7xl items-end px-4 pb-24 sm:pb-28 lg:items-center lg:pb-16">
        <div key={active.id} className="max-w-2xl animate-fade-up">
          {/* Плашки */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-accent-2/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-accent-2 ring-1 ring-accent-2/30">
              {active.status === "ongoing" ? "Выходит сейчас" : "Рекомендуем"}
            </span>
            {active.rating != null && (
              <span className="flex items-center gap-1 rounded-full bg-white/8 px-3 py-1 text-xs font-bold text-gold ring-1 ring-white/10 backdrop-blur">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                  <path d="m12 17.3-6.16 3.7 1.64-7.03L2 9.24l7.19-.61L12 2l2.81 6.63 7.19.61-5.48 4.73L18.16 21z" />
                </svg>
                {formatRating(active.rating)}
              </span>
            )}
          </div>

          <h1 className="text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            <span className="text-white">{active.title}</span>
          </h1>

          {/* Мета */}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-white/70">
            {active.year && <span className="font-semibold">{active.year}</span>}
            {kindLabel(active.kind) && (
              <span className="rounded-md bg-white/8 px-2 py-0.5 text-xs ring-1 ring-white/10">
                {kindLabel(active.kind)}
              </span>
            )}
            {statusLabel(active.status) && (
              <span
                className={`rounded-md px-2 py-0.5 text-xs ring-1 backdrop-blur ${statusTone(active.status)}`}
              >
                {statusLabel(active.status)}
              </span>
            )}
            {active.lastEpisode ? (
              <span>Вышло серий: {active.lastEpisode}</span>
            ) : active.duration ? (
              <span>{active.duration} мин.</span>
            ) : null}
            {active.genres.slice(0, 3).map((g) => (
              <span key={g} className="text-muted">
                · {g}
              </span>
            ))}
          </div>

          {/* Описание */}
          {active.description && (
            <p className="mt-4 line-clamp-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
              {truncate(active.description, 280)}
            </p>
          )}

          {/* Действия */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href={`/title/${active.id}`}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.9-6.86a1.04 1.04 0 0 0 0-1.76L9.56 4.26A1.04 1.04 0 0 0 8 5.14Z" />
              </svg>
              Смотреть
            </Link>
            <Link
              href={`/title/${active.id}`}
              className="btn-ghost inline-flex items-center gap-2 rounded-xl bg-white/8 px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/12 hover:bg-white/14"
            >
              Подробнее
            </Link>
          </div>
        </div>
      </div>

      {/* Навигация: точки по центру снизу */}
      {slides.length > 1 && (
        <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 sm:bottom-8">
          <div className="flex items-center gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id + i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Слайд ${i + 1}`}
                aria-current={i === index}
                className="group h-6 w-7 sm:w-12"
              >
                <span className="block h-[3px] w-full overflow-hidden rounded-full bg-white/20 transition-colors group-hover:bg-white/40">
                  {i === index && (
                    <span
                      key={`${index}-${paused}`}
                      className={`block h-full rounded-full bg-gradient-to-r from-accent to-accent-2 ${
                        paused ? "" : "animate-progress"
                      }`}
                      style={{ animationDuration: `${SLIDE_MS}ms` }}
                    />
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
