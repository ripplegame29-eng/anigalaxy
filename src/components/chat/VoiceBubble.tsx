"use client";

/**
 * Плеер голосового сообщения: кнопка, волна-превью с прогрессом, время,
 * скорость 1×/1.5×/2×. Одновременно играет только одно голосовое.
 */

import { useEffect, useRef, useState } from "react";

let playing: { stop: () => void } | null = null;

export const fmtClock = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

const SPEEDS = [1, 1.5, 2] as const;

export function VoiceBubble({ id, ms, wave }: { id: number; ms: number; wave: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const raf = useRef(0);
  const [on, setOn] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [failed, setFailed] = useState(false);

  const bars = (wave || "5".repeat(40)).split("").map((char) => Number(char) || 1);

  const stopTick = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = 0;
  };

  const pause = () => {
    audio.current?.pause();
    stopTick();
    setOn(false);
  };

  useEffect(
    () => () => {
      stopTick();
      audio.current?.pause();
      if (playing && audio.current) playing = null;
    },
    [],
  );

  const tick = () => {
    const el = audio.current;
    if (!el) return;
    setProgress(Math.min(1, el.currentTime / Math.max(0.1, ms / 1000)));
    raf.current = requestAnimationFrame(tick);
  };

  const toggle = async () => {
    if (on) return pause();
    if (!audio.current) {
      const el = new Audio(`/api/chat/audio/${id}`);
      el.preload = "auto";
      el.onended = () => {
        stopTick();
        setOn(false);
        setProgress(0);
        el.currentTime = 0;
      };
      el.onerror = () => {
        stopTick();
        setOn(false);
        setFailed(true);
      };
      audio.current = el;
    }
    playing?.stop();
    playing = { stop: pause };
    audio.current.playbackRate = speed;
    try {
      await audio.current.play();
      setOn(true);
      setFailed(false);
      stopTick();
      raf.current = requestAnimationFrame(tick);
    } catch {
      setFailed(true);
    }
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audio.current) audio.current.playbackRate = next;
  };

  const seek = (event: React.MouseEvent<HTMLDivElement>) => {
    const el = audio.current;
    if (!el) return;
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    try {
      el.currentTime = ratio * (ms / 1000);
      setProgress(ratio);
    } catch {
      /* поток без индекса — перемотка недоступна */
    }
  };

  return (
    <div className={`agc-voice${on ? " is-on" : ""}${failed ? " is-failed" : ""}`}>
      <button type="button" className="agc-voice-btn" onClick={toggle} aria-label={on ? "Пауза" : "Слушать голосовое"}>
        {on ? (
          <svg viewBox="0 0 24 24" aria-hidden>
            <path fill="currentColor" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden>
            <path fill="currentColor" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
          </svg>
        )}
      </button>
      <div className="agc-voice-wave" onClick={seek} role="presentation">
        {bars.map((value, index) => (
          <i
            key={index}
            className={index / bars.length < progress ? "is-played" : undefined}
            style={{ height: `${14 + value * 8.5}%` }}
          />
        ))}
      </div>
      <div className="agc-voice-meta">
        <span>{failed ? "Ошибка" : fmtClock(on ? progress * ms : ms)}</span>
        <button type="button" onClick={cycleSpeed} aria-label={`Скорость ${speed}×`}>
          {speed}×
        </button>
      </div>
    </div>
  );
}
