"use client";

/**
 * AniSwipe — свайп-подборка аниме.
 *
 * Каталог Kodik, настоящие постеры. Лайк кладёт тайтл в «Избранное».
 *
 * Как устроено:
 *  - перетаскивание карточки идёт напрямую через style (без setState на
 *    каждое движение мыши) — иначе колода перерисовывалась 60 раз в секунду;
 *  - колода (`SwipeDeck`) общая для соло-режима и режима «Вдвоём»;
 *  - жанры-предпочтения — короткая полоса самых частых жанров, а не стена из
 *    семидесяти кнопок;
 *  - состояние хранится в localStorage под прежним ключом, формат не менялся.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { isFavorite, toggleFavorite } from "@/lib/collections";
import { kindLabel } from "@/lib/anime";
import type { AnimeCard as Card } from "@/lib/types";
import { Poster } from "@/components/Poster";

const STORAGE_KEY = "animehub:aniswipe:v1";

type Tab = "swipe" | "duo" | "lists";
type Vote = "like" | "later" | "skip";
type ListKey = "liked" | "later" | "skip";

interface SwipeState {
  liked: string[];
  later: string[];
  skip: string[];
  genres: string[];
  weights: Record<string, number>;
}

const EMPTY_STATE: SwipeState = { liked: [], later: [], skip: [], genres: [], weights: {} };

const VOTE_WEIGHT: Record<Vote, number> = { like: 1, later: 0.4, skip: -0.5 };
const VOTE_LABEL: Record<Vote, string> = { like: "Нравится", later: "Позже", skip: "Пропуск" };
const LIST_LABEL: Record<ListKey, string> = {
  liked: "Нравится",
  later: "Посмотреть позже",
  skip: "Пропущено",
};
const GENRE_LIMIT = 16;
/** Порог смещения карточки, после которого жест засчитывается */
const SWIPE_X = 90;
const SWIPE_UP = 110;

const VOTE_ICON: Record<Vote, React.ReactNode> = {
  skip: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  later: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M7 4h10v16l-5-4-5 4z" />
    </svg>
  ),
  like: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  ),
};

/* ------------------------------- состояние ------------------------------- */

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

function loadState(): SwipeState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<SwipeState>;
    return {
      liked: strings(parsed.liked),
      later: strings(parsed.later),
      skip: strings(parsed.skip),
      genres: strings(parsed.genres),
      weights:
        parsed.weights && typeof parsed.weights === "object"
          ? (parsed.weights as Record<string, number>)
          : {},
    };
  } catch {
    return EMPTY_STATE;
  }
}

function hashString(value: string): number {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

/** Стабильный «шум» для карточки: порядок не прыгает между рендерами */
const jitter = (id: string) => (hashString(id) % 1000) / 1000;

function rankCards(
  cards: Card[],
  selected: string[],
  weights: Record<string, number>,
  seen: Set<string>,
): Card[] {
  return cards
    .filter((card) => !seen.has(card.id))
    .map((card) => {
      const genreScore = card.genres.reduce(
        (sum, genre) => sum + (weights[genre] ?? 0) + (selected.includes(genre) ? 1.8 : 0),
        0,
      );
      return { card, total: genreScore + (card.rating ?? 0) / 2 + jitter(card.id) * 0.02 };
    })
    .sort((a, b) => b.total - a.total)
    .map((item) => item.card);
}

/** Самые частые жанры колоды; выбранные остаются в полосе всегда */
function topGenres(cards: Card[], keep: string[]): string[] {
  const count = new Map<string, number>();
  for (const card of cards) for (const genre of card.genres) count.set(genre, (count.get(genre) ?? 0) + 1);
  const top = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, GENRE_LIMIT).map(([genre]) => genre);
  return [...new Set([...keep, ...top])];
}

function cardHue(id: string): number {
  return hashString(id) % 360;
}

/** Кладёт тайтл в «Избранное»; true — если добавили именно мы (для отмены) */
function addToFavorites(card: Card): boolean {
  try {
    if (isFavorite(card.id)) return false;
    toggleFavorite(card.id);
    window.dispatchEvent(new Event("animehub:favorites-changed"));
    return true;
  } catch {
    return false; // хранилище недоступно — лайк всё равно учтён в подборке
  }
}

