"use client";

/**
 * Результаты каталога в визуале `ag-catalog.html`: постер-карточки с
 * рейтингом, статусом, жанрами и избранным, плюс курсорная догрузка.
 *
 * Первый экран приходит с сервера (SSR), дальше — `/api/kodik/list` с
 * курсором. Плотность сетки задаётся на `<html data-cat-density>` из
 * `CatalogFilters`, поэтому обе половины панели остаются независимыми.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { cardKey, kindLabel, statusLabel } from "@/lib/anime";
import { loadFavorites, toggleFavorite as toggleFavoriteId } from "@/lib/collections";
import type { AnimeCard as Card } from "@/lib/types";
import type { CatalogState } from "@/lib/catalog-query";
import { toSearch } from "@/lib/catalog-query";
import { Poster } from "./Poster";

const KIND_SHORT: Record<string, string> = {
  tv: "ТВ",
  movie: "Фильм",
  ova: "OVA",
  ona: "ONA",
  special: "Спешл",
  tv_special: "Спешл",
  music: "Клип",
  tv_13: "ТВ",
  tv_24: "ТВ",
  tv_48: "ТВ",
};

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="cat-star" aria-hidden>
      <path d="M12 2l3 6.6 7 .8-5.2 4.8 1.5 7L12 17.8 5.7 21.2l1.5-7L2 9.4l7-.8z" />
    </svg>
  );
}

function HeartIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="cat-heart"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="cat-play" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function formatRating(value?: number): string | undefined {
  if (value == null || Number.isNaN(value)) return undefined;
  const fixed = value.toFixed(2);
  return fixed.endsWith("0") ? fixed.slice(0, -1) : fixed;
}

function statusClass(status?: string): string {
  if (status === "ongoing") return "ong";
  if (status === "anons") return "ann";
  return "fin";
}

function CatalogCard({
  card,
  index,
  saved,
  onToggle,
}: {
  card: Card;
  index: number;
  saved: boolean;
  onToggle: (id: string) => void;
}) {
  const rating = formatRating(card.rating);
  const episodes = card.lastEpisode ?? card.episodesAired ?? card.episodesTotal;
  const status = statusLabel(card.status);
  const kind = KIND_SHORT[card.kind ?? ""] ?? kindLabel(card.kind) ?? "Аниме";
  const genres = card.genres.slice(0, 3);
  const href = `/title/${card.id}`;

  return (
    <article className="cat-cd" style={{ ["--i" as string]: String(Math.min(index, 12)) }}>
      <div className="cat-pw">
        <Link className="cat-ps" href={href} aria-label={card.title}>
          <span className="cat-pi">
            <Poster
              src={card.poster}
              alt={card.title}
              title={card.title}
              priority={index < 6}
              sizes="(max-width: 640px) 46vw, (max-width: 1100px) 24vw, 16vw"
              className="object-cover"
            />
          </span>

          {rating && (
            <span className="cat-bd cat-rt">
              <StarIcon />
              {rating}
            </span>
          )}
          {episodes ? <span className="cat-bd cat-ep">{episodes} эп.</span> : null}
          {status && <span className={`cat-bd cat-sta ${statusClass(card.status)}`}>{status}</span>}

          <span className="cat-ov">
            {genres.length > 0 && (
              <span className="cat-gs">
                {genres.map((genre) => (
                  <i key={genre}>{genre}</i>
                ))}
              </span>
            )}
            <span className="cat-go">
              <PlayIcon />
              Смотреть
            </span>
          </span>
        </Link>

        <button
          type="button"
          className={`cat-fv${saved ? " on" : ""}`}
          aria-label={saved ? "Убрать из избранного" : "Добавить в избранное"}
          aria-pressed={saved}
          onClick={() => onToggle(card.id)}
        >
          <HeartIcon filled={saved} />
        </button>
      </div>

      <Link className="cat-tl" href={href}>
        {card.title}
      </Link>
      <div className="cat-mt">
        {card.year && <span>{card.year}</span>}
        {card.year && <i aria-hidden />}
        <span>{kind}</span>
        {card.studios?.[0] && (
          <>
            <i aria-hidden />
            <span className="truncate">{card.studios[0]}</span>
          </>
        )}
      </div>
    </article>
  );
}

export function CatalogResults({
  initial,
  next,
  total,
  state,
}: {
  initial: Card[];
  next: string | null;
  total: number;
  state: CatalogState;
}) {
  const [items, setItems] = useState<Card[]>(initial);
  const [cursor, setCursor] = useState<string | null>(next);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  /** SSR-ответ мог отдать верхнюю границу счётчика — помечаем её ≈ */
  const [approxTotal] = useState(Boolean(next));

  useEffect(() => {
    const sync = () => setFavs(new Set(loadFavorites()));
    sync();
    window.addEventListener("animehub:favorites-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("animehub:favorites-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = (id: string) => {
    toggleFavoriteId(id);
    setFavs((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(id)) nextSet.delete(id);
      else nextSet.add(id);
      return nextSet;
    });
    window.dispatchEvent(new Event("animehub:favorites-changed"));
  };

  const loadMore = async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(false);

    try {
      const base = toSearch(state).replace(/^\?/, "");
      const url = `/api/kodik/list?${base ? `${base}&` : ""}cursor=${encodeURIComponent(cursor)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("bad response");

      const data = (await res.json()) as { cards: Card[]; next: string | null };
      setItems((prev) => {
        // Kodik отдаёт один тайтл несколькими id — дедуплицируем по названию
        const seen = new Set(prev.map(cardKey));
        const fresh: Card[] = [];
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

  if (!items.length) {
    return (
      <div className="cat-emp">
        <span className="cat-emp-ico" aria-hidden>
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.2-3.2M8.5 8.5l5 5m0-5-5 5" />
          </svg>
        </span>
        <h2>Ничего не нашли</h2>
        <p>Попробуйте убрать часть фильтров или изменить запрос.</p>
        <Link className="cat-btn" href="/catalog">
          Сбросить фильтры
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="cat-grid">
        {items.map((card, index) => (
          <CatalogCard
            key={`${card.id}-${index}`}
            card={card}
            index={index}
            saved={favs.has(card.id)}
            onToggle={toggle}
          />
        ))}
      </div>

      <div className="cat-foot">
        {cursor ? (
          <button type="button" onClick={loadMore} disabled={loading} className="cat-more">
            {loading ? (
              <>
                <span className="cat-spin" />
                Загружаем…
              </>
            ) : (
              <>Показать ещё</>
            )}
          </button>
        ) : (
          <p className="cat-end">
            Это все результаты · {approxTotal ? "≈ " : ""}
            {total.toLocaleString("ru-RU")} тайтлов в базе
          </p>
        )}

        {error && (
          <p className="cat-err" role="status">
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
    <div className="cat-grid" aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <div className="cat-sk" key={index} />
      ))}
    </div>
  );
}
