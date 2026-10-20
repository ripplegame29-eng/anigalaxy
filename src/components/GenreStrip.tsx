"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Полоса жанров одной строкой со стрелками. Стрелка появляется только там,
 * куда ещё можно прокрутить; край затухает маской, а не обрывает пилюлю.
 */
export function GenreStrip({ genres }: { genres: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdge((prev) => {
      const next = { start: el.scrollLeft > 4, end: el.scrollLeft < max - 4 };
      return prev.start === next.start && prev.end === next.end ? prev : next;
    });
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const go = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className="gn-wrap" data-start={edge.start} data-end={edge.end}>
      <button type="button" className="gn-arrow gn-prev" onClick={() => go(-1)} aria-label="Жанры назад" tabIndex={edge.start ? 0 : -1}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 5-7 7 7 7" />
        </svg>
      </button>
      <nav ref={ref} aria-label="Жанры" className="gn-strip" onScroll={measure}>
        {genres.map((title) => (
          <Link key={title} href={`/catalog?genre=${encodeURIComponent(title)}`}>
            {title}
          </Link>
        ))}
      </nav>
      <button type="button" className="gn-arrow gn-next" onClick={() => go(1)} aria-label="Жанры вперёд" tabIndex={edge.end ? 0 : -1}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
