"use client";

import { useEffect, useRef } from "react";

/**
 * Колесо фортуны: iframe с копией `public/fortune-wheel.html`. Копия
 * отличается от оригинала одним: у `.w` снят `min-width:640px` — иначе
 * колесо уезжало бы в боковой скролл при любой ширине меньше 664px
 * (см. коммент в самом файле). Дизайн, CSS, JS и картинки не менялись.
 *
 * Размер задаёт модалка (`DailyBonusDialog`): ширина панели по высоте
 * окна, а от неё — высота iframe через CSS-переменную `--wheel-w`, чтобы
 * с первого кадра не было пустого блока.
 *
 * Высота:
 *  - после загрузки — fit по `.stack` (offsetHeight + 40: отступы body 20×2),
 *    внутренний скроллбар не появляется;
 *  - при открытой модалке приза (`.modal.on`) — минимум 380px, иначе окно
 *    с призом обрезалось бы по вертикали; ловится MutationObserver'ом
 *    по атрибуту class (пересоздаётся на каждый load: первый attach может
 *    прийтись на начальный about:blank, где модалок нет).
 */
export function FortuneWheel() {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const fr = ref.current;
    if (!fr) return;

    let observer: MutationObserver | null = null;
    let settle = 0;

    const fit = () => {
      const doc = fr.contentDocument;
      const stack = doc?.querySelector<HTMLElement>(".stack");
      if (!doc || !stack) return;
      const base = stack.offsetHeight + 40; // padding body 20 + 20
      const modalOpen = Boolean(doc.querySelector(".modal.on"));
      const h = Math.max(base, modalOpen ? 380 : 0);
      const px = `${Math.ceil(h)}px`;
      if (fr.style.height !== px) fr.style.height = px;
    };

    const attach = () => {
      fit();
      // Финальная подгонка после анимации входа (.w: animation in .9s)
      window.clearTimeout(settle);
      settle = window.setTimeout(fit, 1000);
      // Пересоздаём наблюдатель на каждый load
      observer?.disconnect();
      observer = null;
      const modals = fr.contentDocument?.querySelectorAll(".modal");
      if (!modals?.length) return;
      const mo = new MutationObserver(fit);
      modals.forEach((m) => mo.observe(m, { attributes: true, attributeFilter: ["class"] }));
      observer = mo;
    };

    fr.addEventListener("load", attach);
    window.addEventListener("resize", fit);
    // Если iframe успел загрузиться до подписки — подгоняем сразу
    if (fr.contentDocument?.readyState === "complete") attach();

    return () => {
      fr.removeEventListener("load", attach);
      window.removeEventListener("resize", fit);
      window.clearTimeout(settle);
      observer?.disconnect();
    };
  }, []);

  return (
    <iframe
      ref={ref}
      src="/fortune-wheel.html"
      title="AniGalaxy — колесо фортуны"
      scrolling="no"
      className="block w-full border-0"
      style={{
        // 0.6667·W + 50 — расчётная высота колеса (см. DailyBonusDialog),
        // держим её до первого fit(), чтобы не было скачка размера
        height: "calc(var(--wheel-w, 760px) * 0.6667 + 50px)",
        background: "#060914",
      }}
    />
  );
}