const VOTE_COLOR: Record<Vote, string> = { like: "#38d39f", skip: "#ff5d73", later: "#f5b94a" };

/** Россыпь искр из точки экрана: чистый DOM, без состояния React */
function burst(x: number, y: number, color: string, count = 14) {
  if (typeof document === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  for (let index = 0; index < count; index += 1) {
    const spark = document.createElement("b");
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 110;
    spark.className = "as-spark";
    spark.style.cssText = `left:${x}px;top:${y}px;background:${color};--dx:${Math.cos(angle) * dist}px;--dy:${Math.sin(angle) * dist - 30}px;--sz:${4 + Math.random() * 6}px`;
    document.body.appendChild(spark);
    window.setTimeout(() => spark.remove(), 900);
  }
}

const metaLine = (card: Card) =>
  [card.year, kindLabel(card.kind), card.lastEpisode ? `${card.lastEpisode} эп.` : null]
    .filter(Boolean)
    .join(" · ");

/* ------------------------------- мелкие части ------------------------------ */

function GenreChips({
  genres,
  selected,
  onToggle,
  wrap = false,
}: {
  genres: string[];
  selected: string[];
  onToggle: (genre: string) => void;
  wrap?: boolean;
}) {
  return (
    <div className={`as-chips${wrap ? " is-wrap" : ""}`} role="group" aria-label="Жанры">
      {genres.map((genre) => (
        <button
          key={genre}
          type="button"
          className={selected.includes(genre) ? "on" : undefined}
          aria-pressed={selected.includes(genre)}
          onClick={() => onToggle(genre)}
        >
          {genre}
        </button>
      ))}
    </div>
  );
}

function ActionBar({
  onVote,
  disabled,
  onUndo,
}: {
  onVote: (kind: Vote) => void;
  disabled?: boolean;
  onUndo?: () => void;
}) {
  return (
    <div className="as-acts">
      {onUndo && (
        <button type="button" className="as-undo" onClick={onUndo} aria-label="Вернуть последнюю карточку">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M9 7H5v4M5.5 11a7 7 0 1 1 1.6 5.4" />
          </svg>
          Вернуть
        </button>
      )}
      {(["skip", "later", "like"] as const).map((kind) => (
        <button
          key={kind}
          type="button"
          className={`as-act is-${kind}`}
          disabled={disabled}
          onClick={() => onVote(kind)}
        >
          <i>{VOTE_ICON[kind]}</i>
          {kind === "skip" ? "Пропустить" : VOTE_LABEL[kind]}
          <kbd aria-hidden>{kind === "skip" ? "←" : kind === "like" ? "→" : "↑"}</kbd>
        </button>
      ))}
    </div>
  );
}

function CardFace({ card, hue }: { card: Card; hue: number }) {
  return (
    <div className="as-card-in">
      <div
        className="as-card-img"
        style={{
          background: `linear-gradient(160deg, hsl(${hue} 55% 30%), hsl(${(hue + 40) % 360} 45% 10%))`,
        }}
      >
        <Poster
          src={card.poster}
          alt=""
          title={card.title}
          sizes="(max-width: 640px) 92vw, 380px"
          className="object-cover"
        />
      </div>
      <div className="as-card-shade" aria-hidden />
      {card.rating ? <span className="as-card-rating">★ {card.rating.toFixed(1)}</span> : null}
      <div className="as-card-meta">
        <p className="as-card-sub">{metaLine(card)}</p>
        <h2>{card.title}</h2>
        {card.genres.length > 0 && (
          <div className="as-card-genres">
            {card.genres.slice(0, 3).map((genre) => (
              <span key={genre}>{genre}</span>
            ))}
          </div>
        )}
      </div>
      <span className="as-card-glare" aria-hidden />
    </div>
  );
}

/* --------------------------------- колода --------------------------------- */

function SwipeDeck({
  cards,
  onVote,
  onOpen,
  active,
  footer,
  onUndo,
}: {
  cards: Card[];
  onVote: (card: Card, kind: Vote) => void;
  onOpen: (card: Card) => void;
  /** Стрелки клавиатуры работают, только пока колода на экране и нет окна */
  active: boolean;
  footer?: React.ReactNode;
  /** Если задано — рядом с действиями появляется «Вернуть» */
  onUndo?: () => void;
}) {
  const topRef = useRef<HTMLDivElement | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const delta = useRef({ x: 0, y: 0 });
  const moved = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const [leaving, setLeaving] = useState<Vote | null>(null);
  const top = cards[0];

  useEffect(() => () => window.clearTimeout(timer.current), []);

  /** Ставит карточку под курсор: только style, без setState */
  const place = useCallback((x: number, y: number, animate: boolean) => {
    const el = topRef.current;
    if (!el) return;
    el.style.transition = animate ? "" : "none";
    el.style.transform = x || y ? `translate3d(${x}px, ${y}px, 0) rotate(${x / 18}deg)` : "";
    const up = y < 0 && -y > Math.abs(x);
    el.style.setProperty("--like-o", String(!up && x > 0 ? Math.min(x / 110, 1) : 0));
    el.style.setProperty("--skip-o", String(!up && x < 0 ? Math.min(-x / 110, 1) : 0));
    el.style.setProperty("--later-o", String(up ? Math.min(-y / 130, 1) : 0));
  }, []);

  const commit = useCallback(
    (kind: Vote) => {
      if (!top || leaving) return;
      const el = topRef.current;
      if (el) {
        const box = el.getBoundingClientRect();
        burst(
          box.left + box.width * (kind === "like" ? 0.78 : kind === "skip" ? 0.22 : 0.5),
          box.top + box.height * (kind === "later" ? 0.2 : 0.5),
          VOTE_COLOR[kind],
          kind === "like" ? 22 : 14,
        );
        el.style.transform = "";
        el.style.transition = "";
      }
      setLeaving(kind);
      timer.current = window.setTimeout(() => {
        setLeaving(null);
        onVote(top, kind);
      }, 240);
    },
    [top, leaving, onVote],
  );

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const kind = ({ ArrowRight: "like", ArrowLeft: "skip", ArrowUp: "later" } as const)[
        event.key as "ArrowRight" | "ArrowLeft" | "ArrowUp"
      ];
      if (!kind) return;
      event.preventDefault();
      commit(kind);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, commit]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (leaving) return;
    start.current = { x: event.clientX, y: event.clientY };
    delta.current = { x: 0, y: 0 };
    moved.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
    place(0, 0, false);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current) {
      // Без нажатия карточка слегка наклоняется за курсором, блик едет следом
      const el = event.currentTarget;
      const box = el.getBoundingClientRect();
      const px = (event.clientX - box.left) / box.width;
      const py = (event.clientY - box.top) / box.height;
      el.style.setProperty("--mx", `${px * 100}%`);
      el.style.setProperty("--my", `${py * 100}%`);
      el.style.setProperty("--rx", `${(0.5 - py) * 9}deg`);
      el.style.setProperty("--ry", `${(px - 0.5) * 11}deg`);
      return;
    }
    const x = event.clientX - start.current.x;
    const y = event.clientY - start.current.y;
    delta.current = { x, y };
    moved.current = Math.max(moved.current, Math.hypot(x, y));
    place(x, y, false);
  };

  const onPointerEnd = () => {
    if (!start.current || !top) return;
    const { x, y } = delta.current;
    start.current = null;
    if (moved.current < 6) {
      place(0, 0, true);
      onOpen(top);
      return;
    }
    if (x > SWIPE_X) commit("like");
    else if (x < -SWIPE_X) commit("skip");
    else if (y < -SWIPE_UP && -y > Math.abs(x)) commit("later");
    else place(0, 0, true);
  };

  if (!top) return null;

  return (
    <>
      <div className="as-deck">
        {cards.slice(0, 3).map((card, index) => {
          const isTop = index === 0;
          return (
            <div
              key={card.id}
              ref={isTop ? topRef : undefined}
              className={`as-card depth-${index}${isTop && leaving ? ` leaving-${leaving}` : ""}`}
              style={{ zIndex: 3 - index }}
              onPointerDown={isTop ? onPointerDown : undefined}
              onPointerMove={isTop ? onPointerMove : undefined}
              onPointerUp={isTop ? onPointerEnd : undefined}
              onPointerCancel={isTop ? onPointerEnd : undefined}
              onPointerLeave={
                isTop
                  ? (event) => {
                      event.currentTarget.style.setProperty("--rx", "0deg");
                      event.currentTarget.style.setProperty("--ry", "0deg");
                    }
                  : undefined
              }
            >
              <CardFace card={card} hue={cardHue(card.id)} />
              {isTop && (
                <>
                  <span className="as-stamp is-like">Нравится</span>
                  <span className="as-stamp is-skip">Пропуск</span>
                  <span className="as-stamp is-later">Позже</span>
                </>
              )}
            </div>
          );
        })}
      </div>
      <ActionBar onVote={commit} disabled={leaving !== null} onUndo={onUndo} />
      {footer}
    </>
  );
}

