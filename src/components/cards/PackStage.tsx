"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";

export type PackPhase = "idle" | "charge" | "burst";

const TEETH = 20;
const W = 240 / TEETH;
const zigTop = (() => {
  let d = "M0 0H240V26";
  for (let i = 0; i < TEETH; i += 1) d += ` l${-W / 2} 6 l${-W / 2} -6`;
  return `${d}Z`;
})();
const zigBottom = (() => {
  let d = "M0 340H240V314";
  for (let i = 0; i < TEETH; i += 1) d += ` l${-W / 2} -6 l${-W / 2} 6`;
  return `${d}Z`;
})();

const PIPS = ["#9aa7bd", "#3fa3ff", "#b46bff", "#ffb020", "#ff4d6d"];

/** Объект пака: фольга с обжатыми краями, эмблема галактики, голографический блик */
export function PackArt() {
  return (
    <svg className="pk-svg" viewBox="0 0 240 340" role="img" aria-label="Бустер-пак AniGalaxy">
      <defs>
        <linearGradient id="pk-foil" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#10205c" />
          <stop offset="0.45" stopColor="#3a2fb8" />
          <stop offset="0.75" stopColor="#2a5fe0" />
          <stop offset="1" stopColor="#0d1a4a" />
        </linearGradient>
        <linearGradient id="pk-edge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9d6ff" />
          <stop offset="0.5" stopColor="#6d7fd0" />
          <stop offset="1" stopColor="#aab9f5" />
        </linearGradient>
        <linearGradient id="pk-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset="0.5" stopColor="#d9a441" />
          <stop offset="1" stopColor="#ffe9a8" />
        </linearGradient>
        <radialGradient id="pk-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#8fb4ff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#4a6dff" stopOpacity="0" />
        </radialGradient>
        <pattern id="pk-holo" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="14" height="14" fill="none" />
          <rect width="3" height="14" fill="#fff" opacity="0.05" />
        </pattern>
        <clipPath id="pk-clip">
          <rect x="0" y="22" width="240" height="296" />
        </clipPath>
      </defs>

      <g className="pk-body">
        <rect x="0" y="22" width="240" height="296" fill="url(#pk-foil)" />
        <rect x="0" y="22" width="240" height="296" fill="url(#pk-holo)" />
        <g clipPath="url(#pk-clip)">
          <circle cx="40" cy="60" r="90" fill="url(#pk-glow)" opacity="0.28" />
          <circle cx="210" cy="300" r="110" fill="url(#pk-glow)" opacity="0.22" />
        </g>
        <rect x="13" y="40" width="214" height="262" rx="12" fill="none" stroke="url(#pk-gold)" strokeWidth="1.2" opacity="0.85" />
        <rect x="19" y="46" width="202" height="250" rx="8" fill="none" stroke="#fff" strokeOpacity="0.12" />

        <text x="120" y="68" textAnchor="middle" className="pk-t1">
          ANIGALAXY
        </text>
        <line x1="70" y1="78" x2="170" y2="78" stroke="url(#pk-gold)" strokeWidth="1" />

        <g transform="translate(120 160)">
          <circle r="64" fill="none" stroke="#fff" strokeOpacity="0.16" />
          <circle r="48" fill="none" stroke="#fff" strokeOpacity="0.22" strokeDasharray="2 5" />
          <circle r="34" fill="#0a1236" fillOpacity="0.55" stroke="url(#pk-gold)" strokeWidth="1.4" />
          <path d="M0 0c6-2 11 1 11 7s-5 12-13 11-15-8-14-18 10-19 22-18 22 11 21 25" fill="none" stroke="#bcd0ff" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
          <path d="M0 -22 L4 -4 L22 0 L4 4 L0 22 L-4 4 L-22 0 L-4 -4Z" fill="#fff" opacity="0.95" />
          <circle r="64" fill="url(#pk-glow)" opacity="0.35" />
        </g>

        <text x="120" y="262" textAnchor="middle" className="pk-t2">
          БУСТЕР
        </text>
        <text x="120" y="281" textAnchor="middle" className="pk-t3">
          3 КАРТЫ · ВЫБЕРИ 1
        </text>
        {PIPS.map((c, i) => (
          <circle key={c} cx={96 + i * 12} cy="294" r="2.6" fill={c} />
        ))}
      </g>

      <path d={zigBottom} fill="url(#pk-edge)" />
      <g className="pk-top">
        <path d={zigTop} fill="url(#pk-edge)" />
        <path d="M0 24H240" stroke="#fff" strokeOpacity="0.35" />
      </g>
    </svg>
  );
}

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  x: (i * 53 + 11) % 100,
  d: (i * 0.37) % 5,
  s: 2 + (i % 4),
  t: 6 + (i % 5) * 1.4,
}));

export function PackStage({
  phase,
  blocked,
  dim,
  onOpen,
  children,
}: {
  phase: PackPhase;
  blocked?: boolean;
  dim?: boolean;
  onOpen: () => void;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el || phase !== "idle") return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${((0.5 - py) * 12).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${((px - 0.5) * 16).toFixed(2)}deg`);
    el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
  };
  const leave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };
  return (
    <div className={`cg-stage ph-${phase} ${blocked ? "is-blocked" : ""} ${dim ? "is-dim" : ""}`}>
      <div className="cg-rays" aria-hidden />
      <div className="cg-particles" aria-hidden>
        {PARTICLES.map((p, i) => (
          <i key={i} style={{ left: `${p.x}%`, width: p.s, height: p.s, animationDelay: `${p.d}s`, animationDuration: `${p.t}s` }} />
        ))}
      </div>
      <div className="pk-wrap" ref={ref}>
        <div className="pk-halo" aria-hidden />
        <button type="button" className="pk" onClick={onOpen} onPointerMove={move} onPointerLeave={leave} disabled={phase !== "idle"} aria-label="Открыть пак">
          <PackArt />
          <span className="pk-sheen" aria-hidden />
        </button>
        <div className="pk-flash" aria-hidden />
        <div className="pk-floor" aria-hidden />
      </div>
      {children}
    </div>
  );
}
