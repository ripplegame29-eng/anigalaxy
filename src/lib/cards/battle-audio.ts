"use client";

/**
 * Звук боя: целиком синтезируется Web Audio, файлов нет.
 * Мастер-цепочка: компрессор + сверточная реверберация (общая «комната»), поверх — слоёные голоса:
 * клинок, удар, стихии, ультимейты, фанфары и тихая фоновая музыка (пад + арпеджио).
 * Звуки и музыку можно выключить отдельно в настройках боя; выбор хранится в браузере.
 */

import { useSyncExternalStore } from "react";
import type { SkillFx } from "./skills";

const K_SFX = "animehub:battle:sfx";
const K_MUS = "animehub:battle:music";
const K_VOL = "animehub:battle:volume";
const TRACK = "/audio/bleach-battle.m4a";

let ctx: AudioContext | null = null;
let forced: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let verb: ConvolverNode | null = null;
let verbIn: AudioNode | null = null;
let noiseBuf: AudioBuffer | null = null;
const samples = new Map<string, AudioBuffer>();
let samplesTried = false;
let sfxOn: boolean | null = null;
let musOn: boolean | null = null;
let vol: number | null = null;
let el: HTMLAudioElement | null = null;
let fade: ReturnType<typeof setInterval> | null = null;
let synthFallback = false;
const subs = new Set<() => void>();
const last = new Map<string, number>();

function read(key: string): boolean {
  try {
    return window.localStorage.getItem(key) !== "0";
  } catch {
    return true;
  }
}
const isSfx = (): boolean => (sfxOn ??= read(K_SFX));
const isMus = (): boolean => (musOn ??= read(K_MUS));
const emit = (): void => subs.forEach((f) => f());

export function setBattleSfx(v: boolean): void {
  sfxOn = v;
  try { window.localStorage.setItem(K_SFX, v ? "1" : "0"); } catch { /* ignore */ }
  emit();
  if (v) bs.ui();
}
const readVol = (): number => {
  try {
    const v = Number(window.localStorage.getItem(K_VOL));
    return window.localStorage.getItem(K_VOL) === null || Number.isNaN(v) ? 0.5 : Math.min(1, Math.max(0, v));
  } catch {
    return 0.5;
  }
};
export const getBattleVolume = (): number => (vol ??= readVol());

/** Целевая громкость трека с учётом выключателя */
const target = (): number => (isMus() ? Math.pow(getBattleVolume(), 1.6) * 0.9 : 0);

export function setBattleVolume(v: number): void {
  vol = Math.min(1, Math.max(0, v));
  try { window.localStorage.setItem(K_VOL, String(vol)); } catch { /* ignore */ }
  if (el && !fade) el.volume = target();
  if (vol > 0 && !isMus()) setBattleMusic(true);
  else emit();
}
export function setBattleMusic(v: boolean): void {
  musOn = v;
  try { window.localStorage.setItem(K_MUS, v ? "1" : "0"); } catch { /* ignore */ }
  if (v && getBattleVolume() === 0) vol = 0.5;
  emit();
  if (el && musicWanted) rampTo(target(), 400);
  else if (v && musicWanted) startMusic();
}

function rampTo(to: number, ms: number, done?: () => void): void {
  if (!el) return;
  if (fade) clearInterval(fade);
  const a = el;
  const from = a.volume;
  const t0 = performance.now();
  fade = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    a.volume = Math.min(1, Math.max(0, from + (to - from) * k));
    if (k >= 1) {
      if (fade) clearInterval(fade);
      fade = null;
      done?.();
    }
  }, 40);
}

const sub = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};
export const useBattleSfx = (): boolean => useSyncExternalStore(sub, isSfx, () => true);
export const useBattleMusic = (): boolean => useSyncExternalStore(sub, isMus, () => true);
export const useBattleVolume = (): number => useSyncExternalStore(sub, getBattleVolume, () => 0.5);

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = forced ?? new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 18;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.22;
      const tone0 = ctx.createBiquadFilter();
      tone0.type = "lowpass";
      tone0.frequency.value = 11000;
      tone0.Q.value = 0.5;
      const warm = ctx.createBiquadFilter();
      warm.type = "peaking";
      warm.frequency.value = 180;
      warm.gain.value = 2.5;
      comp.connect(warm).connect(tone0).connect(ctx.destination);
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(comp);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0;
      musicBus.connect(comp);
      verb = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 3.2);
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch += 1) {
        const d = buf.getChannelData(ch);
        let lp = 0;
        for (let i = 0; i < len; i += 1) {
          const k = i / len;
          lp += ((Math.random() * 2 - 1) - lp) * (0.55 - 0.45 * k); // хвост темнеет
          d[i] = lp * Math.pow(1 - k, 2.4) * (i < 900 ? i / 900 : 1);
        }
      }
      verb.buffer = buf;
      const vg = ctx.createGain();
      vg.gain.value = 0.62;
      const pre = ctx.createDelay(0.2);
      pre.delayTime.value = 0.028;
      pre.connect(verb);
      verbIn = pre;
      verb.connect(vg).connect(comp);
    }
    if (ctx.state === "suspended" && !forced) void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Подключить голос к мастеру и (с долей rev) к реверберации */
function route(c: AudioContext, g: AudioNode, rev = 0, bus: GainNode | null = master): void {
  if (bus === master && c.createStereoPanner) {
    const pn = c.createStereoPanner();
    pn.pan.value = (Math.random() - 0.5) * 0.5;
    g.connect(pn);
    pn.connect(bus!);
  } else g.connect(bus!);
  if (rev > 0 && verb) {
    const s = c.createGain();
    s.gain.value = rev;
    g.connect(s);
    s.connect(verbIn ?? verb);
  }
}

