"use client";

/**
 * Кольцо уровня пропуска: 100 делений (реперные — длиннее и золотые),
 * лунное гало с орбитальной искрой, дуга прогресса внутри сезона и сам
 * номер уровня. SVG собирается один раз на `maxLevel` и дальше только
 * переключает классы/атрибут — перерисовки на каждый кадр нет.
 */

import { useMemo } from "react";

import { ITEM_LEVELS } from "@/components/battlepass/model";

export interface LevelRingProps {
  level: number;
  /** Доля прогресса внутри текущего уровня, 0…1 */
  fraction: number;
  maxLevel?: number;
}

export function LevelRing({ level, fraction, maxLevel = 100 }: LevelRingProps) {
  const ticks = useMemo(
    () =>
      Array.from({ length: maxLevel }, (_, i) => {
        const a = (i / maxLevel) * Math.PI * 2 - Math.PI / 2;
        const key = (i + 1) % 10 === 0 || ITEM_LEVELS.has(i + 1);
        const r1 = key ? 70 : 73;
        const r2 = 80;
        return {
          i: i + 1,
          key,
          x1: (85 + r1 * Math.cos(a)).toFixed(2),
          y1: (85 + r1 * Math.sin(a)).toFixed(2),
          x2: (85 + r2 * Math.cos(a)).toFixed(2),
          y2: (85 + r2 * Math.sin(a)).toFixed(2),
        };
      }),
    [maxLevel],
  );

  const done = level >= maxLevel ? 100 : Math.max(0, Math.min(100, fraction * 100));

  return (
    <div className="bp-ring">
      <svg viewBox="0 0 170 170" role="img" aria-label={`Уровень пропуска ${level} из ${maxLevel}`}>
        <defs>
          <radialGradient id="bp-ring-halo">
            <stop offset="0" stopColor="#cfefff" stopOpacity=".55" />
            <stop offset="1" stopColor="#6cf0ff" stopOpacity="0" />
          </radialGradient>
          <mask id="bp-ring-moon">
            <rect width="170" height="170" fill="#fff" />
            <circle cx="78" cy="42" r="16" fill="#000" />
          </mask>
        </defs>

        {ticks.map((tick) => (
          <line
            key={tick.i}
            className={`tk${tick.key ? " k" : ""}${tick.i <= level ? " on" : ""}`}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
          />
        ))}

        <circle className="halo" cx="85" cy="52" r="34" fill="url(#bp-ring-halo)" />
        <circle
          cx="85"
          cy="50"
          r="21"
          fill="#f4fbff"
          mask="url(#bp-ring-moon)"
          style={{ filter: "drop-shadow(0 0 6px #aee)" }}
        />
        <g className="orb">
          <circle
            cx="85"
            cy="12"
            r="2.6"
            fill="#b06bff"
            style={{ filter: "drop-shadow(0 0 4px #b06bff)" }}
          />
        </g>
        <circle
          cx="85"
          cy="85"
          r="63"
          fill="none"
          stroke="#b06bff"
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${done} 100`}
          transform="rotate(-90 85 85)"
          style={{ filter: "drop-shadow(0 0 4px #b06bff)" }}
        />
      </svg>
      <div className="cn">
        <small>УРОВЕНЬ</small>
        <b>{level}</b>
      </div>
    </div>
  );
}
