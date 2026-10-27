"use client";

import { useSyncExternalStore } from "react";

/**
 * Тихие звуки интерфейса. Ничего не загружается: тоны синтезируются в браузере,
 * поэтому нет ни файлов, ни задержки. Громкость намеренно низкая, выключатель —
 * в настройках («Внешний вид»). Первый звук возможен только после жеста
 * пользователя (правило браузеров), поэтому до него вызовы молча пропускаются.
 */

export type Sfx = "tap" | "pop" | "ok" | "err" | "reward" | "open" | "close";

const KEY = "ag.sfx";
const listeners = new Set<() => void>();
let enabled: boolean | null = null;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let lastAt = 0;

function read(): boolean {
  if (enabled !== null) return enabled;
  try {
    enabled = window.localStorage.getItem(KEY) !== "0";
  } catch {
    enabled = true;
  }
  return enabled;
}

export const sfxEnabled = (): boolean => (typeof window === "undefined" ? false : read());

export function setSfxEnabled(value: boolean): void {
  enabled = value;
  try {
    window.localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    /* без хранилища настройка живёт до перезагрузки */
  }
  listeners.forEach((l) => l());
  if (value) playSfx("pop");
}

export function useSfxEnabled(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    sfxEnabled,
    () => false,
  );
}

function audio(): { c: AudioContext; out: GainNode } | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(comp);
    comp.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  if (ctx.state !== "running" || !master) return null;
  return { c: ctx, out: master };
}

function tone(a: { c: AudioContext; out: GainNode }, freq: number, at: number, dur: number, gain: number, type: OscillatorType = "sine", slideTo?: number): void {
  const t0 = a.c.currentTime + at;
  const osc = a.c.createOscillator();
  const g = a.c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(a.out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function playSfx(kind: Sfx): void {
  if (!sfxEnabled()) return;
  const now = performance.now();
  if (now - lastAt < 45) return;
  lastAt = now;
  const a = audio();
  if (!a) return;
  switch (kind) {
    case "tap":
      tone(a, 880, 0, 0.05, 0.05, "triangle", 620);
      break;
    case "pop":
      tone(a, 520, 0, 0.09, 0.08, "sine", 900);
      break;
    case "ok":
      tone(a, 660, 0, 0.12, 0.07, "sine");
      tone(a, 990, 0.08, 0.18, 0.07, "sine");
      break;
    case "err":
      tone(a, 220, 0, 0.18, 0.08, "sawtooth", 140);
      tone(a, 165, 0.09, 0.2, 0.06, "sawtooth", 110);
      break;
    case "reward":
      [523, 659, 784, 1047].forEach((f, i) => tone(a, f, i * 0.07, 0.28, 0.06, "sine"));
      tone(a, 2093, 0.22, 0.35, 0.025, "sine");
      break;
    case "open":
      tone(a, 300, 0, 0.16, 0.05, "sine", 620);
      break;
    case "close":
      tone(a, 520, 0, 0.14, 0.04, "sine", 260);
      break;
  }
}
