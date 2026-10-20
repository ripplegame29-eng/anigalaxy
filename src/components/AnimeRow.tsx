"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AnimeCard as Card } from "@/lib/types";
import { AnimeCard } from "./AnimeCard";
import { RowHighlight } from "./RowHighlight";
import { Reveal } from "./Reveal";
import { SectionMark, markFor, type MarkKind } from "./SectionMark";

/**
 * Горизонтальная лента тайтлов со стрелками-прокруткой.
 *
 * Раньше стрелки появлялись только по наведению и только на десктопе
 * (md:flex + opacity-0): на телефоне их не было вообще, а лента
 * прокручивалась пальцем по карточкам — в «Онгоингах» это означало,
 * что половина ряда недоступна, если не догадаться свайпнуть.
 * Теперь стрелки есть и на мобильном, они не гаснут и блокируются
 * у краёв, чтобы не листать в пустоту.
 */
export function AnimeRow({
  title,
  cards,
  href = "/catalog",
  viewAllLabel = "Смотреть все",
  accent = false,
  priorityCount = 0,
  mark,
  headerExtra,
}: {
  title: string;
  cards: Card[];
  href?: string;
  viewAllLabel?: string;
  accent?: boolean;
  /**
   * Сколько первых карточек грузить сразу, без ленивой загрузки.
   *
   * Раньше здесь стояло `i < 4` для каждой строки безусловно. На главной
   * шесть строк — и 24 постера уезжали в загрузку одновременно с
   * fetchpriority=high, конкурируя с первым экраном. Браузер отдавал приоритет
   * картинкам, которых через два экрана, и главная открывалась медленнее,
   * а не быстрее.
   *
   * Теперь решает вызывающая сторона: приоритет — только тому, что реально
   * видно сразу. По умолчанию ноль.
   */
  priorityCount?: number;
  /** Иконка секции; по умолчанию подбирается по заголовку */
  mark?: MarkKind;
  /** Переключатель вкладок рядом с заголовком */
  headerExtra?: React.ReactNode;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  /** Края ленты: нужны, чтобы гасить стрелку, за которой ничего нет */
  const [edge, setEdge] = useState<"none" | "start" | "end">("none");

  const syncEdge = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const slack = rail.scrollWidth - rail.clientWidth;
    // Порог 12px, а не 2px: у ленты свой горизонтальный отступ px-2, и
    // браузер на загрузке подкручивает первый фокусируемый элемент под его
    // край — scrollLeft сразу 8. При строгом пороге стрелка «назад» никогда
    // не считалась бы погашенной.
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
    // Ширина ленты меняется после загрузки обложек и при повороте экрана
    const observer = new ResizeObserver(syncEdge);
    observer.observe(rail);
    return () => {
      rail.removeEventListener("scroll", syncEdge);
      window.removeEventListener("resize", syncEdge);
      observer.disconnect();
    };
  }, [syncEdge]);

  /**
   * Листаем на 85% кадра, но если остаток меньше — доезжаем до края.
   * Иначе лента встаёт за полшага до конца, стрелка остаётся висеть
   * поверх последней карточки и второй тап по ней ничего не делает.
   */
  const scrollBy = (direction: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    const max = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const page = rail.clientWidth * 0.85;
    const remaining = direction === 1 ? max - rail.scrollLeft : rail.scrollLeft;
    rail.scrollBy({
      left: direction * Math.min(page, Math.max(remaining, 0)),
      behavior: "smooth",
    });
  };

  if (!cards.length) return null;

  return (
    <Reveal as="section" className="group/rail">
      {/* Заголовок секции */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <SectionMark kind={mark ?? markFor(title)} />
          <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">{title}</h2>
          {headerExtra}
        </div>

        <div className="flex items-center gap-2">
          {/* Стрелки: на десктопе появляются по наведению, на телефоне
              видны всегда — навести там нечем, а листать ленту нужно */}
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
            href={href}
            className="btn-ghost hidden items-center gap-1 text-sm font-semibold text-muted hover:text-white sm:flex"
          >
            {viewAllLabel}
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Лента. pb-2 убран: вертикальные отступы задаёт .hl-row (см.
          components/row-highlight.css) — иначе плашку и подъём карточки
          режет overflow ленты. */}
      <RowHighlight
        railRef={railRef}
        className="rail -mx-2 flex gap-3 overflow-x-auto px-2 sm:gap-4"
      >
        {cards.map((card, i) => (
          <div
            key={card.id}
            className="hl-card w-[160px] shrink-0 sm:w-[184px] md:w-[200px] lg:w-[216px] xl:w-[224px]"
          >
            <AnimeCard card={card} priority={i < priorityCount} />
          </div>
        ))}
      </RowHighlight>
    </Reveal>
  );
}

/** Сетка карточек (каталог, похожие) */
export function AnimeGrid({
  cards,
  className = "",
  priorityCount = 0,
}: {
  cards: Card[];
  className?: string;
  /** См. AnimeRow.priorityCount: по умолчанию всё грузится лениво. */
  priorityCount?: number;
}) {
  return (
    <div
      className={`grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 ${className}`}
    >
      {cards.map((card, i) => (
        <AnimeCard key={card.id} card={card} priority={i < priorityCount} />
      ))}
    </div>
  );
}
