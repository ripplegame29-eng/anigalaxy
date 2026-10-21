"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type Hls from "hls.js";
import type { AniSearchCard, AniTitleDetail } from "@/lib/anilibria";
import { FREE_HQ_EPISODES, hqFreeForEpisode, usePremium } from "@/lib/premium";

/**
 * Альтернативный плеер блока просмотра — каталог AniLiberty.
 *
 * Основной плеер страницы — iframe Kodik (качество уступает: плеер чужого
 * домена). Здесь тотий тайтл подбираем поиском по AniLiberty (точное
 * название → совпадение года → первый результат) и играем HLS (m3u8)
 * через hls.js с качеством до 1080p. Управление — собственная панель
 * в духе стримингов: постер-оверлей с «Продолжить…», верхняя плашка
 * с названием, прогресс/звук/время/качество/скорость/настройки/PiP/фулскрин.
 *
 * Схема подключения — как в RoomPlayer: сначала MSE/hls.js (Chrome
 * врёт про нативный m3u8 и падает с SRC_NOT_SUPPORTED), нативный путь —
 * только фоллбэк для старых Safari без MSE.
 */

/** Реальные потоки, которые отдаёт AniLiberty */
type StreamQuality = "480" | "720" | "1080";

/**
 * Качества выбора (список как в референсе): авто, цели апскейла Anime4K
 * и потоки AniLiberty. «1080» доступно всегда — без потока апскейлится
 * с меньшей силой.
 *
 * «2160» и «1440» — витрина подписки: это цели апскейла лучшего потока,
 * шейдерный проход Anime4K реально грузит GPU и батарею, поэтому всю серию
 * выдавать его всем было бы нечестно. Первые FREE_HQ_EPISODES серий он
 * открыт всем — посмотреть, что покупается, можно без подписки; дальше
 * пункт закрыт и вместо переключения качества открывает окно с предложением.
 */
const QUALITIES = ["auto", "2160", "1440", "1080", "720", "480", "360"] as const;
type Quality = (typeof QUALITIES)[number];


/** 2K/4K открыты всем: замок по подписке снят по решению владельца сайта */
const qualityNeedsPremium_ = (...args: unknown[]): boolean => args.length < 0;
const SHOW_HQ_NOTE = false;

/** Длина опенинга для кнопки «Пропустить» (сек) */
const OP_LEN = 85;
/** Ключ «где у этого тайтла начинается опенинг» — запоминается по первому пропуску */
const OP_KEY = "ag:op";
const GLOW_KEY = "ag:glow";