let satCurve: Float32Array | null = null;
function saturator(c: AudioContext, amt = 3): WaveShaperNode {
  if (!satCurve) {
    const n = 1024;
    satCurve = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      const x = (i / (n - 1)) * 2 - 1;
      satCurve[i] = Math.tanh(x * amt) / Math.tanh(amt);
    }
  }
  const sh = c.createWaveShaper();
  sh.curve = satCurve as Float32Array<ArrayBuffer>;
  sh.oversample = "4x";
  return sh;
}

/** FM-голос: металлический тембр (колокола, звон клинка) */
function fm(c: AudioContext, o: { f: number; ratio: number; idx: number; d: number; v: number; at?: number; rev?: number }): void {
  const t0 = c.currentTime + (o.at ?? 0);
  const car = c.createOscillator();
  const mod = c.createOscillator();
  const mg = c.createGain();
  const g = c.createGain();
  car.frequency.value = o.f;
  mod.frequency.value = o.f * o.ratio;
  mg.gain.setValueAtTime(o.f * o.idx, t0);
  mg.gain.exponentialRampToValueAtTime(Math.max(1, o.f * o.idx * 0.04), t0 + o.d);
  mod.connect(mg).connect(car.frequency);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.v, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
  car.connect(g);
  route(c, g, o.rev ?? 0.5);
  car.start(t0);
  mod.start(t0);
  car.stop(t0 + o.d + 0.05);
  mod.stop(t0 + o.d + 0.05);
}

/** «Хор»: сумма пил через формантные фильтры гласной «а» */
function choir(c: AudioContext, notes: number[], at = 0, d = 2.4, v = 0.07): void {
  const t0 = c.currentTime + at;
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(v, t0 + d * 0.35);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  [[800, 4], [1150, 6], [2800, 8]].forEach(([f, q], k) => {
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = f;
    bp.Q.value = q;
    const bg = c.createGain();
    bg.gain.value = k === 0 ? 1 : k === 1 ? 0.6 : 0.25;
    notes.forEach((n, i) => {
      [-9, 0, 9].forEach((dt) => {
        const o = c.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = n;
        o.detune.value = dt + i * 2;
        const vib = c.createOscillator();
        const vg = c.createGain();
        vib.frequency.value = 5 + i * 0.3;
        vg.gain.value = 6;
        vib.connect(vg).connect(o.detune);
        o.connect(bp);
        o.start(t0);
        vib.start(t0);
        o.stop(t0 + d + 0.1);
        vib.stop(t0 + d + 0.1);
      });
    });
    bp.connect(bg).connect(out);
  });
  route(c, out, 0.7);
}

interface ToneO { f: number; to?: number; d: number; type?: OscillatorType; v?: number; at?: number; rev?: number; det?: number; atk?: number; bus?: GainNode | null; lp?: number }
function tone(c: AudioContext, o: ToneO): void {
  const t0 = c.currentTime + (o.at ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.f, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.d);
  if (o.det) osc.detune.value = o.det;
  const v = o.v ?? 0.3;
  const atk = o.atk ?? Math.min(0.012, o.d / 4);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
  let node: AudioNode = osc;
  if (o.lp) {
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = o.lp;
    osc.connect(f);
    node = f;
  }
  node.connect(g);
  route(c, g, o.rev ?? 0, o.bus ?? master);
  osc.start(t0);
  osc.stop(t0 + o.d + 0.08);
}

interface NoiseO { d: number; f: number; to?: number; q?: number; v?: number; at?: number; type?: BiquadFilterType; rev?: number; atk?: number }
function noise(c: AudioContext, o: NoiseO): void {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
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
  g.gain.exponentialRampToValueAtTime(o.v ?? 0.3, t0 + (o.atk ?? Math.min(0.02, o.d / 3)));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
  src.connect(fl).connect(g);
  route(c, g, o.rev ?? 0);
  src.start(t0, Math.random());
  src.stop(t0 + o.d + 0.08);
}

/** Колокольчик: несколько негармоничных обертонов с разной длиной затухания */
function bell(c: AudioContext, f: number, d = 1.2, v = 0.2, at = 0, rev = 0.5): void {
  [[1, 1], [2.01, 0.55], [2.76, 0.4], [4.07, 0.22], [5.4, 0.12]].forEach(([m, a], i) => tone(c, { f: f * m, d: d / (1 + i * 0.45), v: v * a, at, rev, type: "sine" }));
  fm(c, { f, ratio: 1.4, idx: 0.9, d: d * 0.7, v: v * 0.35, at, rev });
}
/** Щипок арфы */
const pluck = (c: AudioContext, f: number, at = 0, v = 0.2, d = 0.9, rev = 0.45): void => {
  tone(c, { f, d, type: "triangle", v, at, rev, lp: 4200 });
  tone(c, { f: f * 2, d: d * 0.5, type: "sine", v: v * 0.35, at, rev });
};
const N = { A2: 110, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196, A3: 220, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5 };

function gate(name: string, ms = 40): boolean {
  const now = performance.now();
  if (now - (last.get(name) ?? 0) < ms) return false;
  last.set(name, now);
  return true;
}
function loadSamples(c: AudioContext): void {
  if (samplesTried) return;
  samplesTried = true;
  void fetch("/sfx/manifest.json")
    .then((r) => (r.ok ? (r.json() as Promise<string[]>) : []))
    .then((list) => {
      list.forEach((n) => {
        void fetch(`/sfx/${n}.ogg`)
          .then((r) => r.arrayBuffer())
          .then((b) => c.decodeAudioData(b))
          .then((buf) => samples.set(n, buf))
          .catch(() => {});
      });
    })
    .catch(() => {});
}
function playSample(c: AudioContext, name: string, vol = 1): boolean {
  const buf = samples.get(name);
  if (!buf || !master) return false;
  const src = c.createBufferSource();
  const g = c.createGain();
  src.buffer = buf;
  src.playbackRate.value = 0.97 + Math.random() * 0.06;
  g.gain.value = vol;
  src.connect(g);
  route(c, g, 0.12);
  src.start();
  return true;
}
function run(name: string, fn: (c: AudioContext) => void, ms = 40): void {
  if (typeof window === "undefined" || !isSfx() || !gate(name, ms)) return;
  const c = audio();
  if (!c || !master) return;
  loadSamples(c);
  if (playSample(c, name)) return;
  fn(c);
}

