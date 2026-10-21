"use client";

/**
 * Знак уровня — многослойный «голографический» значок.
 *
 * Слои: аура → корона/рамки/волны/орбита (старшие эры) → тело с вращающимся
 * кольцом, внутренней пластиной, лучами, голограммой, эмблемой и числом →
 * блик за курсором и пробегающий блик → искры и вспышки. Чем выше эра, тем
 * больше слоёв включено (тиры 0–5). У каждой эры своя форма и эмблема:
 *
 *   0 Новобранец — круг, лист
 *   1 Странник   — скруглённый квадрат, звезда-компас
 *   2 Охотник    — лист-клинок, сюрикен
 *   3 Ронин      — ромб, скрещённые катаны
 *   4 Сэнсэй     — сквиркл с рамками, круг энсо
 *   5 Сёгун      — октаграмма из двух рамок, венец
 *   6 Небожитель — радужное кольцо, всевидящее око
 *
 * Мелкие знаки на дорожке работают в облегчённом режиме без бесконечных
 * анимаций, чтобы сотня штук на странице не нагружала видеокарту.
 */

import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { ERAS } from "@/lib/levels";
import "../../app/levels.css";

export type BadgeState = "done" | "current" | "locked";

export interface EraTheme {
  c1: string;
  c2: string;
  c3: string;
  /** Свечение в виде "r,g,b" для rgba() */
  rgb: string;
  /** То же свечение как hex — для градиентов и подсветки */
  glow: string;
  shape: number;
  cosmic?: boolean;
}

export const ERA_THEME: EraTheme[] = [
  { c1: "#e4ecfa", c2: "#7f93b6", c3: "#232b45", rgb: "160,180,215", glow: "#a0b4d7", shape: 0 },
  { c1: "#a5fff0", c2: "#0fb49a", c3: "#053b34", rgb: "45,224,190", glow: "#2de0be", shape: 1 },
  { c1: "#b3d6ff", c2: "#3b7df0", c3: "#0b2467", rgb: "70,140,255", glow: "#468cff", shape: 2 },
  { c1: "#ecc9ff", c2: "#a04dff", c3: "#2e0c6b", rgb: "176,100,255", glow: "#b064ff", shape: 3 },
  { c1: "#ffd7ad", c2: "#f0591e", c3: "#581405", rgb: "255,120,66", glow: "#ff7842", shape: 4 },
  { c1: "#fff6c4", c2: "#f4ad12", c3: "#664002", rgb: "255,204,61", glow: "#ffcc3d", shape: 4 },
  { c1: "#fbeeff", c2: "#7c68ff", c3: "#1c1050", rgb: "205,160,255", glow: "#cda0ff", shape: 0, cosmic: true },
];

/** Тир эффектов по эре (0–5) */
const TIER = [0, 1, 2, 3, 3, 4, 5];
const GLOW_PX = [22, 28, 34, 42, 52, 64];
const RING_PX = [1.5, 2, 2, 2.5, 3, 3.5];
const AURA = [16, 18, 20, 26, 34, 40];
const SPARKS = [3, 5, 7, 9, 11, 14];
const WAVES = [0, 0, 1, 1, 2, 2];
const ORBIT = [0, 0, 0, 3, 5, 7];
/** Радиусы скругления тела и внутренней пластины по форме эры */
const BR = ["50%", "30%", "50% 16% 50% 16%", "20%", "38%"];
const BRI = ["50%", "24%", "50% 12% 50% 12%", "14%", "30%"];

/** Индекс эры для уровня */
export function eraIndex(level: number): number {
  let idx = 0;
  ERAS.forEach((era, i) => {
    if (level >= era.from) idx = i;
  });
  return idx;
}

const pts = (cx: number, cy: number, n: number, ro: number, ri: number, rot = -90) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 ? ri : ro;
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");

const W = "url(#lvbw)";
const D = "rgba(0,0,0,.32)";

function Dot({ x, y, r = 2, d = 0 }: { x: number; y: number; r?: number; d?: number }) {
  return <circle cx={x} cy={y} r={r} fill="#fff" className="lvb-twinkle" style={{ animationDelay: `${d}s` }} />;
}

