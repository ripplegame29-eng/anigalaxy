"use client";

import { useEffect } from "react";

/**
 * Пауза анимаций эмблем вне экрана — дословно как в оригинале:
 * IntersectionObserver + класс `pz`, MutationObserver подхватывает
 * эмблемы, которые появляются позже (другие страницы, динамический UI).
 */
export function LevelEmblemIO() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.target.classList.toggle("pz", !e.isIntersecting)),
      { rootMargin: "80px" },
    );
    const watch = () =>
      document.querySelectorAll(".le:not([data-w])").forEach((el) => {
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