/* ------------------------------- голоса ------------------------------- */

const swish = (c: AudioContext, at = 0, v = 0.3): void => {
  noise(c, { d: 0.2, f: 3600, to: 900, q: 1.1, v: v * 0.8, at, atk: 0.05, rev: 0.4 });
  noise(c, { d: 0.12, f: 6500, to: 2600, q: 2, v: v * 0.22, at: at + 0.02, atk: 0.04, rev: 0.4 });
};
const shing = (c: AudioContext, at = 0, v = 0.16): void => {
  fm(c, { f: 1568, ratio: 3.51, idx: 2.2, d: 1.1, v: v * 0.8, at, rev: 0.8 });
  fm(c, { f: 2349, ratio: 2.76, idx: 1.4, d: 0.8, v: v * 0.6, at: at + 0.012, rev: 0.8 });
  tone(c, { f: 3136, d: 0.6, type: "sine", v: v * 0.35, at: at + 0.01, rev: 0.8 });
  noise(c, { d: 0.04, f: 6000, q: 3, v: v * 0.35, at, type: "highpass" });
};
const thud = (c: AudioContext, p = 1, at = 0): void => {
  {
    const t0 = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(220, t0);
    o.frequency.exponentialRampToValueAtTime(52, t0 + 0.16);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.6 * p, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
    o.connect(saturator(c, 2.6)).connect(g);
    route(c, g, 0.18);
    o.start(t0);
    o.stop(t0 + 0.4);
  }
  noise(c, { d: 0.035, f: 2400, q: 1.2, v: 0.38 * p, at, atk: 0.002 });
  tone(c, { f: 150, to: 40, d: 0.28 + 0.1 * p, type: "sine", v: 0.5 * p, at });
  tone(c, { f: 78, to: 30, d: 0.4, type: "sine", v: 0.35 * p, at });
  tone(c, { f: 52, to: 36, d: 0.55, type: "sine", v: 0.3 * p, at, rev: 0.25 });
  noise(c, { d: 0.1, f: 2200, to: 220, q: 0.7, v: 0.34 * p, at, type: "lowpass", rev: 0.2 });
};
const boom = (c: AudioContext, p = 1, at = 0): void => {
  noise(c, { d: 1.6, f: 5200, to: 160, q: 0.9, v: 0.16 * p, at: at + 0.05, rev: 0.7 });
  tone(c, { f: 100, to: 28, d: 1.3, type: "sine", v: 0.7 * p, at, rev: 0.4 });
  noise(c, { d: 0.9, f: 1800, to: 120, q: 0.6, v: 0.38 * p, at, type: "lowpass", rev: 0.5 });
  noise(c, { d: 0.5, f: 6000, to: 900, q: 0.8, v: 0.2 * p, at, rev: 0.6 });
};
const riser = (c: AudioContext, d: number, v = 0.22, at = 0): void => {
  noise(c, { d, f: 300, to: 7500, q: 2.2, v, at, atk: d * 0.8, rev: 0.3 });
  tone(c, { f: 110, to: 880, d, type: "sawtooth", v: v * 0.5, at, atk: d * 0.85, lp: 2400, rev: 0.3 });
  tone(c, { f: 112, to: 884, d, type: "sawtooth", v: v * 0.4, at, atk: d * 0.85, lp: 2400, det: 14 });
};
const chord = (c: AudioContext, notes: number[], at = 0, d = 1.6, v = 0.11, type: OscillatorType = "sawtooth"): void => {
  if (type === "sawtooth" && d >= 1.4) choir(c, notes.map((f) => (f < 200 ? f * 2 : f)), at, d, v * 0.55);
  notes.forEach((f, i) => {
    tone(c, { f, d, type, v, at, atk: 0.06, rev: 0.55, lp: 2600, det: i % 2 ? 7 : -7 });
  });
};

/** Россыпь коротких искр: «звёздная пыль» поверх колокольчиков */
const sparkle = (c: AudioContext, at = 0, v = 0.08, n = 5, base = 3000): void => {
  for (let i = 0; i < n; i += 1) {
    const f = base * (1 + ((i * 0.37) % 1) * 1.6);
    tone(c, { f, d: 0.35 + (i % 3) * 0.12, type: "sine", v: v * (1 - i / (n + 2)), at: at + i * 0.055, rev: 0.8 });
  }
};
/** Треск и искры: короткие высокочастотные щелчки */
const crackle = (c: AudioContext, at = 0, n = 8, v = 0.16, step = 0.07): void => {
  for (let i = 0; i < n; i += 1) noise(c, { d: 0.035, f: 3500 + ((i * 631) % 3200), q: 2, v: v * (0.5 + ((i * 7) % 5) / 8), at: at + i * step + ((i * 13) % 5) * 0.006, type: "highpass", rev: 0.25 });
};

