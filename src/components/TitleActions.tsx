"use client";

import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  COLLECTIONS_KEY,
  FAVORITES_KEY,
  countFor,
  createCollection,
  sanitizeName,
  toggleFavorite,
  toggleInCollection,
  type Collection,
} from "@/lib/collections";
import { parseList, useLocalSnapshot, useModalBehaviour } from "@/lib/use-local-storage";
import { rememberTitle } from "@/lib/titles";
import { progressEmit } from "@/lib/progression/events";
import { STATUS_LABEL, STATUS_ORDER, getStatus, setStatus, type WatchStatus } from "@/lib/statuses";
import { MAX_SCORE, MIN_SCORE, getRating, setRating } from "@/lib/ratings";

interface Props {
  anime: { id: string; title: string; poster?: string };
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
  const [draft, setDraft] = useState("");
  const close = useCallback(() => setOpen(false), []);
  const panelRef = useModalBehaviour(open, close);

  const onBackdrop = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) close();
    },
    [close],
  );

  const onFavorite = useCallback(() => {
    rememberTitle({ id: anime.id, title: anime.title, poster: anime.poster });
    const added = toggleFavorite(anime.id);
    // Награда за включение в избранное — движок; на выключение событие не шлём
    if (added) progressEmit({ type: "LIST_ADD", titleId: anime.id, list: "favorite" });
    bump();
  }, [anime.id, anime.title, anime.poster, bump]);

  const status = getStatus(anime.id);
  const rating = getRating(anime.id);

  /**
   * Статус списка: «Буду смотреть» и «Просмотрено» — события LIST_ADD
   * (движок платит за планы и завершённые), «Смотрю»/«Брошено» — чистые
   * метаданные списков без награды.
   */
  const onStatus = useCallback(
    (next: WatchStatus) => {
      rememberTitle({ id: anime.id, title: anime.title, poster: anime.poster });
      const applied = setStatus(anime.id, next);
      if (applied === "planned") progressEmit({ type: "LIST_ADD", titleId: anime.id, list: "planned" });
      else if (applied === "completed") progressEmit({ type: "LIST_ADD", titleId: anime.id, list: "watched" });
      bump();
    },
    [anime.id, anime.title, anime.poster, bump],
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

  const onToggleCollection = useCallback(
    (collectionId: string) => {
      rememberTitle({ id: anime.id, title: anime.title, poster: anime.poster });
      toggleInCollection(collectionId, anime.id);
      bump();
    },
    [anime.id, anime.title, anime.poster, bump],
  );

  const onCreate = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (!sanitizeName(draft)) return;
      rememberTitle({ id: anime.id, title: anime.title, poster: anime.poster });
      createCollection(draft, anime.id);
      setDraft("");
      bump();
    },
    [draft, anime.id, anime.title, anime.poster, bump],
  );

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
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="btn-ghost inline-flex items-center gap-2 rounded-xl bg-white/8 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/12 hover:bg-white/14"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-accent" fill="none" stroke="currentColor" strokeWidth="2">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 7a2 2 0 0 1 2-2h3.6a2 2 0 0 1 1.66.9l.7 1.05H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm9 5v4m2-2h-4"
          />
        </svg>
        В подборку
        {addedTo > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">
            {addedTo}
          </span>
        )}
      </button>

      {/* ----------------- Статус списка и пользовательская оценка ---------- */}
      <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 border-t border-line/70 pt-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Статус</span>
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

        <span className="ml-auto text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Оценка</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label={`Оценка от ${MIN_SCORE} до ${MAX_SCORE}`}>
          {Array.from({ length: MAX_SCORE - MIN_SCORE + 1 }, (_, i) => MIN_SCORE + i).map((score) => {
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
          })}
        </div>
      </div>

      {/* ---------------------------- Модалка ---------------------------- */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
            onMouseDown={onBackdrop}
          >
            <div className="absolute inset-0 bg-ink/85 backdrop-blur-sm" aria-hidden />
  
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="collections-title"
              tabIndex={-1}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface/95 p-5 shadow-[0_40px_100px_-30px_rgba(0,0,0,1)] ring-1 ring-white/10 outline-none"
            >
              <div className="mb-1 flex items-start justify-between gap-3">
                <div>
                  <h2
                    id="collections-title"
                    className="text-base font-extrabold tracking-tight text-white"
                  >
                    В подборку
                  </h2>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted" title={anime.title}>
                    {anime.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Закрыть"
                  className="-m-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted ring-1 ring-transparent transition hover:bg-white/10 hover:text-white hover:ring-white/10"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
  
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-muted">
                Мои подборки{collections.length > 0 ? ` · ${collections.length}` : ""}
              </p>
  
              <ul className="mt-2 max-h-[38vh] space-y-1.5 overflow-y-auto pr-1">
                {collections.length === 0 && (
                  <li className="rounded-xl border border-dashed border-line bg-white/[0.02] px-3 py-5 text-center text-sm text-muted">
                    Подборок пока нет. Создайте первую ниже — тайтл добавится в неё
                    автоматически.
                  </li>
                )}
  
                {collections.map((collection) => {
                  const inside = collection.animeIds.includes(anime.id);
                  return (
                    <li key={collection.id}>
                      <button
                        type="button"
                        onClick={() => onToggleCollection(collection.id)}
                        aria-pressed={inside}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                          inside
                            ? "border-accent/45 bg-accent/12"
                            : "border-line bg-card/60 hover:border-white/20 hover:bg-elevated/70"
                        }`}
                      >
                        <span
                          className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                            inside ? "border-accent bg-accent-deep text-white" : "border-white/25"
                          }`}
                          aria-hidden
                        >
                          {inside && (
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 5 5L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-white">
                            {collection.name}
                          </span>
                          <span className="block text-xs text-muted">
                            {collection.animeIds.length}{" "}
                            {collection.animeIds.length === 1 ? "тайтл" : "тайтлов"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
  
              <form onSubmit={onCreate} className="mt-4 border-t border-line pt-4">
                <label
                  htmlFor="new-collection"
                  className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-muted"
                >
                  Создать подборку
                </label>
                <div className="flex gap-2">
                  <input
                    id="new-collection"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={48}
                    autoComplete="off"
                    placeholder="Например: Любимое"
                    className="min-w-0 flex-1 rounded-xl bg-card px-3 py-2.5 text-sm text-white ring-1 ring-white/10 transition placeholder:text-muted/60 focus:outline-none focus:ring-accent/60"
                  />
                  <button
                    type="submit"
                    disabled={!sanitizeName(draft)}
                    className="btn-primary shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Создать
                  </button>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  Подборка сохраняется в этом браузере, текущий тайтл добавится в неё сразу.
                </p>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
