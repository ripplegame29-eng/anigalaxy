"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePageCounter } from "./usePageCounter";
import "./reader.css";

export type ReaderMode = "scroll" | "page";
export type ReaderWidth = "s" | "m" | "l";
export interface SeekTarget {
  page: number;
  nonce: number;
}
interface ChapterLink {
  id: string;
  label: string;
}

/** Ключ сохранённой позиции в главе */
export const posKey = (mangaId: string, chapter: string) => `mr-pos:${mangaId}:${chapter}`;

/** Сохранённая страница; завершённую главу читаем заново с первой */
function readSaved(key: string, total: number): number {
  try {
    const n = Number(window.localStorage.getItem(key) ?? 0);
    return Number.isFinite(n) && n > 1 && n < total ? n : 0;
  } catch {
    return 0;
  }
}

interface Common {
  mangaId: string;
  pages: string[];
  title: string;
  chapterLabel: string;
  startAt: number;
  seek: SeekTarget;
  onPageChange: (page: number) => void;
  prevChapter?: ChapterLink;
  nextChapter?: ChapterLink;
}

/**
 * Ридер манги. Два режима: лента (все страницы одним потоком) и по одной
 * странице (стрелки, тап по краям, свайп). В ленте картинки рендерятся
 * сразу все — догрузкой занимается браузер (loading="lazy"), а пока страница
 * не пришла, на её месте держится заглушка с номером.
 */
export function MangaReader(
  props: Common & {
    mode: ReaderMode;
    width: ReaderWidth;
    onToggleBar: () => void;
  },
) {
  const { mode, width, onToggleBar, ...common } = props;

  if (common.pages.length === 0) {
    return (
      <p className="mx-auto max-w-md px-4 py-20 text-center text-sm text-muted">
        Страницы главы пока не загружены — перевод ещё не выложен. Попробуй соседнюю главу.
      </p>
    );
  }
  return mode === "page" ? (
    <PageView {...common} onToggleBar={onToggleBar} />
  ) : (
    <ScrollView {...common} width={width} />
  );
}

/* ---------------------------- лента ---------------------------- */

