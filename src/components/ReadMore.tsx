"use client";

import { useState } from "react";

/**
 * Описание с «Читать далее»: свёрнуто до нескольких строк с мягким затуханием
 * снизу, раскрывается по клику. Если текст короткий — кнопка не показывается
 * (порог — по длине, без измерения DOM, чтобы не было скачка при гидратации).
 */
export function ReadMore({
  text,
  lines = 5,
  threshold = 320,
}: {
  text: string;
  lines?: number;
  threshold?: number;
}) {
  const [open, setOpen] = useState(false);
  const long = text.length > threshold;

  return (
    <div>
      <div className="relative">
        <p
          className="text-[15px] leading-[1.75] text-white/80"
          style={
            long && !open
              ? { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" }
              : undefined
          }
        >
          {text}
        </p>
        {long && !open && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-ink to-transparent"
            aria-hidden
          />
        )}
      </div>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-accent-2 transition hover:text-white"
        >
          {open ? "Свернуть" : "Читать далее"}
          <svg
            viewBox="0 0 24 24"
            className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}
