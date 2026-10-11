"use client";

import { useCallback, useEffect, useState } from "react";
import { MangaReader } from "./MangaReader";
import { ReaderBar } from "./ReaderBar";
import { noteMangaChapter } from "@/lib/clans.runtime";

/**
 * Оболочка страницы чтения: держит номер текущей страницы и рисует
 * панель навигации. Счёт живёт здесь, ридер только сообщает номер —
 * иначе панель не знала бы, где читатель.
 */
export function ReaderShell({
  mangaId,
  mangaTitle,
  chapterLabel,
  chapterTitle,
  pages,
  prevChapter,
  nextChapter,
}: {
  mangaId: string;
  mangaTitle: string;
  chapterLabel: string;
  chapterTitle?: string;
  pages: string[];
  prevChapter?: { id: string; label: string };
  nextChapter?: { id: string; label: string };
}) {
  const [page, setPage] = useState(0);
  const onPageChange = useCallback((next: number) => setPage(next), []);

  // Глава засчитывается клану один раз: повторное открытие того же тайтла
  // и главы ничего не приносит. Именно на этом строится защита от накрутки
  // клановых заданий — перечитать 100 глав ради очков нельзя.
  useEffect(() => {
    noteMangaChapter(mangaId, chapterLabel);
  }, [mangaId, chapterLabel]);

  return (
    <div className="min-h-dvh bg-ink pb-24">
      <ReaderBar
        mangaId={mangaId}
        mangaTitle={mangaTitle}
        chapterLabel={chapterLabel}
        page={page}
        pages={pages.length}
        prevChapter={prevChapter}
        nextChapter={nextChapter}
      />

      {(chapterLabel !== "—" || chapterTitle) && (
        // pt-16 — запас под липкую шапку сайта, иначе заголовок уезжает под неё
        <h1 className="mx-auto max-w-3xl px-4 pb-3 pt-16 text-center text-sm font-semibold text-white/70">
          {mangaTitle} · Глава {chapterLabel}
          {chapterTitle && (
            <span className="mt-1 block text-xs font-normal text-muted">{chapterTitle}</span>
          )}
        </h1>
      )}

      <MangaReader
        pages={pages}
        title={mangaTitle}
        chapterLabel={chapterLabel}
        onPageChange={onPageChange}
      />
    </div>
  );
}