function fxSound(c: AudioContext, fx: SkillFx, power: number): void {
  const p = power;
  switch (fx) {
    case "slash":
      swish(c, 0, 0.42 * p);
      noise(c, { d: 0.05, f: 5200, q: 1.5, v: 0.3 * p, at: 0.05, type: "highpass" });
      shing(c, 0.05, 0.24 * p);
      thud(c, 0.8 * p, 0.07);
      bell(c, N.E6, 0.9, 0.05 * p, 0.08, 0.7);
      break;
    case "pierce":
      tone(c, { f: 900, to: 3800, d: 0.12, type: "sine", v: 0.18 * p, rev: 0.3 });
      noise(c, { d: 0.08, f: 6500, q: 2, v: 0.2 * p, type: "highpass" });
      shing(c, 0.035, 0.26 * p);
      thud(c, 0.7 * p, 0.06);
      bell(c, N.G5, 1, 0.07 * p, 0.07, 0.7);
      break;
    case "whirl":
      swish(c, 0, 0.3 * p);
      swish(c, 0.1, 0.3 * p);
      swish(c, 0.2, 0.26 * p);
      noise(c, { d: 0.55, f: 600, to: 5200, q: 2.5, v: 0.14 * p, rev: 0.4 });
      shing(c, 0.22, 0.2 * p);
      thud(c, 0.7 * p, 0.3);
      break;
    case "fire":
      noise(c, { d: 0.9, f: 400, to: 2200, q: 1, v: 0.3 * p, atk: 0.25, rev: 0.35 });
      noise(c, { d: 0.7, f: 3500, to: 500, q: 0.8, v: 0.24 * p, at: 0.05, type: "lowpass" });
      tone(c, { f: 160, to: 45, d: 0.8, type: "sawtooth", v: 0.2 * p, lp: 800, rev: 0.3 });
      crackle(c, 0.12, 9, 0.18 * p);
      boom(c, 0.5 * p, 0.04);
      break;
    case "burst":
      boom(c, 0.85 * p);
      noise(c, { d: 0.6, f: 8000, to: 1500, q: 1, v: 0.2 * p, type: "highpass", rev: 0.5 });
      chord(c, [N.A3, N.E4, N.A4], 0.02, 1.2, 0.07 * p, "triangle");
      shing(c, 0.02, 0.2 * p);
      break;
    case "rain":
      for (let i = 0; i < 14; i += 1) noise(c, { d: 0.05, f: 5000 + ((i * 337) % 1700), q: 2, v: 0.16 * p, at: 0.02 + i * 0.045, type: "highpass", rev: 0.3 });
      noise(c, { d: 0.9, f: 500, to: 120, q: 0.7, v: 0.22 * p, type: "lowpass", atk: 0.2, rev: 0.4 });
      thud(c, 0.6 * p, 0.5);
      sparkle(c, 0.5, 0.05 * p, 4, 3400);
      break;
    case "ice":
      noise(c, { d: 0.04, f: 9000, q: 1, v: 0.35 * p, type: "highpass" });
      for (let i = 0; i < 5; i += 1) bell(c, N.C6 * (1 + i * 0.19), 0.8, 0.08 * p, 0.02 + i * 0.045, 0.7);
      tone(c, { f: 2400, to: 1200, d: 0.25, type: "sine", v: 0.1 * p, rev: 0.6 });
      noise(c, { d: 0.8, f: 8000, q: 6, v: 0.07 * p, type: "highpass", atk: 0.2, rev: 0.7 });
      thud(c, 0.55 * p, 0.05);
      break;
    case "wind":
      noise(c, { d: 1, f: 300, to: 3500, q: 3, v: 0.3 * p, atk: 0.3, rev: 0.45 });
      noise(c, { d: 0.7, f: 3000, to: 400, q: 3, v: 0.22 * p, at: 0.3, rev: 0.45 });
      tone(c, { f: 420, to: 840, d: 0.9, type: "sine", v: 0.05 * p, atk: 0.4, rev: 0.7 });
      swish(c, 0.5, 0.2 * p);
      break;
    case "earth":
    case "quake":
      tone(c, { f: 62, to: 28, d: 1.2, type: "sine", v: 0.65 * p });
      noise(c, { d: 1.1, f: 280, to: 80, q: 0.7, v: 0.5 * p, type: "lowpass" });
      for (let i = 0; i < 8; i += 1) noise(c, { d: 0.06, f: 700 + i * 160, q: 2, v: 0.22 * p, at: 0.06 + i * 0.075 });
      boom(c, 0.5 * p);
      thud(c, 0.9 * p, 0.02);
      break;
    case "beam":
      // мягкий заряд: светящийся «воздух» и чистый звон нарастают, затем чистый разряд
      noise(c, { d: 0.5, f: 1500, to: 6500, q: 3, v: 0.1 * p, atk: 0.42, rev: 0.5 });
      fm(c, { f: 440, ratio: 2, idx: 0.8, d: 0.55, v: 0.07 * p, rev: 0.6 });
      tone(c, { f: 660, to: 1760, d: 0.5, type: "sine", v: 0.09 * p, atk: 0.4, rev: 0.6 });
      tone(c, { f: 1320, to: 3520, d: 0.5, type: "sine", v: 0.04 * p, atk: 0.4, rev: 0.7 });
      noise(c, { d: 0.5, f: 220, to: 900, q: 0.8, v: 0.1 * p, type: "lowpass", atk: 0.4 });
      shing(c, 0.5, 0.2 * p);
      boom(c, 0.6 * p, 0.5);
      bell(c, N.E6, 1.4, 0.08 * p, 0.52, 0.8);
      break;
    case "dark":
      tone(c, { f: 55, to: 38, d: 1.3, type: "sawtooth", v: 0.28 * p, lp: 420, atk: 0.3, rev: 0.4 });
      tone(c, { f: 58, to: 40, d: 1.3, type: "sawtooth", v: 0.2 * p, lp: 420, atk: 0.3, det: 12 });
      chord(c, [N.A3, N.C4, N.E4], 0.1, 1.6, 0.05 * p);
      noise(c, { d: 0.9, f: 200, to: 2500, q: 2, v: 0.14 * p, atk: 0.5, rev: 0.5 });
      thud(c, 0.6 * p, 0.55);
      break;
    case "drain":
      tone(c, { f: 900, to: 180, d: 0.9, type: "triangle", v: 0.2 * p, rev: 0.5 });
      fm(c, { f: 400, ratio: 1.5, idx: 2, d: 0.9, v: 0.08 * p, rev: 0.5 });
      noise(c, { d: 0.8, f: 3000, to: 300, q: 2, v: 0.18 * p, rev: 0.4 });
      thud(c, 0.4 * p, 0.7);
      bell(c, N.A3, 1.6, 0.1 * p, 0.6, 0.8);
      break;
    case "poison":
      for (let i = 0; i < 7; i += 1) {
        const f = 300 + ((i * 97) % 260);
        tone(c, { f, to: f * 1.8, d: 0.09, type: "sine", v: 0.16 * p, at: i * 0.07, rev: 0.3 });
      }
      tone(c, { f: 150, to: 110, d: 0.7, type: "sawtooth", v: 0.15 * p, lp: 700, rev: 0.3 });
      tone(c, { f: 153, to: 112, d: 0.7, type: "sawtooth", v: 0.1 * p, lp: 700, det: 14 });
      noise(c, { d: 0.6, f: 900, to: 300, q: 1.5, v: 0.12 * p, rev: 0.4 });
      break;
    case "debuff":
      [N.E5, N.C5, N.A4, N.E4].forEach((f, i) => tone(c, { f, d: 0.32, type: "sawtooth", v: 0.09 * p, at: i * 0.09, lp: 1500, rev: 0.45 }));
      noise(c, { d: 0.5, f: 2500, to: 300, q: 1.2, v: 0.12 * p, at: 0.1, rev: 0.4 });
      thud(c, 0.5 * p, 0.3);
      break;
    case "taunt":
      chord(c, [N.D3, N.A3, N.D4, N.F4], 0, 0.9, 0.1 * p);
      shing(c, 0.02, 0.18 * p);
      noise(c, { d: 0.5, f: 500, to: 1400, q: 1.5, v: 0.16 * p, rev: 0.4 });
      thud(c, 0.7 * p);
      break;
    case "heal":
      [N.C5, N.E5, N.G5, N.C6, N.E6].forEach((f, i) => pluck(c, f, i * 0.07, 0.16 * p));
      choir(c, [N.C4, N.E4, N.G4, N.C5], 0, 2, 0.05 * p);
      bell(c, N.C6, 1.6, 0.09 * p, 0.25, 0.8);
      noise(c, { d: 0.8, f: 7000, q: 6, v: 0.05 * p, type: "highpass", atk: 0.2, rev: 0.7 });
      break;
    case "shield":
      noise(c, { d: 0.3, f: 1200, to: 5000, q: 4, v: 0.2 * p, rev: 0.5 });
      bell(c, N.G5, 1.1, 0.16 * p, 0.04, 0.6);
      bell(c, N.C6, 1.2, 0.09 * p, 0.1, 0.7);
      tone(c, { f: 300, to: 150, d: 0.3, type: "triangle", v: 0.22 * p });
      shing(c, 0.06, 0.12 * p);
      break;
    case "buff":
      [N.G4, N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone(c, { f, d: 0.4, type: "triangle", v: 0.14 * p, at: i * 0.055, rev: 0.5 }));
      noise(c, { d: 0.4, f: 1500, to: 7000, q: 2, v: 0.1 * p, rev: 0.4 });
      choir(c, [N.C4, N.G4, N.C5], 0, 1.4, 0.045 * p);
      bell(c, N.E6, 1.2, 0.08 * p, 0.3, 0.8);
      break;
  }
}

