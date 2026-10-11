"use client";

import { useEffect, useRef } from "react";
import { closeBonusDialog } from "@/lib/bonus-dialog";
import { FortuneWheel } from "./FortuneWheel";

/**
 * Модалка колеса фортуны (кнопка «Ежедневный бонус» в шапке).
 *
 * Внутри — только сам виджет: без заголовков, стрика, кнопок и подписей
 * (так просил пользователь). Панель раскрывается почти на всё окно, а её
 * ширина подбирается по высоте экрана, чтобы колесо (дизайн 1536×1024)
 * влезло целиком, без внутренних скроллбаров.
 */
export function DailyBonusDialog() {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // Закрытие по Escape + запрет прокрутки страницы под модалкой
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeBonusDialog();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const onBackdrop = (e: React.MouseEvent) => {
    if (panelRef.current && e.target instanceof Node && !panelRef.current.contains(e.target)) {
      closeBonusDialog();
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" onMouseDown={onBackdrop}>
      <div className="absolute inset-0 bg-ink/88 backdrop-blur-sm" aria-hidden />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Колесо фортуны"
        tabIndex={-1}
        className="relative max-h-[calc(100dvh-32px)] overflow-hidden rounded-3xl border border-white/10 bg-ink outline-none shadow-[0_40px_100px_-30px_rgba(0,0,0,1)] animate-fade-in"
        style={
          {
            /*
             * Высота колеса ≈ 0.667·W + 50px: (W − 24) · 1024/1536 — сама
             * картинка, + 40 — отступы body (20×2), + ~26 — строка
             * «Сбросить демо». Значит 0.667·W + 50 + 32 (поля оверлея)
             * ≤ 100dvh, отсюда W ≤ (100dvh − 130px) · 1.5. Плюс потолок
             * 1280px (крупнее незачем) и ширина экрана. Значение отдаётся
             * в CSS-переменную, чтобы iframe получил правильную высоту ещё
             * с первого кадра (до замера изнутри).
             */
            "--wheel-w":
              "min(1280px, max(320px, calc((100dvh - 130px) * 1.5)), calc(100vw - 32px))",
            width: "var(--wheel-w)",
          } as React.CSSProperties
        }
      >
        <button
          type="button"
          onClick={closeBonusDialog}
          aria-label="Закрыть"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-ink/65 text-white/85 ring-1 ring-white/15 backdrop-blur transition hover:bg-ink hover:text-white hover:ring-white/35"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>

        <FortuneWheel />
      </div>
    </div>
  );
}
