"use client";

import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";

export type PackPhase = "idle" | "charge" | "burst";

/** Объект пака: фольга с обжатыми краями и эмблемой галактики. Верхний «клапан» — отдельный слой: при открытии он отрывается */
export function PackArt() {
  return (
    <div className="pk-art" role="img" aria-label="Бустер-пак AniGalaxy">
      <img className="pk-img pk-body" src="/cards/pack.webp" alt="" draggable={false} />
      <img className="pk-img pk-top" src="/cards/pack.webp" alt="" draggable={false} />
    </div>
  );
}

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  x: (i * 53 + 11) % 100,
  d: (i * 0.37) % 5,
  s: 2 + (i % 4),
  t: 6 + (i % 5) * 1.4,
}));

const STARS = [
  { x: -16, y: 16, d: 0 },
  { x: 108, y: 26, d: 0.9 },
  { x: -8, y: 68, d: 1.7 },
  { x: 104, y: 74, d: 2.3 },
  { x: 46, y: -9, d: 1.2 },
  { x: 92, y: 4, d: 0.4 },
];

/** Позиции «стопки» за главным паком: чем больше набор, тем шире веер */
const ghostStyle = (k: number): CSSProperties => {
  const side = k % 2 ? -1 : 1;
  const lvl = Math.ceil(k / 2);
  return {
    ["--gx" as string]: `${side * lvl * 24}%`,
    ["--gy" as string]: `${lvl * 3.5}%`,
    ["--gr" as string]: `${side * lvl * 7}deg`,
    ["--gs" as string]: `${1 - lvl * 0.06}`,
    ["--gb" as string]: `${0.82 - lvl * 0.1}`,
    ["--gd" as string]: `${-k * 0.7}s`,
  };
};

export function PackStage({
  phase,
  blocked,
  dim,
  stack = 0,
  onOpen,
  children,
}: {
  phase: PackPhase;
  blocked?: boolean;
  dim?: boolean;
  /** Сколько паков-«призраков» показать за главным (0, 2, 4) — наглядно показывает размер набора */
  stack?: number;
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
        <div className="pk-beam" aria-hidden />
        <div className="pk-halo" aria-hidden />
        <div className="pk-orbit o1" aria-hidden>
          <i />
        </div>
        <div className="pk-orbit o2" aria-hidden>
          <i />
        </div>
        <div className="pk-pad" aria-hidden />
        {Array.from({ length: stack }, (_, k) => (
          <img key={k} className="pk-ghost" src="/cards/pack.webp" alt="" draggable={false} style={ghostStyle(k + 1)} />
        ))}
        <button type="button" className="pk" onClick={onOpen} onPointerMove={move} onPointerLeave={leave} disabled={phase !== "idle"} aria-label="Открыть пак">
          <PackArt />
          <span className="pk-glint" aria-hidden />
          <span className="pk-holo" aria-hidden />
          <span className="pk-sheen" aria-hidden />
        </button>
        <div className="pk-stars" aria-hidden>
          {STARS.map((s, i) => (
            <i key={i} style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.d}s` }} />
          ))}
        </div>
        <div className="pk-shock s1" aria-hidden />
        <div className="pk-shock s2" aria-hidden />
        <div className="pk-flash" aria-hidden />
        <div className="pk-floor" aria-hidden />
      </div>
      {children}
    </div>
  );
}