/* ---------- интерфейс и гача (бывший sound.ts): те же голоса, свой переключатель ---------- */

function runAny(name: string, fn: (c: AudioContext) => void, ms = 35): void {
  if (typeof window === "undefined" || !gate(`ux-${name}`, ms)) return;
  const c = audio();
  if (!c || !master) return;
  fn(c);
}

export type UxName = "ok" | "err" | "hit" | "crit" | "cast" | "ult" | "heal" | "shield" | "ko" | "win" | "lose" | "charge" | "burst" | "reveal0" | "reveal1" | "reveal2" | "reveal3" | "reveal4" | "star";

export function uxPlay(name: UxName): void {
  switch (name) {
    case "ok": runAny(name, (c) => { bell(c, N.E5, 0.6, 0.1, 0, 0.6); bell(c, N.A5, 0.9, 0.1, 0.07, 0.6); }); break;
    case "err": runAny(name, (c) => { tone(c, { f: 200, to: 120, d: 0.22, type: "triangle", v: 0.22, lp: 700, rev: 0.2 }); tone(c, { f: 150, to: 90, d: 0.25, type: "triangle", v: 0.2, at: 0.12, lp: 600, rev: 0.2 }); noise(c, { d: 0.12, f: 500, to: 150, v: 0.12, type: "lowpass" }); }); break;
    case "hit": runAny(name, (c) => { thud(c, 0.9); swish(c, 0, 0.14); }); break;
    case "crit": runAny(name, (c) => { thud(c, 1.25); shing(c, 0.01, 0.2); tone(c, { f: N.A5, to: N.E6, d: 0.25, type: "triangle", v: 0.16, at: 0.03, rev: 0.5 }); bell(c, N.E6, 0.9, 0.1, 0.06, 0.7); }); break;
    case "cast": runAny(name, (c) => { tone(c, { f: 300, to: 960, d: 0.35, type: "sawtooth", v: 0.1, lp: 2600, rev: 0.4 }); noise(c, { d: 0.32, f: 900, to: 4200, q: 2, v: 0.12, rev: 0.35 }); shing(c, 0.3, 0.12); bell(c, N.A5, 1.1, 0.08, 0.32, 0.8); }); break;
    case "ult": runAny(name, (c) => { riser(c, 0.9, 0.24); boom(c, 0.9, 0.85); chord(c, [N.A3, N.E4, N.A4, N.C5], 0.88, 1.8, 0.07); bell(c, N.A5, 1.6, 0.12, 0.95, 0.8); shing(c, 0.9, 0.2); }); break;
    case "heal": runAny(name, (c) => fxSound(c, "heal", 0.8), 200); break;
    case "shield": runAny(name, (c) => fxSound(c, "shield", 0.8), 200); break;
    case "ko": runAny(name, (c) => { thud(c, 1.15); noise(c, { d: 0.45, f: 7000, to: 700, q: 0.8, v: 0.25, rev: 0.4 }); tone(c, { f: 400, to: 55, d: 0.7, type: "sawtooth", v: 0.16, lp: 1500, rev: 0.4 }); bell(c, N.A3, 1.8, 0.1, 0.1, 0.9); }); break;
    case "win": runAny(name, (c) => { boom(c, 0.8); [[N.A3, N.E4, N.A4], [N.C4, N.G4, N.C5], [N.D4, N.A4, N.D5], [N.E4, N.B4, N.E5]].forEach((ch, i) => chord(c, ch, 0.1 + i * 0.28, i === 3 ? 2.6 : 0.9, 0.09)); [N.A5, N.C6, N.E6, N.A5 * 2].forEach((f, i) => pluck(c, f, 1.1 + i * 0.1, 0.16, 1.6)); bell(c, N.E6, 2.6, 0.12, 1.2, 0.9); }, 500); break;
    case "lose": runAny(name, (c) => { [[N.A3, N.C4, N.E4], [N.F3, N.A3, N.C4], [N.E3, N.G3, N.B3]].forEach((ch, i) => chord(c, ch, i * 0.55, 1.6, 0.08, "triangle")); tone(c, { f: 110, to: 55, d: 2.2, type: "sine", v: 0.35, rev: 0.4 }); bell(c, N.A3, 2.8, 0.1, 0.3, 0.9); }, 500); break;
    case "charge": runAny(name, (c) => { riser(c, 1, 0.2); sparkle(c, 0.5, 0.05, 6, 2800); bell(c, N.E6, 1, 0.08, 0.95, 0.8); }); break;
    case "burst": runAny(name, (c) => { boom(c, 1); noise(c, { d: 0.6, f: 8000, to: 1500, q: 1, v: 0.18, type: "highpass", rev: 0.5 }); chord(c, [N.A3, N.E4, N.A4], 0.02, 1.2, 0.07, "triangle"); shing(c, 0.02, 0.2); }); break;
    case "reveal0":
    case "reveal1": runAny(name, (c) => { bell(c, N.E5, 0.6, 0.1, 0, 0.6); bell(c, N.A5, 0.8, 0.09, 0.07, 0.6); }); break;
    case "reveal2": runAny(name, (c) => { [N.C5, N.E5, N.G5].forEach((f, i) => pluck(c, f, i * 0.09, 0.16)); bell(c, N.G5, 1.2, 0.08, 0.2, 0.8); }); break;
    case "reveal3": runAny(name, (c) => { [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => pluck(c, f, i * 0.09, 0.17)); choir(c, [N.C4, N.E4, N.G4, N.C5], 0.1, 2, 0.05); sparkle(c, 0.3, 0.05, 5, 3200); bell(c, N.C6, 1.6, 0.1, 0.36, 0.8); }); break;
    case "reveal4": runAny(name, (c) => { riser(c, 0.5, 0.14); boom(c, 0.85, 0.48); chord(c, [N.A2 * 2, N.A3, N.E4, N.A4, N.C5], 0.5, 2.4, 0.07); [N.C5, N.E5, N.G5, N.C6, N.E6, N.G5 * 2, N.C6 * 2].forEach((f, i) => pluck(c, f, 0.55 + i * 0.07, 0.15, 1.4)); sparkle(c, 0.6, 0.06, 8, 3000); bell(c, N.E6, 2.6, 0.12, 0.85, 0.9); shing(c, 0.5, 0.18); }, 400); break;
    case "star": runAny(name, (c) => { bell(c, N.E6, 1.2, 0.13, 0, 0.8); bell(c, N.A5, 1, 0.08, 0.06, 0.7); sparkle(c, 0.05, 0.05, 4, 3600); }); break;
  }
}


