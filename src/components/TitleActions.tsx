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

  const BTN =
    "inline-flex h-12 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-3 text-[13px] font-bold ring-1 transition";
  const scores = Array.from({ length: MAX_SCORE - MIN_SCORE + 1 }, (_, i) => MIN_SCORE + i);

  return (
    <div className="space-y-3">
      {/* ------------------ Избранное и подборки: две равные кнопки ------------------ */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={onFavorite}
          aria-pressed={favorite}
          className={`${BTN} ${
            favorite
              ? "bg-accent/15 text-accent-2 ring-accent/45 hover:bg-accent/22"
              : "bg-[#0d0d14] text-white/90 ring-white/[0.09] hover:bg-[#121220] hover:ring-white/20"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill={favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.8 5.6a5.2 5.2 0 0 0-7.4 0L12 7l-1.4-1.4a5.2 5.2 0 1 0-7.4 7.4l8.4 8.4 8.4-8.4a5.2 5.2 0 0 0 0-7.4Z"
            />
          </svg>
          <span className="truncate">{favorite ? "В избранном" : "Избранное"}</span>
        </button>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`${BTN} ${
            addedTo > 0
              ? "bg-accent/15 text-accent-2 ring-accent/45 hover:bg-accent/22"
              : "bg-[#0d0d14] text-white/90 ring-white/[0.09] hover:bg-[#121220] hover:ring-white/20"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="truncate">Подборки</span>
          {addedTo > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-extrabold text-white">
              {addedTo}
            </span>
          )}
        </button>
      </div>

      {/* ------------------ Мой список: статус и оценка одной карточкой ------------------ */}
      <div className="space-y-4 rounded-2xl bg-[#0d0d14] p-4 ring-1 ring-white/[0.07]">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Статус</p>
          <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Статус тайтла">
            {STATUS_ORDER.map((item) => {
              const active = status === item;
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onStatus(item)}
                  className={`h-9 rounded-xl px-2 text-xs font-bold ring-1 transition ${
                    active
                      ? "bg-accent text-white ring-accent shadow-[0_8px_22px_-10px_rgba(43,127,255,0.9)]"
                      : "bg-white/[0.04] text-white/65 ring-white/[0.08] hover:bg-white/[0.09] hover:text-white"
                  }`}
                >
                  {STATUS_LABEL[item]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Моя оценка</p>
          <div
            className="grid grid-cols-5 gap-1.5"
            role="group"
            aria-label={`Оценка от ${MIN_SCORE} до ${MAX_SCORE}`}
          >
            {scores.map((score) => {
              const active = rating === score;
              return (
                <button
                  key={score}
                  type="button"
                  aria-pressed={active}
                  aria-label={`Оценка ${score}`}
                  onClick={() => onRate(score)}
                  className={`grid h-9 place-items-center rounded-xl text-[13px] font-extrabold tabular-nums ring-1 transition ${
                    active
                      ? "bg-accent-2 text-ink ring-accent-2 shadow-[0_8px_22px_-10px_rgba(34,211,238,0.9)]"
                      : "bg-white/[0.04] text-white/65 ring-white/[0.08] hover:bg-white/[0.09] hover:text-white"
                  }`}
                >
                  {score}
                </button>
              );
            })}
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
    </div>
  );
}