function ScrollView({
  mangaId,
  pages,
  title,
  chapterLabel,
  startAt,
  seek,
  onPageChange,
  prevChapter,
  nextChapter,
  width,
}: Common & { width: ReaderWidth }) {
  const [ok, setOk] = useState<Record<number, true>>({});
  const [bad, setBad] = useState<Record<number, true>>({});
  const [retry, setRetry] = useState<Record<number, number>>({});
  const stripRef = useRef<HTMLDivElement>(null);

  const page = usePageCounter(pages.length);
  useEffect(() => {
    if (page > 0) onPageChange(page);
  }, [page, onPageChange]);

  const goTo = useCallback((n: number, smooth: boolean) => {
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-page="${n}"]`);
    el?.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Стартовая позиция: явная (смена режима) или сохранённая
  useEffect(() => {
    const n = startAt > 1 ? startAt : readSaved(posKey(mangaId, chapterLabel), pages.length);
    if (n > 1) goTo(n, false);
  }, [startAt, mangaId, chapterLabel, pages.length, goTo]);

  // Прыжок по ползунку на панели
  const lastNonce = useRef(seek.nonce);
  useEffect(() => {
    if (seek.nonce === lastNonce.current) return;
    lastNonce.current = seek.nonce;
    goTo(seek.page, false);
  }, [seek, goTo]);

  const markOk = useCallback((i: number) => setOk((p) => (p[i] ? p : { ...p, [i]: true })), []);

  return (
    <div ref={stripRef} className="mr-strip" data-w={width}>
      {pages.map((url, i) => (
        <figure
          key={`${url}:${retry[i] ?? 0}`}
          data-page={i + 1}
          data-n={i + 1}
          className={`mr-pg${ok[i] ? " ok" : ""}`}
        >
          {/* Страницы с CDN не проходят через next/image: домен сменяется на каждый запрос */}
          <img
            ref={(el) => {
              if (el && el.complete && el.naturalWidth > 0) markOk(i);
            }}
            src={url}
            alt={`${title} — глава ${chapterLabel}, страница ${i + 1}`}
            loading={i < 3 ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => markOk(i)}
            onError={() => setBad((p) => ({ ...p, [i]: true }))}
          />
          {bad[i] && !ok[i] && (
            <button
              type="button"
              className="mr-bad"
              onClick={() => {
                setBad((p) => {
                  const next = { ...p };
                  delete next[i];
                  return next;
                });
                setRetry((p) => ({ ...p, [i]: (p[i] ?? 0) + 1 }));
              }}
            >
              Страница {i + 1} не загрузилась
              <b>Повторить</b>
            </button>
          )}
        </figure>
      ))}

      <EndCard
        mangaId={mangaId}
        total={pages.length}
        chapterLabel={chapterLabel}
        prevChapter={prevChapter}
        nextChapter={nextChapter}
      />
    </div>
  );
}

/* ------------------------ по одной странице ------------------------ */

function PageView({
  mangaId,
  pages,
  title,
  chapterLabel,
  startAt,
  seek,
  onPageChange,
  onToggleBar,
  prevChapter,
  nextChapter,
}: Common & { onToggleBar: () => void }) {
  const total = pages.length;
  // 1..total — страницы, total + 1 — финальная карточка главы
  const [cur, setCur] = useState(() => {
    const n = startAt > 0 ? startAt : readSaved(posKey(mangaId, chapterLabel), total) || 1;
    return Math.min(Math.max(n, 1), total);
  });
  const [ok, setOk] = useState<Record<number, true>>({});
  const touch = useRef<{ x: number; y: number } | null>(null);

  const go = useCallback(
    (n: number) => {
      setCur(Math.min(Math.max(n, 1), total + 1));
      window.scrollTo({ top: 0 });
    },
    [total],
  );

  useEffect(() => {
    onPageChange(Math.min(cur, total));
  }, [cur, total, onPageChange]);

  const lastNonce = useRef(seek.nonce);
  useEffect(() => {
    if (seek.nonce === lastNonce.current) return;
    lastNonce.current = seek.nonce;
    go(seek.page);
  }, [seek, go]);

  // Заранее тянем две следующие страницы
  useEffect(() => {
    for (const n of [cur + 1, cur + 2]) {
      if (n <= total) new Image().src = pages[n - 1];
    }
  }, [cur, pages, total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        go(cur + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(cur - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cur, go]);

  if (cur > total) {
    return (
      <div className="mr-strip" data-w="m">
        <EndCard
          mangaId={mangaId}
          total={total}
          chapterLabel={chapterLabel}
          prevChapter={prevChapter}
          nextChapter={nextChapter}
          onBack={() => go(total)}
        />
      </div>
    );
  }

  return (
    <div
      className="mr-single"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        if (x < 0.33) go(cur - 1);
        else if (x > 0.67) go(cur + 1);
        else onToggleBar();
      }}
      onTouchStart={(e) => {
        const t = e.touches[0];
        touch.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const s = touch.current;
        touch.current = null;
        if (!s) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - s.x;
        if (Math.abs(dx) > 60 && Math.abs(t.clientY - s.y) < 70) {
          e.preventDefault();
          go(dx < 0 ? cur + 1 : cur - 1);
        }
      }}
    >
      <figure className={`mr-one${ok[cur] ? " ok" : ""}`} data-n={cur}>
        <img
          key={cur}
          ref={(el) => {
            if (el && el.complete && el.naturalWidth > 0) setOk((p) => (p[cur] ? p : { ...p, [cur]: true }));
          }}
          src={pages[cur - 1]}
          alt={`${title} — глава ${chapterLabel}, страница ${cur}`}
          decoding="async"
          draggable={false}
          onLoad={() => setOk((p) => ({ ...p, [cur]: true }))}
        />
      </figure>
      <span className="mr-zone l" aria-hidden />
      <span className="mr-zone r" aria-hidden />
    </div>
  );
}

/* ------------------------ финальная карточка ------------------------ */

function EndCard({
  mangaId,
  total,
  chapterLabel,
  prevChapter,
  nextChapter,
  onBack,
}: {
  mangaId: string;
  total: number;
  chapterLabel: string;
  prevChapter?: ChapterLink;
  nextChapter?: ChapterLink;
  onBack?: () => void;
}) {
  return (
    <section className="mr-end" aria-label="Конец главы">
      <p className="mr-end-k">
        Глава {chapterLabel} · {total} {total === 1 ? "страница" : total < 5 ? "страницы" : "страниц"}
      </p>
      <h2>{nextChapter ? "Глава прочитана" : "Это последняя доступная глава"}</h2>
      <div className="mr-end-act">
        {nextChapter && (
          <Link className="mr-end-main" href={`/manga/${mangaId}/read/${nextChapter.id}`}>
            Глава {nextChapter.label}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )}
        <Link className="mr-end-sec" href={`/manga/${mangaId}`}>
          К тайтлу
        </Link>
        {prevChapter && (
          <Link className="mr-end-sec" href={`/manga/${mangaId}/read/${prevChapter.id}`}>
            Глава {prevChapter.label}
          </Link>
        )}
        {onBack && (
          <button type="button" className="mr-end-sec" onClick={onBack}>
            Назад к странице
          </button>
        )}
      </div>
    </section>
  );
}