export const bs = {
  ui: (): void => run("ui", (c) => { tone(c, { f: 880, d: 0.1, type: "triangle", v: 0.16 }); tone(c, { f: 1320, d: 0.16, type: "triangle", v: 0.14, at: 0.06, rev: 0.3 }); }, 80),
  /** Начало применения умения: «зарядка» */
  cast: (fx: SkillFx, ult: boolean, tier = 0): void =>
    run(`cast`, (c) => {
      if (ult) {
        riser(c, tier ? 1.4 : 0.9, tier ? 0.3 : 0.24);
        bell(c, N.A5, 1.6, 0.12, 0.1, 0.8);
        return;
      }
      shing(c, 0.01, 0.2);
      tone(c, { f: N.A5, to: N.E6, d: 0.25, type: "triangle", v: 0.16, at: 0.03, rev: 0.5 });
      bell(c, N.E6, 0.9, 0.1, 0.06, 0.7);
    }, 60),
  /** Момент попадания умения */
  impact: (fx: SkillFx, ult: boolean, big: boolean): void =>
    run("impact", (c) => {
      fxSound(c, fx, ult ? 1.25 : 1);
      if (ult) {
        boom(c, big ? 1.2 : 0.85);
        chord(c, [N.A3, N.E4, N.A4, N.C5], 0.02, 1.8, 0.07);
      }
    }, 90),
  /** Бан-кай и именные формы: гонг, обратный свист, хор и удар */
  bankai: (): void =>
    run("bankai", (c) => {
      bell(c, 73.4, 4, 0.3, 0, 0.9);
      tone(c, { f: 36, to: 30, d: 3.2, type: "sine", v: 0.3, atk: 0.4 });
      noise(c, { d: 1.5, f: 200, to: 9000, q: 1.4, v: 0.28, atk: 1.3, rev: 0.4 });
      choir(c, [N.A2 * 2, N.E3 * 2, N.A3 * 2, N.C4 * 2], 0.5, 3.4, 0.06);
      boom(c, 1.3, 1.5);
      shing(c, 1.5, 0.22);
      shing(c, 1.75, 0.2);
      bell(c, N.E6, 3, 0.1, 1.55, 0.9);
    }, 1200),
  swing: (): void => run("swing", (c) => swish(c, 0, 0.22), 120),
  hit: (crit: boolean, big: boolean): void =>
    run("hit", (c) => {
      thud(c, crit ? 1.25 : big ? 1.05 : 0.8);
      if (crit) {
        shing(c, 0.01, 0.2);
        tone(c, { f: N.A5, to: N.E6, d: 0.25, type: "triangle", v: 0.16, at: 0.03, rev: 0.5 });
        bell(c, N.E6, 0.9, 0.1, 0.06, 0.7);
      }
    }, 60),
  heal: (): void => run("heal", (c) => fxSound(c, "heal", 0.8), 200),
  shield: (): void => run("shield", (c) => fxSound(c, "shield", 0.8), 200),
  status: (buff: boolean, on: boolean): void =>
    run("status", (c) => {
      if (!on) return;
      if (buff) [N.E5, N.A5].forEach((f, i) => tone(c, { f, d: 0.3, type: "triangle", v: 0.13, at: i * 0.07, rev: 0.5 }));
      else [N.E5, N.C5, N.A4].forEach((f, i) => tone(c, { f, d: 0.28, type: "sawtooth", v: 0.07, at: i * 0.07, lp: 1400, rev: 0.4 }));
    }, 120),
  dot: (): void => run("dot", (c) => { noise(c, { d: 0.35, f: 1200, to: 400, q: 1, v: 0.18, rev: 0.2 }); tone(c, { f: 130, to: 70, d: 0.2, type: "sine", v: 0.2 }); }, 150),
  ko: (last: boolean): void =>
    run("ko", (c) => {
      thud(c, 1.25);
      shing(c, 0.01, 0.2);
      tone(c, { f: N.A5, to: N.E6, d: 0.25, type: "triangle", v: 0.16, at: 0.03, rev: 0.5 });
      bell(c, N.E6, 0.9, 0.1, 0.06, 0.7);
      if (last) { boom(c, 1.2, 0.1); bell(c, N.A2 * 2, 2.4, 0.16, 0.2, 0.9); }
    }, 150),
  revive: (): void => run("revive", (c) => { chord(c, [N.C4, N.E4, N.G4, N.C5], 0, 1.8, 0.09, "triangle"); [N.C5, N.E5, N.G5, N.C6, N.E6].forEach((f, i) => pluck(c, f, 0.1 + i * 0.07, 0.14)); }, 300),
  tactic: (): void => run("tactic", (c) => { bell(c, N.D5, 1.4, 0.16, 0, 0.7); noise(c, { d: 0.5, f: 800, to: 3800, q: 2, v: 0.12, rev: 0.4 }); tone(c, { f: 196, to: 392, d: 0.5, type: "triangle", v: 0.16, rev: 0.4 }); }, 300),
  stun: (): void => run("stun", (c) => { bell(c, 740, 0.7, 0.1, 0, 0.6); bell(c, 622, 0.8, 0.1, 0.12, 0.6); }, 200),
  /** Баннер раунда: низкий гонг */
  round: (): void => run("round", (c) => { bell(c, 98, 3.2, 0.26, 0, 0.85); bell(c, 196, 2.4, 0.12, 0.02, 0.85); tone(c, { f: 49, d: 2.2, type: "sine", v: 0.22, atk: 0.05 }); noise(c, { d: 0.5, f: 300, to: 2000, q: 1.5, v: 0.1, rev: 0.4 }); }, 400),
  /** Заставка перед боем */
  intro: (): void => run("intro", (c) => { riser(c, 1.6, 0.2); boom(c, 1, 1.55); chord(c, [N.A2 * 2, N.A3, N.E4, N.A4, N.C5], 1.55, 2.4, 0.07); bell(c, N.A5, 2.2, 0.12, 1.6, 0.9); }, 1000),
  /** Раздача карт на поле */
  deal: (): void => run("deal", (c) => { for (let i = 0; i < 8; i += 1) { swish(c, i * 0.2, 0.12); tone(c, { f: 180, to: 90, d: 0.1, type: "sine", v: 0.16, at: i * 0.2 + 0.1 }); } }, 1500),
  win: (): void =>
    run("win", (c) => {
      boom(c, 0.8);
      [[N.A3, N.E4, N.A4], [N.C4, N.G4, N.C5], [N.D4, N.A4, N.D5], [N.E4, N.B4, N.E5]].forEach((ch, i) => chord(c, ch, 0.1 + i * 0.28, i === 3 ? 2.6 : 0.9, 0.09));
      [N.A5, N.C6, N.E6, N.A5 * 2].forEach((f, i) => pluck(c, f, 1.1 + i * 0.1, 0.16, 1.6));
      bell(c, N.E6, 2.6, 0.12, 1.2, 0.9);
    }, 1000),
  lose: (): void =>
    run("lose", (c) => {
      [[N.A3, N.C4, N.E4], [N.F3, N.A3, N.C4], [N.E3, N.G3, N.B3]].forEach((ch, i) => chord(c, ch, i * 0.55, 1.6, 0.08, "triangle"));
      tone(c, { f: 110, to: 55, d: 2.2, type: "sine", v: 0.35, rev: 0.4 });
      bell(c, N.A3, 2.8, 0.1, 0.3, 0.9);
    }, 1000),
};