/** Эмблемы эр (viewBox 64) */
const ICONS: ReactNode[] = [
  <>
    <path d="M32 9C49 18 53 39 32 55C11 39 15 18 32 9Z" fill={W} className="lvb-beat" />
    <path d="M32 19V50M32 30l8-6M32 38l-8-6" stroke={D} strokeWidth="2.4" strokeLinecap="round" fill="none" />
    <Dot x={50} y={14} r={1.8} d={0.4} />
    <Dot x={13} y={50} r={1.5} d={1} />
  </>,
  <>
    <circle cx="32" cy="32" r="22" stroke={W} strokeWidth="1.6" fill="none" strokeDasharray="3 4" className="lvb-dash" />
    <polygon points={pts(32, 32, 4, 27, 6.5)} fill={W} strokeLinejoin="round" className="lvb-beat" />
    <circle cx="32" cy="32" r="4.4" fill={D} />
    <Dot x={52} y={12} r={1.7} d={0.3} />
  </>,
  <>
    <g className="lvb-spin" style={{ animationDuration: "9s" }}>
      <polygon points={pts(32, 32, 4, 29, 8.5)} fill={W} strokeLinejoin="round" />
      <polygon points={pts(32, 32, 4, 17, 6, -45)} fill="rgba(0,0,0,.22)" />
    </g>
    <circle cx="32" cy="32" r="5.2" fill={D} />
    <circle cx="32" cy="32" r="2" fill="#fff" className="lvb-beat" />
  </>,
  <>
    {[45, -45].map((r) => (
      <g key={r} transform={`rotate(${r} 32 32)`}>
        <path d="M32 4L36 38H28Z" fill={W} />
        <path d="M32 6L33.200 36H32Z" fill="rgba(255,255,255,.55)" />
        <rect x="23.500" y="38" width="17" height="3.600" rx="1.500" fill={W} />
        <rect x="29.800" y="41.600" width="4.400" height="13" rx="1.600" fill={W} />
      </g>
    ))}
    <circle cx="32" cy="32" r="2.600" fill="#fff" className="lvb-beat" />
  </>,
  <>
    <g className="lvb-spin" style={{ animationDuration: "26s" }}>
      <path d="M44 12A21 21 0 1 0 53 34" stroke={W} strokeWidth="5.200" strokeLinecap="round" fill="none" />
    </g>
    <circle cx="32" cy="32" r="4.200" fill={W} className="lvb-beat" />
    <Dot x={50} y={12} r={1.6} d={0.2} />
    <Dot x={12} y={52} r={1.6} d={1.1} />
  </>,
  <>
    <path d="M10 48L13 22L24 34L32 14L40 34L51 22L54 48Z" fill={W} strokeLinejoin="round" />
    <rect x="10" y="50" width="44" height="6" rx="2.400" fill={W} />
    <circle cx="32" cy="42" r="3.400" fill={D} className="lvb-beat" />
    <circle cx="19" cy="43" r="2.200" fill={D} />
    <circle cx="45" cy="43" r="2.200" fill={D} />
    <Dot x={32} y={8} r={1.8} d={0.5} />
  </>,
  <>
    <g className="lvb-spin" style={{ animationDuration: "16s" }}>
      <circle cx="32" cy="32" r="27" stroke={W} strokeWidth="1.600" fill="none" strokeDasharray="2 5" />
    </g>
    <path d="M7 32Q32 6 57 32Q32 58 7 32Z" stroke={W} strokeWidth="3.200" fill="none" strokeLinejoin="round" />
    <circle cx="32" cy="32" r="9.500" fill={W} />
    <circle cx="32" cy="32" r="4.200" fill={D} className="lvb-beat" />
    <Dot x={52} y={10} r={1.7} d={0.2} />
    <Dot x={11} y={54} r={1.5} d={0.9} />
  </>,
];

interface LevelBadgeProps {
  level: number;
  size?: number;
  /** Состояние: пройден, текущий или закрыт */
  state?: BadgeState;
  /** Промежуточный знак (без эмблемы). По умолчанию — всё, что не начало эры */
  minor?: boolean;
  /** Переопределить эру (для шкалы эр) */
  era?: number;
  /** Подробные эффекты. По умолчанию — от размера 84 px либо у текущего */
  rich?: boolean;
  className?: string;
}

