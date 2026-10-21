"use client";

import type { CSSProperties } from "react";

/** Сундук в векторе: корпус с металлическими поясами, крышка на петле, свет и искры при открытии */
export function ChestArt({ color, state = "idle", size = 150 }: { color: string; state?: "idle" | "shake" | "open"; size?: number }) {
  const id = color.replace("#", "c");
  return (
    <svg className={`c2-chest ${state}`} width={size} height={size} viewBox="0 0 200 200" style={{ ["--cc" as string]: color } as CSSProperties} aria-hidden>
      <defs>
        <linearGradient id={`wood-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a3a22" />
          <stop offset="1" stopColor="#2a180c" />
        </linearGradient>
        <linearGradient id={`metal-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".9" />
          <stop offset=".35" stopColor={color} />
          <stop offset="1" stopColor={color} stopOpacity=".45" />
        </linearGradient>
        <radialGradient id={`glow-${id}`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff" stopOpacity=".95" />
          <stop offset=".35" stopColor={color} stopOpacity=".8" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <filter id={`blur-${id}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>

      <ellipse cx="100" cy="176" rx="68" ry="9" fill="#000" opacity=".5" />
      {/* свет изнутри */}
      <g className="burst">
        <circle cx="100" cy="100" r="86" fill={`url(#glow-${id})`} />
        <g className="rays" stroke={color} strokeWidth="3" strokeLinecap="round" opacity=".8">
          {Array.from({ length: 12 }).map((_, i) => (
            <line key={i} x1="100" y1="100" x2="100" y2="14" transform={`rotate(${i * 30} 100 100)`} />
          ))}
        </g>
      </g>
      {/* корпус */}
      <g>
        <rect x="36" y="98" width="128" height="68" rx="8" fill={`url(#wood-${id})`} stroke={color} strokeOpacity=".7" strokeWidth="2" />
        <rect x="36" y="98" width="128" height="14" fill={`url(#metal-${id})`} opacity=".85" />
        <rect x="52" y="98" width="12" height="68" fill={`url(#metal-${id})`} opacity=".8" />
        <rect x="136" y="98" width="12" height="68" fill={`url(#metal-${id})`} opacity=".8" />
        <rect x="36" y="152" width="128" height="14" rx="6" fill={`url(#metal-${id})`} opacity=".7" />
        <g className="lock">
          <rect x="88" y="104" width="24" height="28" rx="5" fill={`url(#metal-${id})`} stroke="#fff" strokeOpacity=".4" />
          <circle cx="100" cy="116" r="4" fill="#1a0f06" />
          <rect x="98.5" y="116" width="3" height="9" rx="1.5" fill="#1a0f06" />
        </g>
      </g>
      {/* крышка */}
      <g className="lid">
        <path d="M34 98 C34 52 166 52 166 98 Z" fill={`url(#wood-${id})`} stroke={color} strokeOpacity=".7" strokeWidth="2" />
        <path d="M34 98 C34 70 60 60 100 60 C140 60 166 70 166 98 L166 88 C166 62 140 48 100 48 C60 48 34 62 34 88 Z" fill={`url(#metal-${id})`} opacity=".8" />
        <rect x="52" y="58" width="12" height="42" fill={`url(#metal-${id})`} opacity=".7" transform="skewX(-4)" />
        <rect x="136" y="58" width="12" height="42" fill={`url(#metal-${id})`} opacity=".7" transform="skewX(4)" />
        <rect x="34" y="94" width="132" height="8" rx="3" fill={`url(#metal-${id})`} />
      </g>
      {/* искры */}
      <g className="sparks" fill="#fff">
        {[[60, 60], [140, 54], [100, 40], [78, 30], [124, 32]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.4" style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </g>
    </svg>
  );
}
