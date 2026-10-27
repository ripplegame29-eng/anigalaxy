"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { ReaderMode, ReaderWidth } from "./MangaReader";

const noop = () => () => {};

const WIDTHS: ReaderWidth[] = ["s", "m", "l"];
const WIDTH_LABEL: Record<ReaderWidth, string> = { s: "Узко", m: "Средне", l: "Широко" };

function Chevron({ dir }: { dir: "l" | "r" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d={dir === "l" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Плавающая панель ридера: к тайтлу, соседние главы, ползунок страниц,
 * режим чтения и ширина ленты. В ленте уезжает вниз при прокрутке.
 */
export function ReaderBar({
  mangaId,
  mangaTitle,
  chapterLabel,
  page,
  pages,
  prevChapter,
  nextChapter,
  mode,
  width,
  hidden,
  onMode,
  onWidth,
  onSeek,
}: {
  mangaId: string;
  mangaTitle: string;
  chapterLabel: string;
  page: number;
  pages: number;
  prevChapter?: { id: string; label: string };
  nextChapter?: { id: string; label: string };
  mode: ReaderMode;
  width: ReaderWidth;
  hidden: boolean;
  onMode: (m: ReaderMode) => void;
  onWidth: (w: ReaderWidth) => void;
  onSeek: (n: number) => void;
}) {
  // Панель выносим в body: <main> и подвал сайта — отдельные слои, и без
  // этого подвал рисуется поверх панели у конца страницы
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const shown = Math.max(page, 1);
  const pct = pages > 1 ? ((shown - 1) / (pages - 1)) * 100 : 100;

  if (!mounted) return null;

  return createPortal(
    <>
      <div aria-hidden className="mr-top">
        <i style={{ width: `${pct}%` }} />
      </div>

      <div className={`mr-bar${hidden ? " is-hidden" : ""}`} role="toolbar" aria-label="Панель чтения">
        <Link href={`/manga/${mangaId}`} className="mr-btn mr-back" title={mangaTitle} aria-label="К тайтлу">
          <Chevron dir="l" />
          <span>{mangaTitle}</span>
        </Link>

        <span className="mr-sep" aria-hidden />

        {prevChapter ? (
          <Link
            href={`/manga/${mangaId}/read/${prevChapter.id}`}
            className="mr-btn mr-ic"
            title={`Предыдущая: глава ${prevChapter.label}`}
            aria-label="Предыдущая глава"
          >
            <Chevron dir="l" />
          </Link>
        ) : (
          <span className="mr-btn mr-ic is-off" aria-hidden>
            <Chevron dir="l" />
          </span>
        )}

        <div className="mr-seek">
          <div className="mr-seek-h">
            <b>Глава {chapterLabel}</b>
            <span>
              {shown} / {pages}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={Math.max(pages, 1)}
            value={Math.min(shown, Math.max(pages, 1))}
            onChange={(e) => onSeek(Number(e.target.value))}
            style={{ ["--p" as string]: `${pct}%` }}
            aria-label="Страница главы"
          />
        </div>

        {nextChapter ? (
          <Link
            href={`/manga/${mangaId}/read/${nextChapter.id}`}
            className="mr-btn mr-ic"
            title={`Следующая: глава ${nextChapter.label}`}
            aria-label="Следующая глава"
          >
            <Chevron dir="r" />
          </Link>
        ) : (
          <span className="mr-btn mr-ic is-off" aria-hidden>
            <Chevron dir="r" />
          </span>
        )}

        <span className="mr-sep" aria-hidden />

        <div className="mr-seg" role="group" aria-label="Режим чтения">
          <button
            type="button"
            className="mr-btn mr-ic"
            aria-pressed={mode === "scroll"}
            title="Лента"
            onClick={() => onMode("scroll")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
              <rect x="7" y="3" width="10" height="7" rx="1.5" />
              <rect x="7" y="14" width="10" height="7" rx="1.5" />
            </svg>
          </button>
          <button
            type="button"
            className="mr-btn mr-ic"
            aria-pressed={mode === "page"}
            title="По одной странице"
            onClick={() => onMode("page")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
              <rect x="6" y="3" width="12" height="18" rx="2" />
            </svg>
          </button>
        </div>

        {mode === "scroll" && (
          <button
            type="button"
            className="mr-btn mr-ic mr-w"
            title={`Ширина: ${WIDTH_LABEL[width]}`}
            aria-label={`Ширина ленты: ${WIDTH_LABEL[width]}. Нажмите, чтобы изменить`}
            onClick={() => onWidth(WIDTHS[(WIDTHS.indexOf(width) + 1) % WIDTHS.length])}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
              <path d="M4 12h16M4 12l3-3M4 12l3 3M20 12l-3-3M20 12l-3 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </>,
    document.body,
  );
}