function ListRow({
  card,
  note,
  onOpen,
  actions,
}: {
  card: Card;
  note: string;
  onOpen: (card: Card) => void;
  actions?: React.ReactNode;
}) {
  return (
    <div className="as-row">
      <button type="button" className="as-row-main" onClick={() => onOpen(card)}>
        <span className="as-row-poster">
          <Poster src={card.poster} alt="" title={card.title} sizes="56px" />
        </span>
        <span className="as-row-text">
          <b>{card.title}</b>
          <span>{note}</span>
        </span>
      </button>
      {actions}
    </div>
  );
}

/* --------------------------------- страница -------------------------------- */

export function AniSwipeView({ cards }: { cards: Card[] }) {
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [state, setState] = useState<SwipeState>(loadState);
  const [tab, setTab] = useState<Tab>("swipe");
  const [detail, setDetail] = useState<Card | null>(null);
  const [listTab, setListTab] = useState<ListKey>("liked");
  /** Последние решения: нужны кнопке «Вернуть» */
  const [history, setHistory] = useState<
    { id: string; kind: Vote; genres: string[]; fav: boolean }[]
  >([]);

  // Duo
  const [duoPhase, setDuoPhase] = useState<"setup" | "play" | "handoff" | "result">("setup");
  const [duoNames, setDuoNames] = useState(["", ""]);
  const [duoGenres, setDuoGenres] = useState<string[][]>([[], []]);
  const [duoPool, setDuoPool] = useState<string[]>([]);
  const [duoVotes, setDuoVotes] = useState<Array<Record<string, Vote>>>([{}, {}]);
  const [duoPlayer, setDuoPlayer] = useState(0);
  const [duoIndex, setDuoIndex] = useState(0);
  const [duoError, setDuoError] = useState("");
  const duoUsed = useRef<Set<string>>(new Set());

  const byId = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const genreList = useMemo(() => topGenres(cards, state.genres), [cards, state.genres]);
  const duoGenreList = useMemo(
    () => topGenres(cards, [...duoGenres[0], ...duoGenres[1]]),
    [cards, duoGenres],
  );

  const seen = useMemo(
    () => new Set([...state.liked, ...state.later, ...state.skip]),
    [state.liked, state.later, state.skip],
  );
  const ranked = useMemo(
    () => rankCards(cards, state.genres, state.weights, seen),
    [cards, state.genres, state.weights, seen],
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

  const castVote = useCallback((card: Card, kind: Vote) => {
    setState((prev) => {
      const without = (list: string[]) => list.filter((id) => id !== card.id);
      const next: SwipeState = {
        liked: without(prev.liked),
        later: without(prev.later),
        skip: without(prev.skip),
        genres: prev.genres,
        weights: { ...prev.weights },
      };
      ({ like: next.liked, later: next.later, skip: next.skip })[kind].push(card.id);
      for (const genre of card.genres) next.weights[genre] = (next.weights[genre] ?? 0) + VOTE_WEIGHT[kind];
      return next;
    });
    const fav = kind === "like" ? addToFavorites(card) : false;
    setHistory((prev) => [...prev.slice(-29), { id: card.id, kind, genres: card.genres, fav }]);
  }, []);

  const undo = useCallback(() => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((prev) => prev.slice(0, -1));
    setState((prev) => {
      const weights = { ...prev.weights };
      for (const genre of last.genres) weights[genre] = (weights[genre] ?? 0) - VOTE_WEIGHT[last.kind];
      const without = (list: string[]) => list.filter((id) => id !== last.id);
      return { ...prev, liked: without(prev.liked), later: without(prev.later), skip: without(prev.skip), weights };
    });
    if (last.fav) {
      try {
        toggleFavorite(last.id);
        window.dispatchEvent(new Event("animehub:favorites-changed"));
      } catch {
        /* ignore */
      }
    }
  }, [history]);

  const toggleGenre = (genre: string) =>
    setState((prev) => ({
      ...prev,
      genres: prev.genres.includes(genre) ? prev.genres.filter((g) => g !== genre) : [...prev.genres, genre],
    }));

  const moveListItem = (id: string, to: ListKey | "none") =>
    setState((prev) => {
      const without = (list: string[]) => list.filter((item) => item !== id);
      const next: SwipeState = {
        ...prev,
        liked: without(prev.liked),
        later: without(prev.later),
        skip: without(prev.skip),
      };
      if (to === "liked") next.liked.push(id);
      else if (to === "later") next.later.push(id);
      else if (to === "skip") next.skip.push(id);
      return next;
    });

  /* ----------------------------------- Вдвоём ---------------------------------- */

  const playerName = (index: number) => duoNames[index].trim() || `Игрок ${index + 1}`;

  const duoDeal = () => {
    const score = (card: Card, player: number) => {
      const matches = card.genres.filter((genre) => duoGenres[player].includes(genre)).length;
      const shared = card.genres.some((genre) => duoGenres[1 - player].includes(genre));
      return matches + (matches > 0 && shared ? 2 : 0) + (card.rating ?? 0) / 5;
    };
    const pool = cards
      .filter((card) => !duoUsed.current.has(card.id))
      .sort((a, b) => score(b, 0) + score(b, 1) - (score(a, 0) + score(a, 1)))
      .slice(0, 12)
      .map((card) => card.id)
      .sort(() => Math.random() - 0.5);
    pool.forEach((id) => duoUsed.current.add(id));
    setDuoPool(pool);
    setDuoVotes([{}, {}]);
    setDuoPlayer(0);
    setDuoIndex(0);
    setDuoPhase(pool.length ? "play" : "setup");
  };

  const duoStart = () => {
    if (!duoGenres[0].length || !duoGenres[1].length) {
      setDuoError("Выберите хотя бы один жанр каждому игроку.");
      return;
    }
    setDuoError("");
    duoUsed.current = new Set();
    duoDeal();
  };

  const duoVote = useCallback(
    (card: Card, kind: Vote) => {
      setDuoVotes((prev) => {
        const next = [...prev];
        next[duoPlayer] = { ...next[duoPlayer], [card.id]: kind };
        return next;
      });
      if (duoIndex + 1 >= duoPool.length) setDuoPhase(duoPlayer === 0 ? "handoff" : "result");
      else setDuoIndex(duoIndex + 1);
    },
    [duoPlayer, duoIndex, duoPool.length],
  );

  const duoReset = () => {
    setDuoNames(["", ""]);
    setDuoGenres([[], []]);
    setDuoPool([]);
    setDuoVotes([{}, {}]);
    duoUsed.current = new Set();
    setDuoPhase("setup");
  };

  const duoBoth = duoPool.filter((id) => duoVotes[0][id] === "like" && duoVotes[1][id] === "like");
  const duoMaybe = duoPool.filter(
    (id) => duoVotes[0][id] !== "skip" && duoVotes[1][id] !== "skip" && !duoBoth.includes(id),
  );
  const duoFound = duoBoth.length + duoMaybe.length;

  const duoSave = () =>
    setState((prev) => {
      const next: SwipeState = { ...prev, later: [...prev.later], skip: [...prev.skip] };
      for (const id of [...duoBoth, ...duoMaybe]) {
        if (!next.later.includes(id) && !next.liked.includes(id)) {
          next.skip = next.skip.filter((item) => item !== id);
          next.later.push(id);
        }
      }
      return next;
    });

  const duoCards = useMemo(
    () => duoPool.slice(duoIndex).flatMap((id) => (byId.get(id) ? [byId.get(id)!] : [])),
    [duoPool, duoIndex, byId],
  );

  const ambient =
    tab === "swipe" ? ranked[0] : tab === "duo" && duoPhase === "play" ? duoCards[0] : undefined;

  // Совпало у обоих — праздничный залп
  useEffect(() => {
    if (duoPhase !== "result" || duoBoth.length === 0) return;
    const colors = ["#3d7bff", "#22d3ee", "#f5b94a", "#38d39f"];
    const timers = colors.map((color, index) =>
      window.setTimeout(
        () => burst(window.innerWidth * (0.25 + index * 0.17), window.innerHeight * 0.32, color, 20),
        index * 140,
      ),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duoPhase]);

  const mark: Record<Vote, string> = { like: "нравится", later: "позже", skip: "пропуск" };

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
      <div className="as-ambient" aria-hidden>
        {ambient?.poster && (
          <span key={ambient.id} style={{ backgroundImage: `url("${ambient.poster}")` }} />
        )}
      </div>
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
              {value === "lists" && state.liked.length + state.later.length > 0 && (
                <b>{state.liked.length + state.later.length}</b>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="as-main">
        {tab === "swipe" && (
          <section className="as-section" aria-label="Свайп-подборка">
            <div className="as-stats" aria-label="Ваш выбор">
              <span className="is-like" title="Нравится">
                {VOTE_ICON.like}
                <b key={state.liked.length}>{state.liked.length}</b>
              </span>
              <span className="is-later" title="Позже">
                {VOTE_ICON.later}
                <b key={state.later.length}>{state.later.length}</b>
              </span>
              <span className="is-skip" title="Пропуск">
                {VOTE_ICON.skip}
                <b key={state.skip.length}>{state.skip.length}</b>
              </span>
              <span className="as-bar" aria-hidden>
                <i style={{ width: `${Math.round((seen.size / Math.max(1, seen.size + ranked.length)) * 100)}%` }} />
              </span>
              <em>
                {seen.size} из {seen.size + ranked.length}
              </em>
            </div>
            <GenreChips genres={genreList} selected={state.genres} onToggle={toggleGenre} />
            {ranked.length ? (
              <SwipeDeck
                cards={ranked}
                onVote={castVote}
                onOpen={setDetail}
                active={tab === "swipe" && !detail}
                onUndo={history.length ? undo : undefined}
                footer={
                  <p className="as-hint">
                    <kbd>←</kbd> пропуск · <kbd>↑</kbd> позже · <kbd>→</kbd> нравится · нажмите на карточку — подробнее
                  </p>
                }
              />
            ) : (
              <div className="as-empty">
                <svg className="as-empty-art" viewBox="0 0 120 120" aria-hidden>
                  <circle cx="60" cy="60" r="44" />
                  <path d="M40 62l14 14 28-32" />
                </svg>
                <h2>Карточки закончились</h2>
                <p>Всё из подборки уже разобрано.</p>
                <button
                  type="button"
                  className="as-go"
                  onClick={() => setState((prev) => ({ ...prev, skip: [] }))}
                >
                  Вернуть пропущенные
                </button>
              </div>
            )}
          </section>
        )}

        {tab === "lists" && (
          <section className="as-section" aria-label="Списки AniSwipe">
            <div className="as-tabs" role="group" aria-label="Списки">
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
                state[listTab].flatMap((id) => {
                  const card = byId.get(id);
                  if (!card) return [];
                  return [
                    <ListRow
                      key={id}
                      card={card}
                      onOpen={setDetail}
                      note={[card.year, kindLabel(card.kind), card.genres.slice(0, 2).join(", ")]
                        .filter(Boolean)
                        .join(" · ")}
                      actions={
                        <div className="as-row-actions">
                          {(["liked", "later", "skip", "none"] as const)
                            .filter((target) => target !== listTab)
                            .map((target) => (
                              <button key={target} type="button" onClick={() => moveListItem(id, target)}>
                                {target === "none" ? "В подбор" : LIST_LABEL[target]}
                              </button>
                            ))}
                        </div>
                      }
                    />,
                  ];
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
                  Каждый выбирает жанры и по очереди листает одни и те же 12 карточек. В конце увидите,
                  что нравится обоим.
                </p>
                <div className="as-duo-players">
                  {[0, 1].map((player) => (
                    <div className="as-duo-player" key={player}>
                      <input
                        type="text"
                        maxLength={20}
                        placeholder={`Игрок ${player + 1}`}
                        value={duoNames[player]}
                        onChange={(event) =>
                          setDuoNames((prev) => prev.map((name, i) => (i === player ? event.target.value : name)))
                        }
                      />
                      <GenreChips
                        wrap
                        genres={duoGenreList}
                        selected={duoGenres[player]}
                        onToggle={(genre) =>
                          setDuoGenres((prev) =>
                            prev.map((list, i) =>
                              i !== player
                                ? list
                                : list.includes(genre)
                                  ? list.filter((item) => item !== genre)
                                  : [...list, genre],
                            ),
                          )
                        }
                      />
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
                <div className="as-turn">Листает: {playerName(duoPlayer)}</div>
                <SwipeDeck
                  key={duoPlayer}
                  cards={duoCards}
                  onVote={duoVote}
                  onOpen={setDetail}
                  active={tab === "duo" && !detail}
                  footer={
                    <p className="as-hint">
                      Карточка {Math.min(duoIndex + 1, duoPool.length)} из {duoPool.length}
                    </p>
                  }
                />
              </div>
            )}

            {duoPhase === "handoff" && (
              <div className="as-empty">
                <h2>Передайте устройство</h2>
                <p>
                  Теперь очередь: {playerName(1)}. Ответы {playerName(0)} скрыты.
                </p>
                <button
                  type="button"
                  className="as-go"
                  onClick={() => {
                    setDuoPlayer(1);
                    setDuoIndex(0);
                    setDuoPhase("play");
                  }}
                >
                  Я готов(а)
                </button>
              </div>
            )}

            {duoPhase === "result" && (
              <div className="as-duo-result">
                <h2>{duoFound ? "Вот что можно смотреть вместе" : "Пока без совпадений"}</h2>
                {!duoFound && (
                  <p className="as-duo-sub">Вкусы разошлись. Попробуйте ещё один раунд с новыми карточками.</p>
                )}
                {[
                  { title: "Нравится обоим", ids: duoBoth },
                  { title: "Можно попробовать — никто не пропустил", ids: duoMaybe },
                ].map(
                  (group) =>
                    group.ids.length > 0 && (
                      <div key={group.title}>
                        <div className="as-sec">{group.title}</div>
                        <div className="as-list">
                          {group.ids.flatMap((id) => {
                            const card = byId.get(id);
                            if (!card) return [];
                            return [
                              <ListRow
                                key={id}
                                card={card}
                                onOpen={setDetail}
                                note={`${playerName(0)}: ${mark[duoVotes[0][id]]} · ${playerName(1)}: ${mark[duoVotes[1][id]]}`}
                              />,
                            ];
                          })}
                        </div>
                      </div>
                    ),
                )}
                <div className="as-duo-actions">
                  {duoFound > 0 && (
                    <button type="button" className="as-ghost" onClick={duoSave}>
                      Сохранить в «Позже»
                    </button>
                  )}
                  <button type="button" className="as-ghost" onClick={duoDeal}>
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
              style={{
                background: `linear-gradient(160deg, hsl(${cardHue(detail.id)} 55% 30%), hsl(${(cardHue(detail.id) + 40) % 360} 45% 10%))`,
              }}
            >
              <Poster src={detail.poster} alt="" title={detail.title} sizes="520px" className="object-cover" />
              <span className="as-sheet-fade" aria-hidden />
            </div>
            <div className="as-sheet-body">
              <p className="as-card-sub">
                {[metaLine(detail), detail.rating ? `★ ${detail.rating.toFixed(1)}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <h2>{detail.title}</h2>
              {detail.genres.length > 0 && (
                <div className="as-card-genres">
                  {detail.genres.map((genre) => (
                    <span key={genre}>{genre}</span>
                  ))}
                </div>
              )}
              <p className="as-sheet-text">{detail.description || "Описание пока не загружено."}</p>
              <Link href={`/title/${detail.id}`} className="as-watch">
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.9-6.86a1.04 1.04 0 0 0 0-1.76L9.56 4.26A1.04 1.04 0 0 0 8 5.14Z" />
                </svg>
                Смотреть
              </Link>
              <div className="as-sheet-actions">
                {(tab === "duo" ? [] : (["skip", "later", "like"] as const)).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className={`as-act is-${kind}`}
                    onClick={() => {
                      castVote(detail, kind);
                      setDetail(null);
                    }}
                  >
                    <i>{VOTE_ICON[kind]}</i>
                    {VOTE_LABEL[kind]}
                  </button>
                ))}
              </div>
              <button type="button" className="as-close" onClick={() => setDetail(null)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
