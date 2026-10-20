"use client";

/**
 * AniSwipe — свайп-подборка аниме.
 *
 * Визуал и логика взяты из `aniswipe.html`, но данные настоящие:
 * каталог Kodik, избранное и жанры приходят из реальных карточек. Лайки
 * попадают в «Мой список», поэтому система не остаётся игрушкой.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toggleFavorite } from "@/lib/collections";
import { kindLabel } from "@/lib/anime";
import type { AnimeCard as Card } from "@/lib/types";
import { Poster } from "@/components/Poster";

const STORAGE_KEY = "animehub:aniswipe:v1";

interface SwipeState {
  liked: string[];
  later: string[];
  skip: string[];
  genres: string[];
  weights: Record<string, number>;
}

const EMPTY_STATE: SwipeState = {
  liked: [],
  later: [],
  skip: [],
  genres: [],
  weights: {},
};

function hashString(value: string): number {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function loadState(): SwipeState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<SwipeState>;
    return {
      liked: Array.isArray(parsed.liked) ? parsed.liked.filter((id): id is string => typeof id === "string") : [],
      later: Array.isArray(parsed.later) ? parsed.later.filter((id): id is string => typeof id === "string") : [],
      skip: Array.isArray(parsed.skip) ? parsed.skip.filter((id): id is string => typeof id === "string") : [],
      genres: Array.isArray(parsed.genres) ? parsed.genres.filter((g): g is string => typeof g === "string") : [],
      weights: parsed.weights && typeof parsed.weights === "object" ? (parsed.weights as Record<string, number>) : {},
    };
  } catch {
    return EMPTY_STATE;
  }
}

type Tab = "swipe" | "duo" | "lists";
type Vote = "like" | "later" | "skip";
type ListKey = "liked" | "later" | "skip";

const VOTE_WEIGHT: Record<Vote, number> = { like: 1, later: 0.4, skip: -0.5 };
const VOTE_LABEL: Record<Vote, string> = { like: "Нравится", later: "Позже", skip: "Пропуск" };
const LIST_LABEL: Record<ListKey, string> = {
  liked: "Нравится",
  later: "Посмотреть позже",
  skip: "Пропущено",
};

const ICONS: Record<Vote, string> = {
  skip: "✕",
  later: "🔖",
  like: "♥",
};

function cardHue(id: string): number {
  return hashString(id) % 360;
}

function cardJitter(id: string): number {
  return (hashString(id) % 1000) / 1000;
}

function rankCards(cards: Card[], selected: string[], weights: Record<string, number>, seen: Set<string>): Card[] {
  const left = cards.filter((card) => !seen.has(card.id));
  return left
    .map((card) => {
      const genreScore = card.genres.reduce((sum, genre) => {
        const base = weights[genre] ?? 0;
        const selectedBonus = selected.includes(genre) ? 1.8 : 0;
        return sum + base + selectedBonus;
      }, 0);
      const ratingScore = (card.rating ?? 0) / 2;
      const total = genreScore + ratingScore + cardJitter(card.id) * 0.02;
      return { card, total };
    })
    .sort((a, b) => b.total - a.total)
    .map((item) => item.card);
}

function pluralCards(count: number): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "карточек";
  if (last === 1) return "карточка";
  if (last > 1 && last < 5) return "карточки";
  return "карточек";
}

export function AniSwipeView({ cards }: { cards: Card[] }) {

  const [state, setState] = useState<SwipeState>(() =>
    typeof window === "undefined" ? EMPTY_STATE : loadState(),
  );
  const [tab, setTab] = useState<Tab>("swipe");
  const [detail, setDetail] = useState<Card | null>(null);
  const [listTab, setListTab] = useState<ListKey>("liked");
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [leaving, setLeaving] = useState<Vote | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(0);
  const allGenres = [...new Set(cards.flatMap((card) => card.genres))].sort((a, b) =>
    a.localeCompare(b, "ru"),
  );

  // Duo state
  const [duoPhase, setDuoPhase] = useState<"setup" | "play" | "handoff" | "result">("setup");
  const [duoNames, setDuoNames] = useState(["", ""]);
  const [duoGenres, setDuoGenres] = useState<string[][]>([[], []]);
  const [duoPool, setDuoPool] = useState<string[]>([]);
  const [duoVotes, setDuoVotes] = useState<Array<Record<string, Vote>>>([{}, {}]);
  const [duoPlayer, setDuoPlayer] = useState(0);
  const [duoIndex, setDuoIndex] = useState(0);
  const [duoError, setDuoError] = useState("");
  const [duoUsed, setDuoUsed] = useState<Set<string>>(new Set());

  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* приватный режим — просто не сохраняем */
    }
  }, [state, hydrated]);

  useEffect(() => {
    if (!detail) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetail(null);
    };
    document.body.classList.add("as-modal-open");
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("as-modal-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [detail]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setLeaving(null), 260);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  const seen = new Set<string>([...state.liked, ...state.later, ...state.skip]);
  const ranked = rankCards(cards, state.genres, state.weights, seen);
  const current = ranked[0] ?? null;

  const updateState = (updater: (prev: SwipeState) => SwipeState) => {
    setState((prev) => updater(prev));
  };

  const vote = (card: Card, kind: Vote) => {
    if (leaving) return;
    setLeaving(kind);
    window.setTimeout(() => {
      updateState((prev) => {
        const next: SwipeState = {
          liked: prev.liked.filter((id) => id !== card.id),
          later: prev.later.filter((id) => id !== card.id),
          skip: prev.skip.filter((id) => id !== card.id),
          genres: prev.genres,
          weights: { ...prev.weights },
        };
        ({ like: next.liked, later: next.later, skip: next.skip }[kind]).push(card.id);
        card.genres.forEach((genre) => {
          next.weights[genre] = (next.weights[genre] ?? 0) + VOTE_WEIGHT[kind];
        });
        return next;
      });


    }, 230);
  };

  // Лайк → в избранное (синхронно, без лишнего импорта в начале)
  useEffect(() => {
    // placeholder effect intentionally empty
  }, []);

  const toggleGenre = (genre: string) => {
    updateState((prev) => {
      const next = prev.genres.includes(genre)
        ? prev.genres.filter((item) => item !== genre)
        : [...prev.genres, genre];
      return { ...prev, genres: next };
    });
  };

  const resetSkipped = () => {
    updateState((prev) => ({ ...prev, skip: [] }));
  };

  const moveListItem = (id: string, to: ListKey | "none") => {
    updateState((prev) => {
      const next: SwipeState = {
        liked: prev.liked.filter((item) => item !== id),
        later: prev.later.filter((item) => item !== id),
        skip: prev.skip.filter((item) => item !== id),
        genres: prev.genres,
        weights: prev.weights,
      };
      if (to !== "none") {
        const bucket = to === "liked" ? next.liked : to === "later" ? next.later : next.skip;
        bucket.push(id);
      }
      return next;
    });
  };

  const favoriteIfNeeded = (card: Card) => {
    try {
      // toggleFavorite импортирован выше
      toggleFavorite(card.id);
      window.dispatchEvent(new Event("animehub:favorites-changed"));
    } catch {
      /* игнорируем */
    }
  };

  // actually call favorite on like inside vote:
  const voteWithFavorite = (card: Card, kind: Vote) => {
    vote(card, kind);
    if (kind === "like") favoriteIfNeeded(card);
  };

  // Duo helpers
  const duoDeal = () => {
    const left = cards.filter((card) => !duoUsed.has(card.id));
    const scoreFor = (card: Card, player: number) => {
      const matches = card.genres.filter((genre) => duoGenres[player].includes(genre)).length;
      return matches + (matches > 0 && card.genres.some((genre) => duoGenres[1 - player].includes(genre)) ? 2 : 0) + (card.rating ?? 0) / 5;
    };
    const sorted = [...left].sort((a, b) => {
      const sa = scoreFor(a, 0) + scoreFor(a, 1);
      const sb = scoreFor(b, 0) + scoreFor(b, 1);
      return sb - sa;
    });
    const pool = sorted.slice(0, 12).map((card) => card.id).sort(() => Math.random() - 0.5);
    pool.forEach((id) => duoUsed.add(id));
    setDuoPool(pool);
    setDuoVotes([{}, {}]);
    setDuoPlayer(0);
    setDuoIndex(0);
    setDuoPhase("play");
  };

  const duoToggleGenre = (player: number, genre: string) => {
    setDuoGenres((prev) => {
      const next = [...prev];
      next[player] = next[player].includes(genre)
        ? next[player].filter((item) => item !== genre)
        : [...next[player], genre];
      return next;
    });
  };

  const duoStart = () => {
    if (!duoGenres[0].length || !duoGenres[1].length) {
      setDuoError("Выберите хотя бы один жанр каждому игроку.");
      return;
    }
    setDuoError("");
    setDuoUsed(new Set());
    duoDeal();
  };

  const duoVote = (card: Card, kind: Vote) => {
    setDuoVotes((prev) => {
      const next = [...prev];
      next[duoPlayer] = { ...next[duoPlayer], [card.id]: kind };
      return next;
    });
    const nextIndex = duoIndex + 1;
    if (nextIndex >= duoPool.length) {
      if (duoPlayer === 0) setDuoPhase("handoff");
      else setDuoPhase("result");
    } else {
      setDuoIndex(nextIndex);
    }
  };

  const duoNext = () => {
    setDuoPlayer(1);
    setDuoIndex(0);
    setDuoPhase("play");
  };

  const duoAnother = () => {
    duoDeal();
  };

  const duoReset = () => {
    setDuoNames(["", ""]);
    setDuoGenres([[], []]);
    setDuoPool([]);
    setDuoVotes([{}, {}]);
    setDuoUsed(new Set());
    setDuoPhase("setup");
  };

  const duoSave = () => {
    const [a, b] = duoVotes;
    const both = duoPool.filter((id) => a[id] === "like" && b[id] === "like");
    const maybe = duoPool.filter(
      (id) => a[id] !== "skip" && b[id] !== "skip" && !both.includes(id),
    );
    updateState((prev) => {
      const next: SwipeState = {
        ...prev,
        later: [...prev.later],
      };
      [...both, ...maybe].forEach((id) => {
        if (!next.later.includes(id) && !next.liked.includes(id)) {
          next.skip = next.skip.filter((item) => item !== id);
          next.later.push(id);
        }
      });
      return next;
    });
  };

  const duoCard = (id: string): Card | undefined => cards.find((card) => card.id === id);

  const duoBoth = duoPool.filter((id) => duoVotes[0][id] === "like" && duoVotes[1][id] === "like");
  const duoMaybe = duoPool.filter(
    (id) => duoVotes[0][id] !== "skip" && duoVotes[1][id] !== "skip" && !duoBoth.includes(id),
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (leaving) return;
    dragStart.current = { x: event.clientX, y: event.clientY };
    movedRef.current = 0;
    setDrag({ x: 0, y: 0, active: true });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.active || !dragStart.current) return;
    const x = event.clientX - dragStart.current.x;
    const y = event.clientY - dragStart.current.y;
    movedRef.current = Math.max(movedRef.current, Math.hypot(x, y));
    setDrag({ x, y, active: true });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.active || !dragStart.current || !current) return;
    const x = drag.x;
    const y = drag.y;
    dragStart.current = null;
    setDrag({ x: 0, y: 0, active: false });

    if (movedRef.current < 6) {
      setDetail(current);
      return;
    }
    if (x > 90) voteWithFavorite(current, "like");
    else if (x < -90) voteWithFavorite(current, "skip");
    else if (y < -110) voteWithFavorite(current, "later");
  };

  const stampSkip = Math.max(0, Math.min(1, -drag.x / 120));
  const stampLike = Math.max(0, Math.min(1, drag.x / 120));
  const stampLater = Math.max(0, Math.min(1, -drag.y / 140));

  if (!hydrated) {
    return (
      <div className="as-page">
        <div className="as-main">
          <div className="as-skeleton" />
        </div>
      </div>
    );
  }

  return (
    <div className="as-page">
      <header className="as-top">
        <div className="as-logo">
          Ani<span>Swipe</span>
        </div>
        <nav className="as-nav" aria-label="Разделы AniSwipe">
          {(
            [
              ["swipe", "Свайп"],
              ["duo", "Вдвоём"],
              ["lists", "Списки"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={tab === value ? "on" : undefined}
              aria-pressed={tab === value}
              onClick={() => {
                setTab(value);
                setDetail(null);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="as-main">
        {tab === "swipe" && (
          <section className="as-section" aria-label="Свайп-подборка">
            <div className="as-chips" role="group" aria-label="Жанры-предпочтения">
              {allGenres.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  className={state.genres.includes(genre) ? "on" : undefined}
                  aria-pressed={state.genres.includes(genre)}
                  onClick={() => toggleGenre(genre)}
                >
                  {genre}
                </button>
              ))}
            </div>

            <div className="as-deck-wrap">
              {current ? (
                <div className="as-deck">
                  {ranked.slice(0, 3).map((card, index) => {
                    const top = index === 0;
                    const hue = cardHue(card.id);
                    const style: React.CSSProperties = top
                      ? {
                          transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 18}deg)`,
                          transition: drag.active ? "none" : "transform 0.35s ease",
                        }
                      : {
                          transform: `scale(${1 - index * 0.04}) translateY(${index * 10}px)`,
                          opacity: 1 - index * 0.12,
                        };
                    return (
                      <div
                        className={`as-card${top ? " top" : ""}${leaving && top ? ` leaving-${leaving}` : ""}`}
                        key={card.id}
                        style={style}
                        onPointerDown={top ? handlePointerDown : undefined}
                        onPointerMove={top ? handlePointerMove : undefined}
                        onPointerUp={top ? handlePointerUp : undefined}
                        onPointerCancel={top ? () => setDrag({ x: 0, y: 0, active: false }) : undefined}
                      >
                        <div
                          className="as-card-bg"
                          style={
                            card.poster
                              ? { backgroundImage: `url(${card.poster})` }
                              : { background: `linear-gradient(160deg, hsl(${hue} 60% 38%), hsl(${(hue + 40) % 360} 45% 12%))` }
                          }
                        />
                        <div className="as-card-shade" />
                        {top && (
                          <>
                            <span className="as-stamp as-stamp-skip" style={{ opacity: stampSkip }}>
                              Пропуск
                            </span>
                            <span className="as-stamp as-stamp-like" style={{ opacity: stampLike }}>
                              Нравится
                            </span>
                            <span className="as-stamp as-stamp-later" style={{ opacity: stampLater }}>
                              Позже
                            </span>
                          </>
                        )}
                        <div className="as-card-body">
                          <span className="as-card-letter" aria-hidden>
                            {card.title.slice(0, 1).toUpperCase()}
                          </span>
                          {card.rating ? <span className="as-card-rating">★ {card.rating.toFixed(1)}</span> : null}
                          <div className="as-card-meta">
                            <h2>{card.title}</h2>
                            <p>
                              {[card.year, kindLabel(card.kind), card.lastEpisode ? `${card.lastEpisode} эп.` : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            {card.genres.length > 0 && (
                              <div className="as-card-genres">
                                {card.genres.slice(0, 4).map((genre) => (
                                  <span key={genre}>{genre}</span>
                                ))}
                              </div>
                            )}
                            {card.description && <p className="as-card-desc">{card.description}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="as-empty">
                  <h2>Карточки закончились</h2>
                  <p>Всё из подборки уже разобрано.</p>
                  <button type="button" className="as-go" onClick={resetSkipped}>
                    Вернуть пропущенные
                  </button>
                </div>
              )}
            </div>

            {current && (
              <div className="as-acts">
                <button type="button" className="as-act as-skip" onClick={() => voteWithFavorite(current, "skip")}>
                  <span>{ICONS.skip}</span>
                  Пропустить
                </button>
                <button type="button" className="as-act as-later" onClick={() => voteWithFavorite(current, "later")}>
                  <span>{ICONS.later}</span>
                  Позже
                </button>
                <button type="button" className="as-act as-like" onClick={() => voteWithFavorite(current, "like")}>
                  <span>{ICONS.like}</span>
                  Нравится
                </button>
              </div>
            )}

            {current && (
              <p className="as-hint">
                Осталось карточек: {ranked.length} · вправо — нравится, влево — пропуск, вверх — позже
              </p>
            )}
          </section>
        )}

        {tab === "lists" && (
          <section className="as-section" aria-label="Списки AniSwipe">
            <div className="as-tabs" role="tablist" aria-label="Списки">
              {(["liked", "later", "skip"] as ListKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={listTab === key ? "on" : undefined}
                  aria-pressed={listTab === key}
                  onClick={() => setListTab(key)}
                >
                  {LIST_LABEL[key]}
                  <b>{state[key].length}</b>
                </button>
              ))}
            </div>

            <div className="as-list">
              {state[listTab].length === 0 ? (
                <div className="as-empty">
                  <h2>Здесь пока пусто</h2>
                  <p>Свайпните несколько карточек, чтобы список наполнился.</p>
                </div>
              ) : (
                state[listTab].map((id) => {
                  const card = cards.find((item) => item.id === id);
                  if (!card) return null;
                  return (
                    <div className="as-row" key={id}>
                      <button type="button" className="as-row-main" onClick={() => setDetail(card)}>
                        <span className="as-row-poster">
                          <Poster src={card.poster} alt="" title={card.title} sizes="56px" />
                        </span>
                        <span className="as-row-text">
                          <b>{card.title}</b>
                          <span>
                            {[card.year, kindLabel(card.kind), card.genres.slice(0, 2).join(", ")]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                      </button>
                      <div className="as-row-actions">
                        {(["liked", "later", "skip", "none"] as const)
                          .filter((target) => target !== listTab)
                          .map((target) => (
                            <button
                              key={target}
                              type="button"
                              onClick={() => moveListItem(id, target)}
                            >
                              {target === "none" ? "В подбор" : LIST_LABEL[target as ListKey]}
                            </button>
                          ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {tab === "duo" && (
          <section className="as-section" aria-label="Подбор вдвоём">
            {duoPhase === "setup" && (
              <div className="as-duo">
                <h2>Подбор вдвоём</h2>
                <p className="as-duo-sub">
                  Каждый выбирает жанры и по очереди листает одни и те же 12 карточек. В конце
                  увидите, что нравится обоим.
                </p>

                <div className="as-duo-players">
                  {[0, 1].map((player) => (
                    <div className="as-duo-player" key={player}>
                      <input
                        type="text"
                        maxLength={20}
                        placeholder={`Игрок ${player + 1}`}
                        value={duoNames[player]}
                        onChange={(event) => {
                          const next = [...duoNames];
                          next[player] = event.target.value;
                          setDuoNames(next);
                        }}
                      />
                      <div className="as-chips as-chips-wrap">
                        {allGenres.map((genre) => (
                          <button
                            key={genre}
                            type="button"
                            className={duoGenres[player].includes(genre) ? "on" : undefined}
                            aria-pressed={duoGenres[player].includes(genre)}
                            onClick={() => duoToggleGenre(player, genre)}
                          >
                            {genre}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {duoError && <p className="as-error">{duoError}</p>}

                <div className="as-duo-actions">
                  <button type="button" className="as-go" onClick={duoStart}>
                    Начать
                  </button>
                </div>
              </div>
            )}

            {duoPhase === "play" && (
              <div className="as-duo-play">
                <div className="as-turn">Листает: {duoNames[duoPlayer].trim() || `Игрок ${duoPlayer + 1}`}</div>
                <div className="as-deck">
                  {(() => {
                    const card = duoCard(duoPool[duoIndex]);
                    if (!card) return null;
                    return (
                      <div className="as-card top" key={card.id}>
                        <div
                          className="as-card-bg"
                          style={
                            card.poster
                              ? { backgroundImage: `url(${card.poster})` }
                              : { background: `linear-gradient(160deg, hsl(${cardHue(card.id)} 60% 38%), hsl(${(cardHue(card.id) + 40) % 360} 45% 12%))` }
                          }
                        />
                        <div className="as-card-shade" />
                        <div className="as-card-body">
                          <span className="as-card-letter" aria-hidden>
                            {card.title.slice(0, 1).toUpperCase()}
                          </span>
                          <div className="as-card-meta">
                            <h2>{card.title}</h2>
                            <p>
                              {[card.year, kindLabel(card.kind), card.lastEpisode ? `${card.lastEpisode} эп.` : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            {card.genres.length > 0 && (
                              <div className="as-card-genres">
                                {card.genres.slice(0, 4).map((genre) => (
                                  <span key={genre}>{genre}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                {duoPool.length > 0 && (
                  <>
                    <div className="as-acts">
                      <button type="button" className="as-act as-skip" onClick={() => duoVote(duoCard(duoPool[duoIndex])!, "skip")}>
                        <span>{ICONS.skip}</span>
                        Пропуск
                      </button>
                      <button type="button" className="as-act as-later" onClick={() => duoVote(duoCard(duoPool[duoIndex])!, "later")}>
                        <span>{ICONS.later}</span>
                        Позже
                      </button>
                      <button type="button" className="as-act as-like" onClick={() => duoVote(duoCard(duoPool[duoIndex])!, "like")}>
                        <span>{ICONS.like}</span>
                        Нравится
                      </button>
                    </div>
                    <p className="as-hint">
                      Карточка {Math.min(Object.keys(duoVotes[duoPlayer]).length + 1, duoPool.length)} из {duoPool.length}
                    </p>
                  </>
                )}
              </div>
            )}

            {duoPhase === "handoff" && (
              <div className="as-empty">
                <h2>Передайте устройство</h2>
                <p>Теперь очередь: {duoNames[1].trim() || "Игрок 2"}. Ответы {duoNames[0].trim() || "Игрок 1"} скрыты.</p>
                <button type="button" className="as-go" onClick={duoNext}>
                  Я готов(а)
                </button>
              </div>
            )}

            {duoPhase === "result" && (
              <div className="as-duo-result">
                <h2>{duoBoth.length + duoMaybe.length ? "Вот что можно смотреть вместе" : "Пока без совпадений"}</h2>
                {!(duoBoth.length + duoMaybe.length) && (
                  <p className="as-duo-sub">Вкусы разошлись. Попробуйте ещё один раунд с новыми карточками.</p>
                )}

                {duoBoth.length > 0 && (
                  <>
                    <div className="as-sec">Нравится обоим</div>
                    <div className="as-list">
                      {duoBoth.map((id) => {
                        const card = duoCard(id);
                        if (!card) return null;
                        return (
                          <div className="as-row" key={id}>
                            <button type="button" className="as-row-main" onClick={() => setDetail(card)}>
                              <span className="as-row-poster">
                                <Poster src={card.poster} alt="" title={card.title} sizes="56px" />
                              </span>
                              <span className="as-row-text">
                                <b>{card.title}</b>
                                <span>
                                  {duoNames[0].trim() || "Игрок 1"}: нравится · {duoNames[1].trim() || "Игрок 2"}: нравится
                                </span>
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {duoMaybe.length > 0 && (
                  <>
                    <div className="as-sec">Можно попробовать — никто не пропустил</div>
                    <div className="as-list">
                      {duoMaybe.map((id) => {
                        const card = duoCard(id);
                        if (!card) return null;
                        const mark: Record<Vote, string> = { like: "нравится", later: "позже", skip: "пропуск" };
                        return (
                          <div className="as-row" key={id}>
                            <button type="button" className="as-row-main" onClick={() => setDetail(card)}>
                              <span className="as-row-poster">
                                <Poster src={card.poster} alt="" title={card.title} sizes="56px" />
                              </span>
                              <span className="as-row-text">
                                <b>{card.title}</b>
                                <span>
                                  {duoNames[0].trim() || "Игрок 1"}: {mark[duoVotes[0][id]]} · {duoNames[1].trim() || "Игрок 2"}: {mark[duoVotes[1][id]]}
                                </span>
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                <div className="as-duo-actions">
                  {duoBoth.length + duoMaybe.length > 0 && (
                    <button type="button" className="as-ghost" onClick={duoSave}>
                      Сохранить в «Позже»
                    </button>
                  )}
                  <button type="button" className="as-ghost" onClick={duoAnother}>
                    Ещё раунд
                  </button>
                  <button type="button" className="as-ghost" onClick={duoReset}>
                    Заново
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {detail && (
        <div className="as-modal" role="dialog" aria-modal="true" aria-label={detail.title} onClick={() => setDetail(null)}>
          <div className="as-sheet" onClick={(event) => event.stopPropagation()}>
            <div
              className="as-sheet-top"
              style={
                detail.poster
                  ? { backgroundImage: `url(${detail.poster})` }
                  : { background: `linear-gradient(160deg, hsl(${cardHue(detail.id)} 60% 38%), hsl(${(cardHue(detail.id) + 40) % 360} 45% 12%))` }
              }
            >
              <span className="as-sheet-letter" aria-hidden>
                {detail.title.slice(0, 1).toUpperCase()}
              </span>
            </div>
            <div className="as-sheet-body">
              <div className="as-sheet-meta">
                {[detail.year, kindLabel(detail.kind), detail.lastEpisode ? `${detail.lastEpisode} эп.` : null, detail.rating ? `★ ${detail.rating.toFixed(1)}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              <h2>{detail.title}</h2>
              {detail.genres.length > 0 && (
                <div className="as-card-genres">
                  {detail.genres.map((genre) => (
                    <span key={genre}>{genre}</span>
                  ))}
                </div>
              )}
              <p>{detail.description || "Описание пока не загружено."}</p>
              <div className="as-sheet-actions">
                <button type="button" className="as-act as-skip" onClick={() => { voteWithFavorite(detail, "skip"); setDetail(null); }}>
                  <span>{ICONS.skip}</span>
                  Пропуск
                </button>
                <button type="button" className="as-act as-later" onClick={() => { voteWithFavorite(detail, "later"); setDetail(null); }}>
                  <span>{ICONS.later}</span>
                  Позже
                </button>
                <button type="button" className="as-act as-like" onClick={() => { voteWithFavorite(detail, "like"); setDetail(null); }}>
                  <span>{ICONS.like}</span>
                  Нравится
                </button>
                <button type="button" className="as-close" onClick={() => setDetail(null)}>
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
