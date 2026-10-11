"use client";

import { useEffect, useState } from "react";

/**
 * Счётчик страниц для панели ридера: номер страницы, которая сейчас
 * в экране. IntersectionObserver сообщает об изменениях асинхронно,
 * поэтому синхронного setState в эффекте здесь нет.
 */
export function usePageCounter(count: number): number {
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (count === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Видимых картинок на экране может быть несколько — берём верхнюю
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!visible) return;
        const index = (visible.target as HTMLElement).dataset.page;
        if (index) setPage(Number(index));
      },
      { threshold: 0.5 },
    );

    const nodes = document.querySelectorAll<HTMLElement>("[data-page]");
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [count]);

  return page;
}