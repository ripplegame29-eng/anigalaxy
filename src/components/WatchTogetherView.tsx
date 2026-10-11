"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { kindLabel } from "@/lib/anime";
import type { AniSearchCard } from "@/lib/anilibria";
import { createLocalStore } from "@/lib/store";
import { Poster } from "./Poster";
import { RoomPlayer } from "./RoomPlayer";

/* ================================================================== */
/*  Модели и константы                                                 */
/* ================================================================== */

/** Комната совместного просмотра. Бэкенда нет — всё живёт в браузере. */
interface WatchRoom {
  /** 6-символьный код комнаты — он же значение `?room=` */
  code: string;
  /** Название комнаты (что смотрим и с кем) */
  title: string;
  /** Название тайтла */
  anime: string;
  /** Постер тайтла из каталога AniLiberty (необязательно) */
  poster?: string;
  /** Алиас тайтла в AniLiberty — по нему плеер комнаты грузит серии */
  alias?: string;
  /** Озвучка */
  dub: string;
  /** Доступ: открытая (видна в списке) или только по ссылке */
  access: "open" | "link";
  /** Сколько зрителей занято */
  viewers: number;
  /** Вместимость комнаты */
  limit: number;
  /** Какая серия сейчас идёт */
  episode: number;
  /** Когда создана (мс) */
  createdAt: number;
  /** Комната создана этим браузером */
  owner?: boolean;
}

/** Свои комнаты в localStorage */
const ROOMS_KEY = "ag:wt:rooms";
/** Сколько своих комнат держим в хранилище */
const ROOMS_LIMIT = 12;
/** Вместимость по типу доступа */
const LIMITS: Record<WatchRoom["access"], number> = { open: 12, link: 8 };

/** Типовые озвучки на выбор */
const DUBS = ["AniLibria", "AniDUB", "Studio Band", "Шедевры"] as const;

/** Варианты доступа к комнате */
const ACCESS: { value: WatchRoom["access"]; label: string; hint: string }[] = [
  { value: "open", label: "Открытая", hint: "видна в общем списке" },
  { value: "link", label: "По ссылке", hint: "только по приглашению" },
];

/**
 * Публичные демо-комнаты — статичный массив: сервера нет, «онлайн»
 * симулируется на клиенте, постеры рисуются заглушкой Poster.
 */
const DEMO_ROOMS: WatchRoom[] = [
  {
    code: "K7QP2X",
    title: "Боевички на вечер",
    anime: "Магическая битва",
    alias: "jujutsu-kaisen",
    dub: "AniLibria",
    access: "open",
    viewers: 6,
    limit: 12,
    episode: 14,
    createdAt: 0,
  },
  {
    code: "M3RT9A",
    title: "Рерайт по пятницам",
    anime: "Рерайт",
    alias: "rewrite",
    dub: "AniDUB",
    access: "link",
    viewers: 4,
    limit: 8,
    episode: 9,
    createdAt: 0,
  },
  {
    code: "VZ8N4E",
    title: "Ночная смена",
    anime: "Поднятие уровня в одиночку",
    alias: "ore-dake-level-up-na-ken",
    dub: "Studio Band",
    access: "open",
    viewers: 9,
    limit: 12,
    episode: 12,
    createdAt: 0,
  },
  {
    code: "LQ5W7B",
    title: "Онгоинги-марафон",
    anime: "Дандадан",
    alias: "dandadan",
    dub: "Шедевры",
    access: "open",
    viewers: 11,
    limit: 12,
    episode: 7,
    createdAt: 0,
  },
];

/** Статистика героя: стартовые значения, дальше — лёгкий «живой» дрейф */
const BASE_STATS = { rooms: 148, viewers: 3274 };

/** Алфавит кода комнаты — без похожих символов (0/O, 1/I) */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/* ------------------------------ Утилиты ----------------------------- */

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/** Случайное целое в диапазоне — вызывается только из обработчиков/таймеров */
const drift = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/** Генерация 6-символьного кода комнаты (в обработчике клика, не в рендере) */
function makeCode(): string {
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/** Строка вида `12-я серия` */
const episodeLabel = (n: number) => `${n}-я серия`;

/* --------------------------- Локальный стор ------------------------- */

/** Проверка одной записи из localStorage перед тем, как дать ей тип */
function isRoom(value: unknown): value is WatchRoom {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.code === "string" &&
    typeof r.title === "string" &&
    typeof r.anime === "string" &&
    typeof r.dub === "string" &&
    (r.access === "open" || r.access === "link") &&
    typeof r.viewers === "number" &&
    typeof r.limit === "number" &&
    typeof r.episode === "number" &&
    typeof r.createdAt === "number"
  );
}

