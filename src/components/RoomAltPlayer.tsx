"use client";

import { useEffect, useRef, useState } from "react";
import type { AniTitleDetail } from "@/lib/anilibria";
import type { RoomState, WtRoomInfo } from "@/lib/watch-together-client";
import { AltPlayer } from "./AltPlayer";

/**
 * Плеер AniGalaxy в комнате совместного просмотра.
 *
 * Это тот же `AltPlayer`, что и на странице тайтла (панель управления,
 * качество, скорости, пропуск опенинга, полный экран), только состояние
 * синхронизируется с комнатой: пауза, перемотка и смена серии уходят на
 * сервер, а чужие действия применяются к видео. Сервер отдаёт состояние
 * комнаты в `sync`, свои действия плеер публикует через `onPublish`.
 */

const REACTIONS = ["🔥", "😂", "😮", "❤️", "👏"];

/** Пока применяем чужое действие, свои события плеера не публикуем */
const QUIET_MS = 1500;

interface Incoming {
  at: number;
  position: number;
  playing: boolean;
  /** Серия не менялась — применяем сразу, иначе после загрузки новой */
  sameEpisode: boolean;
}

export function RoomAltPlayer({
  title,
  alias,
  startEpisode,
  clientId,
  sync,
  onPublish,
}: {
  title: string;
  alias?: string;
  startEpisode: number;
  clientId: string;
  sync: WtRoomInfo;
  onPublish: (state: RoomState) => void;
}) {
  const [episode, setEpisode] = useState(startEpisode);
  const [seenAt, setSeenAt] = useState(0);
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [detail, setDetail] = useState<AniTitleDetail | null>(null);
  const [nonce, setNonce] = useState(0);
  const [burst, setBurst] = useState<{ key: number; emoji: string } | null>(null);

  const shellRef = useRef<HTMLDivElement>(null);
  const episodeRef = useRef(episode);
  const quietUntil = useRef(0);
  const lastPublish = useRef(0);
  /** Что применить, когда у видео появятся метаданные новой серии */
  const pendingRef = useRef<{ position: number; playing: boolean } | null>(null);
  const appliedRef = useRef(0);
  const onPublishRef = useRef(onPublish);

  useEffect(() => {
    episodeRef.current = episode;
    onPublishRef.current = onPublish;
  });

  // Новое состояние комнаты. Первое применяем всегда (встаём туда, где
  // комната), дальше — только чужие и только более новые.
  if (sync.at !== seenAt) {
    setSeenAt(sync.at);
    if (seenAt === 0 || sync.by !== clientId) {
      setIncoming({ at: sync.at, position: sync.position, playing: sync.playing, sameEpisode: sync.episode === episode });
      if (sync.episode !== episode) setEpisode(sync.episode);
    }
  }

  /* Список серий — для панели «Сезоны и эпизоды» в плеере */
  useEffect(() => {
    let alive = true;
    const url = alias
      ? `/api/anilibria/title?id=${encodeURIComponent(alias)}`
      : `/api/anilibria/title?q=${encodeURIComponent(title)}`;
    fetch(url)
      .then((res) => (res.ok ? (res.json() as Promise<{ detail?: AniTitleDetail }>) : null))
      .then((data) => {
        if (alive && data?.detail) setDetail(data.detail);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [alias, title, nonce]);

  const video = () => shellRef.current?.querySelector("video") ?? null;

  const publish = (override?: Partial<RoomState>) => {
    const el = video();
    if (!el) return;
    if (!override && Date.now() < quietUntil.current) return;
    const now = Date.now();
    if (!override && now - lastPublish.current < 250) return;
    lastPublish.current = now;
    onPublishRef.current({
      episode: override?.episode ?? episodeRef.current,
      position: override?.position ?? el.currentTime ?? 0,
      playing: override?.playing ?? !el.paused,
    });
  };

  const apply = (el: HTMLVideoElement, target: { position: number; playing: boolean }) => {
    quietUntil.current = Date.now() + QUIET_MS;
    if (target.position > 0 && Math.abs((el.currentTime || 0) - target.position) > 1.5) el.currentTime = target.position;
    if (target.playing && el.paused) el.play().catch(() => undefined);
    else if (!target.playing && !el.paused) el.pause();
  };

  // Чужое действие: сразу к видео или, если сменилась серия, после загрузки
  useEffect(() => {
    if (!incoming || incoming.at <= appliedRef.current) return;
    appliedRef.current = incoming.at;
    const target = { position: incoming.position, playing: incoming.playing };
    const el = video();
    if (incoming.sameEpisode && el && el.readyState >= 1) apply(el, target);
    else {
      pendingRef.current = target;
      quietUntil.current = Date.now() + QUIET_MS * 2;
    }
  }, [incoming]);

  // Подписка на события <video>: он один на всё время и подменяет источник
  useEffect(() => {
    let attached: HTMLVideoElement | null = null;
    const onPlay = () => publish({ playing: true });
    const onPause = () => {
      if (attached?.ended || Date.now() < quietUntil.current) return;
      publish({ playing: false });
    };
    const onSeeked = () => publish();
    const onMeta = () => {
      const pending = pendingRef.current;
      if (!pending || !attached) return;
      pendingRef.current = null;
      apply(attached, pending);
    };
    const attach = () => {
      const el = video();
      if (!el || el === attached) return;
      detach();
      attached = el;
      el.addEventListener("play", onPlay);
      el.addEventListener("pause", onPause);
      el.addEventListener("seeked", onSeeked);
      el.addEventListener("loadedmetadata", onMeta);
      if (pendingRef.current && el.readyState >= 1) onMeta();
    };
    const detach = () => {
      attached?.removeEventListener("play", onPlay);
      attached?.removeEventListener("pause", onPause);
      attached?.removeEventListener("seeked", onSeeked);
      attached?.removeEventListener("loadedmetadata", onMeta);
      attached = null;
    };
    attach();
    const timer = window.setInterval(attach, 800);
    // Пока играем — раз в 3 с подтверждаем место, чтобы новый зритель попал на актуальную секунду
    const beat = window.setInterval(() => {
      const el = video();
      if (el && !el.paused) publish();
    }, 3000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(beat);
      detach();
    };
    // publish/apply читают только refs и DOM
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickEpisode = (next: number) => {
    if (next === episodeRef.current || next < 1) return;
    quietUntil.current = Date.now() + QUIET_MS * 2;
    pendingRef.current = { position: 0, playing: true };
    setEpisode(next);
    publish({ episode: next, position: 0, playing: true });
  };

  const episodes = detail?.episodes ?? [];
  const nav = episodes.length
    ? {
        seasons: [{ number: 1, episodes: episodes.map((ep) => ({ number: ep.number })) }],
        season: 1,
        voices: [],
        voiceId: null,
        onPickEpisode: (_season: number, ep: number) => pickEpisode(ep),
        onPickVoice: () => undefined,
      }
    : undefined;
  const hasNext = episodes.some((ep) => ep.number > episode);

  return (
    <div>
      {/* id нужен AltPlayer: он ищет по нему оболочку для полного экрана и горячих клавиш */}
      <div
        id="player-shell"
        ref={shellRef}
        className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/12 shadow-[0_40px_80px_-40px_rgba(0,0,0,1)]"
      >
        <AltPlayer
          key={`${alias ?? title}:${nonce}`}
          query={title}
          alias={alias || undefined}
          episode={episode}
          titleId={`room:${alias || title}`}
          backend="anilibria"
          onBack={() => setNonce((n) => n + 1)}
          nav={nav}
          hasNext={hasNext}
          onNextEpisode={() => pickEpisode(episodeRef.current + 1)}
        />
        {burst && (
          <span
            key={burst.key}
            className="animate-fade-up pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 text-6xl drop-shadow-[0_0_18px_rgba(0,200,255,0.6)]"
            aria-hidden
          >
            {burst.emoji}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">Пауза, перемотка и серия общие для всех в комнате</p>
        <div className="flex flex-wrap gap-1.5">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                setBurst((prev) => ({ key: (prev?.key ?? 0) + 1, emoji }));
                window.setTimeout(() => setBurst(null), 1500);
              }}
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