function readNum(key: string): number | null {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/** Скорости воспроизведения (цикл на чипе скорости) */
const SPEEDS = [0.5, 1, 1.25, 1.5, 2];

/** localStorage с позициями просмотра: { [titleId]: { e5: секунды } } */
const POS_KEY = "ag:altpos";

/** Компактная плашка в оверлеях */
const CHIP =
  "inline-flex items-center gap-1.5 rounded-lg bg-black/55 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white ring-1 ring-white/15 backdrop-blur";

/** Кнопка-чип в нижней панели управления (крупная, как в референсе) */
const CBAR_CHIP =
  "rounded-full bg-white/10 px-3 py-1.5 text-xs font-black sm:px-4 sm:py-2 text-white ring-1 ring-white/15 transition hover:bg-white/18";

/** Иконочная кнопка в нижней панели управления (крупная, как в референсе) */
const CBAR_BTN =
  "grid h-9 w-9 place-items-center rounded-full text-white ring-1 ring-transparent sm:h-11 sm:w-11 transition hover:bg-white/12";

/** Тонкие SVG-иконки: stroke currentColor, как во всём интерфейсе */
const PATHS: Record<string, string[]> = {
  play: ["M8 5.5v13l11-6.5z"],
  list: ["M4 6h16", "M4 12h16", "M4 18h10"],
  voices: ["M4 5h9", "M8 3v2", "M6 5c0 4 3 7 7 8", "M12 5c0 3-2 6-6 8", "m13 20 4-9 4 9", "M14.5 17h5"],
  close: ["M6 6l12 12", "M18 6 6 18"],
  pause: ["M9 5v14", "M15 5v14"],
  volume: ["M11 5 6 9H3v6h3l5 4V5z", "M15.5 8.5a5 5 0 0 1 0 7"],
  volumeOff: ["M11 5 6 9H3v6h3l5 4V5z", "m16.5 9.5 5 5", "m21.5 9.5-5 5"],
  gear: [
    "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  ],
  fill: ["M4 9V4h5", "M20 9V4h-5", "M4 15v5h5", "M20 15v5h-5"],
  pip: ["M3 5h18v14H3z", "M12 12h8v6h-8z"],
  expand: [
    "M8 3H5a2 2 0 0 0-2 2v3",
    "M21 8V5a2 2 0 0 0-2-2h-3",
    "M3 16v3a2 2 0 0 0 2 2h3",
    "M16 21h3a2 2 0 0 0 2-2v-3",
  ],
  compress: [
    "M8 3v3a2 2 0 0 1-2 2H3",
    "M21 8h-3a2 2 0 0 1-2-2V3",
    "M3 16h3a2 2 0 0 1 2 2v3",
    "M16 21v-3a2 2 0 0 1 2-2h3",
  ],
  chevron: ["m9 6 6 6-6 6"],
  back: ["m12 19-7-7 7-7", "M19 12H5"],
  check: ["m5 13 4 4L19 7"],
  back10: ["M3 12a9 9 0 1 0 3-6.7", "M3 4v5h5"],
  fwd10: ["M21 12a9 9 0 1 1-3-6.7", "M21 4v5h-5"],
  next: ["M6 5l9 7-9 7z", "M19 5v14"],
  skip: ["M5 5l8 7-8 7z", "M13 5l8 7-8 7z"],
  bookmark: ["M6 3h12v18l-6-4-6 4z"],
  glow: ["M12 3v2", "M12 19v2", "M3 12h2", "M19 12h2", "M5.6 5.6 7 7", "M17 17l1.4 1.4", "M5.6 18.4 7 17", "M17 7l1.4-1.4", "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"],
};

function Icon({ d, className = "h-5 w-5" }: { d: string[]; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
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

/** Время в MM:SS (или H:MM:SS для длинных фильмов) */
function fmt(sec: number): string {
  const total = Number.isFinite(sec) && sec > 0 ? sec : 0;
  const s = Math.floor(total % 60);
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

/** Нормализация названия: регистр, кавычки и знаки не мешают сравнению */
function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[«»"'`.?:!,\-–—…]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Лучшее совпадение из выдачи: точное название → год → первый результат */
function pickBest(list: AniSearchCard[], names: string[], year?: number): AniSearchCard | null {
  const wanted = names.map(norm).filter(Boolean);
  const exact = list.find(
    (card) =>
      wanted.includes(norm(card.title)) ||
      (card.titleOrig ? wanted.includes(norm(card.titleOrig)) : false),
  );
  if (exact) return exact;
  if (year) {
    const sameYear = list.find((card) => card.year === year);
    if (sameYear) return sameYear;
  }
  return list[0] ?? null;
}

/** Сохранить позицию серии (приватный режим — молча пропускаем) */
function savePos(titleId: string, episode: number, sec: number): void {
  if (!titleId || !Number.isFinite(sec) || sec < 5) return;
  try {
    const raw = window.localStorage.getItem(POS_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, Record<string, number>>) : {};
    const per = (map[titleId] = map[titleId] ?? {});
    per[`e${episode}`] = Math.floor(sec);
    window.localStorage.setItem(POS_KEY, JSON.stringify(map));
  } catch {
    /* недоступно — просто без продолжения */
  }
}

/** Прочитанная позиция серии (0, если нет) */
function readPos(titleId: string, episode: number): number {
  if (!titleId) return 0;
  try {
    const raw = window.localStorage.getItem(POS_KEY);
    if (!raw) return 0;
    const map = JSON.parse(raw) as Record<string, Record<string, number>>;
    return map[titleId]?.[`e${episode}`] ?? 0;
  } catch {
    return 0;
  }
}

/** Перетаскиваемая полоса (прогресс/звук): role=slider + клавиатура */
function DragBar({
  ratio,
  onPick,
  onStep,
  label,
  valueText,
  className = "",
  marks,
  hintAt,
  pins,
}: {
  /** Заполнение 0..1 */
  ratio: number;
  onPick: (ratio: number) => void;
  /** Шаг клавишами ←/→ (необязательно) */
  onStep?: (dir: -1 | 1) => void;
  label: string;
  valueText: string;
  className?: string;
  /** Отмеченные участки (опенинг/эндинг) в долях 0..1 */
  marks?: { a: number; b: number; label: string }[];
  /** Подпись времени под курсором: «03:20 (Опенинг)» */
  hintAt?: (ratio: number) => string;
  /** Закладки в долях 0..1 */
  pins?: number[];
}) {
  const activeRef = useRef(false);
  const [hover, setHover] = useState<number | null>(null);
  const pct = Math.min(100, Math.max(0, ratio * 100));
  const pick = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onPick(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
  };
  return (
    <div
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-valuetext={valueText}
      tabIndex={0}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        activeRef.current = true;
        pick(e);
      }}
      onPointerMove={(e) => {
        if (activeRef.current) pick(e);
        if (hintAt) {
          const rect = e.currentTarget.getBoundingClientRect();
          setHover(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
        }
      }}
      onPointerLeave={() => setHover(null)}
      onPointerUp={(e) => {
        activeRef.current = false;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      }}
      onPointerCancel={() => {
        activeRef.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          onStep?.(-1);
        } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          onStep?.(1);
        }
      }}
      className={`group/bar relative cursor-pointer touch-none ${className}`}
    >
      <div className="h-full w-full rounded-full bg-white/25" />
      {marks?.map((m) => (
        <div
          key={m.label}
          className="absolute inset-y-0 rounded-sm bg-amber-400/80"
          style={{ left: `${m.a * 100}%`, width: `${Math.max(0, m.b - m.a) * 100}%` }}
        />
      ))}
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-white"
        style={{ width: `${pct}%` }}
      />
      <div
        className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.18)] transition-transform group-hover/bar:scale-125"
        style={{ left: `${pct}%` }}
      />
      {pins?.map((r) => (
        <span
          key={r}
          aria-hidden
          className="pointer-events-none absolute -top-2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"
          style={{ left: `${r * 100}%` }}
        />
      ))}
      {hover !== null && hintAt && (
        <div
          className="pointer-events-none absolute bottom-full mb-3 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white backdrop-blur"
          style={{ left: `${Math.min(92, Math.max(8, hover * 100))}%` }}
        >
          {hintAt(hover)}
        </div>
      )}
    </div>
  );
}

export function AltPlayer({
  query,
  altQuery,
  year,
  episode,
  titleId,
  backend = "anilibria",
  kodikId,
  season = 1,
  onBack,
  onNextEpisode,
  hasNext: hasNextProp,
  malId,
  nav,
}: {
  /** Название тайтла — запрос поиска AniLiberty и заголовок в оверлее */
  query: string;
  /** Оригинальное название — запасной запрос, если первый пустой */
  altQuery?: string;
  /** Год тайтла — критерий выбора из выдачи поиска */
  year?: number;
  /** Номер серии из боковой панели WatchBox */
  episode: number;
  /** Id тайтла (Kodik) — ключ позиций просмотра в localStorage */
  titleId: string;
  /**
   * Откуда берём поток: «anilibria» — поиск по каталогу AniLiberty,
   * «kodik» — прямые HLS-манифесты Kodik (плеер AniGalaxy). Панель
   * управления, качество, скорости и позиции — одни и те же.
   */
  backend?: "anilibria" | "kodik";
  /** Id тайтла Kodik («serial-3566») — обязателен для backend="kodik" */
  kodikId?: string;
  /** Сезон Kodik; по умолчанию первый */
  season?: number;
  /** «Не нашли» → вернуть исходный плеер */
  onBack: () => void;
  /** Авто-переключение: вызывается, если в AniLiberty есть следующая серия */
  onNextEpisode?: () => void;
  /** Есть ли следующая серия (для режима Kodik, где списка серий у плеера нет) */
  hasNext?: boolean;
  /** MAL-id (= shikimori_id Kodik): по нему берём точные тайм-коды опенинга и эндинга */
  malId?: number;
  /** Сезоны/серии и озвучки: панели «Сезоны и эпизоды» и «Озвучки» прямо в плеере */
  nav?: {
    seasons: { number: number; title?: string; episodes: { number: number }[] }[];
    season: number;
    voices: { id: number; title: string; type: "voice" | "subtitles" }[];
    voiceId: number | null;
    onPickEpisode: (season: number, episode: number) => void;
    onPickVoice: (id: number) => void;
  };
}) {
  const [detail, setDetail] = useState<AniTitleDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "empty">("loading");
  /**
   * Потоки Kodik для текущей серии: качество → HLS-манифест.
   * Наполняется вместо `detail` в режиме backend="kodik" — плеер дальше
   * работает с тем же набором «качество → ссылка», что и у AniLiberty.
   */
  const [kodikLinks, setKodikLinks] = useState<Record<string, string> | null>(null);
  /**
   * Настоящая причина неудачи в режиме Kodik. Раньше всё сводилось к
   * «не нашли», хотя на самом деле могла не ответить сеть или сам Kodik —
   * по такому тексту непонятно, что делать.
   */
  const [kodikError, setKodikError] = useState<string | null>(null);
  /** Что выбрал пользователь. Действующее качество — выведено ниже:
      подписка может кончиться, и тогда цель апскейла сама откатывается
      на «Авто», без записи в состояние из эффекта. */
  const [qualityPref, setQualityPref] = useState<Quality>("auto");
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [mediaNonce, setMediaNonce] = useState(0);
  const [buffering, setBuffering] = useState(false);

  // Собственная панель управления
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [curTime, setCurTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [savedPos, setSavedPos] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRateState] = useState(() => {
    try {
      const v = Number(localStorage.getItem("ag:rate"));
      return SPEEDS.includes(v) ? v : 1;
    } catch {
      return 1;
    }
  });
  /** Скорость запоминается между сериями и визитами */
  const setRate = (v: number) => {
    setRateState(v);
    try {
      localStorage.setItem("ag:rate", String(v));
    } catch {
      /* хранилище недоступно — не страшно */
    }
  };
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Левая панель озвучек и оверлей сезонов/серий */
  const [panel, setPanel] = useState<null | "voices" | "episodes">(null);
  const [openSeason, setOpenSeason] = useState<number | null>(null);
  const [qualityOpen, setQualityOpen] = useState(false);
  /** Окно «2K/4K — по подписке»: замкнуто на текущую серию, не серию из localStorage */
  const [hqModal, setHqModal] = useState(false);
  const [autoNext, setAutoNextState] = useState(() => {
    try {
      return localStorage.getItem("ag:autonext") !== "0";
    } catch {
      return true;
    }
  });
  const setAutoNext = (fn: (v: boolean) => boolean) => {
    setAutoNextState((v) => {
      const next = fn(v);
      try {
        localStorage.setItem("ag:autonext", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  /** Секунды до автоперехода на следующую серию; null — отсчёта нет */
  const [countdown, setCountdown] = useState<number | null>(null);
  /** Закладки на моменты серии (секунды) */
  const bmKey = `ag:bm:${titleId}:${season}:${episode}`;
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [bmLoaded, setBmLoaded] = useState<string>("");
  if (bmLoaded !== bmKey) {
    setBmLoaded(bmKey);
    let list: number[] = [];
    try {
      const raw = JSON.parse(localStorage.getItem(bmKey) ?? "[]");
      if (Array.isArray(raw)) list = raw.filter((n): n is number => typeof n === "number").slice(0, 30);
    } catch {
      /* битые данные — начинаем с пустого списка */
    }
    setBookmarks(list);
    setCountdown(null);
  }
  /** Фоновая подсветка: цвет кадра льётся за рамку плеера */
  const [glow, setGlow] = useState(() => {
    try {
      // На телефоне подсветка по умолчанию выключена: съём кадров и широкая тень
      // каждые 300 мс заметно греют устройство. Включается вручную в настройках.
      const saved = localStorage.getItem(GLOW_KEY);
      if (saved !== null) return saved !== "0";
      return !window.matchMedia("(pointer: coarse)").matches;
    } catch {
      return true;
    }
  });
  /** Вспышка перемотки: сторона, шаг и счётчик для перезапуска анимации */
  /** Тайм-коды пропуска из AniSkip; null — ещё грузятся или для серии их нет */
  const [skips, setSkips] = useState<{ op: [number, number] | null; ed: [number, number] | null; exact?: boolean } | null>(null);
  /** Авто-пропуск опенинга без нажатия (настройка плеера) */
  const [autoSkip, setAutoSkip] = useState(() => {
    try {
      return localStorage.getItem("ag:autoskip") === "1";
    } catch {
      return false;
    }
  });
  const autoSkippedRef = useRef<string | null>(null);
  /** «Смотреть опенинг»: подсказка пропуска скрыта до конца этой серии */
  const [watchOp, setWatchOp] = useState<string | null>(null);
  const epKey = `${titleId}:${season}:${episode}`;
  const [flash, setFlash] = useState<{ side: "l" | "r"; sec: number; n: number } | null>(null);
  const [isFs, setIsFs] = useState(false);
  /** Anime4K не запустился (нет WebGL / canvas заблокирован CORS) */
  const [a4kFailed, setA4kFailed] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  /** Канвас поверх видео: на нём Anime4K рисует апскейленные кадры */
  const a4kCanvasRef = useRef<HTMLCanvasElement>(null);
  /** Растянуть кадр на весь экран (старые 4:3 аниме): обрезает края вместо чёрных полос */
  const [fillScreen, setFillScreen] = useState(false);
  /** Диалог «2K/4K по подписке» — на него ставим фокус при открытии */
  const hqDialogRef = useRef<HTMLDivElement>(null);
  /** true, пока управление ошибками у hls.js (чтобы onError не дублировал) */
  const hlsActiveRef = useRef(false);
  /** Отложенные перемотка/воспроизведение при смене качества */
  const pendingSeekRef = useRef<number | null>(null);
  const pendingPlayRef = useRef(false);
  /** Авто-переключение: продолжить на новой серии, несмотря на паузу финала */
  const forcePlayRef = useRef(false);
  /** Таймер скрытия панели управления */
  const hideTimerRef = useRef<number | null>(null);
  /** Последняя запись позиции в localStorage (троттлинг timeupdate) */
  const lastSaveRef = useRef(0);

  /* ---------------------- Поиск тайтла и серий ---------------------- */
  useEffect(() => {
    let alive = true;

    // Режим Kodik (AniGalaxy): серию мы знаем точно — поиск по каталогу не
    // нужен, сразу берём подписанные HLS-манифесты у /api/kodik/stream.
    if (backend === "kodik") {
      (async () => {
        setKodikLinks(null);
        setKodikError(null);
        try {
          if (!kodikId) {
            if (alive) {
              setKodikError("Не указан id тайтла Kodik");
              setStatus("empty");
            }
            return;
          }
          const query_ =
            `id=${encodeURIComponent(kodikId)}&season=${season}&episode=${episode}`;
          const res = await fetch(`/api/kodik/stream?${query_}`);

          // Сервер отдаёт { error } с кодом 404/502/500 — разбираем его,
          // чтобы показать причину, а не «не нашли»
          const data = (await res.json().catch(() => null)) as {
            links?: Record<string, { Src?: string }>;
            error?: string;
          } | null;

          if (!alive) return;

          if (!res.ok) {
            setKodikError(data?.error ?? `Сервер ответил ${res.status}`);
            setStatus("empty");
            return;
          }

          const links: Record<string, string> = {};
          for (const [q, value] of Object.entries(data?.links ?? {})) {
            if (value?.Src) links[q] = value.Src;
          }
          if (Object.keys(links).length) {
            setKodikLinks(links);
            setStatus("ok");
          } else {
            setKodikError("Kodik не отдал ни одной ссылки на поток");
            setStatus("empty");
          }
        } catch {
          if (alive) {
            setKodikError("Не удалось связаться с сервером");
            setStatus("empty");
          }
        }
      })();
      return () => {
        alive = false;
      };
    }

    const names = [query, altQuery].filter((name): name is string => Boolean(name));
    (async () => {
      try {
        let picked: AniSearchCard | null = null;
        for (const name of names) {
          const res = await fetch(`/api/anilibria/search?q=${encodeURIComponent(name)}&limit=8`);
          if (!res.ok) continue;
          const data = (await res.json()) as { results?: AniSearchCard[] };
          const list = data.results ?? [];
          if (list.length) {
            picked = pickBest(list, names, year);
            break;
          }
        }
        if (!alive) return;
        if (!picked) {
          setStatus("empty");
          return;
        }
        const res = await fetch(`/api/anilibria/title?id=${encodeURIComponent(picked.alias)}`);
        const data = res.ok ? ((await res.json()) as { detail?: AniTitleDetail }) : null;
        if (!alive) return;
        if (data?.detail) {
          setDetail(data.detail);
          setStatus("ok");
        } else {
          setStatus("empty");
        }
      } catch {
        if (alive) setStatus("empty");
      }
    })();
    return () => {
      alive = false;
    };
  }, [backend, kodikId, season, episode, query, altQuery, year]);

  const router = useRouter();
  const { active: premiumActive } = usePremium();

  /** Название источника в статусах: свой плеер Kodik — AniGalaxy, каталог — AniLiberty */
  const brand = backend === "kodik" ? "AniGalaxy" : "AniLiberty";

  /* ------------------------ Текущая серия и src --------------------- */
  // Фильм/серии с другими номерами: для первого эпизода берём первый
  // доступный поток (в AniLiberty нумерация почти всегда 1..N)
  const current =
    detail?.episodes.find((ep) => ep.number === episode) ??
    (episode === 1 ? detail?.episodes[0] : undefined);
  /**
   * Набор «качество → ссылка на поток». В режиме Kodik он приходит
   * готовым из /api/kodik/stream (серия известна заранее, искать нечего),
   * в режиме AniLiberty — из найденной серии каталога.
   */
  const sources: Record<string, string> | undefined =
    backend === "kodik" ? (kodikLinks ?? undefined) : current?.sources;
  /** Лучший поток серии: база для апскейла 4K/2K и фоллбэка без потока */
  const bestSrc = sources?.["1080"] ?? sources?.["720"] ?? sources?.["480"];
  /** Мельчайший поток — цель 360p (апскейл не нужен, уменьшает дисплей) */
  const lowSrc = sources?.["480"] ?? sources?.["720"] ?? sources?.["1080"];
  /** Источник под цель качества: апскейл-цели играют лучший поток */
  const srcFor = (q: Quality): string | undefined => {
    if (q === "auto" || q === "2160" || q === "1440") return bestSrc;
    if (q === "1080") return sources?.["1080"] ?? bestSrc;
    if (q === "720") return sources?.["720"] ?? bestSrc;
    if (q === "480") return sources?.["480"] ?? bestSrc;
    return lowSrc;
  };
  // Действующее качество выведено: подписка может кончиться, а серия
  // уехать за пределы бесплатных — цель сама откатывается на «Авто»,
  // без записи в состояние из эффекта.
  const quality: Quality =
    qualityNeedsPremium_(qualityPref, episode) && !premiumActive ? "auto" : qualityPref;
  const src = srcFor(quality);
  const mediaFailed = Boolean(src) && failedSrc === src;
  /** Фактически играющий поток (апскейл рисуется поверх) */
  const streamQuality: StreamQuality =
    src === sources?.["1080"] ? "1080" : src === sources?.["720"] ? "720" : "480";
  /**
   * Апскейл нужен: 4K/2K — всегда, «1080» — если потока 1080 нет
   * (делаем пункт доступным, но с более слабым пресетом Anime4K)
   */
  const upscaleNeeded =
    Boolean(src) &&
    (quality === "2160" || quality === "1440" || (quality === "1080" && !sources?.["1080"]));
  /** Подпись чипа: «Авто»/«4K»/«2K» или разрешение потока */
  const qualityLabel =
    quality === "auto"
      ? "Авто"
      : quality === "2160"
        ? "4K"
        : quality === "1440"
          ? "2K"
          : `${quality}p`;

  // Смена серии: отложенную позицию качества не тащим, а «играли»
  // ловим в cleanup — он выполняется ДО cleanup hls-эффекта, видео ещё
  // со старым src (после video.load() состояние уже сброшено). Позицию
  // старой серии тут же сохраняем — это точный момент перехода
  useEffect(() => {
    // Нода <video> стабильна между сериями (без key) — копируем на setup,
    // чтобы exhaustive-deps не ругался на ref в cleanup
    const video = videoRef.current;
    return () => {
      if (video && video.currentTime > 5) savePos(titleId, episode, video.currentTime);
      pendingPlayRef.current =
        forcePlayRef.current || Boolean(video && !video.paused && video.currentTime > 0);
      forcePlayRef.current = false;
      pendingSeekRef.current = null;
    };
  }, [episode, titleId]);

  /* -------------------- hls.js: подключение потока ------------------ */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    let cancelled = false;
    let hls: Hls | null = null;
    let networkRetries = 0;
    const nativePlayable = Boolean(video.canPlayType("application/vnd.apple.mpegurl"));

    /** Применить отложенную перемотку/воспроизведение после метаданных */
    const applyPending = () => {
      if (pendingSeekRef.current != null) {
        video.currentTime = pendingSeekRef.current;
        pendingSeekRef.current = null;
      }
      if (pendingPlayRef.current) {
        pendingPlayRef.current = false;
        video.play().catch(() => undefined);
      }
    };
    const onMeta = () => applyPending();
    video.addEventListener("loadedmetadata", onMeta);

    /** Старый Safari/iOS без MSE: m3u8 играем нативно */
    const startNative = () => {
      video.src = src;
    };

    import("hls.js")
      .then(({ default: HlsCtor }) => {
        if (cancelled) return;
        if (!HlsCtor.isSupported()) {
          if (nativePlayable) startNative();
          else setFailedSrc(src);
          return;
        }
        // MSE есть — hls.js демуксирует MPEG-TS сам (нативный путь в
        // Chrome падает с SRC_NOT_SUPPORTED — чёрный экран)
        hls = new HlsCtor({ enableWorker: true, backBufferLength: 60 });
        hlsActiveRef.current = true;
        hls.on(HlsCtor.Events.MANIFEST_PARSED, applyPending);
        hls.on(HlsCtor.Events.ERROR, (_event, data) => {
          if (!data.fatal || cancelled) return;
          if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR && networkRetries < 2) {
            networkRetries += 1;
            hls?.startLoad();
          } else if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR) {
            hls?.recoverMediaError();
          } else {
            setFailedSrc(src);
          }
        });
        hls.loadSource(src);
        hls.attachMedia(video);
      })
      .catch(() => {
        if (cancelled) return;
        if (nativePlayable) startNative();
        else setFailedSrc(src);
      });

    return () => {
      cancelled = true;
      hlsActiveRef.current = false;
      video.removeEventListener("loadedmetadata", onMeta);
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [src, mediaNonce]);

  /* ------------- Anime4K: апскейл кадров <video> на канвасе ----------- */
  // Кадры доступны напрямую (MSE → blob same-origin, canvas не блокируется
  // CORS). Рисует шейдерами в requestVideoFrameCallback — на паузе цикл
  // просто спит. Нативный m3u8 чужого домена даёт SecurityError, цикл
  // умирает, канвас остаётся прозрачным — видно исходное видео.
  useEffect(() => {
    // До первого play кадров нет — апскейл подключаем при старте
    if (!upscaleNeeded || !started) return;
    const video = videoRef.current;
    const canvas = a4kCanvasRef.current;
    if (!video || !canvas) return;
    let cancelled = false;
    let instance: { detachVideo(): void } | null = null;
    import("anime4k.js")
      .then(({ VideoUpscaler, ANIME4KJS_SIMPLE_M_2X, ANIME4KJS_SIMPLE_S_2X }) => {
        if (cancelled) return;
        if (!VideoUpscaler.isSupported()) {
          setA4kFailed(true);
          return;
        }
        // 4K/2K — сильный пресет; «1080» без потока — более слабый
        // (апскейл лёгкий, чтобы не перегружать GPU на 1080-канвасе)
        const preset = quality === "1080" ? ANIME4KJS_SIMPLE_S_2X : ANIME4KJS_SIMPLE_M_2X;
        const up = new VideoUpscaler(preset);
        up.attachVideo(video, canvas);
        up.start();
        instance = up;
        setA4kFailed(false);
      })
      .catch(() => {
        if (!cancelled) setA4kFailed(true);
      });
    return () => {
      cancelled = true;
      // detachVideo() внутри делает stop() и освобождает ресурсы WebGL
      instance?.detachVideo();
    };
  }, [quality, upscaleNeeded, src, started]);

  /* --------------------- Панель: служебные эффекты ------------------ */
  // Вне/внутри фулскрина — иконка кнопки
  useEffect(() => {
    const onChange = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Панели озвучек/серий: закрытие по Escape
  useEffect(() => {
    if (!panel) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setPanel(null);
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [panel]);

  // Настройки/качество: закрытие кликом мимо и по Escape
  useEffect(() => {
    if (!settingsOpen && !qualityOpen) return;
    const close = () => {
      setSettingsOpen(false);
      setQualityOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-alt-settings],[data-alt-quality]")) close();
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [settingsOpen, qualityOpen]);

  /**
   * Окно «2K/4K по подписке»: закрывается по Escape, по клику по подложке
   * и по кнопке. Фокус уводим внутрь окна — иначе он остаётся на пункте
   * качества под подложкой, и с клавиатуры до «Оформить» не дойти.
   */
  useEffect(() => {
    if (!hqModal) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHqModal(false);
    };
    document.addEventListener("keydown", onEsc);
    hqDialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onEsc);
  }, [hqModal]);

  /* ---------------------------- Действия ---------------------------- */
  const clearHideTimer = () => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  /** Показать панель; во время просмотра сама скроется через 3 с */
  const revealUi = () => {
    setUiVisible(true);
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => setUiVisible(false), 3000);
  };

  const play = () => videoRef.current?.play().catch(() => undefined);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => undefined);
    else video.pause();
  };

  const pickQuality = (next: Quality) => {
    setQualityOpen(false);
    if (next === quality) return;
    // Замок: за пределами бесплатных серий цель 2K/4K не включаем, а
    // показываем окно. На первых сериях замка нет — замку там неоткуда взяться.
    if (qualityNeedsPremium_(next, episode) && !premiumActive) {
      setHqModal(true);
      return;
    }
    // Апскейл-цели (4K/2K) играют лучший поток — src обычно не меняется,
    // слой апскейла просто включается/выключается поверх без перезапуска
    const nextSrc = srcFor(next);
    const video = videoRef.current;
    // Позицию держим только при реальной смене потока; если качество
    // недоступно и src не изменится — плеер продолжит без перезапуска
    if (video && nextSrc !== src && video.currentTime > 1) {
      pendingSeekRef.current = video.currentTime;
      pendingPlayRef.current = !video.paused;
    }
    setQualityPref(next);
  };

  const cycleSpeed = () => {
    const i = SPEEDS.indexOf(rate);
    const next = i < 0 ? 1 : (SPEEDS[(i + 1) % SPEEDS.length] ?? 1);
    setRate(next);
    const video = videoRef.current;
    if (video) video.playbackRate = next;
  };

  /** Закладка в текущий момент: повторное нажатие рядом с ней — снимает */
  const toggleBookmark = () => {
    const video = videoRef.current;
    if (!video) return;
    const t = Math.round(video.currentTime);
    const near = bookmarks.find((b) => Math.abs(b - t) <= 3);
    const next = near !== undefined ? bookmarks.filter((b) => b !== near) : [...bookmarks, t].sort((a, b) => a - b).slice(0, 30);
    setBookmarks(next);
    try {
      localStorage.setItem(bmKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const seekTo = (ratio: number) => {
    const video = videoRef.current;
    if (!video || !dur) return;
    video.currentTime = ratio * dur;
    setCurTime(ratio * dur);
  };

  const seekStep = (dir: -1 | 1) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(dur || Infinity, Math.max(0, video.currentTime + dir * 5));
  };

  const setVol = (ratio: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.min(1, Math.max(0, ratio));
    video.muted = false;
    setVolume(video.volume);
    setMuted(false);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const toggleFullscreen = () => {
    const shell = videoRef.current?.closest("#player-shell");
    if (!shell) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void shell.requestFullscreen().catch(() => undefined);
    }
  };

  const togglePip = () => {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) return;
    if (document.pictureInPictureElement) {
      void document.exitPictureInPicture().catch(() => undefined);
    } else {
      void video.requestPictureInPicture().catch(() => undefined);
    }
  };

  const hasNextEp = hasNextProp ?? Boolean(detail?.episodes.some((ep) => ep.number > episode));

  const goNext = () => {
    if (!hasNextEp || !onNextEpisode) return;
    forcePlayRef.current = true;
    setCountdown(null);
    onNextEpisode();
  };
  const goNextRef = useRef(goNext);
  useEffect(() => {
    goNextRef.current = goNext;
  });

  /** Перемотка на шаг с вспышкой-подсказкой на нужной половине экрана */
  const skipBy = (sec: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(dur || Infinity, Math.max(0, video.currentTime + sec));
    setFlash((f) => ({ side: sec < 0 ? "l" : "r", sec: Math.abs(sec), n: (f?.n ?? 0) + 1 }));
  };

  /** Пропуск опенинга: запоминаем, где он начался, чтобы на следующих сериях кнопка вставала точно */
  const skipOpening = () => {
    const video = videoRef.current;
    if (!video) return;
    if (skips?.op) {
      const len = Math.max(1, Math.round(skips.op[1] - video.currentTime));
      video.currentTime = skips.op[1];
      setFlash((f) => ({ side: "r", sec: len, n: (f?.n ?? 0) + 1 }));
      return;
    }
    const start = readNum(`${OP_KEY}:${titleId}`);
    if (start === null && video.currentTime > 1) {
      try {
        localStorage.setItem(`${OP_KEY}:${titleId}`, String(Math.round(video.currentTime)));
      } catch {
        /* хранилище недоступно — не страшно */
      }
    }
    skipBy(OP_LEN);
  };

  /** Пропуск эндинга: следующая серия, а если её нет — в конец */
  const skipEnding = () => {
    if (hasNextEp) goNext();
    else if (videoRef.current && dur) videoRef.current.currentTime = dur;
  };

  const toggleGlow = () => {
    setGlow((v) => {
      try {
        localStorage.setItem(GLOW_KEY, v ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !v;
    });
  };

  /* ---------------------- Тайм-коды опенинга/эндинга ------------------ */
  const durKey = dur > 0 ? Math.round(dur) : 0;
  useEffect(() => {
    /* Ждём длину видео: AniSkip хранит метки отдельно для каждого релиза, и
       нужный выбирается по длине серии — без неё метки могли быть чужими */
    if (!malId || durKey <= 0) return;
    let alive = true;
    fetch(`/api/skip?mal=${malId}&ep=${episode}&len=${durKey}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => alive && setSkips(data && (data.op || data.ed) ? data : null))
      .catch(() => alive && setSkips(null));
    return () => {
      alive = false;
      setSkips(null);
    };
  }, [malId, episode, durKey]);

  /* Авто-пропуск: один раз за серию, как только дошли до начала опенинга */
  useEffect(() => {
    const op = skips?.op;
    /* Авто-пропуск только по меткам нашего релиза: из чужого он мог бы перепрыгнуть не туда */
    if (!autoSkip || !op || !playing || skips?.exact === false) return;
    const key = `${titleId}:${episode}`;
    if (autoSkippedRef.current === key) return;
    if (curTime >= op[0] - 0.5 && curTime < op[1] - 2) {
      autoSkippedRef.current = key;
      const video = videoRef.current;
      if (video) {
        video.currentTime = op[1];
        setFlash((f) => ({ side: "r", sec: Math.round(op[1] - op[0]), n: (f?.n ?? 0) + 1 }));
      }
    }
  }, [autoSkip, skips, playing, curTime, titleId, episode]);

  const toggleAutoSkip = () => {
    setAutoSkip((v) => {
      try {
        localStorage.setItem("ag:autoskip", v ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !v;
    });
  };

  /* ----------------------- Горячие клавиши плеера -------------------- */
  const keysRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
  keysRef.current = (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey || hqModal) return;
    const shell = videoRef.current?.closest("#player-shell");
    if (!shell || !started || !(shell.matches(":hover") || document.fullscreenElement)) return;
    const k = e.key.toLowerCase();
    const act: Record<string, () => void> = {
      " ": toggle,
      k: toggle,
      arrowleft: () => skipBy(-5),
      arrowright: () => skipBy(5),
      j: () => skipBy(-10),
      l: () => skipBy(10),
      m: toggleMute,
      f: toggleFullscreen,
      n: goNext,
      o: skipOpening,
      b: toggleBookmark,
    };
    const fn = act[k];
    if (!fn) return;
    e.preventDefault();
    fn();
    revealUi();
  };
  });
  /* Отсчёт до следующей серии: по секунде, в конце — переход */
  useEffect(() => {
    if (countdown === null) return;
    const id = window.setTimeout(() => {
      if (countdown <= 0) goNextRef.current();
      else setCountdown(countdown - 1);
    }, countdown <= 0 ? 0 : 1000);
    return () => window.clearTimeout(id);
  }, [countdown]);

  useEffect(() => {
    const on = (e: KeyboardEvent) => keysRef.current(e);
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, []);

  /* ------------------ Фоновая подсветка по цвету кадра --------------- */
  useEffect(() => {
    const video = videoRef.current;
    const shell = video?.closest("#player-shell") as HTMLElement | null;
    if (!video || !shell || !glow || !playing) return;
    const cv = document.createElement("canvas");
    cv.width = 16;
    cv.height = 9;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    let rgb = [31, 123, 255];
    const id = window.setInterval(() => {
      try {
        ctx.drawImage(video, 0, 0, 16, 9);
        const px = ctx.getImageData(0, 0, 16, 9).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < px.length; i += 4) {
          r += px[i];
          g += px[i + 1];
          b += px[i + 2];
        }
        const n = px.length / 4;
        // Плавно подтягиваем к новому цвету — без мерцания на смене кадров
        rgb = [r / n, g / n, b / n].map((v, i) => rgb[i] + (v - rgb[i]) * 0.35);
        const [R, G, B] = rgb.map(Math.round);
        shell.style.boxShadow = `0 0 150px 28px rgba(${R},${G},${B},0.42), 0 0 40px 2px rgba(${R},${G},${B},0.25), 0 40px 80px -40px #000`;
      } catch {
        // Кадр «грязный» (поток без CORS) — читать пиксели нельзя, оставляем акцент
        window.clearInterval(id);
        shell.style.boxShadow = "0 0 120px 20px rgba(var(--accent-rgb), 0.22), 0 40px 80px -40px #000";
      }
    }, 300);
    return () => {
      window.clearInterval(id);
    };
  }, [glow, playing, src]);

  /* Выключили подсветку — убираем inline-тень */
  useEffect(() => {
    const shell = videoRef.current?.closest("#player-shell") as HTMLElement | null;
    if (shell && !glow) shell.style.boxShadow = "";
    return () => {
      if (shell) shell.style.boxShadow = "";
    };
  }, [glow]);

  const retryMedia = () => {
    setFailedSrc(null);
    setMediaNonce((n) => n + 1);
  };

  const continueFrom = () => {
    const video = videoRef.current;
    if (!video || !savedPos) return;
    video.currentTime = savedPos;
    video.play().catch(() => undefined);
  };

  const showContinue = savedPos > 30 && (!dur || savedPos < dur * 0.95);
  const mediaReady = status === "ok" && Boolean(src) && !mediaFailed;
  const showTopBar = mediaReady && started && (uiVisible || !playing);

  /* ------------------------------ Визуал ---------------------------- */
  return (
    <>
      <video
        ref={videoRef}
        playsInline
        preload="metadata"
        className={`absolute inset-0 h-full w-full bg-black ${fillScreen ? "object-cover" : "object-contain"}`}
        onPlay={() => {
          setStarted(true);
          setPlaying(true);
          revealUi();
        }}
        onPause={() => {
          setPlaying(false);
          setUiVisible(true);
          clearHideTimer();
          const v = videoRef.current;
          if (v && v.currentTime > 5) savePos(titleId, episode, v.currentTime);
        }}
        onEnded={() => {
          setPlaying(false);
          setUiVisible(true);
          if (autoNext && hasNextEp && onNextEpisode) setCountdown(5);
        }}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (!v) return;
          setCurTime(v.currentTime);
          const now = Date.now();
          if (now - lastSaveRef.current > 5000) {
            lastSaveRef.current = now;
            savePos(titleId, episode, v.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          const v = videoRef.current;
          if (!v) return;
          setDur(Number.isFinite(v.duration) ? v.duration : 0);
          v.playbackRate = rate;
          setSavedPos(readPos(titleId, episode));
        }}
        onVolumeChange={() => {
          const v = videoRef.current;
          if (!v) return;
          setVolume(v.volume);
          setMuted(v.muted);
        }}
        onError={() => {
          // Сбой нативного пути (hls.js свои ошибки показывает сам)
          const video = videoRef.current;
          if (video?.error && !hlsActiveRef.current && src) setFailedSrc(src);
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
      />

      {/* Anime4K: кадры видео апскейлятся шейдерами и рисуются поверх.
          Библиотека сама ставит pointer-events:none; до первого кадра
          канвас прозрачен — видно исходное видео/постер */}
      {upscaleNeeded && src && (
        <canvas
          ref={a4kCanvasRef}
          aria-hidden
          className={`pointer-events-none absolute inset-0 h-full w-full ${fillScreen ? "object-cover" : "object-contain"}`}
        />
      )}

      {/* Клик по кадру: пауза/воспроизведение (пока панели закрыты) */}
      {started && mediaReady && !settingsOpen && !qualityOpen && (
        <button
          type="button"
          aria-label={playing ? "Пауза" : "Воспроизвести"}
          onClick={toggle}
          onPointerMove={revealUi}
          className="absolute inset-0 z-[5] cursor-pointer"
        />
      )}

      {/* Центр: −10 с, пуск/пауза, +10 с — как в референсе */}
      {started && mediaReady && (
        <div className={`absolute left-1/2 top-1/2 z-[8] flex -translate-x-1/2 -translate-y-1/2 items-center gap-12 transition-opacity duration-300 sm:gap-20 ${uiVisible || !playing ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <button type="button" aria-label="Назад на 10 секунд" title="−10 с (J)" onClick={() => skipBy(-10)} className="relative grid h-14 w-14 place-items-center rounded-full text-white/90 transition hover:scale-110 hover:text-white">
            <Icon d={PATHS.back10} className="h-9 w-9" />
            <span className="absolute text-[10px] font-black">10</span>
          </button>
          <button type="button" aria-label={playing ? "Пауза" : "Воспроизвести"} onClick={toggle} className="grid h-16 w-16 place-items-center rounded-full text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] transition hover:scale-110">
            <Icon d={playing ? PATHS.pause : PATHS.play} className="h-11 w-11" />
          </button>
          <button type="button" aria-label="Вперёд на 10 секунд" title="+10 с (L)" onClick={() => skipBy(10)} className="relative grid h-14 w-14 place-items-center rounded-full text-white/90 transition hover:scale-110 hover:text-white">
            <Icon d={PATHS.fwd10} className="h-9 w-9" />
            <span className="absolute text-[10px] font-black">10</span>
          </button>
        </div>
      )}

      {/* Буферизация */}
      {buffering && mediaReady && status === "ok" && (
        <div className="pointer-events-none absolute inset-0 z-[7] grid place-items-center">
          <span className="h-9 w-9 animate-spin-slow rounded-full border-[3px] border-white/20 border-t-accent" />
        </div>
      )}

      {/* ---------------- Верхняя плашка: название по центру ------------ */}
      {showTopBar && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/75 via-black/35 to-transparent px-4 pb-12 pt-4 text-center">
          {isFs && (
            <button type="button" aria-label="Выйти из полноэкранного режима" onClick={toggleFullscreen} className="pointer-events-auto absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full text-white/90 transition hover:bg-white/12 hover:text-white">
              <Icon d={PATHS.close} className="h-6 w-6" />
            </button>
          )}
          <p className="mx-auto max-w-[70%] truncate text-lg font-semibold text-white md:text-xl">{query}</p>
          <p className="mt-2 text-xs font-medium text-white/65">
            {nav ? `${nav.season} сезон, ` : season > 1 ? `${season} сезон, ` : ""}{episode} серия
          </p>
        </div>
      )}

      {/* Вспышка перемотки: двойной тап/клавиши J, L, стрелки */}
      {flash && (
        <div
          key={flash.n}
          aria-hidden
          onAnimationEnd={() => setFlash(null)}
          className={`ag-seekflash pointer-events-none absolute top-1/2 z-[12] grid h-24 w-24 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur ${
            flash.side === "l" ? "left-[14%]" : "right-[14%]"
          }`}
        >
          <div className="text-center">
            <Icon d={flash.side === "l" ? PATHS.back10 : PATHS.fwd10} className="mx-auto h-7 w-7" />
            <span className="text-xs font-black">{flash.side === "l" ? "−" : "+"}{flash.sec} с</span>
          </div>
        </div>
      )}

      {/* Зоны двойного клика: слева −10 с, справа +10 с */}
      {started && mediaReady && (
        <>
          <div className="absolute inset-y-16 left-0 z-[6] w-[30%]" onDoubleClick={() => skipBy(-10)} />
          <div className="absolute inset-y-16 right-0 z-[6] w-[30%]" onDoubleClick={() => skipBy(10)} />
        </>
      )}

      {/* Автопереход: отсчёт с возможностью отмены */}
      {countdown !== null && hasNextEp && (
        <div className="absolute inset-0 z-[24] grid place-items-center bg-black/55 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 text-center text-white">
            <span className="text-sm font-bold text-white/70">Следующая серия через</span>
            <span className="grid h-24 w-24 place-items-center rounded-full border-4 border-white/20 border-t-accent text-5xl font-black tabular-nums">
              {countdown}
            </span>
            <div className="flex gap-3">
              <button type="button" className="ag-skipbtn ag-skipbtn--white" onClick={goNext}>
                Смотреть сейчас
              </button>
              <button type="button" className="ag-skipbtn" onClick={() => setCountdown(null)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Пропустить опенинг / эндинг */}
      {started && mediaReady && dur > 0 && (() => {
        const opStart = readNum(`${OP_KEY}:${titleId}`);
        // Точные метки AniSkip, если они есть; иначе приблизительные окна
        const inOpening = skips?.op
          ? curTime >= skips.op[0] - 1 && curTime < skips.op[1] - 1
          : skips?.ed
            ? false
            : opStart !== null
              ? curTime >= opStart - 2 && curTime <= opStart + 25
              : curTime >= 3 && curTime <= 240;
        const remain = dur - curTime;
        const inEnding = skips?.ed
          ? curTime >= skips.ed[0] - 1 && curTime < dur - 1
          : curTime > dur * 0.8 && remain <= 130;
        if (!inOpening && !inEnding) return null;
        const showOp = inOpening && !inEnding && watchOp !== epKey;
        const showEd = inEnding && watchOp !== `${epKey}:ed`;
        if (!showOp && !showEd) return null;
        return (
          <div className={`absolute right-5 z-[21] flex items-center gap-3 transition-all duration-300 ${uiVisible || !playing ? "bottom-40" : "bottom-8"}`}>
            {showOp && (
              <>
                <button type="button" onClick={skipOpening} title="Пропустить опенинг (O)" className="ag-skipbtn ag-skipbtn--white">
                  <Icon d={PATHS.skip} className="h-4 w-4" />
                  Пропустить
                </button>
                <button type="button" onClick={() => setWatchOp(epKey)} className="ag-skipbtn">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                    <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-6h2zm0-8h-2V7h2z" />
                  </svg>
                  Смотреть опенинг
                </button>
              </>
            )}
            {showEd && (
              <>
                <button
                  type="button"
                  onClick={hasNextEp ? goNext : skipEnding}
                  title="Следующая серия (N)"
                  className="ag-skipbtn ag-skipbtn--white"
                >
                  <Icon d={PATHS.skip} className="h-4 w-4" />
                  {hasNextEp ? "Следующая серия" : "Пропустить"}
                </button>
                <button type="button" onClick={() => setWatchOp(`${epKey}:ed`)} className="ag-skipbtn">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                    <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-6h2zm0-8h-2V7h2z" />
                  </svg>
                  Смотреть эндинг
                </button>
              </>
            )}
          </div>
        );
      })()}

      {/* ------------------ Нижняя панель управления ------------------- */}
      {started && mediaReady && (
        <div
          className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-5 pb-4 pt-16 transition-opacity duration-300 ${
            uiVisible || !playing ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {/* Ряд над прогрессом: звук слева, время по центру, инструменты справа */}
          <div className="mb-3 flex items-center gap-2">
            <div className="group/vol flex flex-1 items-center gap-1">
              <button type="button" aria-label={muted ? "Включить звук" : "Выключить звук"} onClick={toggleMute} className="grid h-10 w-10 place-items-center rounded-full text-white transition hover:bg-white/12">
                <Icon d={muted || volume === 0 ? PATHS.volumeOff : PATHS.volume} className="h-5 w-5" />
              </button>
              <DragBar
                className="hidden h-1.5 w-0 overflow-hidden opacity-0 transition-all duration-200 group-hover/vol:w-24 group-hover/vol:opacity-100 focus-within:w-24 focus-within:opacity-100 sm:block"
                ratio={muted ? 0 : volume}
                onPick={setVol}
                onStep={(dir) => setVol((muted ? 0 : volume) + dir * 0.05)}
                label="Громкость"
                valueText={`${Math.round((muted ? 0 : volume) * 100)}%`}
              />
            </div>

            <span className="rounded-full bg-black/45 px-4 py-1.5 text-xs font-bold tabular-nums text-white ring-1 ring-white/10 backdrop-blur">
              {fmt(curTime)} / {fmt(dur)}
            </span>

            <div className="flex flex-1 items-center justify-end gap-1">
              <button type="button" aria-label="Качество" aria-expanded={qualityOpen} onClick={() => setQualityOpen(true)} className={`${CBAR_CHIP} ${qualityOpen ? "bg-white/18" : ""}`}>
                {quality === "2160" ? <span className="rounded bg-red-600 px-1.5 py-0.5 font-black text-white">4K</span> : qualityLabel}
              </button>
              <button type="button" aria-label="Скорость" onClick={cycleSpeed} className={`${CBAR_CHIP} max-sm:hidden`}>{rate}x</button>
              <button type="button" aria-label="Закладка на этот момент" aria-pressed={bookmarks.some((b) => Math.abs(b - curTime) <= 3)} title="Закладка (B)" onClick={toggleBookmark} className={`${CBAR_BTN} max-sm:hidden`}>
                <Icon d={PATHS.bookmark} className="h-5 w-5" />
              </button>
              <button type="button" aria-label={fillScreen ? "Вернуть исходный формат" : "Растянуть на весь экран"} aria-pressed={fillScreen} title={fillScreen ? "Исходный формат" : "Расширить на весь экран"} onClick={() => setFillScreen((v) => !v)} className={`${CBAR_BTN} ${fillScreen ? "bg-white/18" : ""}`}>
                <Icon d={PATHS.fill} className="h-5 w-5" />
              </button>
              <button type="button" aria-label="Картинка в картинке" onClick={togglePip} className={`${CBAR_BTN} max-sm:hidden`}>
                <Icon d={PATHS.pip} className="h-5 w-5" />
              </button>
              <button type="button" aria-label="Настройки" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((v) => !v)} className={`${CBAR_BTN} ${settingsOpen ? "bg-white/15" : ""}`}>
                <Icon d={PATHS.gear} className="h-5 w-5" />
              </button>
              <button type="button" aria-label={isFs ? "Выйти из полноэкранного режима" : "На весь экран"} onClick={toggleFullscreen} className={CBAR_BTN}>
                <Icon d={isFs ? PATHS.compress : PATHS.expand} className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Прогресс */}
          <DragBar
            className="h-1.5 w-full transition-[height] hover:h-2"
            ratio={dur ? curTime / dur : 0}
            onPick={seekTo}
            onStep={seekStep}
            label="Перемотка"
            valueText={`${fmt(curTime)} из ${fmt(dur)}`}
            pins={dur > 0 ? bookmarks.map((b) => Math.min(1, b / dur)) : undefined}
            marks={
              dur > 0
                ? [
                    ...(skips?.op ? [{ a: skips.op[0] / dur, b: Math.min(1, skips.op[1] / dur), label: "Опенинг" }] : []),
                    ...(skips?.ed ? [{ a: skips.ed[0] / dur, b: Math.min(1, skips.ed[1] / dur), label: "Эндинг" }] : []),
                  ]
                : undefined
            }
            hintAt={(r) => {
              const t = r * dur;
              const inOp = skips?.op && t >= skips.op[0] && t <= skips.op[1];
              const inEd = skips?.ed && t >= skips.ed[0] && t <= skips.ed[1];
              return `${fmt(t)}${inOp ? " (Опенинг)" : inEd ? " (Эндинг)" : ""}`;
            }}
          />

          {/* Ряд под прогрессом: панели слева, следующая серия справа */}
          <div className="mt-3 flex items-center gap-2">
            {nav && (
              <>
                <button type="button" aria-label="Сезоны и эпизоды" aria-expanded={panel === "episodes"} onClick={() => { setOpenSeason(nav.season); setPanel("episodes"); }} className={`${CBAR_CHIP} inline-flex items-center gap-2 max-sm:hidden`}>
                  <Icon d={PATHS.list} className="h-4 w-4" />
                  Сезоны и эпизоды
                </button>
                {nav.voices.length > 1 && (
                  <button type="button" aria-label="Озвучки" aria-expanded={panel === "voices"} onClick={() => setPanel("voices")} className={`${CBAR_CHIP} inline-flex items-center gap-2 max-sm:hidden`}>
                    <Icon d={PATHS.voices} className="h-4 w-4" />
                    Озвучки
                  </button>
                )}
              </>
            )}
            <div className="flex-1" />
            {hasNextEp && (
              <button type="button" aria-label="Следующая серия" title="Следующая серия (N)" onClick={goNext} className="flex items-center gap-3 rounded-xl bg-white/8 px-3 py-1.5 text-left ring-1 ring-white/10 transition hover:bg-white/14">
                <Icon d={PATHS.next} className="h-5 w-5" />
                <span className="grid">
                  <b className="text-xs font-bold text-white">Следующая серия</b>
                  <small className="text-[10px] text-white/60">{nav ? `${nav.season} сезон, ` : ""}{episode + 1} эпизод</small>
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ------------- Озвучки и сезоны/серии (оверлеи плеера) ------------- */}
      {nav && panel === "voices" && (
        <div className="absolute inset-0 z-[45] flex animate-fade-in" role="dialog" aria-label="Озвучки">
          <div className="flex w-[min(20rem,85%)] flex-col gap-1 overflow-y-auto bg-[#0b0a14]/96 p-5 shadow-2xl backdrop-blur-xl">
            <h3 className="mb-3 flex items-center justify-between text-2xl font-black text-white">
              Озвучки
              <button type="button" aria-label="Закрыть" onClick={() => setPanel(null)} className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
                <Icon d={PATHS.close} className="h-4 w-4" />
              </button>
            </h3>
            {nav.voices.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => { setPanel(null); if (v.id !== nav.voiceId) nav.onPickVoice(v.id); }}
                className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition ${v.id === nav.voiceId ? "bg-white/14 text-white" : "text-white/80 hover:bg-white/8"}`}
              >
                <span className="truncate">{v.title}</span>
                {v.type === "subtitles" && <span className="rounded bg-white/12 px-1.5 py-0.5 text-[10px] font-black">СУБ</span>}
              </button>
            ))}
          </div>
          <button type="button" aria-label="Закрыть панель" className="flex-1 cursor-default" onClick={() => setPanel(null)} />
        </div>
      )}

      {nav && panel === "episodes" && (
        <div className="absolute inset-0 z-[45] overflow-y-auto bg-black/88 p-6 backdrop-blur-xl animate-fade-in" role="dialog" aria-label="Сезоны и эпизоды">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-2xl font-black text-white">Сезоны и эпизоды</h3>
            <button type="button" aria-label="Закрыть" onClick={() => setPanel(null)} className="grid h-10 w-10 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white">
              <Icon d={PATHS.close} className="h-5 w-5" />
            </button>
          </div>
          <div className="grid gap-4">
            {nav.seasons.map((s) => {
              const open = openSeason === s.number;
              return (
                <section key={s.number}>
                  <button type="button" aria-expanded={open} onClick={() => setOpenSeason(open ? null : s.number)} className="flex items-center gap-3 text-left text-base font-black text-white">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-white/12">
                      <svg viewBox="0 0 24 24" className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
                    </span>
                    {s.title || `${s.number} сезон`}
                    <span className="text-xs font-bold text-white/50">{s.episodes.length}</span>
                  </button>
                  {open && (
                    <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2.5">
                      {s.episodes.map((e) => {
                        const cur = s.number === nav.season && e.number === episode;
                        return (
                          <button
                            key={e.number}
                            type="button"
                            onClick={() => { setPanel(null); if (!cur) nav.onPickEpisode(s.number, e.number); }}
                            className={`rounded-xl px-3 py-4 text-left text-sm font-black transition ${cur ? "bg-accent/30 text-white ring-2 ring-accent" : "bg-white/8 text-white/85 ring-1 ring-white/10 hover:bg-white/14"}`}
                          >
                            {e.number} серия
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}

      {/* -------------------------- Настройки -------------------------- */}
      {settingsOpen && mediaReady && (
        <div
          data-alt-settings
          className="absolute bottom-28 right-3 z-30 w-60 rounded-2xl border border-line bg-[#0d0d15]/95 p-3.5 shadow-[0_28px_60px_-24px_rgba(0,0,0,1)] backdrop-blur-xl animate-fade-in"
        >
          <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-muted">
            Настройки
          </p>

          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            Скорость
          </p>
          <div className="mb-3.5 flex flex-wrap gap-1.5">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={rate === s}
                onClick={() => {
                  setRate(s);
                  const video = videoRef.current;
                  if (video) video.playbackRate = s;
                }}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-black ring-1 transition ${
                  rate === s
                    ? "bg-accent text-white ring-transparent"
                    : "bg-white/8 text-white/80 ring-white/12 hover:bg-white/14"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {skips?.op && (
            <div className="mb-3 flex items-center justify-between gap-3 border-t border-line pt-3">
              <span className="text-sm font-semibold text-white">Авто-пропуск опенинга</span>
              <button
                type="button"
                role="switch"
                aria-checked={autoSkip}
                aria-label="Автоматически пропускать опенинг"
                onClick={toggleAutoSkip}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${autoSkip ? "bg-accent" : "bg-white/15"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${autoSkip ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
          )}

          <div className="mb-3 flex items-center justify-between gap-3 border-t border-line pt-3">
            <span className="text-sm font-semibold text-white">Подсветка</span>
            <button
              type="button"
              role="switch"
              aria-checked={glow}
              aria-label="Фоновая подсветка плеера"
              onClick={toggleGlow}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${glow ? "bg-accent" : "bg-white/15"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${glow ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <span className="text-sm font-semibold text-white">
              Авто-
              <br />
              переключение
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={autoNext}
              aria-label="Авто-переключение серий"
              onClick={() => setAutoNext((v) => !v)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                autoNext ? "bg-accent" : "bg-white/15"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  autoNext ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* --------------- Выбор качества (список, как в референсе) ------- */}
      {qualityOpen && mediaReady && (
        <div
          data-alt-quality
          className="absolute bottom-28 right-3 z-30 w-64 overflow-hidden rounded-2xl border border-line bg-[#0d0d15]/95 shadow-[0_28px_60px_-24px_rgba(0,0,0,1)] backdrop-blur-xl animate-fade-in"
        >
          <div className="relative flex items-center justify-center px-4 pb-2.5 pt-3.5">
            <button
              type="button"
              aria-label="Назад"
              onClick={() => setQualityOpen(false)}
              className="absolute left-3 grid h-8 w-8 place-items-center rounded-lg text-white transition hover:bg-white/12"
            >
              <Icon d={PATHS.back} className="h-5 w-5" />
            </button>
            <p className="text-base font-black text-white">Качество</p>
          </div>
          <div className="h-0.5 bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />

          {SHOW_HQ_NOTE && (
            <p className="mx-2 mb-1.5 rounded-lg bg-accent-2/10 px-3 py-2 text-[11px] leading-relaxed text-accent-2/90 ring-1 ring-accent-2/25">
              {hqFreeForEpisode(episode) ? (
                <>
                  4K и 2K открыты на первых {FREE_HQ_EPISODES} сериях — это апскейл
                  Anime4K поверх потока 1080p. С {FREE_HQ_EPISODES + 1}-й — по подписке.
                </>
              ) : (
                <>
                  4K и 2K с {FREE_HQ_EPISODES + 1}-й серии — часть Premium: апскейл
                  Anime4K поверх потока 1080p. Первые {FREE_HQ_EPISODES} серии открыты
                  всем.
                </>
              )}
            </p>
          )}
          <div className="p-1.5">
            {QUALITIES.map((q) => {
              const available =
                q === "auto" || q === "1080" || q === "360"
                  ? Boolean(bestSrc)
                  : q === "720" || q === "480"
                    ? Boolean(sources?.[q])
                    : Boolean(bestSrc);
              const selected = quality === q;
              const beta = q === "2160" || q === "1440" || q === "1080";
              /** Замок есть только на платных сериях: кнопку не гасим, а объясняем */
              const locked = qualityNeedsPremium_(q, episode) && !premiumActive;
              return (
                <button
                  key={q}
                  type="button"
                  disabled={!available}
                  aria-pressed={selected}
                  onClick={() => (locked ? setHqModal(true) : pickQuality(q))}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3.5 py-3 text-left transition ${
                    !available
                      ? "cursor-not-allowed text-white/25"
                      : selected
                        ? "bg-accent text-white"
                        : locked
                          ? "text-white/80 hover:bg-white/10"
                          : "text-white/90 hover:bg-white/10"
                  }`}
                >
                  <span className="flex items-center gap-2 text-[15px] font-black">
                    {q === "2160" ? (
                      <>
                        {/* Красная плашка на надписи 4K — как в референсе */}
                        <span className="rounded-md bg-red-600 px-1.5 py-0.5 text-xs font-black uppercase text-white">
                          4K
                        </span>
                        <span className={selected ? "text-white" : "text-white/70"}>
                          (2160p)
                        </span>
                      </>
                    ) : (
                      <span>
                        {q === "auto"
                          ? "Авто"
                          : q === "1440"
                            ? "2K (1440p)"
                            : q === "360"
                              ? "360p"
                              : `${q}p`}
                      </span>
                    )}
                    {beta && available && !selected && (
                      <span className="rounded bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-black uppercase text-black">
                        Beta
                      </span>
                    )}
                  </span>
                  {locked ? (
                    <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent-2/18 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-accent-2 ring-1 ring-accent-2/35">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        aria-hidden
                      >
                        <rect x="5" y="11" width="14" height="9" rx="2" />
                        <path strokeLinecap="round" d="M8 11V8a4 4 0 0 1 8 0v3" />
                      </svg>
                      Premium
                    </span>
                  ) : (
                    selected && <Icon d={PATHS.check} className="h-5 w-5 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------- Окно «2K/4K по подписке» -------------------------
          Всплывает вместо переключения качества, когда серия не входит
          в бесплатные первые FREE_HQ_EPISODES. */}
      {hqModal && (
        <div
          className="absolute inset-0 z-40 grid place-items-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            // подложка — всё, кроме самого окна
            if (e.target === e.currentTarget) setHqModal(false);
          }}
        >
          <div
            ref={hqDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="alt-hq-title"
            data-alt-hq-modal=""
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl border border-line bg-[#0d0d15]/98 p-5 text-center shadow-[0_36px_80px_-28px_rgba(0,0,0,1)] outline-none animate-fade-in"
          >
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent-2/15 text-accent-2 ring-1 ring-accent-2/30">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                aria-hidden
              >
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path strokeLinecap="round" d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            </span>

            <h3 id="alt-hq-title" className="mt-3 text-lg font-black text-white">
              2K и 4K — с подпиской Premium
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              На первых {FREE_HQ_EPISODES} сериях 2K и 4K доступны всем. С 3-й серии
              качество выше 1080p открывается по подписке — это апскейл Anime4K, он
              считается на видеокарте.
            </p>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                onClick={() => router.push("/premium")}
                className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-black text-white transition hover:brightness-110"
              >
                Оформить Premium
              </button>
              <button
                type="button"
                onClick={() => setHqModal(false)}
                className="flex-1 rounded-xl bg-white/8 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/12 transition hover:bg-white/14"
              >
                Смотреть в 1080p
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------ Постер-оверлей до первого play -------------- */}
      {mediaReady && !started && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-black/55 via-black/25 to-black/75 px-8 text-center">
          <button
            type="button"
            aria-label="Воспроизвести"
            onClick={play}
            className="grid h-20 w-20 place-items-center rounded-full bg-accent text-white shadow-[0_0_50px_rgba(31,123,255,0.65)] transition hover:scale-105"
          >
            <Icon d={PATHS.play} className="ml-1 h-9 w-9" />
          </button>

          <h3 className="max-w-2xl text-xl font-black leading-tight text-white md:text-2xl">
            {query}
          </h3>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className={CHIP}>Серия {episode}</span>
          </div>

          {showContinue && (
            <button
              type="button"
              onClick={continueFrom}
              className="inline-flex items-center gap-2 rounded-xl bg-black/60 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-black/80"
            >
              <Icon d={PATHS.play} className="h-4 w-4" />
              Продолжить с {fmt(savedPos)}
            </button>
          )}
        </div>
      )}

      {/* ------------------------- Статусы ----------------------------- */}
      {status === "loading" && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-ink/70 backdrop-blur-sm animate-fade-in">
          <div className="grid justify-items-center gap-3 text-center">
            <span className="h-9 w-9 animate-spin-slow rounded-full border-[3px] border-white/20 border-t-accent" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted">
              Ищем на {brand}…
            </span>
          </div>
        </div>
      )}

      {status === "empty" && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-ink/85 animate-fade-in">
          <div className="grid max-w-xs justify-items-center gap-3 px-6 text-center">
            {/* У Kodik серия ищется не по каталогу, а прямой подписанной
                ссылкой, поэтому «не нашли» тут означало бы неверно:
                показываем то, что сервер ответил на самом деле. */}
            {backend === "kodik" ? (
              <>
                <p className="text-sm font-semibold text-white">Поток не получен</p>
                <p className="text-xs text-muted">
                  {kodikError ?? "Kodik не ответил"}
                </p>
                <p className="text-xs text-muted/80">
                  Если с VPN работает, а без него — нет, значит до сервера Kodik
                  закрыт доступ из вашей сети.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-white">Не нашли на {brand}</p>
                <p className="text-xs text-muted">
                  Возможно, этого тайтла нет в каталоге альтернативы — вернитесь на
                  основной плеер.
                </p>
              </>
            )}
            <button
              type="button"
              onClick={onBack}
              className="btn-ghost rounded-xl bg-white/8 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/15 hover:bg-white/14"
            >
              Вернуть основной плеер
            </button>
          </div>
        </div>
      )}

      {/* Нет именно этой серии в каталоге: у Kodik серии приходят по номеру,
          пустой результат сюда не попадает — там своя проверка выше */}
      {status === "ok" && !current && backend === "anilibria" && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-ink/85 animate-fade-in">
          <div className="grid max-w-xs justify-items-center gap-2 px-6 text-center">
            <p className="text-sm font-semibold text-white">Серии {episode} нет на {brand}</p>
            <p className="text-xs text-muted">
              Выберите другую серию или переключитесь обратно на основной плеер.
            </p>
          </div>
        </div>
      )}

      {mediaFailed && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-ink/85 animate-fade-in">
          <div className="grid justify-items-center gap-3 text-center">
            <p className="text-sm font-semibold text-white">Не удалось загрузить видео</p>
            <button
              type="button"
              onClick={retryMedia}
              className="btn-ghost rounded-xl bg-white/8 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/15 hover:bg-white/14"
            >
              Повторить
            </button>
          </div>
        </div>
      )}

      {/* Anime4K не запустился: честно сообщаем, что играет исходный поток */}
      {upscaleNeeded && a4kFailed && started && mediaReady && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2 rounded-lg bg-black/70 px-2.5 py-1 text-[11px] font-black text-amber-300 ring-1 ring-amber-300/40 backdrop-blur">
          Апскейл недоступен — {streamQuality}p
        </div>
      )}
    </>
  );
}