function parseRooms(raw: string): WatchRoom[] | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return null;
    return data.filter(isRoom).slice(0, ROOMS_LIMIT);
  } catch {
    return null;
  }
}

/**
 * Стор комнат: сервер всегда отдаёт `[]`, поэтому гидратация совпадает
 * с первым клиентским рендером (см. `lib/store.ts`).
 */
const roomsStore = createLocalStore<WatchRoom[]>(ROOMS_KEY, [], parseRooms);

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
const LABEL = "mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-muted";

/** Поле ввода в стиле SearchBox (высота задаётся отдельно: h-11 / h-10) */
const FIELD =
  "w-full rounded-xl border border-line bg-white/6 px-3 text-sm text-white outline-none transition placeholder:text-muted/80 focus:border-accent/60 focus:bg-white/10 focus:shadow-[0_0_0_4px_rgba(31,123,255,.14)]";

/** Компактный бейдж-пилюля */
const CHIP =
  "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-black uppercase tracking-wide ring-1";

/* ================================================================== */
/*  Герой: живая статистика + кнопки                                   */
/* ================================================================== */

/**
 * Счётчики и CTA героя. Первый рендер одинаков на сервере и клиенте —
 * дрейф чисел стартует только в эффекте (иначе рассинхрон гидратации).
 */
