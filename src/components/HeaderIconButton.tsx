"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";

interface HeaderIconButtonProps {
  /** Заголовок в тултипе (жирный, первой строкой) */
  label: string;
  /** Пояснение в тултипе (второй строкой, приглушённым) */
  hint: string;
  /** Подпись для скринридеров — кнопка же визуально без текста */
  ariaLabel: string;
  /** Если задан — кнопка рендерится как ссылка next/link */
  href?: string;
  onClick?: () => void;
  children: ReactNode;
}

/**
 * Плашка тултипа: центр по кнопке, на 10px ниже её, появляется с лёгким
 * сдвигом вверх и проявлением. z-50 — чтобы перекрыть соседние элементы
 * шапки; pointer-events-none — чтобы не мешать наведению.
 */
const TIP =
  "pointer-events-none absolute left-1/2 top-[calc(100%+10px)] z-50 w-max max-w-[230px] -translate-x-1/2 translate-y-[-4px] scale-[.96] rounded-xl border border-white/10 bg-[#14141c]/97 px-3 py-2 text-left opacity-0 shadow-[0_20px_45px_-20px_rgba(0,0,0,.95)] backdrop-blur-xl transition duration-150 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:scale-100 group-focus-within:opacity-100";

const BTN =
  "grid h-9 w-9 place-items-center rounded-full bg-white/6 text-white/85 ring-1 ring-white/10 transition hover:bg-white/12 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70";

/**
 * Иконко-кнопка шапки с всплывающим окошком при наведении (и при фокусе с
 * клавиатуры — group-focus-within). Окошко: тёмная плашка с заголовком и
 * пояснением, как во «втором скрине» пользователя.
 *
 * Окошко всегда в DOM (только скрыто), поэтому его можно честно привязать к
 * кнопке через aria-describedby. На мобильных страницах не используется —
 * шапка показывает эти кнопки начиная с lg.
 */
export function HeaderIconButton({
  label,
  hint,
  ariaLabel,
  href,
  onClick,
  children,
}: HeaderIconButtonProps) {
  const tipId = useId();

  const body = (
    <>
      <span id={tipId} role="tooltip" className={TIP}>
        <span className="block text-[13px] font-bold leading-tight text-white">{label}</span>
        <span className="mt-0.5 block text-[11.5px] font-medium leading-snug text-muted">
          {hint}
        </span>
      </span>
      {children}
    </>
  );

  if (href) {
    return (
      <span className="group relative inline-flex">
        <Link href={href} aria-label={ariaLabel} aria-describedby={tipId} className={BTN}>
          {body}
        </Link>
      </span>
    );
  }

  return (
    <span className="group relative inline-flex">
      <button type="button" onClick={onClick} aria-label={ariaLabel} aria-describedby={tipId} className={BTN}>
        {body}
      </button>
    </span>
  );
}
