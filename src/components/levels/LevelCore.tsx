"use client";

/**
 * «Ядро уровня» — центр героя страницы.
 * Стеклянный диск с числом внутри «реактора»: корона из лучей, две вращающиеся
 * звезды, орбитальные кольца со спутниками и циферблат из 120 делений,
 * которые зажигаются по мере набора опыта до следующего уровня.
 */

import { useRef, type CSSProperties, type PointerEvent } from "react";
import { ERA_THEME, eraIndex } from "./LevelBadge";

const pts = (cx: number, cy: number, n: number, ro: number, ri: number, rot = -90) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 ? ri : ro;
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");

interface LevelCoreProps {
  level: number;
  /** Прогресс до следующего уровня, 0–1 */
  progress: number;
}

export function LevelCore({ level, progress }: LevelCoreProps) {
  const ref = useRef<HTMLDivElement>(null);
  const idx = eraIndex(level);
  const t = ERA_THEME[idx];
  const p = Math.max(0, Math.min(1, progress));
  const text = String(level);
  const fk = Math.min(0.2, 0.467 / (text.length * 0.78 + 0.6));

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-y * 22).toFixed(1)}deg`);
    el.style.setProperty("--ry", `${(x * 22).toFixed(1)}deg`);
  };
  const leave = () => {
    ref.current?.style.setProperty("--rx", "0deg");
    ref.current?.style.setProperty("--ry", "0deg");
  };

  const N = 120;
  const on = Math.round(p * N);
  const ticks = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    const len = i % 10 === 0 ? 16 : i % 5 === 0 ? 12 : 8;
    const c = Math.cos(a);
    const s = Math.sin(a);
    ticks.push(
      <line
        key={i}
        x1={(170 + 150 * c).toFixed(2)}
        y1={(170 + 150 * s).toFixed(2)}
        x2={(170 + (150 + len) * c).toFixed(2)}
        y2={(170 + (150 + len) * s).toFixed(2)}
        className={`lvc-t${i < on ? " on" : ""}`}
        style={{ "--i": i } as CSSProperties}
      />,
    );
  }
  const ha = p * Math.PI * 2 - Math.PI / 2;

  const vars = {
    "--c1": t.c1,
    "--c2": t.c2,
    "--c3": t.c3,
    "--glow": t.rgb,
    "--fk": fk,
  } as CSSProperties;

  return (
    <div ref={ref} className={`lvc${t.cosmic ? " lvc-cosmic" : ""}`} style={vars} onPointerMove={move} onPointerLeave={leave} role="img" aria-label={`Уровень ${level}`}>
      <div className="lvc-aura" />
      <div className="lvc-stage">
        <span className="lvc-halo" />
        <svg className="lvc-star" viewBox="0 0 100 100" aria-hidden>
          <defs>
            <linearGradient id="lvcs" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" style={{ stopColor: "var(--c1)" }} />
              <stop offset="1" style={{ stopColor: "var(--c2)" }} />
            </linearGradient>
          </defs>
          <polygon className="s1" points={pts(50, 50, 12, 48, 30)} fill="url(#lvcs)" opacity=".5" />
          <polygon className="s2" points={pts(50, 50, 12, 40, 25, -75)} fill="url(#lvcs)" opacity=".32" />
        </svg>
        <span className="lvc-ring lvc-r1" />
        <span className="lvc-ring lvc-r2" />
        <svg className="lvc-dial" viewBox="0 0 340 340" aria-hidden>
          <g>{ticks}</g>
          <circle className="lvc-head" cx={(170 + 158 * Math.cos(ha)).toFixed(2)} cy={(170 + 158 * Math.sin(ha)).toFixed(2)} r="5" />
        </svg>
        <div className="lvc-disc">
          <div>
            <b key={level} className="lvc-n">{text}</b>
            <span className="lvc-cap">уровень</span>
          </div>
        </div>
        <span className="lvc-glint" />
        <span key={`w${level}`} className="lvc-wave" />
      </div>
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} className="lvc-mote" style={{ left: `${14 + ((i * 41) % 72)}%`, animationDelay: `${(i * 0.55) % 4}s`, animationDuration: `${3.4 + (i % 4) * 0.6}s` }} />
      ))}
    </div>
  );
}
