"use client";

import { useEffect, useRef } from "react";

/**
 * Фон страницы карточек: сетка с параллаксом, подсветка сетки под курсором,
 * синяя аура, три медленных шара и виньетка. Всё fixed и без событий мыши.
 * Позицию курсора плавно догоняем в rAF и отдаём в CSS-переменные.
 */
export function CardsBackdrop() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // На телефоне параллакс за пальцем не нужен, а вечный rAF греет устройство
    if (window.matchMedia("(prefers-reduced-motion: reduce), (hover: none) and (pointer: coarse)").matches) return;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * -18;
      ty = (e.clientY / window.innerHeight - 0.5) * -18;
      el.style.setProperty("--mx", `${e.clientX}px`);
      el.style.setProperty("--my", `${e.clientY}px`);
      if (!raf) raf = window.requestAnimationFrame(tick);
    };
    const tick = () => {
      cx += (tx - cx) * 0.05;
      cy += (ty - cy) * 0.05;
      el.style.setProperty("--px", `${cx.toFixed(2)}px`);
      el.style.setProperty("--py", `${cy.toFixed(2)}px`);
      // Догнали курсор — цикл засыпает до следующего движения мыши
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.05 ? window.requestAnimationFrame(tick) : 0;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="cg2-bg" ref={ref} aria-hidden>
      <i className="cg2-aura" />
      <span className="cg2-orbs">
        <i />
        <i />
        <i />
      </span>
      <i className="cg2-grid" />
      <i className="cg2-hot" />
      <i className="cg2-vig" />
    </div>
  );
}
