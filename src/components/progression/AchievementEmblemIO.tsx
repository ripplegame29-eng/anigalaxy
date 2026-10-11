"use client";

import { useEffect } from "react";

/**
 * Одна точка наблюдения для всех эмблем достижений и артов наград пропуска:
 * IntersectionObserver ставит класс `ae-pz`, когда элемент вне экрана,
 * MutationObserver подхватывает новые, появляющиеся позже.
 */
export function AchievementEmblemIO() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.target.classList.toggle("ae-pz", !e.isIntersecting)),
      { rootMargin: "80px" },
    );
    const watch = () =>
      document.querySelectorAll(".ae:not([data-w]), .bp-art:not([data-w])").forEach((el) => {
        (el as HTMLElement).dataset.w = "1";
        io.observe(el);
      });
    const mo = new MutationObserver(watch);
    mo.observe(document.body, { childList: true, subtree: true });
    watch();
    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  return null;
}