export function WatchTogetherHero() {
  const [stats, setStats] = useState(BASE_STATS);

  // Лёгкий «живой» дрейф: раз в 4 с подкручиваем числа в разумных пределах
  useEffect(() => {
    const timer = window.setInterval(() => {
      setStats((prev) => ({
        rooms: clamp(prev.rooms + drift(-2, 3), 96, 320),
        viewers: clamp(prev.viewers + drift(-45, 70), 1800, 6400),
      }));
    }, 4200);
    return () => window.clearInterval(timer);
  }, []);

  /** Кнопка «Создать комнату»: прокрутка к форме + фокус на первом поле */
  const openForm = () => {
    document.getElementById("create-room")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(
      () => document.getElementById("wt-room-name")?.focus({ preventScroll: true }),
      520,
    );
  };

  return (
    <div className="mt-7 flex flex-col items-center gap-6">
      {/* Счётчики */}
      <dl className="flex flex-wrap items-stretch justify-center gap-3">
        <div className="min-w-[152px] rounded-2xl border border-line bg-card/70 px-5 py-3 text-left">
          <dt className="text-[11px] font-black uppercase tracking-[0.14em] text-muted">
            Активных комнат
          </dt>
          <dd className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white sm:text-3xl">{stats.rooms}</span>
            <span className="text-[11px] font-black uppercase tracking-wide text-mint">live</span>
          </dd>
        </div>

        <div className="min-w-[152px] rounded-2xl border border-line bg-card/70 px-5 py-3 text-left">
          <dt className="text-[11px] font-black uppercase tracking-[0.14em] text-muted">
            Зрителей сейчас
          </dt>
          <dd className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white sm:text-3xl">
              {stats.viewers.toLocaleString("ru-RU")}
            </span>
            <span className="text-[11px] font-black uppercase tracking-wide text-accent-2">
              онлайн
            </span>
          </dd>
        </div>
      </dl>

      {/* CTA */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={openForm}
          className="btn-primary rounded-xl px-6 py-3 text-sm font-black text-white"
        >
          Создать комнату
        </button>
        <a
          href="#how-it-works"
          className="btn-ghost inline-flex rounded-xl border border-line bg-white/6 px-6 py-3 text-sm font-bold text-white/85 hover:border-accent/40 hover:text-white"
        >
          Как это работает
        </a>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Основная интерактивная часть страницы                              */
/* ================================================================== */

export function WatchTogetherView() {
  const searchParams = useSearchParams();
  /** Код из приглашения `?room=XXXXXX` */
  const inviteCode = (searchParams.get("room") ?? "").trim().toUpperCase();

  /** Свои комнаты из localStorage (на сервере — всегда пусто) */
  const myRooms = roomsStore.useStore();

  /* --------------------------- Форма ------------------------------- */
  const [name, setName] = useState("");
  const [dub, setDub] = useState<string>(DUBS[0]);
  const [access, setAccess] = useState<WatchRoom["access"]>("link");
  const [anime, setAnime] = useState<AniSearchCard | null>(null);
  const [error, setError] = useState("");

  /* --------------------------- Поиск ------------------------------- */
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AniSearchCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdown, setDropdown] = useState(false);
  const [cursor, setCursor] = useState(-1);

  /* ------------------------ Результаты ----------------------------- */
  const [created, setCreated] = useState<{ room: WatchRoom; path: string } | null>(null);
  const [joined, setJoined] = useState<WatchRoom | null>(null);
  const [copiedAt, setCopiedAt] = useState(0);

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

  /** Создание комнаты: код, ссылка, запись в localStorage */
  function createRoom(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!anime) {
      setError("Выберите аниме из поиска — по нему поймут, что смотрим.");
      document.getElementById("wt-anime")?.focus();
      return;
    }

    const code = makeCode();
    const room: WatchRoom = {
      code,
      title: name.trim() || `Смотрим «${anime.title}»`,
      anime: anime.title,
      poster: anime.poster,
      alias: anime.alias,
      dub,
      access,
      viewers: 1,
      limit: LIMITS[access],
      episode: 1,
      createdAt: Date.now(),
      owner: true,
    };

    setError("");
    setCreated({ room, path: `/watch-together?room=${code}` });
    roomsStore.update((list) => [room, ...list.filter((r) => r.code !== code)].slice(0, ROOMS_LIMIT));

    window.setTimeout(
      () => document.getElementById("wt-created")?.scrollIntoView({ behavior: "smooth", block: "center" }),
      90,
    );
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

  /** Вход в комнату (симуляция без бэкенда) + прокрутка к панели */
  function joinRoom(room: WatchRoom) {
    setJoined({ ...room, viewers: Math.min(room.limit, room.viewers + (room.owner ? 0 : 1)) });
    window.setTimeout(
      () => document.getElementById("wt-room-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      90,
    );
  }

  /* --------------------------- Производные -------------------------- */

  const q = query.trim();
  const showDropdown = dropdown && q.length >= 2;
  const invited =
    myRooms.find((r) => r.code === inviteCode) ?? DEMO_ROOMS.find((r) => r.code === inviteCode);
  /** Комната по коду: своя → демо-комната → «заглушка» для чужого кода */
  const inviteRoom: WatchRoom = invited ?? {
    code: inviteCode,
    title: `Комната ${inviteCode}`,
    anime: "Тайтл не определён",
    dub: "—",
    access: "link",
    viewers: 1,
    limit: LIMITS.link,
    episode: 1,
    createdAt: 0,
  };
  const allRooms = [...myRooms, ...DEMO_ROOMS];

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
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {invited
                  ? `«${invited.title}» · ${invited.anime} · ${invited.viewers} из ${invited.limit} мест занято`
                  : "Комнату не нашли в этом браузере — возможно, ссылка пришла с другого устройства."}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted/85">
                Вход симулируется без бэкенда: комната откроется только в этом браузере,
                история хранится в localStorage.
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-2">
              <button
                type="button"
                onClick={() => joinRoom(inviteRoom)}
                className="btn-primary rounded-xl px-5 py-3 text-sm font-black text-white"
                aria-label={`Войти в комнату ${inviteCode}`}
              >
                Войти в комнату
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
      <section
        id="create-room"
        aria-label="Создание комнаты"
        className="relative scroll-mt-24 rounded-3xl border border-line bg-card/70 p-5 sm:p-6"
      >
        {/* Мягкое свечение в углу (без overflow-hidden — не режем выпадашку) */}
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent/14 blur-3xl"
          aria-hidden
        />

        <div className="relative">
          <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
            Создать комнату
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
            Название, тайтл, озвучка и доступ — код на шесть символов сгенерируется сразу после
            создания.
          </p>

          <form onSubmit={createRoom} className="mt-5 grid gap-4 sm:grid-cols-2">
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
                className={`h-11 ${FIELD}`}
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
                  className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-line bg-white/6 pr-9 pl-3 text-sm text-white outline-none transition focus:border-accent/60 focus:bg-white/10 focus:shadow-[0_0_0_4px_rgba(31,123,255,.14)]"
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
                <div className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white/6 px-3 transition focus-within:border-accent/60 focus-within:bg-white/10 focus-within:shadow-[0_0_0_4px_rgba(31,123,255,.14)]">
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
                      className={`min-w-[170px] flex-1 rounded-xl border px-4 py-2.5 text-left transition ${
                        active
                          ? "border-accent/60 bg-accent/15 text-white"
                          : "border-line bg-white/5 text-muted hover:border-accent/35 hover:text-white"
                      }`}
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
              <p
                role="alert"
                className="rounded-xl border border-gold/35 bg-gold/10 px-4 py-3 text-sm font-semibold text-gold sm:col-span-2"
              >
                {error}
              </p>
            )}

            {/* Отправка */}
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <button
                type="submit"
                className="btn-primary rounded-xl px-6 py-3 text-sm font-black text-white"
              >
                Создать комнату
              </button>
              <span className="text-xs leading-relaxed text-muted">
                Комната сохраняется только в этом браузере — ключ{" "}
                <code className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-white/80">
                  {ROOMS_KEY}
                </code>
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
            <button
              type="button"
              onClick={() => copyLink(created.path)}
              className="btn-primary rounded-xl px-5 py-2.5 text-sm font-black text-white"
            >
              {copiedAt ? "Скопировано ✓" : "Скопировать ссылку"}
            </button>
            <button
              type="button"
              onClick={() => joinRoom(created.room)}
              className="btn-ghost rounded-xl border border-line bg-white/6 px-5 py-2.5 text-sm font-bold text-white hover:border-accent/40"
            >
              Присоединиться
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
            Комната записана в localStorage (<code className="font-mono">{ROOMS_KEY}</code>) и уже
            видна в списке ниже.
          </p>
        </section>
      )}

      {/* ------------------------- Панель комнаты ---------------------- */}
      {/* key по коду: при входе в другую комнату состояние плеера/чата сбрасывается */}
      {joined && <RoomPanel key={joined.code} room={joined} onLeave={() => setJoined(null)} />}

      {/* ------------------------ Список комнат ------------------------ */}
      <section id="rooms" aria-label="Активные комнаты" className="scroll-mt-24">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="h-7 w-1.5 shrink-0 rounded-full bg-accent-2" aria-hidden />
            <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">Активные комнаты</h2>
          </div>
          <span className={`${CHIP} bg-white/8 text-muted ring-white/15`}>
            {allRooms.length} комнат
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {allRooms.map((room) => (
            <RoomCard key={room.code} room={room} onJoin={() => joinRoom(room)} />
          ))}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-muted">
          Публичные комнаты — демо-список, но плеер в них настоящий (каталог AniLiberty); свои
          создаются здесь и хранятся только в этом браузере.
        </p>
      </section>
    </div>
  );
}

