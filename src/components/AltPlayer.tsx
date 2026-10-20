"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type Hls from "hls.js";
import type { AniSearchCard, AniTitleDetail } from "@/lib/anilibria";
import { FREE_HQ_EPISODES, hqFreeForEpisode, qualityNeedsPremium, usePremium } from "@/lib/premium";

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

/** Скорости воспроизведения (цикл на чипе скорости) */
const SPEEDS = [0.5, 1, 1.25, 1.5, 2];

/** localStorage с позициями просмотра: { [titleId]: { e5: секунды } } */
const POS_KEY = "ag:altpos";

/** Компактная плашка в оверлеях */
const CHIP =
  "inline-flex items-center gap-1.5 rounded-lg bg-black/55 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white ring-1 ring-white/15 backdrop-blur";

/** Кнопка-чип в нижней панели управления (крупная, как в референсе) */
const CBAR_CHIP =
  "rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white ring-1 ring-white/15 transition hover:bg-white/18";

/** Иконочная кнопка в нижней панели управления (крупная, как в референсе) */
const CBAR_BTN =
  "grid h-11 w-11 place-items-center rounded-full text-white ring-1 ring-transparent transition hover:bg-white/12";

/** Тонкие SVG-иконки: stroke currentColor, как во всём интерфейсе */
const PATHS: Record<string, string[]> = {
  play: ["M8 5.5v13l11-6.5z"],
  pause: ["M9 5v14", "M15 5v14"],
  volume: ["M11 5 6 9H3v6h3l5 4V5z", "M15.5 8.5a5 5 0 0 1 0 7"],
  volumeOff: ["M11 5 6 9H3v6h3l5 4V5z", "m16.5 9.5 5 5", "m21.5 9.5-5 5"],
  gear: [
    "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  ],
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
}: {
  /** Заполнение 0..1 */
  ratio: number;
  onPick: (ratio: number) => void;
  /** Шаг клавишами ←/→ (необязательно) */
  onStep?: (dir: -1 | 1) => void;
  label: string;
  valueText: string;
  className?: string;
}) {
  const activeRef = useRef(false);
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
      }}
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
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-accent"
        style={{ width: `${pct}%` }}
      />
      <div
        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover/bar:opacity-100"
        style={{ left: `${pct}%` }}
      />
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
  const [rate, setRate] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  /** Окно «2K/4K — по подписке»: замкнуто на текущую серию, не серию из localStorage */
  const [hqModal, setHqModal] = useState(false);
  const [autoNext, setAutoNext] = useState(true);
  const [isFs, setIsFs] = useState(false);
  /** Anime4K не запустился (нет WebGL / canvas заблокирован CORS) */
  const [a4kFailed, setA4kFailed] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  /** Канвас поверх видео: на нём Anime4K рисует апскейленные кадры */
  const a4kCanvasRef = useRef<HTMLCanvasElement>(null);
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
    qualityNeedsPremium(qualityPref, episode) && !premiumActive ? "auto" : qualityPref;
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
    if (qualityNeedsPremium(next, episode) && !premiumActive) {
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
        className="absolute inset-0 h-full w-full bg-black object-contain"
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
          const hasNext = Boolean(detail?.episodes.some((ep) => ep.number > episode));
          if (autoNext && hasNext && onNextEpisode) {
            forcePlayRef.current = true;
            onNextEpisode();
          }
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
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
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

      {/* Пауза: центральная кнопка пуска — акцентная, со свечением */}
      {started && !playing && mediaReady && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[6] grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-white shadow-[0_0_50px_rgba(31,123,255,0.65)] backdrop-blur-sm transition-transform hover:scale-105">
          <Icon d={PATHS.play} className="ml-1 h-9 w-9" />
        </div>
      )}

      {/* Буферизация */}
      {buffering && mediaReady && status === "ok" && (
        <div className="pointer-events-none absolute inset-0 z-[7] grid place-items-center">
          <span className="h-9 w-9 animate-spin-slow rounded-full border-[3px] border-white/20 border-t-accent" />
        </div>
      )}

      {/* ---------------- Верхняя плашка: название + источник ------------ */}
      {showTopBar && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent px-4 pb-10 pt-3">
          <div className="min-w-0">
            <p className="truncate text-base font-black text-white md:text-lg">{query}</p>
            <span className="mt-1.5 inline-block rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/20 backdrop-blur">
              Серия {episode}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Плашка бренда — как «AnimeOn Classic», но в наших цветах:
                градиентная кайма sky→cyan, тёмная «начинка», иконка-чип */}
            <span className="inline-flex items-center rounded-full bg-gradient-to-r from-sky-400 via-cyan-400 to-sky-500 p-[1.5px] shadow-[0_2px_16px_rgba(56,189,248,0.45)]">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#0a0e15]/92 py-1 pl-1.5 pr-3 backdrop-blur">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-cyan-500 shadow-[0_0_10px_rgba(56,189,248,0.7)]">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-2.5 w-2.5 text-white">
                    <path d="M8 5.5v13l11-6.5z" />
                  </svg>
                </span>
                <span className="text-[11px] font-black tracking-wide text-white">AniGalaxy</span>
              </span>
            </span>
          </div>
        </div>
      )}

      {/* ------------------ Нижняя панель управления ------------------- */}
      {started && mediaReady && (
        <div
          className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3 pb-3 pt-9 transition-opacity duration-300 ${
            uiVisible || !playing ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {/* Прогресс */}
          <DragBar
            className="h-1.5 w-full transition-[height] hover:h-2"
            ratio={dur ? curTime / dur : 0}
            onPick={seekTo}
            onStep={seekStep}
            label="Перемотка"
            valueText={`${fmt(curTime)} из ${fmt(dur)}`}
          />

          <div className="mt-2 flex items-center gap-2">
            {/* Влево: play (акцентная), звук, время */}
            <button
              type="button"
              aria-label={playing ? "Пауза" : "Воспроизвести"}
              onClick={toggle}
              className="grid h-11 w-11 place-items-center rounded-full bg-accent text-white shadow-[0_0_22px_rgba(31,123,255,0.55)] transition hover:scale-105 hover:bg-accent/85"
            >
              <Icon d={playing ? PATHS.pause : PATHS.play} className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label={muted ? "Включить звук" : "Выключить звук"}
              onClick={toggleMute}
              className={CBAR_BTN}
            >
              <Icon d={muted || volume === 0 ? PATHS.volumeOff : PATHS.volume} className="h-5 w-5" />
            </button>
            <DragBar
              className="hidden h-1.5 w-20 transition-[height] hover:h-2 sm:block"
              ratio={muted ? 0 : volume}
              onPick={setVol}
              onStep={(dir) => setVol((muted ? 0 : volume) + dir * 0.05)}
              label="Громкость"
              valueText={`${Math.round((muted ? 0 : volume) * 100)}%`}
            />
            <span className="text-xs font-bold tabular-nums text-white/90">
              {fmt(curTime)} <span className="text-white/50">/ {fmt(dur)}</span>
            </span>

            <div className="flex-1" />

            {/* Вправо: качество, скорость, настройки, PiP, фулскрин */}
            <button
              type="button"
              aria-label="Качество"
              aria-expanded={qualityOpen}
              onClick={() => setQualityOpen(true)}
              className={`${CBAR_CHIP} ${qualityOpen ? "bg-white/18" : ""}`}
            >
              {quality === "2160" ? (
                <span className="rounded bg-red-600 px-1.5 py-0.5 font-black text-white">4K</span>
              ) : (
                qualityLabel
              )}
            </button>
            <button type="button" aria-label="Скорость" onClick={cycleSpeed} className={CBAR_CHIP}>
              {rate}x
            </button>
            <button
              type="button"
              aria-label="Настройки"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((v) => !v)}
              className={`${CBAR_BTN} ${settingsOpen ? "bg-white/15" : ""}`}
            >
              <Icon d={PATHS.gear} className="h-5 w-5" />
            </button>
            <button type="button" aria-label="Картинка в картинке" onClick={togglePip} className={CBAR_BTN}>
              <Icon d={PATHS.pip} className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label={isFs ? "Выйти из полноэкранного режима" : "На весь экран"}
              onClick={toggleFullscreen}
              className={CBAR_BTN}
            >
              <Icon d={isFs ? PATHS.compress : PATHS.expand} className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* -------------------------- Настройки -------------------------- */}
      {settingsOpen && mediaReady && (
        <div
          data-alt-settings
          className="absolute bottom-20 right-3 z-30 w-60 rounded-2xl border border-line bg-[#0d0d15]/95 p-3.5 shadow-[0_28px_60px_-24px_rgba(0,0,0,1)] backdrop-blur-xl animate-fade-in"
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
          className="absolute bottom-20 right-3 z-30 w-64 overflow-hidden rounded-2xl border border-line bg-[#0d0d15]/95 shadow-[0_28px_60px_-24px_rgba(0,0,0,1)] backdrop-blur-xl animate-fade-in"
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

          {!premiumActive && (
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
              const locked = qualityNeedsPremium(q, episode) && !premiumActive;
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
