"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { kindLabel } from "@/lib/anime";
import type { AniSearchCard } from "@/lib/anilibria";
import { useAccount } from "@/lib/use-account";
import {
  createRoom as createRoomRequest,
  getRoom,
  joinRoom as joinRoomRequest,
  leaveRoom,
  listRooms,
  patchRoomState,
  rememberNickname,
  sendRoomMessage,
  useIdentity,
  type RoomState,
  type WtMessageInfo,
  type WtRoomInfo,
  type WtSnapshot,
} from "@/lib/watch-together-client";
import { Poster } from "./Poster";
import { RoomPlayer } from "./RoomPlayer";

/* ================================================================== */
/*  Константы                                                          */
/* ================================================================== */

/** Типовые озвучки на выбор */
const DUBS = ["AniLibria", "AniDUB", "Studio Band", "Шедевры"] as const;

/** Варианты доступа к комнате */
const ACCESS: { value: WtRoomInfo["access"]; label: string; hint: string }[] = [
  { value: "open", label: "Открытая", hint: "видна в общем списке" },
  { value: "link", label: "По ссылке", hint: "только по приглашению" },
];

/** Строка вида `12-я серия` */
const episodeLabel = (n: number) => `${n}-я серия`;

/** Запасной кадр для демо-сцены, когда живых комнат ещё нет */
const DEMO_FALLBACK = { anime: "Магическая битва", episode: 14, viewers: 6 };

/* ------------------------------ Иконки ------------------------------ */

/** Тонкие SVG-иконки: stroke currentColor, как во всём интерфейсе */
const PATHS: Record<string, string[]> = {
  search: ["M11 4.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13", "m16.2 16.2 3.3 3.3"],
  chevronDown: ["m6 9 6 6 6-6"],
  chevronLeft: ["m14 6-6 6 6 6"],
  chevronRight: ["m10 6 6 6-6 6"],
  play: ["M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17", "M10.3 8.7 15.5 12l-5.2 3.3z"],
  pause: ["M9.5 6.5v11", "M14.5 6.5v11"],
  arrow: ["M5 12h13", "m12.5 6.5 6 5.5-6 5.5"],
  close: ["m6.5 6.5 11 11", "m17.5 6.5-11 11"],
};

function Icon({
  d,
  className = "h-5 w-5",
  sw = 1.7,
}: {
  d: string[];
  className?: string;
  sw?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {d.map((path, i) => (
        <path key={i} d={path} />
      ))}
    </svg>
  );
}

/* --------------------------- Общие стили ---------------------------- */

/** Подпись поля формы */
const LABEL = "wtv-label";

/** Поле ввода в стиле нового макета */
const FIELD = "wtv-in";

/** Компактный бейдж-пилюля */
const CHIP = "wtv-chip";

/* ================================================================== */
/*  Герой: живая статистика + кнопки                                   */
/* ================================================================== */

interface CinemaMessage {
  id: string;
  author: string;
  text: string;
  color: string;
}

const CINEMA_INITIAL: CinemaMessage[] = [
  { id: "cin-1", author: "Рин", text: "Этот кадр — просто огонь", color: "#2d7dff" },
  { id: "cin-2", author: "Аки", text: "Пауза сработала у всех", color: "#8a5cff" },
  { id: "cin-3", author: "Юки", text: "Не спойлерите, я первый раз 🙈", color: "#34e5a0" },
];

const CINEMA_POOL: Omit<CinemaMessage, "id">[] = [
  { author: "Кен", text: "Синхронно, идём дальше", color: "#22d3ee" },
  { author: "Ами", text: "Опенинг на повтор!", color: "#4ac3f5" },
  { author: "Рин", text: "Вот это поворот…", color: "#2d7dff" },
  { author: "Юки", text: "Чат, вы лучшие 💙", color: "#34e5a0" },
];

const CINEMA_REACTIONS = [
  { emoji: "🔥", label: "Огонь", base: 12 },
  { emoji: "😱", label: "Страх", base: 7 },
  { emoji: "😂", label: "Смешно", base: 9 },
  { emoji: "💙", label: "Люблю", base: 21 },
] as const;

const SEATS = [
  { initial: "Р", from: "#2d7dff", to: "#8a5cff" },
  { initial: "А", from: "#22d3ee", to: "#2d7dff" },
  { initial: "Ю", from: "#34e5a0", to: "#22d3ee" },
  { initial: "К", from: "#4ac3f5", to: "#ff7d90" },
  { initial: "М", from: "#8a5cff", to: "#ff7d90" },
];

/**
 * Герой совместного просмотра.
 *
 * Счётчики — реальные открытые комнаты с сервера (обновляются раз в 15 с).
 * Сцена справа остаётся интерактивной иллюстрацией: чат и реакции живут
 * только в демо-кадре и подписаны «демо», а числа комнат/зрителей — нет.
 */
