"use client";

/**
 * Ползунок дорожки: положение «окна просмотра» на 100 уровнях.
 *
 * Оптимизация против лагов: бегунок, подпись и заливка двигаются через
 * `transform: translate3d()/scaleX()` — композитный слой без layout и paint.
 * Положение приходит из дорожки каждый кадр прокрутки через императивный
 * handle `setWindow`, поэтому React не перерисовывает дерево на кадрах.
 *
 * Управление: перетаскивание мышью/пальцем и клавиши (стрелки, PageUp/Down,
 * Home/End). Засечки короткие на каждом десятом, длинные — на уровнях
 * с предметами.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

import { ITEM_LEVELS } from "@/components/battlepass/model";

export interface TrackSliderHandle {
  /** Доля прокрутки дорожки 0…1 и уровень в центре окна */
  setWindow: (ratio: number, label: number) => void;
}

export interface TrackSliderProps {
  /** Уровень в центре окна просмотра (для aria и подписи) */
  label: number;
  /** Текущий уровень игрока */
  level: number;
  /** Прогресс внутри уровня, 0…1 */
  fraction: number;
  maxLevel?: number;
  /**
   * Перейти к уровню. `instant` — при перетаскивании ползунком: там нужна
   * прямая отдача под курсором, а не плавная анимация, которую пришлось бы
   * перезапускать на каждом кадре (отсюда «тяжёлое» ощущение ползунка).
   */
  onSeek: (level: number, instant?: boolean) => void;
}

export const TrackSlider = forwardRef<TrackSliderHandle, TrackSliderProps>(function TrackSlider(
  { label, level, fraction, maxLevel = 100, onSeek },
  ref,
) {
  const railRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLElement>(null);
  const dragging = useRef(false);

  /** Позиция уровня в процентах; значение зажато: на первом уровне с нулевым
      прогрессом `level - 1` дал бы отрицательный процент. */
  const pct = (value: number) => {
    const clamped = Math.min(maxLevel, Math.max(1, value));
    return ((clamped - 1) / (maxLevel - 1)) * 100;
  };

  const fillRatio = Math.min(1, Math.max(0, (level - 1 + Math.min(1, Math.max(0, fraction))) / (maxLevel - 1)));

  /**
   * Позиция окна: transform без reflow — вызывается из rAF прокрутки.
   * Градиентной заливки нет: по дизайну шкала остаётся нейтральной, положение
   * показывают бегунок окна и ромб текущего уровня.
   */
  const setWindow = useCallback(
    (ratio: number, next: number) => {
      const rail = railRef.current;
      if (!rail) return;
      const w = rail.clientWidth;
      if (thumbRef.current) thumbRef.current.style.transform = `translate3d(${ratio * w}px,0,0)`;
      if (tagRef.current) tagRef.current.textContent = String(next);
    },
    [],
  );

  useImperativeHandle(ref, () => ({ setWindow }), [setWindow]);

  /* Первичная раскладка: до первого события прокрутки бегунок остался бы
     без transform и стоял на нулевой позиции */
  const placed = useRef(false);
  useEffect(() => {
    if (placed.current) return;
    const rail = railRef.current;
    if (!rail) return;
    placed.current = true;
    setWindow(0, label);
  }, [label, setWindow]);

  /** Уровень из позиции курсора по ползунку */
  const levelFromX = useCallback(
    (clientX: number) => {
      const rail = railRef.current;
      if (!rail) return 1;
      const box = rail.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
      return Math.min(maxLevel, Math.max(1, Math.round(ratio * (maxLevel - 1)) + 1));
    },
    [maxLevel],
  );

  const keys = Array.from({ length: Math.floor(maxLevel / 10) + 1 }, (_, i) => (i + 1) * 10).filter(
    (value) => value <= maxLevel,
  );
  const itemMarks = [...ITEM_LEVELS].filter((value) => value % 10 !== 0);

  return (
    <div
      ref={railRef}
      className="bp-sl"
      role="slider"
      tabIndex={0}
      aria-label="Положение на дорожке"
      aria-valuemin={1}
      aria-valuemax={maxLevel}
      aria-valuenow={label}
      aria-valuetext={`Уровень ${label} из ${maxLevel}`}
      onPointerDown={(event) => {
        dragging.current = true;
        event.currentTarget.classList.add("dragging");
        event.currentTarget.setPointerCapture(event.pointerId);
        onSeek(levelFromX(event.clientX), true);
        event.preventDefault();
      }}
      onPointerMove={(event) => {
        if (dragging.current) onSeek(levelFromX(event.clientX), true);
      }}
      onPointerUp={(event) => {
        dragging.current = false;
        event.currentTarget.classList.remove("dragging");
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }}
      onKeyDown={(event) => {
        const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, PageUp: -10, PageDown: 10 };
        const delta = step[event.key];
        if (delta !== undefined) {
          onSeek(Math.min(maxLevel, Math.max(1, label + delta)));
          event.preventDefault();
        } else if (event.key === "Home") {
          onSeek(1);
          event.preventDefault();
        } else if (event.key === "End") {
          onSeek(maxLevel);
          event.preventDefault();
        }
      }}
    >
      <div className="rail" aria-hidden />
      <div className="ticks" aria-hidden />
      {keys.map((value) => (
        <span key={`k${value}`} className="key" style={{ left: `${pct(value)}%` }} aria-hidden />
      ))}
      {itemMarks.map((value) => (
        <span key={`i${value}`} className="key minor" style={{ left: `${pct(value)}%` }} aria-hidden />
      ))}
      {/* Ромб текущего уровня игрока — статичный, пересчитывается React'ом */}
      <span className="pin" style={{ left: `${fillRatio * 100}%` }} aria-hidden />
      {/* Бегунок окна просмотра с подписью уровня */}
      <div ref={thumbRef} className="thumb" aria-hidden>
        <b ref={tagRef}>{label}</b>
      </div>
    </div>
  );
});
