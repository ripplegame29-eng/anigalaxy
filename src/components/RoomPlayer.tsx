"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import type { AniEpisode, AniTitleDetail } from "@/lib/anilibria";
import type { RoomState, WtRoomInfo } from "@/lib/watch-together-client";

/**
 * Плеер комнаты совместного просмотра: реальные серии из каталога
 * AniLiberty (HLS/m3u8 через hls.js) вместо прежней «заглушки» с
 * фейковым прогрессом.
 *
 * Синхронизация идёт через сервер: родитель раз в пару секунд забирает
 * состояние комнаты и передаёт его в `sync`, а плеер публикует свои
 * действия через `onPublish`. Чужое состояние применяется, только если
 * его записал другой клиент — иначе получился бы эхо-цикл.
 */

/** Качества, которые отдаёт AniLiberty */
const QUALITIES = ["480", "720", "1080"] as const;
type Quality = (typeof QUALITIES)[number];

/** Эмодзи для реакций над плеером */
const REACTIONS = ["🔥", "😂", "😮", "❤️", "👏"];

/** Компактный бейдж-пилюля (как в WatchTogetherView) */
const CHIP =
  "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-black uppercase tracking-wide ring-1";

/** Кнопка управления в строке под видео */
const BTN =
  "btn-ghost flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white/6 text-white transition hover:border-accent/40 disabled:pointer-events-none disabled:opacity-40";

