"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MangaReader, posKey, type ReaderMode, type ReaderWidth, type SeekTarget } from "./MangaReader";
import { ReaderBar } from "./ReaderBar";
import { noteChapter as noteMangaChapter } from "@/lib/clan2/store";

const PREFS = "mr-prefs";

/**
 * Оболочка страницы чтения: держит текущую страницу, режим чтения и ширину,
 * рисует плавающую панель. Ридер только сообщает номер страницы.
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
  const [mode, setMode] = useState<ReaderMode>("scroll");
  const [width, setWidth] = useState<ReaderWidth>("m");
  const [hidden, setHidden] = useState(false);
  const [startAt, setStartAt] = useState(0);
  const [seek, setSeek] = useState<SeekTarget>({ page: 0, nonce: 0 });
  const pageRef = useRef(0);

  const key = posKey(mangaId, chapterLabel);
  const onPageChange = useCallback(
    (next: number) => {
      pageRef.current = next;
      setPage(next);
      try {
        window.localStorage.setItem(key, String(next));
      } catch {
        // приватный режим — позицию не сохраняем
      }
    },
    [key],
  );

  // Сохранённые настройки: читаем после монтирования, чтобы не ломать гидрацию
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        const p = JSON.parse(window.localStorage.getItem(PREFS) ?? "{}");
        if (p.mode === "page" || p.mode === "scroll") setMode(p.mode);
        if (p.width === "s" || p.width === "m" || p.width === "l") setWidth(p.width);
      } catch {
        // нет настроек — остаются значения по умолчанию
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const savePrefs = (m: ReaderMode, w: ReaderWidth) => {
    try {
      window.localStorage.setItem(PREFS, JSON.stringify({ mode: m, width: w }));
    } catch {
      // не критично
    }
  };

  const changeMode = (m: ReaderMode) => {
    if (m === mode) return;
    setStartAt(pageRef.current || 1);
    setMode(m);
    setHidden(false);
    savePrefs(m, width);
  };
  const changeWidth = (w: ReaderWidth) => {
    setWidth(w);
    savePrefs(mode, w);
  };
  const onSeek = (n: number) => setSeek((s) => ({ page: n, nonce: s.nonce + 1 }));

  // В ленте панель прячется при прокрутке вниз и возвращается при прокрутке вверх
  useEffect(() => {
    if (mode !== "scroll") return;
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > last + 10 && y > 240) setHidden(true);
      else if (y < last - 10) setHidden(false);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mode]);

  // Глава засчитывается клану один раз: повторное открытие того же тайтла
  // и главы ничего не приносит. Именно на этом строится защита от накрутки
  // клановых заданий — перечитать 100 глав ради очков нельзя.
  useEffect(() => {
    noteMangaChapter(mangaId, chapterLabel);
  }, [mangaId, chapterLabel]);

  return (
    <div className="min-h-dvh bg-ink pb-32">
      <ReaderBar
        mangaId={mangaId}
        mangaTitle={mangaTitle}
        chapterLabel={chapterLabel}
        page={page}
        pages={pages.length}
        prevChapter={prevChapter}
        nextChapter={nextChapter}
        mode={mode}
        width={width}
        hidden={hidden}
        onMode={changeMode}
        onWidth={changeWidth}
        onSeek={onSeek}
      />

      {mode === "scroll" && (chapterLabel !== "—" || chapterTitle) && (
        <h1 className="mx-auto max-w-3xl px-4 pb-3 pt-4 text-center text-sm font-semibold text-white/70">
          {mangaTitle} · Глава {chapterLabel}
          {chapterTitle && <span className="mt-1 block text-xs font-normal text-muted">{chapterTitle}</span>}
        </h1>
      )}

      <MangaReader
        key={mode}
        mangaId={mangaId}
        pages={pages}
        title={mangaTitle}
        chapterLabel={chapterLabel}
        mode={mode}
        width={width}
        startAt={startAt}
        seek={seek}
        onPageChange={onPageChange}
        onToggleBar={() => setHidden((h) => !h)}
        prevChapter={prevChapter}
        nextChapter={nextChapter}
      />
    </div>
  );
}
