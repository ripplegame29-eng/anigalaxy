"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";

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
