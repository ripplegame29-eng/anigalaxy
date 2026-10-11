"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Панель ридера: возврат к тайтлу, переключение «предыдущая / следующая
 * глава» и счётчик страниц. На мобильных сворачивается в компактную
 * полосу, чтобы не закрывать кадр.
 */
export function ReaderBar({
  mangaId,
  mangaTitle,
  chapterLabel,
  page,
  pages,
  prevChapter,
  nextChapter,
}: {
  mangaId: string;
  mangaTitle: string;
  chapterLabel: string;
  page: number;
  pages: number;
  prevChapter?: { id: string; label: string };
  nextChapter?: { id: string; label: string };
}) {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const percent = pages > 1 ? Math.round(((page - 1) / (pages - 1)) * 100) : 100;

  return (
    <>
      {/* Прогресс по страницам */}
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-40 h-0.5 bg-white/8 transition-opacity duration-300"
        style={{ opacity: solid ? 1 : 0 }}
      >
        <div
          className="h-full bg-accent transition-[width] duration-150"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t transition-colors duration-300 ${
          solid
            ? "border-line bg-ink-soft/95 backdrop-blur-xl"
            : "border-transparent bg-ink-soft/60 backdrop-blur-sm"
        }`}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2.5 sm:px-4">
          <Link
            href={`/manga/${mangaId}`}
            className="btn-ghost flex min-w-0 items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-white/85 transition-colors hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hidden max-w-[30vw] truncate sm:inline">{mangaTitle}</span>
          </Link>

          <span className="ml-auto shrink-0 text-xs tabular-nums text-muted">
            Глава {chapterLabel}
            {page > 0 && ` · ${page} / ${pages}`}
          </span>

          <div className="flex shrink-0 items-center gap-1.5">
            {prevChapter ? (
              <Link
                href={`/manga/${mangaId}/read/${prevChapter.id}`}
                title={`Предыдущая: ${prevChapter.label}`}
                aria-label="Предыдущая глава"
                className="btn-ghost grid h-9 w-9 place-items-center rounded-xl bg-white/6 text-white/80 ring-1 ring-white/10 transition-colors hover:bg-white/12 hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-xl opacity-25" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}

            {nextChapter ? (
              <Link
                href={`/manga/${mangaId}/read/${nextChapter.id}`}
                title={`Следующая: ${nextChapter.label}`}
                aria-label="Следующая глава"
                className="btn-ghost grid h-9 w-9 place-items-center rounded-xl bg-white/6 text-white/80 ring-1 ring-white/10 transition-colors hover:bg-white/12 hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-xl opacity-25" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}