/* ----------------------------- фоновая музыка ----------------------------- */

let musicWanted = false;
let musicTimer: ReturnType<typeof setTimeout> | null = null;
let bar = 0;
const BEAT = 0.6;
const PROG: { pad: number[]; bass: number; arp: number[] }[] = [
  { pad: [N.A3, N.C4, N.E4], bass: N.A2, arp: [N.A4, N.C5, N.E5, N.A5] },
  { pad: [N.F3, N.A3, N.C4], bass: N.F3 / 2, arp: [N.F4, N.A4, N.C5, N.F4 * 2] },
  { pad: [N.C4, N.E4, N.G4], bass: N.C3 / 1, arp: [N.G4, N.C5, N.E5, N.G5] },
  { pad: [N.G3, N.B3, N.D4], bass: N.G3 / 2, arp: [N.G4, N.B4, N.D5, N.G5] },
];

function scheduleBar(): void {
  if (!musicWanted || !ctx || !musicBus || !isMus()) return;
  const c = ctx;
  const p = PROG[bar % PROG.length];
  const at = 0.05;
  p.pad.forEach((f, i) => {
    tone(c, { f, d: BEAT * 4.6, type: "sawtooth", v: 0.05, at, atk: 1.1, lp: 900, det: i * 5 - 5, rev: 0.6, bus: musicBus });
    tone(c, { f: f * 2, d: BEAT * 4.6, type: "sine", v: 0.03, at, atk: 1.4, rev: 0.7, bus: musicBus });
  });
  tone(c, { f: p.bass, d: BEAT * 4, type: "sine", v: 0.16, at, atk: 0.05, bus: musicBus });
  [0, 2].forEach((b) => tone(c, { f: 62, to: 38, d: 0.35, type: "sine", v: 0.2, at: at + b * BEAT, bus: musicBus }));
  for (let i = 0; i < 8; i += 1) tone(c, { f: p.arp[(i * 3 + (bar % 2)) % p.arp.length], d: 0.7, type: "triangle", v: i % 2 ? 0.03 : 0.045, at: at + i * (BEAT / 2), rev: 0.55, lp: 3200, bus: musicBus });
  if (bar % 4 === 3) noise(c, { d: BEAT * 3, f: 500, to: 5200, q: 1.8, v: 0.035, at: at + BEAT, atk: BEAT * 2.6, rev: 0.5 });
  bar += 1;
  musicTimer = setTimeout(scheduleBar, BEAT * 4 * 1000 - 40);
}