/* ================================================================== */
/*  Карточка комнаты                                                   */
/* ================================================================== */

function RoomCard({ room, onJoin }: { room: WatchRoom; onJoin: () => void }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-card/70 transition hover:-translate-y-1 hover:border-accent/40 hover:shadow-[0_18px_40px_-24px_rgba(31,123,255,0.9)]">
      {/* Обложка / плейсхолдер */}
      <div className="relative aspect-video overflow-hidden bg-elevated">
        <Poster
          src={room.poster}
          alt=""
          title={room.anime}
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-card via-card/25 to-transparent"
          aria-hidden
        />

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-accent/85 px-2 py-1 text-[11px] font-black text-white shadow-[0_8px_20px_-12px_rgba(31,123,255,1)]">
            идёт {episodeLabel(room.episode)}
          </span>
        </div>

        <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-ink/85 px-2 py-1 text-[11px] font-black text-mint ring-1 ring-mint/35">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" aria-hidden />
          в эфире
        </span>

        <div className="absolute inset-x-3 bottom-2 flex items-center justify-between gap-2 text-[11px] font-bold text-white/90">
          <span className="truncate">{room.dub}</span>
          <span className="shrink-0">
            {room.viewers}/{room.limit} зрителей
          </span>
        </div>
      </div>

      {/* Тело карточки */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-black text-white">{room.title}</h3>
          <p className="mt-1 truncate text-sm text-muted">{room.anime}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`${CHIP} bg-white/8 text-muted ring-white/15`}>
            {room.access === "open" ? "Открытая" : "По ссылке"}
          </span>
          <span className={`${CHIP} bg-white/6 text-muted ring-white/12`}>{room.code}</span>
          {room.owner && (
            <span className={`${CHIP} bg-mint/12 text-mint ring-mint/35`}>ваша</span>
          )}
        </div>

        <button
          type="button"
          onClick={onJoin}
          aria-label={`Присоединиться к комнате «${room.title}»`}
          className="btn-primary mt-auto w-full rounded-xl px-4 py-2.5 text-sm font-black text-white"
        >
          Присоединиться
        </button>
      </div>
    </article>
  );
}