export function LevelBadge({ level, size = 96, state = "done", minor, era, rich, className = "" }: LevelBadgeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const idx = era ?? eraIndex(level);
  const t = ERA_THEME[idx] ?? ERA_THEME[0];
  const locked = state === "locked";
  const isMinor = minor ?? !ERAS.some((e) => e.from === level);
  const tier = isMinor ? Math.min(TIER[idx], 1) : TIER[idx];
  const full = rich ?? (size >= 84 || state === "current");
  const text = String(level);
  const nf = (isMinor ? 1.45 : 1) * Math.min(0.28, 0.62 / (text.length * 0.9 + 1));

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-y * 36).toFixed(1)}deg`);
    el.style.setProperty("--ry", `${(x * 36).toFixed(1)}deg`);
    el.style.setProperty("--gx", `${((x + 0.5) * 100).toFixed(0)}%`);
    el.style.setProperty("--gy", `${((y + 0.5) * 100).toFixed(0)}%`);
  };
  const leave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--gx", "50%");
    el.style.setProperty("--gy", "30%");
  };

  const vars = {
    "--s": `${size}px`,
    "--c1": t.c1,
    "--c2": t.c2,
    "--c3": t.c3,
    "--glow": t.rgb,
    "--gs": `${GLOW_PX[tier]}px`,
    "--rw": `${RING_PX[tier]}px`,
    "--au": `-${AURA[tier]}%`,
    "--br": BR[t.shape],
    "--bri": BRI[t.shape],
    "--nf": nf,
  } as CSSProperties;

  const diamond = idx === 3;
  const octa = idx === 5;
  const orbitN = full ? ORBIT[tier] : 0;
  const cls = `lvb lvb-t${tier}${full ? "" : " lvb-lite"}${locked ? " lvb-locked" : ""}${state === "current" ? " lvb-cur" : ""}${diamond ? " lvb-diamond" : ""} ${className}`;

  return (
    <div ref={ref} className={cls} style={vars} onPointerMove={full ? move : undefined} onPointerLeave={full ? leave : undefined} aria-label={`Уровень ${level}`} data-era={idx}>
      <div className="lvb-aura" />
      {full && tier >= 4 && <span className="lvb-corona" />}
      {full && tier >= 3 && <span className="lvb-frame" />}
      {full && (tier >= 4 || octa) && <span className="lvb-frame lvb-frame2" />}
      {octa && full && <span className="lvb-frame lvb-frame3" />}
      {full && Array.from({ length: WAVES[tier] }, (_, i) => <span key={i} className="lvb-wave" style={{ animationDelay: `${i * 1.5}s` }} />)}
      {orbitN > 0 && (
        <span className="lvb-orbit">
          {Array.from({ length: orbitN }, (_, i) => (
            <i key={i} style={{ "--r": `${(i * 360) / orbitN}deg`, "--d": `${i % 2 ? 3 : 5}px` } as CSSProperties} />
          ))}
        </span>
      )}

      <div className={`lvb-badge${t.cosmic ? " lvb-cosmic" : ""}`}>
        <span className="lvb-ring" />
        <span className="lvb-inner" />
        <span className="lvb-rays" />
        {tier >= 4 && <span className="lvb-holo" />}
        <span className="lvb-scan" />
        <div className="lvb-body">
          {!isMinor && (
            <svg className="lvb-ic" viewBox="0 0 64 64" fill="none" aria-hidden>
              <defs>
                <linearGradient id="lvbw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#fff" />
                  <stop offset="1" stopColor="#ffe9e2" />
                </linearGradient>
              </defs>
              {ICONS[idx]}
            </svg>
          )}
          <b className="lvb-n">{text}</b>
        </div>
        <span className="lvb-glare" />
        <span className="lvb-sheen" />
        {locked && (
          <svg className="lvb-lock" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <rect x="5" y="11" width="14" height="9" rx="2.500" fill="rgba(0,0,0,.5)" />
            <path d="M8.500 11V8a3.500 3.500 0 0 1 7 0v3" />
          </svg>
        )}
      </div>

      {full && Array.from({ length: SPARKS[tier] }, (_, i) => (
        <span key={i} className="lvb-spark" style={{ left: `${12 + ((i * 37) % 76)}%`, animationDelay: `${(i * 0.45) % 3.2}s`, animationDuration: `${2.6 + (i % 4) * 0.5}s` }} />
      ))}
      {full && tier >= 4 && <span className="lvb-glint" />}
      {full && tier >= 5 && <span className="lvb-glint lvb-glint2" />}
    </div>
  );
}
