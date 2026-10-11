"use client";

import { useEffect, useRef } from "react";

/**
 * Два виджета под плеером (донат + «Боевой пропуск»): iframe с копией
 * `public/donate-widget.html` (1233.html; правки: фон body #060914 →
 * transparent — он рисовал тёмно-синюю рамку вокруг баннеров
 * и перекрывал фоновое свечение страницы; и перф без смены вида —
 * scanline едут через transform (композитор), пульс рамки кнопки на
 * opacity вместо box-shadow, чтобы два баннера не гнали repaint
 * на главном потоке постоянно; картинки вынесены из base64 в
 * `public/banners/*.webp` — HTML похудел с 434 КБ до 24 КБ и стал
 *    кешируемым; ниже 720px у ленты баннеров появляется полоса
 *    прокрутки и затемнение правого края — до этого кнопка «Поддержать»
 *    справа выглядела как просто обрезанный баннер).
 *
 * Высота:
 *  - с первого paint (SSR) — `max(46cqw + 55px, 320px)`: баннеры имеют
 *    min-width 640px, поэтому высота ступенчатая по ширине контейнера и
 *    точной аппроксимации у неё нет — берётся верхняя оценка, пол 320px
 *    закрывает телефон, где лента шире экрана (контейнер — <section> с
 *    container-type: inline-size);
 *  - после загрузки — fit по `.stack` (offsetHeight + отступы body из
 *    computedStyle + 8): на десктопе и мобильном отступы свои, константа
 *    оставляла под баннерами пустую полосу; фон прозрачный, разницы
 *    не видно;
 *  - при открытой модалке (.modal.on) — минимум 430px, чтобы окно
 *    влезло целиком; ловится MutationObserver'ом на самих .modal
 *    (пересоздаётся на каждый load: первый attach может попасть на
 *    начальный about:blank, где модалок нет).
 */
export function DonateWidget() {
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
      // Отступы body в виджете свои на десктопе (20px) и на мобильном (14px),
      // поэтому запас считаем изComputedStyle, а не константой: иначе под
      // карточками оставалась пустая полоса в треть экрана
      const style = doc.defaultView?.getComputedStyle(doc.body);
      const pad = style
        ? parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
        : 40;
      // offsetHeight — чистая layout-высота (без учёта анимации входа)
      const base = stack.offsetHeight + pad + 8;
      const modalOpen = Boolean(doc.querySelector(".modal.on"));
      const h = Math.max(base, modalOpen ? 430 : 210);
      const px = `${Math.ceil(h)}px`;
      if (fr.style.height !== px) fr.style.height = px;
    };

    const attach = () => {
      fit();
      // Финальная подгонка после анимации входа (.w: animation in .9s)
      window.clearTimeout(settle);
      settle = window.setTimeout(fit, 1000);
      // Пересоздаём наблюдатель на каждый load: первый attach может
      // прийтись на начальный about:blank (там body есть, а .modal нет)
      observer?.disconnect();
      observer = null;
      const modals = fr.contentDocument?.querySelectorAll(".modal");
      if (!modals?.length) return;
      const mo = new MutationObserver(fit);
      // Наблюдаем только модалки: пульсации глитч-зон (.on/.loop) внутри
      // баннеров не должны дёргать fit
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
      src="/donate-widget.html"
      title="AniGalaxy — донат и боевой пропуск"
      className="block w-full border-0"
      style={{
        /* Высота двух баннеров по ширине контейнера W, но не уже 640px:
           max(W,640) × (465/2140 + 387/2120) + зазор clamp(18,2.4vw,44)
           + отступы body 40. Прямой аппроксимации нет — слагаемые
           переключаются на 640px, поэтому берём 46cqw + 55px и пол 320px
           (проверено на 358px и 1392px), а после загрузки fit() ужимает
           до точного значения. Пол нужен ещё и для того, чтобы до JS не
           мелькнул внутренний скроллбар. */
        height: "max(46cqw + 55px, 320px)",
        background: "transparent",
      }}
    />
  );
}