export function startMusic(): void {
  musicWanted = true;
  if (typeof window === "undefined") return;
  if (synthFallback) return startSynth();
  if (!el) {
    el = new Audio(TRACK);
    el.loop = true;
    el.preload = "auto";
    el.volume = 0;
    el.addEventListener("error", () => {
      synthFallback = true;
      el = null;
      if (musicWanted) startSynth();
    });
  }
  const a = el;
  if (!a.paused && !fade) {
    rampTo(target(), 600);
    return;
  }
  a.volume = 0;
  void a.play().then(() => rampTo(target(), 2200)).catch(() => { /* автозапуск запрещён: стартуем после первого жеста */ });
}

export function stopMusic(): void {
  musicWanted = false;
  stopSynth();
  if (el) {
    const a = el;
    rampTo(0, 1200, () => { if (!musicWanted) a.pause(); });
  }
}

/* резервная синтезированная музыка, если трек не загрузился */
function startSynth(): void {
  if (typeof window === "undefined" || !isMus()) return;
  const c = audio();
  if (!c || !musicBus || musicTimer) return;
  musicBus.gain.cancelScheduledValues(c.currentTime);
  musicBus.gain.setValueAtTime(musicBus.gain.value, c.currentTime);
  musicBus.gain.linearRampToValueAtTime(0.9, c.currentTime + 2.2);
  bar = 0;
  scheduleBar();
}
function stopSynth(): void {
  if (musicTimer) clearTimeout(musicTimer);
  musicTimer = null;
  if (ctx && musicBus) {
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime);
    musicBus.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
  }
}

/** Офлайн-рендер звука в буфер (для прослушивания и выгрузки в файлы) */
export async function renderBattleSound(fn: () => void, seconds: number): Promise<AudioBuffer> {
  const saved = { ctx, master, musicBus, verb, verbIn, noiseBuf, sfxOn };
  const off = new OfflineAudioContext(2, Math.ceil(44100 * seconds), 44100);
  forced = off as unknown as AudioContext;
  ctx = null;
  master = null;
  musicBus = null;
  verb = null;
  verbIn = null;
  noiseBuf = null;
  sfxOn = true;
  last.clear();
  try {
    audio();
    fn();
    return await off.startRendering();
  } finally {
    forced = null;
    ({ ctx, master, musicBus, verb, verbIn, noiseBuf, sfxOn } = saved);
  }
}
