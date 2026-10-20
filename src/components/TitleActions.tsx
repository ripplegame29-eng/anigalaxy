"use client";

import { useCallback, useMemo, useState } from "react";
import {
  COLLECTIONS_KEY,
  FAVORITES_KEY,
  countFor,
  toggleFavorite,
  type Collection,
} from "@/lib/collections";
import { CollectionPicker } from "./CollectionPicker";
import "./collection-picker.css";
import { parseList, useLocalSnapshot } from "@/lib/use-local-storage";
import { rememberTitle } from "@/lib/titles";
import { progressEmit } from "@/lib/progression/events";
import { STATUS_LABEL, STATUS_ORDER, getStatus, setStatus, type WatchStatus } from "@/lib/statuses";
import { MAX_SCORE, MIN_SCORE, getRating, setRating } from "@/lib/ratings";

interface Props {
  /**
   * Ровно те поля карточки, которые уходят в кэш тайтлов. Необязательные
   * нужны потому, что жанры и студии Kodik отдаёт не для каждого тайгла
   * (а manga-карточки студий не имеют вовсе) — тогда виджет честно скажет,
   * что данных нет, вместо того чтобы показать нули.
   */
  anime: {
    id: string;
    title: string;
    poster?: string;
    genres?: string[];
    studios?: string[];
    year?: number;
    rating?: number;
    episodesTotal?: number;
  };
}

/**
 * «В избранное» + «В подборку».
 *
 * Оба состояния живут в localStorage и читаются через `useSyncExternalStore`,
 * поэтому серверный HTML и первый клиентский рендер совпадают.
 */
