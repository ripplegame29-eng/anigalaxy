"use client";

import { useState } from "react";
import { AnimeCardSkeleton } from "./AnimeCard";
import { AnimeGrid } from "./AnimeRow";
import { toSearch, type CatalogState } from "@/lib/catalog-query";
import { cardKey } from "@/lib/anime";
import type { AnimeCard } from "@/lib/types";

/**
 * Сетка результатов каталога с кнопкой «Показать ещё».
 * Первый экран приходит с сервера (SSR), догрузка — курсорная,
 * как того требует Kodik API.
 */
export function CatalogResults({
  initial,
  next,
  total,
  state,
}: {
  initial: AnimeCard[];
  next: string | null;
  total: number;
  state: CatalogState;
}) {
  const [items, setItems] = useState<AnimeCard[]>(initial);
  const [cursor, setCursor] = useState<string | null>(next);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  /** SSR-ответ мог отдать верхнюю границу счётчика — помечаем её ≈ */
  const [approxTotal] = useState(Boolean(next));

  const loadMore = async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(false);

    try {
      const base = toSearch(state).replace(/^\?/, "");
      const url = `/api/kodik/list?${base ? `${base}&` : ""}cursor=${encodeURIComponent(cursor)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("bad response");

      const data = (await res.json()) as { cards: AnimeCard[]; next: string | null };
      setItems((prev) => {
        // Kodik отдаёт один тайтл несколькими id — дедуплицируем по названию
        const seen = new Set(prev.map(cardKey));
        const fresh: AnimeCard[] = [];
        for (const card of data.cards) {
          const key = cardKey(card);
          if (seen.has(key)) continue;
          seen.add(key);
          fresh.push(card);
        }
        return [...prev, ...fresh];
      });
      setCursor(data.next);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Пустой результат
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface/50 px-6 py-16 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/10">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.2-3.2M8.5 8.5l5 5m0-5-5 5" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="mt-5 text-lg font-bold">Ничего не найдено</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Попробуйте изменить запрос или сбросить фильтры — возможно, тайтл уже выходит под другим
          названием.
        </p>
        <a
          href="/catalog"
          className="btn-primary mt-6 inline-flex rounded-xl px-5 py-2.5 text-sm font-bold text-white"
        >
          Сбросить фильтры
        </a>
      </div>
    );
  }

  return (
    <div>
      <AnimeGrid cards={items} />

      {/* Кнопка догрузки */}
      <div className="mt-10 flex flex-col items-center gap-3">
        {cursor ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="btn-ghost group relative inline-flex min-w-[220px] items-center justify-center gap-2 rounded-xl bg-white/7 px-6 py-3 text-sm font-bold text-white ring-1 ring-white/12 transition hover:bg-white/12 disabled:opacity-70"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin-slow rounded-full border-2 border-white/25 border-t-accent" />
                Загружаем…
              </>
            ) : (
              <>
                Показать ещё
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 transition-transform group-hover:translate-y-0.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path d="M12 5v14m-6-6 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>
        ) : (
          <p className="text-sm text-muted">
            Это все результаты · {approxTotal ? "≈ " : ""}
            {total.toLocaleString("ru-RU")} тайтлов в базе
          </p>
        )}

        {error && (
          <p className="text-sm text-accent-2">
            Не удалось загрузить данные. Проверьте соединение и попробуйте ещё раз.
          </p>
        )}
      </div>
    </div>
  );
}

/** Скелетон сетки каталога */
export function CatalogSkeleton({ count = 18 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <AnimeCardSkeleton key={i} />
      ))}
    </div>
  );
}
