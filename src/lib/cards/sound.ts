"use client";

/**
 * Звук карточек: все эффекты синтезируются на лету (Web Audio), файлов нет.
 * Включается и выключается переключателем в шапке раздела; выбор хранится в браузере.
 */

import { useSyncExternalStore } from "react";

export type Sfx = "ok" | "err" | "hit" | "crit" | "cast" | "ult" | "heal" | "shield" | "ko" | "win" | "lose" | "charge" | "burst" | "reveal0" | "reveal1" | "reveal2" | "reveal3" | "reveal4" | "star";

const KEY = "animehub:cards:sound";
const MASTER = 0.42;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let on: boolean | null = null;
let noiseBuf: AudioBuffer | null = null;
const last = new Map<string, number>();
const subs = new Set<() => void>();

function readOn(): boolean {
  if (on === null) {
    try {
      on = window.localStorage.getItem(KEY) !== "0";
    } catch {
      on = true;
    }
  }
  return on;
}

export function soundOn(): boolean {
  return typeof window !== "undefined" && readOn();
}

export function setSound(v: boolean): void {
  on = v;
  try {
    window.localStorage.setItem(KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
  subs.forEach((f) => f());
  if (v) sfx("ok");
}

export function useSoundOn(): boolean {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
    () => soundOn(),
    () => false,
  );
}

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = MASTER;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(c: AudioContext, o: { f: number; to?: number; d: number; type?: OscillatorType; v?: number; at?: number }): void {
  const t0 = c.currentTime + (o.at ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.f, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.d);
  const v = o.v ?? 0.5;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + Math.min(0.02, o.d / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
  osc.connect(g).connect(master!);
  osc.start(t0);
  osc.stop(t0 + o.d + 0.05);
}

function noise(c: AudioContext, o: { d: number; f: number; to?: number; q?: number; v?: number; at?: number; type?: BiquadFilterType }): void {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  const t0 = c.currentTime + (o.at ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const fl = c.createBiquadFilter();
  fl.type = o.type ?? "bandpass";
  fl.Q.value = o.q ?? 1;
  fl.frequency.setValueAtTime(o.f, t0);
  if (o.to) fl.frequency.exponentialRampToValueAtTime(Math.max(40, o.to), t0 + o.d);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.v ?? 0.4, t0 + Math.min(0.03, o.d / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
  src.connect(fl).connect(g).connect(master!);
  src.start(t0);
  src.stop(t0 + o.d + 0.05);
}

/** Мажорное арпеджио из нот (Гц) */
const arp = (c: AudioContext, notes: number[], step: number, type: OscillatorType = "triangle", v = 0.35): void => notes.forEach((f, i) => tone(c, { f, d: 0.35, type, v, at: i * step }));
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

export function sfx(name: Sfx): void {
  if (typeof window === "undefined" || !readOn()) return;
  const now = performance.now();
  if (now - (last.get(name) ?? 0) < 35) return;
  last.set(name, now);
  const c = audio();
  if (!c || !master) return;
  switch (name) {
    case "ok":
      tone(c, { f: 660, d: 0.09, type: "sine", v: 0.25 });
      tone(c, { f: 990, d: 0.12, type: "sine", v: 0.22, at: 0.07 });
      break;
    case "err":
      tone(c, { f: 180, to: 120, d: 0.22, type: "sawtooth", v: 0.2 });
      break;
    case "hit":
      noise(c, { d: 0.1, f: 2200, to: 500, q: 0.8, v: 0.5 });
      tone(c, { f: 150, to: 55, d: 0.14, type: "sine", v: 0.6 });
      break;
    case "crit":
      noise(c, { d: 0.14, f: 3000, to: 600, q: 0.8, v: 0.6 });
      tone(c, { f: 170, to: 50, d: 0.2, type: "sine", v: 0.7 });
      tone(c, { f: 880, to: 1500, d: 0.18, type: "triangle", v: 0.3, at: 0.02 });
      break;
    case "cast":
      tone(c, { f: 300, to: 950, d: 0.38, type: "sawtooth", v: 0.16 });
      tone(c, { f: 1200, to: 1800, d: 0.3, type: "sine", v: 0.2, at: 0.1 });
      noise(c, { d: 0.35, f: 800, to: 4000, q: 2, v: 0.15 });
      break;
    case "ult":
      tone(c, { f: 90, to: 40, d: 0.9, type: "sine", v: 0.8 });
      noise(c, { d: 0.9, f: 300, to: 6000, q: 1.5, v: 0.3 });
      arp(c, [C5, E5, G5, C6, G5 * 2], 0.08, "sawtooth", 0.18);
      break;
    case "heal":
      tone(c, { f: 660, d: 0.3, v: 0.28 });
      tone(c, { f: 990, d: 0.4, v: 0.24, at: 0.09 });
      tone(c, { f: 1320, d: 0.45, v: 0.18, at: 0.18 });
      break;
    case "shield":
      noise(c, { d: 0.25, f: 1500, q: 4, v: 0.3 });
      tone(c, { f: 520, to: 780, d: 0.25, type: "triangle", v: 0.3 });
      break;
    case "ko":
      tone(c, { f: 320, to: 50, d: 0.5, type: "sawtooth", v: 0.3 });
      noise(c, { d: 0.3, f: 900, to: 150, v: 0.35, type: "lowpass" });
      break;
    case "win":
      arp(c, [C5, E5, G5, C6, E5 * 2], 0.11, "triangle", 0.4);
      break;
    case "lose":
      arp(c, [G5 / 2, 311.13, 261.63, 196], 0.16, "sine", 0.4);
      break;
    case "charge":
      noise(c, { d: 0.65, f: 200, to: 5000, q: 1.2, v: 0.35 });
      tone(c, { f: 110, to: 440, d: 0.65, type: "sawtooth", v: 0.2 });
      break;
    case "burst":
      noise(c, { d: 0.5, f: 4000, to: 300, q: 0.6, v: 0.6 });
      tone(c, { f: 120, to: 45, d: 0.45, type: "sine", v: 0.8 });
      break;
    case "reveal0":
    case "reveal1":
      tone(c, { f: 520, d: 0.2, v: 0.3 });
      tone(c, { f: 780, d: 0.25, v: 0.25, at: 0.08 });
      break;
    case "reveal2":
      arp(c, [C5, E5, G5], 0.09, "triangle", 0.35);
      break;
    case "reveal3":
      arp(c, [C5, E5, G5, C6], 0.09, "triangle", 0.4);
      noise(c, { d: 0.5, f: 5000, to: 2500, q: 6, v: 0.12, at: 0.2 });
      break;
    case "reveal4":
      tone(c, { f: 70, to: 35, d: 1, type: "sine", v: 0.8 });
      arp(c, [C5, E5, G5, C6, E5 * 2, G5 * 2, C6 * 2], 0.07, "triangle", 0.4);
      noise(c, { d: 1.1, f: 6000, to: 2500, q: 8, v: 0.16, at: 0.15 });
      break;
    case "star":
      tone(c, { f: 880, d: 0.2, type: "triangle", v: 0.35 });
      tone(c, { f: 1320, d: 0.35, type: "triangle", v: 0.3, at: 0.08 });
      break;
  }
}