/** Тонкие SVG-иконки: stroke currentColor, как во всём интерфейсе */
const PATHS: Record<string, string[]> = {
  play: ["M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17", "M10.3 8.7 15.5 12l-5.2 3.3z"],
  pause: ["M9.5 6.5v11", "M14.5 6.5v11"],
  chevronLeft: ["m14 6-6 6 6 6"],
  chevronRight: ["m10 6 6 6-6 6"],
  expand: ["M9 4H4v5", "M15 4h5v5", "M9 20H4v-5", "M15 20h5v-5"],
  retry: ["M20 12a8 8 0 1 1-2.34-5.66", "M20 4v5h-5"],
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

/** Секунды → `m:ss` (строка для прогресс-бара) */
function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function RoomPlayer({
  title,
  poster,
  alias,
  startEpisode,
  viewers,
  limit,
  clientId,
  sync,
  onPublish,
}: {
  title: string;
  poster?: string;
  /** Алиас тайтла в AniLiberty; нет — ищем по названию (старые комнаты) */
  alias?: string;
  /** Номер серии, с которой зашли в комнату */
  startEpisode: number;
  viewers: number;
  limit: number;
  /** id этого клиента — чтобы не применять собственное состояние */
  clientId: string;
  /** Состояние комнаты с сервера */
  sync: WtRoomInfo;
  /** Сообщить серверу о паузе/перемотке/смене серии */
  onPublish: (state: RoomState) => void;
}) {
  const [detail, setDetail] = useState<AniTitleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  /** Повтор загрузки тайтла (кнопка «Ещё раз») */
  const [detailNonce, setDetailNonce] = useState(0);
  const [epIndex, setEpIndex] = useState(0);
  const [quality, setQuality] = useState<Quality>("720");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  /** Какой именно источник не смог загрузиться (помогает игнорировать старую ошибку) */
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  /** Перезапуск подключения hls.js к тому же источнику */
  const [mediaNonce, setMediaNonce] = useState(0);
  const [burst, setBurst] = useState<{ key: number; emoji: string } | null>(null);

  const shellRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  /** Куда перемотать и играть ли после подключения нового источника */
  const pendingSeekRef = useRef<number | null>(null);
  const wantPlayRef = useRef(false);
  /** Свежие значения состояния для колбэков вне рендера */
  const detailRef = useRef<AniTitleDetail | null>(null);
  const epIndexRef = useRef(0);
  /** Анти-спам при перетаскивании перемотки */
  const lastPublishRef = useRef(0);
  /** До какого момента не публиковать своё состояние после чужого */
  const quietUntilRef = useRef(0);
  /** Последнее применённое `at` — чтобы не применять один срез дважды */
  const appliedAtRef = useRef(0);
  /** Стартовое состояние комнаты применили один раз */
  const initialSyncRef = useRef(false);

  /** true, пока управление ошибками у hls.js (чтобы onError не дублировал) */
  const hlsActiveRef = useRef(false);

  useEffect(() => {
    detailRef.current = detail;
  }, [detail]);
  useEffect(() => {
    epIndexRef.current = epIndex;
  }, [epIndex]);

  const episodes = detail?.episodes ?? [];
  const episode: AniEpisode | undefined = episodes[epIndex];
  const sources = episode?.sources;
  const src = sources?.[quality] ?? sources?.["720"] ?? sources?.["480"] ?? sources?.["1080"];
  const available = QUALITIES.filter((q) => Boolean(sources?.[q]));
  const mediaFailed = Boolean(src) && failedSrc === src;

  /* --------------------------- Загрузка тайтла ------------------------ */
  useEffect(() => {
    let alive = true;
    const url = alias
      ? `/api/anilibria/title?id=${encodeURIComponent(alias)}`
      : `/api/anilibria/title?q=${encodeURIComponent(title)}`;
    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { detail?: AniTitleDetail }) => {
        if (!alive || !data.detail) return;
        const next = data.detail;
        setDetail(next);
        const idx = next.episodes.findIndex((ep) => ep.number === startEpisode);
        setEpIndex(idx >= 0 ? idx : 0);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setDetail(null);
        setFailed(true);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [alias, title, startEpisode, detailNonce]);

  /* ----------------------- hls.js: подключение ------------------------ */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    let cancelled = false;

    /** Применить отложенные перемотку/воспроизведение после готовности */
    const applyPending = () => {
      if (pendingSeekRef.current != null) {
        video.currentTime = pendingSeekRef.current;
        pendingSeekRef.current = null;
      }
      if (wantPlayRef.current) {
        wantPlayRef.current = false;
        video.play().catch(() => undefined);
      }
    };

    const onMeta = () => applyPending();
    video.addEventListener("loadedmetadata", onMeta);

    let hls: Hls | null = null;
    let networkRetries = 0;
    const nativePlayable = Boolean(video.canPlayType("application/vnd.apple.mpegurl"));

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
        // MSE есть — hls.js демуксирует MPEG-TS сам. Нативку не пробуем:
        // canPlayType в Chrome врёт про m3u8, а нативное воспроизведение
        // падает с SRC_NOT_SUPPORTED (чёрный экран).
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

  /* -------------------- Публикация своего состояния ------------------- */
  const publish = useCallback(
    (override?: Partial<RoomState>) => {
      const video = videoRef.current;
      const current = detailRef.current?.episodes[epIndexRef.current];
      if (!video || !current) return;
      // Только что применили чужое состояние — не отвечаем эхом.
      // Явные действия пользователя (override) проходят всегда.
      if (!override && Date.now() < quietUntilRef.current) return;
      const now = Date.now();
      if (!override && now - lastPublishRef.current < 250) return;
      lastPublishRef.current = now;
      onPublish({
        episode: override?.episode ?? current.number,
        position: override?.position ?? video.currentTime ?? 0,
        playing: override?.playing ?? !video.paused,
      });
    },
    [onPublish],
  );

  /* -------------------- Применение чужого состояния ------------------- */
  useEffect(() => {
    const video = videoRef.current;
    const data = detailRef.current;
    if (!video || !data || !data.episodes.length) return;

    // Первый срез (даже свой): встаём на серию и секунду, где стоит комната
    if (!initialSyncRef.current) {
      initialSyncRef.current = true;
      appliedAtRef.current = Math.max(appliedAtRef.current, sync.at);
      const idx = data.episodes.findIndex((ep) => ep.number === sync.episode);
      if (idx >= 0 && idx !== epIndexRef.current) {
        pendingSeekRef.current = sync.position;
        wantPlayRef.current = sync.playing;
        setEpIndex(idx);
        return;
      }
      if (sync.position > 0) {
        if (video.readyState >= 1) video.currentTime = sync.position;
        else pendingSeekRef.current = sync.position;
      }
      wantPlayRef.current = sync.playing;
      return;
    }

    if (sync.by === clientId) return; // это наше состояние — оно уже на экране
    if (sync.at <= appliedAtRef.current) return; // этот срез уже применяли
    appliedAtRef.current = sync.at;

    const current = data.episodes[epIndexRef.current];
    if (current && current.number !== sync.episode) {
      const idx = data.episodes.findIndex((ep) => ep.number === sync.episode);
      if (idx < 0) return;
      // Чужой переход серией: грузим её и выставляем позицию/паузу
      pendingSeekRef.current = sync.position;
      wantPlayRef.current = sync.playing;
      setEpIndex(idx);
      quietUntilRef.current = Date.now() + 1500;
      return;
    }

    quietUntilRef.current = Date.now() + 1200;
    if (Math.abs((video.currentTime || 0) - sync.position) > 1.5) {
      video.currentTime = sync.position;
    }
    if (sync.playing && video.paused) video.play().catch(() => undefined);
    else if (!sync.playing && !video.paused) video.pause();
  }, [sync, detail, clientId]);

  // Пока играем — раз в 3 с подтверждаем прогресс, чтобы новый зритель
  // сразу попадал на актуальную секунду, а не на паузу десятиминутной давности
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => publish(), 3000);
    return () => window.clearInterval(timer);
  }, [playing, epIndex, publish]);

  /* ---------------------------- Действия ------------------------------ */

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => undefined);
    else video.pause();
  };

  const goto = (delta: number, forcePlay?: boolean) => {
    const total = detailRef.current?.episodes.length ?? 0;
    if (!total) return;
    const next = Math.min(Math.max(epIndex + delta, 0), total - 1);
    if (next === epIndex) return;
    const video = videoRef.current;
    const target = detailRef.current?.episodes[next];
    wantPlayRef.current = forcePlay ?? Boolean(video && !video.paused);
    pendingSeekRef.current = null;
    if (video) video.currentTime = 0;
    setEpIndex(next);
    // Сразу сообщаем серверу новую серию с нулевой позицией
    if (target) {
      publish({ episode: target.number, position: 0, playing: wantPlayRef.current });
    }
  };

  const onSeek = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setTime(value);
    publish({ position: value });
  };

  const pickQuality = (q: Quality) => {
    const video = videoRef.current;
    if (video && detailRef.current) {
      wantPlayRef.current = !video.paused;
      pendingSeekRef.current = video.currentTime;
    }
    setQuality(q);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else {
      shellRef.current?.requestFullscreen().catch(() => undefined);
    }
  };

  const retryDetail = () => {
    setFailed(false);
    setLoading(true);
    setDetailNonce((n) => n + 1);
  };

  const retryMedia = () => {
    setFailedSrc(null);
    setMediaNonce((n) => n + 1);
  };

  // Ключ только чтобы перезапустить анимацию эмодзи (чистый апдейтер)
  const react = (emoji: string) => setBurst((prev) => ({ key: (prev?.key ?? 0) + 1, emoji }));

  useEffect(() => {
    if (!burst) return;
    const timer = window.setTimeout(() => setBurst(null), 1500);
    return () => window.clearTimeout(timer);
  }, [burst]);

  const onEnded = () => {
    if (epIndex < episodes.length - 1) {
      goto(1, true);
    } else {
      setPlaying(false);
      publish({ playing: false });
    }
  };

  const percent = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;

  /* ------------------------------ Разметка ---------------------------- */

  return (
    <div>
      <div
        ref={shellRef}
        className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-elevated"
      >
        <video
          ref={videoRef}
          poster={poster ?? detail?.card.poster}
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full bg-black object-contain"
          onTimeUpdate={() => setTime(videoRef.current?.currentTime ?? 0)}
          onError={() => {
            // Нативный путь упал (hls.js свои ошибки показывает сам)
            const video = videoRef.current;
            if (video?.error && !hlsActiveRef.current && src) setFailedSrc(src);
          }}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
          onPlay={() => {
            setPlaying(true);
            publish();
          }}
          onPause={() => {
            setPlaying(false);
            publish();
          }}
          onEnded={onEnded}
        />

        {/* Затемнение снизу — под нижнюю панель */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink/95 to-transparent"
          aria-hidden
        />

        {/* Всплывающая реакция */}
        {burst && (
          <span
            key={burst.key}
            className="animate-fade-up pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 text-6xl drop-shadow-[0_0_18px_rgba(0,200,255,0.6)]"
            aria-hidden
          >
            {burst.emoji}
          </span>
        )}

        {/* Загрузка тайтла */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/60">
            <span
              className="h-10 w-10 animate-spin-slow rounded-full border-2 border-white/20 border-t-accent"
              aria-hidden
            />
            <span className="sr-only">Загружаем серии…</span>
          </div>
        )}

        {/* Тайтл не найден / не загрузился */}
        {!loading && (failed || (!episode && !mediaFailed)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/80 p-6 text-center">
            <p className="text-sm font-bold text-white">
              {failed
                ? `Не нашли «${title}» в каталоге AniLiberty`
                : "У этого тайтла пока нет доступных серий"}
            </p>
            <p className="max-w-md text-xs leading-relaxed text-muted">
              {failed
                ? "Поиск в комнатах теперь идёт по каталогу AniLiberty — создайте комнату заново или повторите запрос."
                : "Попробуйте открыть позже: серии появляются по мере выхода."}
            </p>
            {failed && (
              <button
                type="button"
                onClick={retryDetail}
                className="btn-ghost inline-flex items-center gap-2 rounded-xl border border-line bg-white/6 px-4 py-2 text-xs font-bold text-white hover:border-accent/40"
              >
                <Icon d={PATHS.retry} className="h-4 w-4" sw={2} />
                Повторить
              </button>
            )}
          </div>
        )}

        {/* Медиа не загрузилось (сеть/кодек) */}
        {!loading && mediaFailed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/80 p-6 text-center">
            <p className="text-sm font-bold text-white">Не удалось загрузить видео</p>
            <p className="max-w-md text-xs leading-relaxed text-muted">
              Проверьте соединение — поток идёт с CDN AniLiberty.
            </p>
            <button
              type="button"
              onClick={retryMedia}
              className="btn-ghost inline-flex items-center gap-2 rounded-xl border border-line bg-white/6 px-4 py-2 text-xs font-bold text-white hover:border-accent/40"
            >
              <Icon d={PATHS.retry} className="h-4 w-4" sw={2} />
              Ещё раз
            </button>
          </div>
        )}

        {/* Кнопка play по центру — пока на паузе */}
        {!loading && !failed && !mediaFailed && episode && !playing && (
          <button
            type="button"
            onClick={togglePlay}
            aria-label="Воспроизвести"
            className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-ink/70 text-white backdrop-blur transition hover:scale-105 hover:border-accent/70"
          >
            <Icon d={PATHS.play} className="h-7 w-7" sw={1.6} />
          </button>
        )}

        {/* Нижняя панель: перемотка и время */}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="relative h-1.5 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-2 to-accent"
              style={{ width: `${percent}%` }}
              aria-hidden
            />
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.25}
              value={Math.min(time, duration || 0)}
              onChange={(e) => onSeek(Number(e.target.value))}
              disabled={!episode || !duration}
              aria-label="Перемотка серии"
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 disabled:cursor-default"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-black text-white/85">
            <span className="font-mono">
              {fmt(time)} / {fmt(duration)}
            </span>
            <span className="text-mint">
              синхронно с {viewers} из {limit} зрителей
            </span>
          </div>
        </div>
      </div>

      {/* Управление */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => goto(-1)}
          disabled={epIndex <= 0}
          aria-label="Предыдущая серия"
          className={BTN}
        >
          <Icon d={PATHS.chevronLeft} className="h-4 w-4" sw={2.2} />
        </button>
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Пауза" : "Воспроизвести"}
          className={BTN}
        >
          <Icon
            d={playing ? PATHS.pause : PATHS.play}
            className="h-4 w-4"
            sw={playing ? 2.4 : 1.8}
          />
        </button>
        <button
          type="button"
          onClick={() => goto(1)}
          disabled={epIndex >= episodes.length - 1}
          aria-label="Следующая серия"
          className={BTN}
        >
          <Icon d={PATHS.chevronRight} className="h-4 w-4" sw={2.2} />
        </button>

        {episode && (
          <span className={`${CHIP} bg-white/8 text-muted ring-white/15`}>
            серия {episode.number} из {episodes.length}
          </span>
        )}
        <span className={`${CHIP} bg-mint/12 text-mint ring-mint/35`}>◉ синхронизировано</span>

        {/* Качество потока */}
        {available.length > 1 && (
          <div className="flex gap-1" role="group" aria-label="Качество видео">
            {available.map((q) => (
              <button
                key={q}
                type="button"
                aria-pressed={quality === q}
                onClick={() => pickQuality(q)}
                className={`rounded-lg px-2 py-1 text-[11px] font-black uppercase ring-1 transition ${
                  quality === q
                    ? "bg-accent/20 text-white ring-accent/50"
                    : "bg-white/6 text-muted ring-white/12 hover:text-white"
                }`}
              >
                {q}p
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label="На весь экран"
          className={BTN}
        >
          <Icon d={PATHS.expand} className="h-4 w-4" sw={2} />
        </button>

        <div className="ml-auto flex flex-wrap gap-1.5">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => react(emoji)}
              aria-label={`Отправить реакцию ${emoji}`}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white/6 text-base transition hover:-translate-y-0.5 hover:border-accent/40"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
