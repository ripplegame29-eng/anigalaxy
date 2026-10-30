"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { kindLabel } from "@/lib/anime";
import type { AnimeCard } from "@/lib/types";
import { Poster } from "./Poster";

/**
 * Живой поиск в шапке: дебаунс 300 мс, выпадающие подсказки
 * с постерами, навигация стрелками и Enter.
 */
export function SearchBox({ mobile = false }: { mobile?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AnimeCard[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(-1);

  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Дебаунс-запрос к API. setState — только внутри callback'ов (rAF/таймер):
  // синхронный вызов в эффекте запрещён правилом react-hooks/set-state-in-effect
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      const reset = requestAnimationFrame(() => {
        setResults([]);
        setOpen(false);
        setLoading(false);
      });
      return () => cancelAnimationFrame(reset);
    }

    const controller = new AbortController();
    const pending = requestAnimationFrame(() => setLoading(true));
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/kodik/search?q=${encodeURIComponent(q)}&limit=8`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { results: AnimeCard[] };
        setResults(data.results);
        setCursor(-1);
        setOpen(true);
      } catch {
        /* запрос отменён или упал — молча игнорируем */
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      cancelAnimationFrame(pending);
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Клик вне — закрываем
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const submit = (item?: AnimeCard) => {
    setOpen(false);
    if (item) {
      setQuery("");
      router.push(`/title/${item.id}`);
    } else if (query.trim()) {
      router.push(`/catalog?q=${encodeURIComponent(query.trim())}`);
      setOpen(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit(cursor >= 0 ? results[cursor] : undefined);
    } else if (e.key === "Escape") {
      setOpen(false);
      (e.target as HTMLInputElement).blur();
    }
  };

  const showDropdown = open && (results.length > 0 || loading);

  return (
    <div
      ref={boxRef}
      className={`relative ${mobile ? "w-full" : "w-full max-w-md lg:max-w-lg"}`}
    >
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          submit(cursor >= 0 ? results[cursor] : undefined);
        }}
        className={`flex items-center gap-2 rounded-xl border border-line bg-white/6 px-3 transition-all duration-200 focus-within:border-accent/60 focus-within:bg-white/10 focus-within:shadow-[0_0_0_4px_rgba(31,123,255,.14)] ${
          mobile ? "h-11" : "h-10"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" strokeLinecap="round" />
        </svg>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Поиск аниме…"
          aria-label="Поиск аниме"
          enterKeyHint="search"
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-muted/80 [&::-webkit-search-cancel-button]:appearance-none"
        />

        {loading && (
          <span className="h-4 w-4 shrink-0 animate-spin-slow rounded-full border-2 border-white/20 border-t-accent" />
        )}
      </form>

      {/* Результаты */}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-line bg-[#0d0d15]/95 shadow-[0_30px_60px_-20px_rgba(0,0,0,.9)] backdrop-blur-xl animate-fade-in">
          {loading && !results.length ? (
            <div className="space-y-2 p-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton h-14 w-10 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3 w-3/4 rounded" />
                    <div className="skeleton h-3 w-1/3 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <ul className="max-h-[60vh] overflow-y-auto p-2">
                {results.map((item, i) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => submit(item)}
                      className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors ${
                        cursor === i ? "bg-white/10" : "hover:bg-white/6"
                      }`}
                    >
                      <span className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-card">
                        <Poster src={item.poster} alt="" title={item.title} sizes="40px" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">
                          {item.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {[item.year, kindLabel(item.kind), item.lastEpisode ? `${item.lastEpisode} эп.` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      {item.rating != null && (
                        <span className="shrink-0 rounded-md bg-white/8 px-1.5 py-0.5 text-[11px] font-bold text-gold">
                          {item.rating}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => submit()}
                className="block w-full border-t border-line px-4 py-3 text-center text-sm font-semibold text-accent transition-colors hover:bg-white/6"
              >
                Все результаты по «{query.trim()}» →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
