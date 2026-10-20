"use client";

/**
 * Подсветка карточек в горизонтальном ряду.
 *
 * Внутри ленты едет одна полупрозрачная плашка: наводишь курсор на карточку —
 * она плавно переезжает под неё, уводишь — гаснет. Эффект одинаковый для всех
 * рядов, поэтому он вынесен отдельным компонентом и подключается в любой ряд.
 *
 * Почему делегирование, а не слушатель на каждой карточке: карточки приходят
 * из серверных данных и появляются позже, слушатели пришлось бы вешать и
 * перевешивать. События ловятся на самой ленте один раз, а нужная карточка
 * ищется через closest — это работает и для карточек, добавленных позже.
 *
 * Разметка и стили — в components/row-highlight.css (классы hl-row / hl-card /
 * hl-pill). Плашка лежит внутри прокручиваемой ленты, поэтому уезжает вместе с
 * контентом при горизонтальной прокрутке.
 */

import { useCallback, useRef, type ReactNode, type RefObject } from "react";

/** Запас плашки вокруг карточки: столько же есть в CSS, если поднять */
const PAD = 8;

export function RowHighlight({
  railRef,
  className = "",
  children,
}: {
  /** Ссылка на ленту — её же используют стрелки прокрутки */
  railRef?: RefObject<HTMLDivElement | null>;
  className?: string;
  children: ReactNode;
}) {
  const pillRef = useRef<HTMLSpanElement>(null);

  /** Ставит плашку под карточку. Позиции — относительно ленты, у неё
   *  position: relative, поэтому offsetLeft карточки пригоден как есть. */
  const show = useCallback((card: HTMLElement) => {
    const pill = pillRef.current;
    if (!pill) return;
    pill.style.width = `${card.offsetWidth + PAD * 2}px`;
    pill.style.height = `${card.offsetHeight + PAD * 2}px`;
    pill.style.transform = `translate(${card.offsetLeft - PAD}px, ${card.offsetTop - PAD}px)`;
    pill.classList.add("on");
  }, []);

  /** Ближайшая карточка от события — работает для динамически добавленных */
  const cardOf = (target: EventTarget | null): HTMLElement | null =>
    target instanceof Element ? target.closest<HTMLElement>(".hl-card") : null;

  return (
    <div
      ref={railRef}
      className={`hl-row ${className}`}
      onPointerOver={(event) => {
        const card = cardOf(event.target);
        if (card) show(card);
      }}
      onPointerOut={(event) => {
        /* Гасим плашку, только когда курсор ушёл из ряда целиком: пока он
         * переходит между соседними карточками, ближайшей карточкой внутри
         * всё равно остаётся какая-то — иначе плашка мигала бы. */
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        pillRef.current?.classList.remove("on");
      }}
      /* С клавиатуры: та же плашка едет к сфокусированной карточке */
      onFocus={(event) => {
        const card = cardOf(event.target);
        if (card) show(card);
      }}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        pillRef.current?.classList.remove("on");
      }}
    >
      <span ref={pillRef} className="hl-pill" aria-hidden />
      {children}
    </div>
  );
}