/* ================================================================== */
/*  Панель комнаты: симуляция синхронного плеера и чата                */
/* ================================================================== */

interface ChatMsg {
  id: string;
  author: string;
  text: string;
  self?: boolean;
}

/** Стартовые сообщения комнатного чата */
const SEED_MESSAGES: ChatMsg[] = [
  { id: "seed-1", author: "Ведущий", text: "Комната открыта, плеер синхронизирован для всех." },
  { id: "seed-2", author: "Юки", text: "Я тут, включаю сабы 👀" },
];

/** Ответы «зрителей» после ваших сообщений */
const REPLIES: ChatMsg[] = [
  { id: "reply-1", author: "Юки", text: "Согласна, этот кадр — топ 🔥" },
  { id: "reply-2", author: "Кен", text: "Не спойлерь, я ещё не смотрел!" },
  { id: "reply-3", author: "Ами", text: "Общая пауза работает — спасибо, что подождали 🙌" },
];

function RoomPanel({ room, onLeave }: { room: WatchRoom; onLeave: () => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>(SEED_MESSAGES);
  const [draft, setDraft] = useState("");
  const [replyNonce, setReplyNonce] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  // Ответ зрителя приходит через 1.5 с после вашего сообщения
  useEffect(() => {
    if (!replyNonce) return;
    const timer = window.setTimeout(() => {
      setMessages((prev) => [...prev, REPLIES[(replyNonce - 1) % REPLIES.length]]);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [replyNonce]);

  // Чат прибивается к нижнему краю при новом сообщении
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const sendMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { id: `self-${prev.length}`, author: "Вы", text, self: true }]);
    setDraft("");
    setReplyNonce((n) => n + 1);
  };

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

        <button
          type="button"
          onClick={onLeave}
          className="btn-ghost shrink-0 rounded-xl border border-line bg-white/6 px-4 py-2 text-xs font-bold text-muted hover:text-white"
        >
          Выйти
        </button>
      </div>

      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ---------------------------- Плеер --------------------------- */}
        <div>
          <RoomPlayer
            roomCode={room.code}
            title={room.anime}
            poster={room.poster}
            alias={room.alias}
            startEpisode={room.episode}
            viewers={room.viewers}
            limit={room.limit}
          />
        </div>

        {/* ----------------------------- Чат ---------------------------- */}
        <div className="flex min-h-[280px] flex-col rounded-2xl border border-line bg-ink/40 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">
            Чат комнаты
          </p>

          <ul
            ref={listRef}
            className="mt-2 max-h-64 min-h-[140px] flex-1 space-y-2 overflow-y-auto pr-1"
          >
            {messages.map((m, i) => (
              <li
                key={`${i}-${m.author}`}
                className={`rounded-xl px-3 py-2 text-sm ${
                  m.self ? "ml-6 bg-accent/15 text-white" : "mr-6 bg-white/6 text-white/90"
                }`}
              >
                <span
                  className={`block text-[11px] font-black ${m.self ? "text-accent-2" : "text-gold"}`}
                >
                  {m.author}
                </span>
                <span className="mt-0.5 block leading-snug break-words">{m.text}</span>
              </li>
            ))}
          </ul>

          <form onSubmit={sendMessage} className="mt-3 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={200}
              placeholder="Сообщение…"
              aria-label="Сообщение в чат комнаты"
              className={`h-10 ${FIELD}`}
            />
            <button
              type="submit"
              aria-label="Отправить сообщение"
              className="btn-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
            >
              <Icon d={PATHS.arrow} className="h-4 w-4" sw={2.2} />
            </button>
          </form>
        </div>
      </div>

      <p className="border-t border-line px-4 py-3 text-[11px] leading-relaxed text-muted sm:px-5">
        Плеер настоящий — серии идут из каталога AniLiberty (HLS), а пауза, перемотка и переходы по
        сериям синхронизируются между вкладками этого браузера. Бэкенда нет: с чужого устройства
        комната не откроется.
      </p>
    </section>
  );
}
