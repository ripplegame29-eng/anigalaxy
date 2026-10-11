"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePageCounter } from "./usePageCounter";

/**
 * Ридер манги: вертикальная лента страниц с бесконечной подгрузкой.
 *
 * Страницы приходят с временного CDN MangaDex — догружаем их по мере
 * прокрутки, чтобы не тянуть 40 картинок сразу. У каждой страницы свой
 * счётчик загрузки: пока она не готова, держим место, чтобы лента не
 * «прыгала» под ногами у читателя.
 */
export function MangaReader({
  pages,
  title,
  chapterLabel,
  onPageChange,
}: {
  pages: string[];
  title: string;
  chapterLabel: string;
  onPageChange?: (page: number) => void;
}) {
  // Возврат к прежнему месту: позиция читается сразу, до первого рендера
  const [restore] = useState(() => {
    if (typeof window === "undefined") return 0;
    try {
      const saved = Number(window.sessionStorage.getItem(`manga-read:${title}`) ?? 0);
      window.sessionStorage.removeItem(`manga-read:${title}`);
      return Number.isFinite(saved) && saved > 0 ? saved : 0;
    } catch {
      return 0;
    }
  });

  const [loadedCount, setLoadedCount] = useState(() =>
    Math.min(pages.length, 5 + (restore > 0 ? Math.ceil(restore / 800) : 0)),
  );
  const [failed, setFailed] = useState<Record<number, true>>({});
  const sentinelRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(restore === 0);

  // Счётчик для панели: MediaObserver вешается после каждого роста ленты
  const visiblePage = usePageCounter(loadedCount);
  useEffect(() => {
    onPageChange?.(visiblePage);
  }, [visiblePage, onPageChange]);

  // Все страницы подгружены — больше не наблюдаем
  const done = loadedCount >= pages.length;

  useEffect(() => {
    if (done) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLoadedCount((count) => Math.min(count + 5, pages.length));
        }
      },
      // Заранее подгружаем за экраном, чтобы лента шла без пауз
      { rootMargin: "1200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [done, pages.length]);

  // Прокрутка к сохранённому месту — после того, как лента туда дорастёт
  useEffect(() => {
    if (restoredRef.current || restore === 0) return;
    restoredRef.current = true;
    window.scrollTo({ top: restore });
  }, [restore, loadedCount]);

  const onLoad = useCallback(() => {
    if (done) {
      try {
        window.sessionStorage.setItem(`manga-read:${title}`, String(window.scrollY));
      } catch {
        // приватный режим — просто не сохраняем позицию
      }
    }
  }, [done, title]);

  if (pages.length === 0) {
    return (
      <p className="mx-auto max-w-md px-4 py-20 text-center text-sm text-muted">
        Страницы главы пока не загружены — перевод ещё не выложен. Попробуй соседнюю главу.
      </p>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-1 px-2 py-4 sm:gap-2 sm:px-4">
      {pages.map((url, i) =>
        i < loadedCount ? (
          <figure key={url} className="w-full">
            <img
              data-page={i + 1}
              src={url}
              alt={`${title} — ${chapterLabel}, страница ${i + 1}`}
              // Страницы с CDN не проходят через next/image: там нет оптимизации,
              // а домен сменяется на каждый запрос at-home
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              onLoad={onLoad}
              onError={() => setFailed((prev) => ({ ...prev, [i]: true }))}
              className="h-auto w-full rounded-lg bg-white/4 shadow-[0_10px_40px_-20px_rgba(0,0,0,.9)]"
            />
            {failed[i] && (
              <figcaption className="py-2 text-center text-xs text-muted">
                Страница {i + 1} не загрузилась — прокрути ещё раз, попробуем заново
              </figcaption>
            )}
          </figure>
        ) : (
          // Место под ещё не подгруженную страницу: без него лента прыгает
          <div key={url} className="w-full" style={{ aspectRatio: "2 / 3" }} aria-hidden />
        ),
      )}

      {!done && (
        <div ref={sentinelRef} className="py-6 text-center text-xs text-muted">
          Прокрути вниз — подгрузим дальше
        </div>
      )}

      {done && (
        <p className="py-8 text-center text-xs text-muted">
          Конец главы · {pages.length} {pages.length === 1 ? "страница" : "страниц"}
        </p>
      )}
    </div>
  );
}