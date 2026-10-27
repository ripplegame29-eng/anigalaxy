"use client";

/**
 * Запись голосового сообщения через MediaRecorder.
 *
 * Пока идёт запись, раз в ~80 мс снимается уровень сигнала (AnalyserNode):
 * из него рисуется живая волна и в конце считаются 48 «пиков» для
 * превью сообщения (строка цифр 0–9, её хранит сервер). Битрейт низкий —
 * минута речи укладывается примерно в 200 КБ.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CHAT_VOICE_MAX_MS } from "@/lib/chat";

export interface VoiceClip {
  blob: Blob;
  ms: number;
  wave: string;
}

export type RecorderState = "idle" | "starting" | "recording";

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const PEAKS = 48;
const LIVE_BARS = 40;

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

/** Сжимает массив уровней (0..1) до PEAKS цифр 0–9 */
export function levelsToWave(levels: number[]): string {
  if (!levels.length) return "1".repeat(PEAKS);
  const out: number[] = [];
  for (let i = 0; i < PEAKS; i += 1) {
    const from = Math.floor((i / PEAKS) * levels.length);
    const to = Math.max(from + 1, Math.floor(((i + 1) / PEAKS) * levels.length));
    let peak = 0;
    for (let j = from; j < to && j < levels.length; j += 1) peak = Math.max(peak, levels[j]);
    out.push(peak);
  }
  const max = Math.max(...out, 0.05);
  return out.map((value) => String(Math.min(9, Math.max(1, Math.round((value / max) * 9))))).join("");
}

export function useVoiceRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [ms, setMs] = useState(0);
  const [live, setLive] = useState<number[]>([]);
  const [error, setError] = useState("");

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunks = useRef<Blob[]>([]);
  const levels = useRef<number[]>([]);
  const startedAt = useRef(0);
  const settle = useRef<((clip: VoiceClip | null) => void) | null>(null);
  const cancelled = useRef(false);

  const supported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  const release = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    void audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
  }, []);

  const finish = useCallback(() => {
    const type = recorder.current?.mimeType || "audio/webm";
    const duration = Math.min(CHAT_VOICE_MAX_MS, Date.now() - startedAt.current);
    const clip: VoiceClip | null =
      cancelled.current || !chunks.current.length
        ? null
        : { blob: new Blob(chunks.current, { type }), ms: duration, wave: levelsToWave(levels.current) };
    chunks.current = [];
    recorder.current = null;
    release();
    setState("idle");
    setMs(0);
    setLive([]);
    settle.current?.(clip);
    settle.current = null;
  }, [release]);

  const start = useCallback(async () => {
    if (state !== "idle") return;
    setError("");
    setState("starting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      stream.current = media;
      const mime = pickMime();
      const rec = new MediaRecorder(media, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 24000 });
      recorder.current = rec;
      chunks.current = [];
      levels.current = [];
      cancelled.current = false;
      rec.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      rec.onstop = finish;

      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      let analyser: AnalyserNode | null = null;
      if (Ctx) {
        const ctx = new Ctx();
        audioCtx.current = ctx;
        analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(media).connect(analyser);
      }
      const buffer = new Uint8Array(analyser?.fftSize ?? 0);

      startedAt.current = Date.now();
      rec.start(250);
      setState("recording");
      timer.current = setInterval(() => {
        const elapsed = Date.now() - startedAt.current;
        setMs(elapsed);
        if (analyser) {
          analyser.getByteTimeDomainData(buffer);
          let sum = 0;
          for (const byte of buffer) sum += ((byte - 128) / 128) ** 2;
          const level = Math.min(1, Math.sqrt(sum / buffer.length) * 3.2);
          levels.current.push(level);
          setLive((prev) => [...prev, level].slice(-LIVE_BARS));
        }
        if (elapsed >= CHAT_VOICE_MAX_MS && rec.state === "recording") rec.stop();
      }, 80);
    } catch (reason) {
      release();
      setState("idle");
      const denied = reason instanceof DOMException && (reason.name === "NotAllowedError" || reason.name === "SecurityError");
      setError(denied ? "Нет доступа к микрофону — разрешите его в настройках браузера" : "Не удалось включить микрофон");
    }
  }, [finish, release, state]);

  /** Останавливает запись и отдаёт готовый клип (или null, если запись пустая) */
  const stop = useCallback(
    () =>
      new Promise<VoiceClip | null>((resolve) => {
        const rec = recorder.current;
        if (!rec || rec.state === "inactive") return resolve(null);
        settle.current = resolve;
        rec.stop();
      }),
    [],
  );

  const cancel = useCallback(() => {
    const rec = recorder.current;
    cancelled.current = true;
    if (rec && rec.state !== "inactive") rec.stop();
    else {
      release();
      setState("idle");
    }
  }, [release]);

  // уход со страницы / закрытие панели — микрофон не должен остаться включённым
  useEffect(
    () => () => {
      cancelled.current = true;
      if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
      release();
    },
    [release],
  );

  return { supported, state, ms, live, error, clearError: () => setError(""), start, stop, cancel };
}