export function WatchTogetherHero() {
  const [rooms, setRooms] = useState<WtRoomInfo[]>([]);
  const [messages, setMessages] = useState<CinemaMessage[]>(CINEMA_INITIAL);
  const [counts, setCounts] = useState<number[]>(CINEMA_REACTIONS.map((item) => item.base));
  const [bursts, setBursts] = useState<{ id: number; emoji: string; x: number; rot: number }[]>([]);
  const messageIndex = useRef(0);
  const burstId = useRef(0);

  useEffect(() => {
    let alive = true;
    const load = () => {
      listRooms()
        .then((next) => {
          if (alive) setRooms(next);
        })
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, 15_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      const next = CINEMA_POOL[messageIndex.current % CINEMA_POOL.length];
      messageIndex.current += 1;
      setMessages((prev) => [
        ...prev.slice(-2),
        { ...next, id: `cin-${messageIndex.current}-${Date.now()}` },
      ]);
    }, 3400);
    return () => window.clearInterval(timer);
  }, []);

  const viewers = rooms.reduce((sum, room) => sum + room.viewers, 0);

  const openForm = () => {
    document.getElementById("create-room")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(
      () => document.getElementById("wt-room-name")?.focus({ preventScroll: true }),
      520,
    );
  };

  const react = (index: number) => {
    const item = CINEMA_REACTIONS[index];
    setCounts((prev) => prev.map((count, i) => (i === index ? count + 1 : count)));
    burstId.current += 1;
    const id = burstId.current;
    setBursts((prev) => [
      ...prev.slice(-7),
      {
        id,
        emoji: item.emoji,
        x: 18 + ((id * 37) % 64),
        rot: ((id * 23) % 40) - 20,
      },
    ]);
  };

  const demo = rooms[0] ?? DEMO_FALLBACK;

  return (
    <header className="wtv-hero">
      <div className="wtv-hero-copy">
        <h1>
          Смотрите аниме <span>вместе</span>, даже на расстоянии
        </h1>
        <p>
          Одна комната, общая пауза и чат поверх плеера. Все видят один и тот же кадр
          в одну и ту же секунду — с любого устройства.
        </p>

        <div className="wtv-cta">
          <button type="button" className="wtv-btn" onClick={openForm}>
            Создать комнату
          </button>
          <a className="wtv-btn ghost" href="#how-it-works">
            Как это работает
          </a>
        </div>

        <div className="wtv-stats">
          <div className="wtv-stat">
            <b>{rooms.length}</b>
            <small>
              <span className="wtv-dot" aria-hidden />
              открытых комнат
            </small>
          </div>
          <div className="wtv-stat">
            <b>{viewers.toLocaleString("ru-RU")}</b>
            <small>
              <span className="wtv-dot" aria-hidden />
              зрителей в комнатах
            </small>
          </div>
        </div>
      </div>

      <div className="wtv-stage" aria-label="Демонстрация комнаты совместного просмотра">
        <div className="wtv-cin">
          <div className="wtv-cin-screen">
            <span className="wtv-cin-jp" aria-hidden>
              呪術
            </span>
            <div className="wtv-cin-top">
              <span>
                {demo.anime} · серия {demo.episode}
              </span>
              <span className="wtv-live">
                <span className="wtv-dot" aria-hidden />
                демо
              </span>
            </div>

            <div className="wtv-cin-chat" aria-live="off">
              {messages.map((message) => (
                <div className="wtv-msg" key={message.id}>
                  <b style={{ background: message.color }}>{message.author.slice(0, 1)}</b>
                  <span>
                    <em>{message.author}</em> {message.text}
                  </span>
                </div>
              ))}
            </div>

            {bursts.map((burst) => (
              <span
                className="wtv-fl"
                key={burst.id}
                style={{
                  left: `${burst.x}%`,
                  ["--sx" as string]: `${((burst.id * 17) % 50) - 25}px`,
                  ["--rot" as string]: `${burst.rot}deg`,
                }}
                onAnimationEnd={() =>
                  setBursts((prev) => prev.filter((item) => item.id !== burst.id))
                }
                aria-hidden
              >
                {burst.emoji}
              </span>
            ))}
          </div>

          <div className="wtv-cin-dock">
            <div className="wtv-cin-row">
              <span className="wtv-sync">Синхронно у {demo.viewers} из {demo.viewers}</span>
              <div className="wtv-rx">
                {CINEMA_REACTIONS.map((item, index) => (
                  <button
                    type="button"
                    key={item.emoji}
                    onClick={() => react(index)}
                    aria-label={item.label}
                    style={{ ["--k" as string]: index === 0 ? "#2d7dff" : index === 1 ? "#8a5cff" : index === 2 ? "#4ac3f5" : "#22d3ee" }}
                  >
                    <span className="e">{item.emoji}</span>
                    <span className="n">{counts[index]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="wtv-cin-tl">
              <i />
            </div>
            <div className="wtv-seats">
              {SEATS.map((seat) => (
                <i
                  key={seat.initial}
                  style={{ background: `linear-gradient(135deg, ${seat.from}, ${seat.to})` }}
                >
                  {seat.initial}
                </i>
              ))}
              <em>{demo.viewers} в комнате</em>
            </div>
          </div>
          <div className="wtv-cin-under" aria-hidden />
        </div>
      </div>
    </header>
  );
}

/* ================================================================== */
/*  Основная интерактивная часть страницы                              */
/* ================================================================== */

export function WatchTogetherView() {
  const searchParams = useSearchParams();
  /** Код из приглашения `?room=XXXXXX` */
  const inviteCode = (searchParams.get("room") ?? "").trim().toUpperCase();
  const account = useAccount();

  /** Постоянный id клиента и ник — общие для всех комнат этого браузера */
  const { clientId, nickname: savedNickname } = useIdentity();
  /** Правка ника: null — показываем запомненный */
  const [nicknameEdit, setNicknameEdit] = useState<string | null>(null);
  const nickname = nicknameEdit ?? savedNickname;

  /* --------------------------- Форма ------------------------------- */
  const [name, setName] = useState("");
  const [dub, setDub] = useState<string>(DUBS[0]);
  const [access, setAccess] = useState<WtRoomInfo["access"]>("link");
  const [anime, setAnime] = useState<AniSearchCard | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  /* --------------------------- Поиск ------------------------------- */
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AniSearchCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdown, setDropdown] = useState(false);
  const [cursor, setCursor] = useState(-1);

  /* ------------------------ Результаты ----------------------------- */
  const [created, setCreated] = useState<{ room: WtRoomInfo; path: string } | null>(null);
  const [joined, setJoined] = useState<WtSnapshot | null>(null);
  const [joiningCode, setJoiningCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [copiedAt, setCopiedAt] = useState(0);

  /* -------------------- Открытые комнаты с сервера ------------------ */
  const [rooms, setRooms] = useState<WtRoomInfo[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);

  /* -------------------- Комната из приглашения --------------------- */
  /** Состояние приглашения вместе с кодом, к которому оно относится */
  const [inviteState, setInviteState] = useState<{
    code: string;
    room: WtRoomInfo | null;
    error: string;
  } | null>(null);

  const boxRef = useRef<HTMLDivElement>(null);

  /* -------------------------- Поиск аниме -------------------------- */
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;

    const controller = new AbortController();
    // Дебаунс 300 мс — тот же паттерн, что у SearchBox в шапке
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/anilibria/search?q=${encodeURIComponent(term)}&limit=6`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as { results: AniSearchCard[] };
        setResults(Array.isArray(data.results) ? data.results : []);
        setCursor(-1);
        setDropdown(true);
      } catch {
        /* запрос отменён или упал — молча игнорируем */
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Клик вне поля — закрываем выпадашку
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setDropdown(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Подсказка «ссылка скопирована» гаснет через 2 с
  useEffect(() => {
    if (!copiedAt) return;
    const timer = window.setTimeout(() => setCopiedAt(0), 2200);
    return () => window.clearTimeout(timer);
  }, [copiedAt]);

  /* ----------------------- Список комнат --------------------------- */
  const refreshRooms = useCallback(async () => {
    try {
      const next = await listRooms();
      setRooms(next);
    } catch {
      /* сервер недоступен — оставляем прошлый список */
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const next = await listRooms();
        if (alive) setRooms(next);
      } catch {
        /* тихо: список просто не обновится */
      } finally {
        if (alive) setRoomsLoading(false);
      }
    };
    load();
    const timer = window.setInterval(load, 10_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  /* ------------------- Приглашение по ссылке ----------------------- */
  useEffect(() => {
    if (!inviteCode) return;
    let alive = true;
    getRoom(inviteCode)
      .then((snapshot) => {
        if (!alive) return;
        setInviteState({ code: inviteCode, room: snapshot.room, error: "" });
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setInviteState({
          code: inviteCode,
          room: null,
          error: err instanceof Error ? err.message : "Комната не найдена",
        });
      });
    return () => {
      alive = false;
    };
  }, [inviteCode]);

  /* --------------------------- Обработчики -------------------------- */

  const onQueryChange = (value: string) => {
    setQuery(value);
    const term = value.trim();
    setDropdown(term.length >= 2);
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      setCursor(-1);
    }
    // Пользователь начал новый запрос — прошлый выбор сбрасываем
    if (anime) setAnime(null);
    if (error) setError("");
  };

  /** Выбор тайтла из выпадашки: запрос и результаты не трогаем,
   *  иначе эффект поиска переоткрыл бы список уже после выбора */
  const pickAnime = (item: AniSearchCard) => {
    setAnime(item);
    setDropdown(false);
    setSearching(false);
    setCursor(-1);
    if (error) setError("");
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, -1));
    } else if (e.key === "Enter") {
      // Enter внутри формы не должен её отправлять — выбираем подсказку
      e.preventDefault();
      if (cursor >= 0 && results[cursor]) pickAnime(results[cursor]);
    } else if (e.key === "Escape") {
      setDropdown(false);
      e.currentTarget.blur();
    }
  };

  /** Создание комнаты на сервере: код выдаёт он же */
  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!anime) {
      setError("Выберите аниме из поиска — по нему поймут, что смотрим.");
      document.getElementById("wt-anime")?.focus();
      return;
    }
    if (!clientId) {
      setError("Браузер ещё не готов — попробуйте через секунду.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const snapshot = await createRoomRequest({
        clientId,
        nickname: roomNickname,
        title: name.trim() || `Смотрим «${anime.title}»`,
        anime: anime.title,
        alias: anime.alias,
        poster: anime.poster,
        dub,
        access,
      });
      rememberNickname(nickname);
      setCreated({ room: snapshot.room, path: `/watch-together?room=${snapshot.room.code}` });
      setJoined(null);
      void refreshRooms();

      window.setTimeout(
        () => document.getElementById("wt-created")?.scrollIntoView({ behavior: "smooth", block: "center" }),
        90,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать комнату");
    } finally {
      setBusy(false);
    }
  }

  /** Сброс формы перед новой комнатой */
  function resetForm() {
    setName("");
    setQuery("");
    setResults([]);
    setAnime(null);
    setCreated(null);
    setDropdown(false);
    setError("");
    setDub(DUBS[0]);
    setAccess("link");
  }

  /** Копирование абсолютной ссылки-приглашения */
  async function copyLink(path: string) {
    const url = window.location.origin + path;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedAt(Date.now());
      return;
    } catch {
      /* Clipboard API недоступен — пробуем классический способ */
    }
    try {
      const area = document.createElement("textarea");
      area.value = url;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      if (ok) setCopiedAt(Date.now());
    } catch {
      /* нечего делать — покажем ссылку текстом, её можно скопировать вручную */
    }
  }

  /** Вход в комнату: сервер проверяет места и запоминает ник */
  const onJoin = async (code: string) => {
    if (!clientId) {
      setJoinError("Браузер ещё не готов — попробуйте через секунду.");
      return;
    }

    setJoiningCode(code);
    setJoinError("");
    try {
      const snapshot = await joinRoomRequest(code, clientId, roomNickname);
      rememberNickname(nickname);
      setJoined(snapshot);
      setCreated(null);
      window.setTimeout(
        () => document.getElementById("wt-room-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }),
        90,
      );
      void refreshRooms();
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Не удалось войти в комнату");
    } finally {
      setJoiningCode("");
    }
  };

  /* --------------------------- Производные -------------------------- */

  const q = query.trim();
  const showDropdown = dropdown && q.length >= 2;
  const showNicknameInput = !nickname.trim();

  /** Ник для комнаты: введённый, иначе имя аккаунта, иначе «Гость» */
  const roomNickname =
    nickname.trim() || account?.displayName || account?.nickname || "Гость";

  /** Приглашение показываем, только если оно относится к текущему коду */
  const invite = inviteState && inviteState.code === inviteCode ? inviteState : null;
  const inviteRoom = invite?.room ?? null;
  const inviteError = invite?.error ?? "";
  const inviteLoading = Boolean(inviteCode) && !invite;

  /* ------------------------------ Разметка -------------------------- */

  return (
    <div className="space-y-6">
      {/* --------------------- Приглашение по ссылке ------------------- */}
      {inviteCode && (
        <section
          aria-label="Приглашение в комнату"
          className="animate-fade-up relative overflow-hidden rounded-3xl border border-accent/35 bg-gradient-to-r from-accent/14 via-card/70 to-accent-2/12 p-5 sm:p-6"
        >
          <div className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full bg-accent/16 blur-3xl" aria-hidden />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-accent/18 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-accent-2 ring-1 ring-accent/40">
                Приглашение
              </span>
              <h2 className="mt-3 break-words text-xl font-black text-white sm:text-2xl">
                Вы приглашены в комнату{" "}
                <span className="font-mono tracking-[0.2em] text-accent-2">{inviteCode}</span>
              </h2>
              {inviteRoom ? (
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  «{inviteRoom.title}» · {inviteRoom.anime} · {inviteRoom.viewers} из{" "}
                  {inviteRoom.limit} мест занято
                </p>
              ) : (
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {inviteLoading ? "Ищем комнату на сервере…" : inviteError || "Комната не найдена."}
                </p>
              )}
              {inviteRoom && (
                <p className="mt-2 text-xs leading-relaxed text-muted/85">
                  Комната живёт на сервере: пауза, перемотка и чат общие для всех устройств.
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-col gap-2">
              {showNicknameInput && (
                <input
                  value={nickname}
                  onChange={(e) => setNicknameEdit(e.target.value)}
                  maxLength={24}
                  placeholder="Ваш ник"
                  aria-label="Ваш ник для комнаты"
                  className={`${FIELD} sm:w-56`}
                />
              )}
              <button
                type="button"
                onClick={() => inviteRoom && onJoin(inviteRoom.code)}
                disabled={!inviteRoom || busy}
                className="btn-primary rounded-xl px-5 py-3 text-sm font-black text-white disabled:pointer-events-none disabled:opacity-50"
                aria-label={`Войти в комнату ${inviteCode}`}
              >
                {joiningCode === inviteCode ? "Входим…" : "Войти в комнату"}
              </button>
              <a
                href="#create-room"
                className="btn-ghost inline-flex rounded-xl border border-line bg-white/6 px-5 py-2.5 text-center text-xs font-bold text-white/85 hover:border-accent/40 hover:text-white"
              >
                Создать свою
              </a>
            </div>
          </div>
        </section>
      )}

      {/* --------------------------- Форма ----------------------------- */}
      <section id="create-room" aria-label="Создание комнаты" className="wtv-panel scroll-mt-24">
        <div className="relative">
          <h2 className="wtv-h2">Создайте комнату</h2>
          <p className="wtv-sub">
            Название, тайтл, озвучка и доступ — код на шесть символов сервер выдаст сразу.
            Ссылка и код заработают на любом устройстве.
          </p>

          <form onSubmit={onCreate} className="wtv-grid2">
            {/* Название комнаты */}
            <div>
              <label htmlFor="wt-room-name" className={LABEL}>
                Название комнаты
              </label>
              <input
                id="wt-room-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="Вечерний марафон"
                className={FIELD}
              />
            </div>

            {/* Ник */}
            <div>
              <label htmlFor="wt-nick" className={LABEL}>
                Ваш ник
              </label>
              <input
                id="wt-nick"
                value={nickname}
                onChange={(e) => {
                  setNicknameEdit(e.target.value);
                  if (error) setError("");
                }}
                maxLength={24}
                autoComplete="nickname"
                placeholder="Как вас увидят (необязательно)"
                className={FIELD}
              />
            </div>

            {/* Озвучка */}
            <div>
              <label htmlFor="wt-dub" className={LABEL}>
                Озвучка
              </label>
              <div className="relative">
                <select
                  id="wt-dub"
                  value={dub}
                  onChange={(e) => setDub(e.target.value)}
                  aria-label="Озвучка комнаты"
                  className={`${FIELD} w-full cursor-pointer appearance-none pr-9 pl-3`}
                >
                  {DUBS.map((option) => (
                    <option key={option} value={option} className="bg-card text-white">
                      {option}
                    </option>
                  ))}
                </select>
                <Icon
                  d={PATHS.chevronDown}
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                />
              </div>
            </div>

            {/* Поиск аниме */}
            <div className="sm:col-span-2">
              <label htmlFor="wt-anime" className={LABEL}>
                Аниме
              </label>
              <div className="relative" ref={boxRef}>
                <div className="wtv-search">
                  <Icon d={PATHS.search} className="h-4 w-4 shrink-0 text-muted" sw={2} />
                  <input
                    id="wt-anime"
                    type="text"
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    onFocus={() => q.length >= 2 && setDropdown(true)}
                    onKeyDown={onSearchKeyDown}
                    placeholder="Например, Магическая битва"
                    autoComplete="off"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-muted/80"
                  />
                  {searching && (
                    <span
                      className="h-4 w-4 shrink-0 animate-spin-slow rounded-full border-2 border-white/20 border-t-accent"
                      aria-hidden
                    />
                  )}
                </div>

                {/* Выпадающие результаты */}
                {showDropdown && (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-line bg-[#0d0d15]/95 shadow-[0_30px_60px_-20px_rgba(0,0,0,.9)] backdrop-blur-xl animate-fade-in">
                    {searching && !results.length ? (
                      <div className="space-y-2 p-3">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="skeleton h-14 w-10 rounded-md" />
                            <div className="flex-1 space-y-2">
                              <div className="skeleton h-3 w-3/4 rounded" />
                              <div className="skeleton h-3 w-1/3 rounded" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : results.length ? (
                      <ul className="max-h-[46vh] overflow-y-auto p-2">
                        {results.map((item, i) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              onMouseEnter={() => setCursor(i)}
                              onClick={() => pickAnime(item)}
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
                                  {[
                                    item.year,
                                    kindLabel(item.kind),
                                    item.lastEpisode ? `${item.lastEpisode} эп.` : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="px-4 py-3 text-sm text-muted">
                        По запросу «{q}» ничего не нашли — можно указать название вручную.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Выбранное аниме */}
              {anime && (
                <div className="animate-fade-in mt-3 flex items-center gap-3 rounded-xl border border-accent/35 bg-accent/10 p-2">
                  <span className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md bg-card">
                    <Poster
                      src={anime.poster}
                      alt=""
                      title={anime.title}
                      sizes="44px"
                      className="object-cover"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-white">
                      {anime.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {[
                        anime.titleOrig,
                        anime.year,
                        kindLabel(anime.kind),
                        anime.lastEpisode ? `до ${anime.lastEpisode} эп.` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAnime(null);
                      setQuery("");
                      setResults([]);
                    }}
                    aria-label="Убрать выбранное аниме"
                    className="btn-ghost flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/8 text-muted hover:text-white"
                  >
                    <Icon d={PATHS.close} className="h-4 w-4" sw={2} />
                  </button>
                </div>
              )}
            </div>

            {/* Доступ */}
            <fieldset className="min-w-0 sm:col-span-2">
              <legend className={LABEL}>Доступ</legend>
              <div className="flex flex-wrap gap-2">
                {ACCESS.map((option) => {
                  const active = access === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setAccess(option.value)}
                      className={`wtv-opt${active ? " on" : ""}`}
                    >
                      <span className="block text-sm font-black">{option.label}</span>
                      <span className="mt-0.5 block text-xs text-muted">{option.hint}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Ошибка валидации */}
            {error && (
              <p role="alert" className="wtv-error sm:col-span-2">
                {error}
              </p>
            )}

            {/* Отправка */}
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <button type="submit" disabled={busy} className="wtv-btn disabled:opacity-60">
                {busy ? "Создаём…" : "Создать комнату"}
              </button>
              <span className="text-xs leading-relaxed text-muted">
                Комната создаётся на сервере и видна всем, кто откроет код или ссылку.
              </span>
            </div>
          </form>
        </div>
      </section>

      {/* ------------------------ Комната создана ---------------------- */}
      {created && (
        <section
          id="wt-created"
          aria-label="Комната создана"
          className="animate-fade-in relative overflow-hidden rounded-3xl border border-mint/35 bg-gradient-to-r from-mint/12 via-card/70 to-accent/10 p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-mint/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-mint ring-1 ring-mint/40">
              ✓ Комната создана
            </span>
            <span className={`${CHIP} bg-white/8 text-muted ring-white/15`}>
              {created.room.access === "open" ? "Открытая" : "По ссылке"}
            </span>
            <span className={`${CHIP} bg-white/8 text-muted ring-white/15`}>{created.room.dub}</span>
          </div>

          <h2 className="mt-3 break-words text-xl font-black text-white sm:text-2xl">
            {created.room.title}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {created.room.anime} · {episodeLabel(created.room.episode)} · {created.room.viewers} из{" "}
            {created.room.limit} мест
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-white/5 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">
                Код комнаты
              </p>
              <p className="mt-1 font-mono text-lg font-black tracking-[0.3em] text-accent-2">
                {created.room.code}
              </p>
            </div>
            <div className="min-w-0 rounded-xl border border-line bg-white/5 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">
                Ссылка-приглашение
              </p>
              <p className="mt-1 truncate font-mono text-sm text-white/85">{created.path}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={() => copyLink(created.path)} className="wtv-btn">
              {copiedAt ? "Скопировано ✓" : "Скопировать ссылку"}
            </button>
            <button
              type="button"
              onClick={() => onJoin(created.room.code)}
              disabled={busy || joiningCode === created.room.code}
              className="btn-ghost rounded-xl border border-line bg-white/6 px-5 py-2.5 text-sm font-bold text-white hover:border-accent/40 disabled:opacity-60"
            >
              {joiningCode === created.room.code ? "Входим…" : "Присоединиться"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="btn-ghost rounded-xl border border-line bg-white/6 px-5 py-2.5 text-sm font-bold text-muted hover:text-white"
            >
              Создать ещё
            </button>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-muted">
            Код и ссылка уже работают на других устройствах. Вы — первый участник комнаты.
          </p>
        </section>
      )}

      {/* ------------------------- Панель комнаты ---------------------- */}
      {/* key по коду: при входе в другую комнату состояние плеера/чата сбрасывается */}
      {joined && (
        <RoomPanel
          key={joined.room.code}
          initial={joined}
          clientId={clientId}
          nickname={roomNickname}
          onLeave={() => {
            setJoined(null);
            void refreshRooms();
          }}
        />
      )}

      {/* ------------------------ Список комнат ------------------------ */}
      <section id="rooms" aria-label="Активные комнаты" className="wtv-rooms-section scroll-mt-24">
        <div className="wtv-sh">
          <div>
            <h2>Активные комнаты</h2>
            <p>Заходите к тем, кто уже смотрит.</p>
          </div>
          <span className="wtv-pill">{rooms.length} комнат</span>
        </div>

        {joinError && (
          <p role="alert" className="wtv-error mb-4">
            {joinError}
          </p>
        )}

        {rooms.length ? (
          <div className="wtv-rooms">
            {rooms.map((room) => (
              <RoomCard
                key={room.code}
                room={room}
                joining={joiningCode === room.code}
                onJoin={() => onJoin(room.code)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-white/[0.03] px-5 py-8 text-center">
            <p className="text-sm font-bold text-white">
              {roomsLoading ? "Загружаем комнаты…" : "Пока никто не смотрит"}
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted">
              {roomsLoading
                ? "Секунду — забираем список с сервера."
                : "Создайте комнату выше: она сразу появится здесь и будет доступна по ссылке на любом устройстве."}
            </p>
          </div>
        )}

        <p className="mt-4 text-xs leading-relaxed text-muted">
          В списке — открытые комнаты с активными зрителями. Комнаты «по ссылке» в него не
          попадают, но открываются по коду из приглашения. Пустые комнаты удаляются автоматически.
        </p>
      </section>
    </div>
  );
}

/* ================================================================== */
/*  Карточка комнаты                                                   */
/* ================================================================== */

function RoomCard({
  room,
  joining,
  onJoin,
}: {
  room: WtRoomInfo;
  joining: boolean;
  onJoin: () => void;
}) {
  return (
    <article className="wtv-room">
      <div className="wtv-room-poster">
        <Poster
          src={room.poster}
          alt=""
          title={room.anime}
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          className="object-cover"
        />
        <span className="wtv-room-letter" aria-hidden>
          {room.anime.slice(0, 1).toUpperCase()}
        </span>
        <span className="wtv-tag wtv-tag-ep">идёт {episodeLabel(room.episode)}</span>
        <span className="wtv-tag wtv-tag-live">
          <span className="wtv-dot" aria-hidden />
          онлайн
        </span>
        <span className="wtv-room-dub">{room.dub}</span>
      </div>

      <div className="wtv-room-body">
        <h3 className="wtv-room-title">{room.title}</h3>
        <p className="wtv-room-anime">{room.anime}</p>

        <div className="wtv-room-meta">
          <span className="wtv-chip">
            {room.access === "open" ? "Открытая" : "По ссылке"}
          </span>
          <span className="wtv-chip wtv-chip-code">{room.code}</span>
        </div>

        <div className="wtv-room-bar">
          <i style={{ width: Math.min(100, Math.round((room.viewers / room.limit) * 100)) + "%" }} />
        </div>

        <div className="wtv-room-foot">
          <div className="wtv-room-stack" aria-hidden>
            {Array.from({ length: Math.min(4, room.viewers) }).map((_, index) => (
              <i key={index} />
            ))}
          </div>
          <span className="wtv-room-count">
            {room.viewers}/{room.limit} зрителей
          </span>
        </div>

        <button
          type="button"
          onClick={onJoin}
          disabled={joining}
          aria-label={`Присоединиться к комнате «${room.title}»`}
          className="wtv-room-join disabled:opacity-60"
        >
          {joining ? "Входим…" : "Присоединиться"}
        </button>
      </div>
    </article>
  );
}

/* ================================================================== */
/*  Панель комнаты: серверный синк плеера и чата                       */
/* ================================================================== */

/** Слишком частое сообщение сервер отклонит — показываем его текст как есть */
function RoomPanel({
  initial,
  clientId,
  nickname,
  onLeave,
}: {
  initial: WtSnapshot;
  clientId: string;
  /** Ник нужен, чтобы вернуться в комнату после долгого простоя вкладки */
  nickname: string;
  onLeave: () => void;
}) {
  const [snap, setSnap] = useState<WtSnapshot>(initial);
  const [messages, setMessages] = useState<WtMessageInfo[]>(initial.messages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [lost, setLost] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const lastIdRef = useRef(initial.messages.at(-1)?.id ?? 0);
  /** Когда последний раз успешно отмечались в комнате (ставится при запуске поллинга) */
  const lastSeenRef = useRef(0);

  /* ------------------------- Поллинг комнаты ----------------------- */
  useEffect(() => {
    let alive = true;
    let busy = false;
    lastSeenRef.current = Date.now();

    const tick = async () => {
      if (!alive || busy || document.hidden) return;
      busy = true;
      try {
        // Вкладка была свёрнута дольше TTL участника — сервер уже забыл нас,
        // поэтому сначала входим заново (если места ещё есть)
        const needRejoin = Date.now() - lastSeenRef.current > 25_000;
        const next = needRejoin
          ? await joinRoomRequest(initial.room.code, clientId, nickname)
          : await getRoom(initial.room.code, {
              clientId,
              after: lastIdRef.current,
            });
        lastSeenRef.current = Date.now();
        if (!alive) return;
        setSnap(next);
        setLost(false);
        if (next.messages.length) {
          setMessages((prev) => {
            const seen = new Set(prev.map((message) => message.id));
            const fresh = next.messages.filter((message) => !seen.has(message.id));
            return fresh.length ? [...prev, ...fresh] : prev;
          });
          lastIdRef.current = Math.max(
            lastIdRef.current,
            next.messages[next.messages.length - 1].id,
          );
        }
      } catch {
        // Сеть моргнула или комнату закрыли — пробуем снова на следующем тике
        if (alive) setLost(true);
      } finally {
        busy = false;
      }
    };

    void tick();
    const timer = window.setInterval(tick, 2000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [initial.room.code, clientId, nickname]);

  // Чат прибивается к нижнему краю при новом сообщении
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  /* --------------------------- Действия ---------------------------- */

  const onPublish = useCallback(
    (state: RoomState) => {
      // Ответ на поллинг не ждём: следующий тик принесёт состояние
      patchRoomState(initial.room.code, clientId, state).catch(() => undefined);
    },
    [initial.room.code, clientId],
  );

  const sendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError("");
    try {
      const message = await sendRoomMessage(initial.room.code, clientId, text);
      setDraft("");
      setMessages((prev) =>
        prev.some((item) => item.id === message.id) ? prev : [...prev, message],
      );
      lastIdRef.current = Math.max(lastIdRef.current, message.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сообщение не отправилось");
    } finally {
      setSending(false);
    }
  };

  const leave = () => {
    void leaveRoom(initial.room.code, clientId);
    onLeave();
  };

  const room = snap.room;

  return (
    <section
      id="wt-room-panel"
      aria-label={`Комната ${room.code}`}
      className="animate-fade-up scroll-mt-24 overflow-hidden rounded-3xl border border-accent/35 bg-card/70"
    >
      {/* Шапка панели */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-gradient-to-r from-accent/12 to-accent-2/8 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-accent-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" aria-hidden />
            комната {room.code}
          </p>
          <h2 className="mt-1 truncate text-lg font-black text-white sm:text-xl">{room.title}</h2>
          <p className="truncate text-xs text-muted">
            {room.anime} · {room.dub} · {room.access === "open" ? "открытая" : "по ссылке"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className={`${CHIP} bg-mint/12 text-mint ring-mint/35`}>
            {room.viewers}/{room.limit} онлайн
          </span>
          <button
            type="button"
            onClick={leave}
            className="btn-ghost shrink-0 rounded-xl border border-line bg-white/6 px-4 py-2 text-xs font-bold text-muted hover:text-white"
          >
            Выйти
          </button>
        </div>
      </div>

      {lost && (
        <p role="status" className="border-b border-line bg-amber-400/10 px-4 py-2 text-xs text-amber-200 sm:px-5">
          Связь с комнатой потеряна — пробуем переподключиться…
        </p>
      )}

      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ---------------------------- Плеер --------------------------- */}
        <div>
          <RoomPlayer
            title={room.anime}
            poster={room.poster}
            alias={room.alias}
            startEpisode={initial.room.episode}
            viewers={room.viewers}
            limit={room.limit}
            clientId={clientId}
            sync={room}
            onPublish={onPublish}
          />
        </div>

        {/* ----------------------------- Чат ---------------------------- */}
        <div className="flex min-h-[280px] flex-col rounded-2xl border border-line bg-ink/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">
              Чат комнаты
            </p>
            <p className="text-[10px] font-bold text-muted">{room.viewers} онлайн</p>
          </div>

          {/* Кто в комнате */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {snap.members.map((member) => (
              <span
                key={member.clientId}
                title={member.nickname}
                className={`inline-flex max-w-[9rem] items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold ring-1 ${
                  member.clientId === clientId
                    ? "bg-accent/15 text-accent-2 ring-accent/35"
                    : "bg-white/6 text-white/85 ring-white/12"
                }`}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-[9px] font-black text-white">
                  {member.nickname.slice(0, 1).toUpperCase()}
                </span>
                <span className="truncate">{member.nickname}</span>
              </span>
            ))}
          </div>

          <ul
            ref={listRef}
            className="mt-2 max-h-64 min-h-[140px] flex-1 space-y-2 overflow-y-auto pr-1"
          >
            {messages.length ? (
              messages.map((message) => {
                const self = message.clientId === clientId;
                return (
                  <li
                    key={message.id}
                    className={`rounded-xl px-3 py-2 text-sm ${
                      self ? "ml-6 bg-accent/15 text-white" : "mr-6 bg-white/6 text-white/90"
                    }`}
                  >
                    <span className="block text-[11px] font-black text-accent-2">
                      {message.nickname}
                      {self ? " (вы)" : ""}
                    </span>
                    <span className="mt-0.5 block leading-snug break-words">{message.body}</span>
                  </li>
                );
              })
            ) : (
              <li className="rounded-xl bg-white/4 px-3 py-2 text-xs leading-relaxed text-muted">
                Чат пуст. Напишите первым — сообщение увидят все в комнате.
              </li>
            )}
          </ul>

          {error && (
            <p role="alert" className="mt-2 text-[11px] font-bold text-rose-300">
              {error}
            </p>
          )}

          <form onSubmit={sendMessage} className="mt-3 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={300}
              placeholder="Сообщение…"
              aria-label="Сообщение в чат комнаты"
              className={FIELD}
            />
            <button
              type="submit"
              disabled={sending}
              aria-label="Отправить сообщение"
              className="wtv-btn wtv-chat-send disabled:opacity-60"
            >
              <Icon d={PATHS.arrow} className="h-4 w-4" sw={2.2} />
            </button>
          </form>
        </div>
      </div>

      <p className="border-t border-line px-4 py-3 text-[11px] leading-relaxed text-muted sm:px-5">
        Плеер настоящий — серии идут из каталога AniLiberty (HLS). Пауза, перемотка и переходы
        по сериям сохраняются на сервере и применяются у всех участников: новый зритель сразу
        попадает на текущую секунду. Комната живёт 12 часов, пустая — удаляется через полчаса.
      </p>
    </section>
  );
}
