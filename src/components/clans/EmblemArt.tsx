"use client";

/**
 * «Ожившая» эмблема клана — перенос из макета «Ожившие эмблемы кланов».
 *
 * Структура повторяет исходную: подложка со свечением, две орбиты,
 * слой с параллаксом и знаком, бегущий блик по маске картинки и вспышка.
 *
 * Отличия от макета сознательные:
 *  - canvas-частицы заменены CSS-слоями. В макете на каждую эмблему был
 *    свой canvas с requestAnimationFrame; в каталоге их двадцать три, и
 *    двадцать три цикла анимации на кадр съедали бы страницу целиком.
 *  - параллакс отключается на тач-устройствах: там нет курсора.
 *
 * Фильтр `#cl-heat` объявлен один раз в app/layout.tsx. Пока его
 * определения в документе не было, Chrome молча игнорировал правило
 * `filter: url(#cl-heat)` — часть эмблем выпадала из сетки.
 */
import { useEffect, useRef, useState } from "react";
import "../../app/clan-emblem.css";
import type { ClanEmblemArt as EmblemArt } from "@/lib/emblems.data";

export function EmblemArt({
  emblem,
  size = 160,
  interactive = true,
}: {
  emblem: EmblemArt;
  /** Размер сцены в px. Знак занимает её целиком, как в макете. */
  size?: number;
  interactive?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [p, setP] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!interactive) return;
    const coarse =
      typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    if (coarse) return;

    const node = ref.current;
    if (!node) return;

    const onMove = (event: PointerEvent) => {
      const box = node.getBoundingClientRect();
      setP({
        x: (event.clientX - box.left) / box.width - 0.5,
        y: (event.clientY - box.top) / box.height - 0.5,
      });
    };
    const onLeave = () => setP({ x: 0, y: 0 });

    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerleave", onLeave);
    return () => {
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
    };
  }, [interactive]);

  const src = `/emblems/${emblem.glyph}`;
  const delay = `${emblem.fd ?? 0}ms`;

  return (
    <span
      ref={ref}
      className="cl-st"
      style={{ width: size, height: size, ["--c" as string]: emblem.color }}
      title={emblem.ru}
    >
      {/* Подложка со свечением — уходит за знак и даёт объём */}
      <span className="cl-st-back" aria-hidden />

      {/* Орбиты: две, разный темп, цвет эмблемы */}
      <svg className="cl-st-rings" viewBox="0 0 100 100" aria-hidden focusable="false">
        <circle className="r1" cx="50" cy="50" r="47" fill="none" stroke="var(--c)" />
        <circle className="r2" cx="50" cy="50" r="43" fill="none" stroke="var(--c)" />
      </svg>

      {/* Слой с параллаксом и плаванием */}
      <span
        className="cl-st-par"
        style={{
          transform: p.x || p.y ? `perspective(900px) rotateY(${p.x * 7}deg) rotateX(${-p.y * 6}deg)` : undefined,
        }}
      >
        {/* Цветной ореол под знаком */}
        <span className="cl-st-aura" aria-hidden />
        {/* Bloom: размытая копия цвета, даёт свечение изнутри */}
        <span className="cl-st-bloom" aria-hidden />

        <span className="cl-st-pic">
          {/* eslint-disable-next-line @next/next/no-img-element -- ассет из public, размер фиксирован */}
          <img
            className={emblem.heat ? "heat" : ""}
            src={src}
            alt={emblem.ru}
            width={size}
            height={size}
            draggable={false}
          />
          {/* Блик и вспышка идут по маске самого знака, как в макете */}
          <span
            className="cl-st-shine"
            style={{ ["--img" as string]: `url("${src}")`, animationDelay: delay }}
            aria-hidden
          />
          <span
            className="cl-st-flash"
            style={{ animationDelay: delay }}
            aria-hidden
          />
        </span>
      </span>
    </span>
  );
}

/** Компактная эмблема для строк списков: без анимации, только знак */
export function ClanEmblemChip({ emblem }: { emblem: EmblemArt }) {
  return (
    <span className="cl-emblem-chip" style={{ ["--c" as string]: emblem.color }} title={emblem.ru}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ассет из public, размер фиксирован */}
      <img src={`/emblems/${emblem.glyph}`} alt="" width={22} height={22} draggable={false} />
    </span>
  );
}