export function TitleActions({ anime }: Props) {
  const [, setRevision] = useState(0);
  /** Перерисовка после записи в хранилище (снимок читается заново на рендере) */
  const bump = useCallback(() => setRevision((value) => value + 1), []);

  const collectionsRaw = useLocalSnapshot(COLLECTIONS_KEY);
  const favoritesRaw = useLocalSnapshot(FAVORITES_KEY);

  const collections = useMemo(
    () => parseList<Collection>(collectionsRaw, []),
    [collectionsRaw],
  );
  const favorites = useMemo(() => parseList<string>(favoritesRaw, []), [favoritesRaw]);

  const favorite = favorites.includes(anime.id);
  const addedTo = countFor(collections, anime.id);

  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const status = getStatus(anime.id);
  const rating = getRating(anime.id);

  /**
   * Снимок карточки для кэша тайтлов. Кроме названия и постера сюда
   * кладутся жанры, студии, год и рейтинг — из них виджеты профиля
   * считают распределение по жанрам и по студиям. В списках хранится
   * только id, поэтому без этого кэша блоки остались бы пустыми.
   */
  const meta = useMemo(
    () => ({
      id: anime.id,
      title: anime.title,
      poster: anime.poster,
      genres: anime.genres,
      studios: anime.studios,
      year: anime.year,
      rating: anime.rating,
      episodesTotal: anime.episodesTotal,
    }),
    [
      anime.id,
      anime.title,
      anime.poster,
      anime.genres,
      anime.studios,
      anime.year,
      anime.rating,
      anime.episodesTotal,
    ],
  );

  const onFavorite = useCallback(() => {
    rememberTitle(meta);
    const added = toggleFavorite(anime.id);
    // Награда за включение в избранное — движок; на выключение событие не шлём
    if (added) progressEmit({ type: "LIST_ADD", titleId: anime.id, list: "favorite" });
    bump();
  }, [meta, anime.id, bump]);

  /**
   * Статус списка: «Буду смотреть» и «Просмотрено» — события LIST_ADD
   * (движок платит за планы и завершённые), «Смотрю»/«Брошено» — чистые
   * метаданные списков без награды.
   */
  const onStatus = useCallback(
    (next: WatchStatus) => {
      rememberTitle(meta);
      const applied = setStatus(anime.id, next);
      if (applied === "planned") progressEmit({ type: "LIST_ADD", titleId: anime.id, list: "planned" });
      else if (applied === "completed") progressEmit({ type: "LIST_ADD", titleId: anime.id, list: "watched" });
      bump();
    },
    [meta, anime.id, bump],
  );

  /** Оценка 1…10: XP за «оценить тайтл» — один раз на тайтл, движок решает */
  const onRate = useCallback(
    (score: number) => {
      const applied = setRating(anime.id, score);
      if (applied !== null) progressEmit({ type: "TITLE_RATED", titleId: anime.id, score: applied });
      bump();
    },
    [anime.id, bump],
  );

  /** Окно само пишет в хранилище — здесь только запоминаем тайл для кэша */
  const onCollectionChange = useCallback(() => {
    rememberTitle(meta);
    bump();
  }, [meta, bump]);

  return (
    <>
      {/* --------------------------- Избранное --------------------------- */}
      <button
        type="button"
        onClick={onFavorite}
        aria-pressed={favorite}
        className={`btn-ghost inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold ring-1 transition ${
          favorite
            ? "bg-accent-2/18 text-accent-2 ring-accent-2/45 hover:bg-accent-2/26"
            : "bg-white/8 text-white ring-white/12 hover:bg-white/14"
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill={favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.8 5.6a5.2 5.2 0 0 0-7.4 0L12 7l-1.4-1.4a5.2 5.2 0 1 0-7.4 7.4l8.4 8.4 8.4-8.4a5.2 5.2 0 0 0 0-7.4Z"
          />
        </svg>
        {favorite ? "В избранном" : "В избранное"}
      </button>

      {/* --------------------------- В подборку -------------------------- */}
      {/* Кнопка и окно — из макета `collection-picker`: класс `.cp-btn` с
          счётчиком подборок, в которые уже добавлен тайтл. */}
      <button
        type="button"
        className={`cp-btn${addedTo > 0 ? " cp-has" : ""}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        В подборки
        <em>{addedTo}</em>
      </button>

      {/* ----------------- Статус списка и пользовательская оценка ---------- */}
      {/* Статус и оценка — двумя строками: раньше оценка прижималась
          `ml-auto` в один ряд со статусом и на узких экранах слетала. */}
      <div className="flex w-full flex-col gap-5 border-t border-line/70 pt-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            Статус
          </span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Статус тайтла">
            {STATUS_ORDER.map((item) => {
              const active = status === item;
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onStatus(item)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ring-1 transition ${
                    active
                      ? "bg-accent-deep text-white ring-accent/50"
                      : "bg-white/8 text-muted ring-white/12 hover:bg-white/14 hover:text-white"
                  }`}
                >
                  {STATUS_LABEL[item]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            Оценка
          </span>
          <div
            className="flex flex-wrap gap-1"
            role="group"
            aria-label={`Оценка от ${MIN_SCORE} до ${MAX_SCORE}`}
          >
            {Array.from({ length: MAX_SCORE - MIN_SCORE + 1 }, (_, i) => MIN_SCORE + i).map(
              (score) => {
                const active = rating === score;
                return (
                  <button
                    key={score}
                    type="button"
                    aria-pressed={active}
                    aria-label={`Оценка ${score}`}
                    onClick={() => onRate(score)}
                    className={`grid h-7 w-7 place-items-center rounded-lg text-[11px] font-bold ring-1 transition ${
                      active
                        ? "bg-gold text-ink ring-gold/60"
                        : "bg-white/8 text-muted ring-white/12 hover:bg-white/14 hover:text-white"
                    }`}
                  >
                    {score}
                  </button>
                );
              },
            )}
          </div>
        </div>
      </div>

      {/* --------------------------- Окно выбора ------------------------ */}
      <CollectionPicker
        open={open}
        onClose={close}
        anime={{ id: anime.id, title: anime.title, poster: anime.poster }}
        onToggle={onCollectionChange}
        onCreate={onCollectionChange}
      />
    </>
  );
}
