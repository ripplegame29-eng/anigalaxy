"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";

/* ============================================================
   26 рангов AniGalaxy: от Пылинки до Легенды.
   Каждый: свои цвета, иконка и своя фирменная анимация.

   Отличие от оригинала Клода: наклон и блик при наведении там сделаны на
   framer-motion (useSpring / useTransform). Такой зависимости в проекте нет,
   и ставить её ради одного наклона — перебор: тот же эффект дают CSS-переменные
   --rx/--ry/--gx/--gy с transition. Разметка, стили и данные — 1:1.
   ============================================================ */

const W = "url(#rbw)";
const D = "rgba(0,0,0,.3)";

/** точки звезды / многоугольника (n=3 при ro=ri даёт шестиугольник) */
const pts = (cx: number, cy: number, n: number, ro: number, ri: number, rot = -90) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 ? ri : ro;
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");

const Wreath = () => (
  <>
    {[...Array(7)].map((_, i) => {
      const a1 = 200 + i * 23;
      const a2 = 340 - i * 23;
      const p = (d: number) => ({
        x: 32 + Math.cos((d * Math.PI) / 180) * 21,
        y: 36 - Math.sin((d * Math.PI) / 180) * 21 * -1,
      });
      const l = p(a1);
      const r = p(a2);
      return (
        <g key={i} className="rb-leaf" style={{ animationDelay: `${i * 0.12}s` }}>
          <ellipse cx={l.x} cy={l.y} rx="2.4" ry="4.6" fill={W} transform={`rotate(${a1 + 90} ${l.x} ${l.y})`} />
          <ellipse cx={r.x} cy={r.y} rx="2.4" ry="4.6" fill={W} transform={`rotate(${a2 + 90} ${r.x} ${r.y})`} />
        </g>
      );
    })}
  </>
);

const Dot = ({ x, y, r = 2, d = 0 }: { x: number; y: number; r?: number; d?: number }) => (
  <circle cx={x} cy={y} r={r} fill="#fff" className="rb-twinkle" style={{ animationDelay: `${d}s` }} />
);

export type Rank = {
  id: number;
  name: string;
  c1: string;
  c2: string;
  c3: string;
  glow: string; // "r,g,b"
  icon: ReactNode;
  cosmic?: boolean;
};

export const RANKS: Rank[] = [
  /* 01 */ {
    id: 1, name: "ПЫЛИНКА", c1: "#b4bccb", c2: "#5b6577", c3: "#1f2430", glow: "148,163,184",
    icon: (
      <>
        <circle cx="32" cy="32" r="6" fill={W} className="rb-beat" />
        <Dot x={18} y={22} r={3} d={0.1} />
        <Dot x={46} y={20} r={2.4} d={0.5} />
        <Dot x={44} y={44} r={2} d={0.9} />
        <Dot x={20} y={45} r={3.4} d={1.3} />
        <Dot x={32} y={12} r={1.6} d={0.7} />
        <Dot x={54} y={34} r={1.5} d={1.1} />
        <Dot x={10} y={34} r={1.5} d={1.5} />
      </>
    ),
  },
  /* 02 */ {
    id: 2, name: "АСТЕРОИД", c1: "#c4a58a", c2: "#7a5a45", c3: "#2e1f16", glow: "196,160,130",
    icon: (
      <g className="rb-spin-slow">
        <path d="M14 27l9-13 15-2 14 10 3 15-8 14-16 4-14-8-3-20Z" fill={W} />
        <circle cx="27" cy="28" r="5" fill={D} />
        <circle cx="42" cy="38" r="4" fill={D} />
        <circle cx="25" cy="43" r="3" fill={D} />
      </g>
    ),
  },
  /* 03 */ {
    id: 3, name: "МЕТЕОР", c1: "#ffb067", c2: "#ea580c", c3: "#6b2305", glow: "251,146,60",
    icon: (
      <g className="rb-streak">
        <path d="M8 56L34 30" stroke={W} strokeWidth="6" strokeLinecap="round" opacity=".55" />
        <path d="M8 44L28 24" stroke={W} strokeWidth="3" strokeLinecap="round" opacity=".4" />
        <path d="M20 58L40 38" stroke={W} strokeWidth="3" strokeLinecap="round" opacity=".4" />
        <circle cx="42" cy="22" r="11" fill={W} />
        <circle cx="42" cy="22" r="5" fill="rgba(255,120,40,.65)" />
      </g>
    ),
  },
  /* 04 */ {
    id: 4, name: "КОМЕТА", c1: "#a5f3fc", c2: "#0ea5e9", c3: "#0c3a5c", glow: "56,189,248",
    icon: (
      <g className="rb-wobble">
        <path d="M22 42C28 28 40 18 56 12" stroke={W} strokeWidth="7" strokeLinecap="round" fill="none" opacity=".9" />
        <path d="M22 42C34 36 48 32 60 32" stroke={W} strokeWidth="4" strokeLinecap="round" fill="none" opacity=".5" />
        <path d="M22 42C24 50 32 56 44 54" stroke={W} strokeWidth="4" strokeLinecap="round" fill="none" opacity=".5" />
        <circle cx="22" cy="42" r="10" fill={W} />
      </g>
    ),
  },
  /* 05 */ {
    id: 5, name: "СПУТНИК", c1: "#e2e8f0", c2: "#64748b", c3: "#1e293b", glow: "186,200,225",
    icon: (
      <g className="rb-wobble">
        <g transform="rotate(-28 32 34)">
          <rect x="26" y="26" width="12" height="16" rx="2.5" fill={W} />
          <rect x="5" y="29" width="17" height="10" rx="1.5" fill={W} />
          <rect x="42" y="29" width="17" height="10" rx="1.5" fill={W} />
          <path d="M22 34h4M38 34h4" stroke={W} strokeWidth="2" />
          <path d="M13.5 29v10M9.5 29v10M17.5 29v10M46.5 29v10M50.5 29v10M54.5 29v10" stroke={D} strokeWidth="1" />
          <path d="M32 26V15" stroke={W} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="32" cy="12.5" r="2.6" fill="#fff" className="rb-twinkle" />
        </g>
      </g>
    ),
  },
  /* 06 */ {
    id: 6, name: "ЛУНА", c1: "#e6e9f5", c2: "#8b93b8", c3: "#2e3354", glow: "200,205,240",
    icon: (
      <>
        <path d="M30 10A22 22 0 1 0 52 32A22 22 0 0 1 30 10Z" fill={W} />
        <circle cx="20" cy="36" r="3.4" fill={D} />
        <circle cx="28" cy="46" r="2.4" fill={D} />
        <circle cx="16" cy="26" r="2" fill={D} />
        <Dot x={48} y={14} r={2} d={0.2} />
        <Dot x={55} y={27} r={1.4} d={0.9} />
        <Dot x={42} y={22} r={1.4} d={1.4} />
      </>
    ),
  },
  /* 07 */ {
    id: 7, name: "ПЛАНЕТА", c1: "#5eead4", c2: "#0d9488", c3: "#073f3a", glow: "45,212,191",
    icon: (
      <>
        <g transform="rotate(-22 32 32)">
          <ellipse cx="32" cy="32" rx="27" ry="8" stroke={W} strokeWidth="3.4" fill="none" />
        </g>
        <circle cx="32" cy="32" r="13" fill={W} />
        <path d="M21 29c7 3 15 3 22-1" stroke={D} strokeWidth="2" fill="none" strokeLinecap="round" />
        <g className="rb-spin-slow" style={{ animationDuration: "7s" }}>
          <circle cx="32" cy="5" r="3" fill="#fff" />
        </g>
      </>
    ),
  },
  /* 08 */ {
    id: 8, name: "ЗВЕЗДА", c1: "#fff08a", c2: "#eab308", c3: "#6b4a03", glow: "253,224,71",
    icon: (
      <>
        <polygon points={pts(32, 34, 5, 25, 10.5)} fill={W} strokeLinejoin="round" className="rb-beat" />
        <Dot x={12} y={14} r={2} d={0.2} />
        <Dot x={53} y={12} r={1.6} d={0.8} />
        <Dot x={54} y={52} r={1.6} d={1.3} />
      </>
    ),
  },
  /* 09 */ {
    id: 9, name: "ПУЛЬСАР", c1: "#93a4ff", c2: "#3b4ce8", c3: "#151a6b", glow: "99,102,241",
    icon: (
      <>
        <circle cx="32" cy="32" r="22" stroke={W} strokeWidth="2" fill="none" className="rb-ping" />
        <circle cx="32" cy="32" r="22" stroke={W} strokeWidth="2" fill="none" className="rb-ping" style={{ animationDelay: "1s" }} />
        <path d="M32 3l5 27H27Z" fill={W} className="rb-flick" />
        <path d="M32 61l-5-27h10Z" fill={W} className="rb-flick" />
        <circle cx="32" cy="32" r="7" fill={W} className="rb-beat" />
      </>
    ),
  },
  /* 10 */ {
    id: 10, name: "КВАЗАР", c1: "#ffa6e6", c2: "#c026d3", c3: "#4a0a56", glow: "232,121,249",
    icon: (
      <g className="rb-beat">
        <g transform="rotate(-25 32 32)">
          <path d="M32 24l-4.5-21h9Z" fill={W} className="rb-flick" />
          <path d="M32 40l-4.5 21h9Z" fill={W} className="rb-flick" />
          <ellipse cx="32" cy="32" rx="26" ry="7.5" stroke={W} strokeWidth="3" fill="none" />
          <circle cx="32" cy="32" r="8.5" fill={W} />
        </g>
      </g>
    ),
  },
  /* 11 */ {
    id: 11, name: "ТУМАННОСТЬ", c1: "#fda4af", c2: "#e11d48", c3: "#5c0a22", glow: "251,113,133",
    icon: (
      <>
        <g className="rb-spin-slow" style={{ animationDuration: "18s" }}>
          <circle cx="24" cy="26" r="13" fill={W} opacity=".55" />
          <circle cx="41" cy="25" r="11" fill={W} opacity=".55" />
          <circle cx="37" cy="42" r="14" fill={W} opacity=".55" />
          <circle cx="22" cy="42" r="10" fill={W} opacity=".55" />
        </g>
        <circle cx="32" cy="33" r="6" fill={W} className="rb-beat" />
        <Dot x={9} y={12} r={1.6} d={0.3} />
        <Dot x={55} y={52} r={1.8} d={1} />
        <Dot x={54} y={12} r={1.4} d={1.6} />
      </>
    ),
  },
  /* 12 */ {
    id: 12, name: "СОЗВЕЗДИЕ", c1: "#a5b4fc", c2: "#4f46e5", c3: "#1e1b5e", glow: "129,140,248",
    icon: (
      <>
        <polyline points="12,46 24,26 38,34 50,14 53,46" stroke={W} strokeWidth="2.2" fill="none" strokeLinejoin="round" strokeDasharray="5 4" className="rb-dash" />
        <circle cx="12" cy="46" r="4" fill={W} className="rb-twinkle" />
        <circle cx="24" cy="26" r="3.4" fill={W} className="rb-twinkle" style={{ animationDelay: ".3s" }} />
        <circle cx="38" cy="34" r="3" fill={W} className="rb-twinkle" style={{ animationDelay: ".6s" }} />
        <circle cx="50" cy="14" r="4.4" fill={W} className="rb-twinkle" style={{ animationDelay: ".9s" }} />
        <circle cx="53" cy="46" r="3.4" fill={W} className="rb-twinkle" style={{ animationDelay: "1.2s" }} />
      </>
    ),
  },
  /* 13 */ {
    id: 13, name: "НАВИГАТОР", c1: "#86efac", c2: "#16a34a", c3: "#0a3d1c", glow: "74,222,128",
    icon: (
      <>
        <circle cx="32" cy="32" r="24" stroke={W} strokeWidth="3.4" fill="none" />
        <path d="M32 8v6M32 50v6M8 32h6M50 32h6" stroke={W} strokeWidth="3" strokeLinecap="round" />
        <g className="rb-needle">
          <path d="M32 14l7 18H25Z" fill={W} />
          <path d="M32 50l7-18H25Z" fill={D} />
        </g>
        <circle cx="32" cy="32" r="2.6" fill="#0a3d1c" />
      </>
    ),
  },
  /* 14 */ {
    id: 14, name: "ПИЛОТ", c1: "#d9f99d", c2: "#65a30d", c3: "#2b4a05", glow: "163,230,53",
    icon: (
      <>
        <path d="M28 41h8l-4 16-4-16Z" fill="#fff" className="rb-flick" />
        <path d="M23 31l-9 11 10-3Z" fill={W} />
        <path d="M41 31l9 11-10-3Z" fill={W} />
        <path d="M32 6c9 6 12 17 10 31H22C20 23 23 12 32 6Z" fill={W} />
        <circle cx="32" cy="23" r="4.6" fill={D} />
        <path d="M22 37h20" stroke={D} strokeWidth="2" />
      </>
    ),
  },
  /* 15 */ {
    id: 15, name: "КАПИТАН", c1: "#7cb2ff", c2: "#1d4ed8", c3: "#0b1f66", glow: "59,130,246",
    icon: (
      <>
        <polygon points={pts(32, 15, 5, 8.5, 3.6)} fill={W} className="rb-beat" />
        <path d="M13 28l19 10 19-10v8L32 46 13 36Z" fill={W} className="rb-leaf" />
        <path d="M13 40l19 10 19-10v8L32 58 13 48Z" fill={W} className="rb-leaf" style={{ animationDelay: ".4s" }} />
      </>
    ),
  },
  /* 16 */ {
    id: 16, name: "АДМИРАЛ", c1: "#cbd5e1", c2: "#334e7a", c3: "#0b1730", glow: "148,180,230",
    icon: (
      <g className="rb-wobble">
        <circle cx="32" cy="13" r="5" stroke={W} strokeWidth="3.6" fill="none" />
        <path d="M32 18v36M21 27h22" stroke={W} strokeWidth="4" strokeLinecap="round" />
        <path d="M12 38c0 11 9 17 20 17s20-6 20-17" stroke={W} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M8 38l4-6 4 6ZM48 38l4-6 4 6Z" fill={W} />
      </g>
    ),
  },
  /* 17 */ {
    id: 17, name: "ГАЛАКТИК", c1: "#d8b4fe", c2: "#9333ea", c3: "#3b0a66", glow: "192,132,252",
    icon: (
      <>
        <g className="rb-spin-slow" style={{ animationDuration: "10s" }}>
          <path d="M32 32c0-7 7-11 12-8s7 10 2 16-14 9-22 4-10-16-3-25 22-11 31-3" stroke={W} strokeWidth="3.2" fill="none" strokeLinecap="round" />
          <g transform="rotate(180 32 32)">
            <path d="M32 32c0-7 7-11 12-8s7 10 2 16-14 9-22 4-10-16-3-25 22-11 31-3" stroke={W} strokeWidth="3.2" fill="none" strokeLinecap="round" />
          </g>
        </g>
        <circle cx="32" cy="32" r="5.5" fill={W} className="rb-beat" />
      </>
    ),
  },
  /* 18 */ {
    id: 18, name: "СВЕРХНОВА", c1: "#ffe08a", c2: "#ef4444", c3: "#5c0a0a", glow: "248,113,80",
    icon: (
      <>
        <circle cx="32" cy="32" r="24" stroke={W} strokeWidth="2.4" fill="none" className="rb-ping" />
        <polygon points={pts(32, 32, 12, 26, 12)} fill={W} className="rb-beat" strokeLinejoin="round" />
        <circle cx="32" cy="32" r="8" fill="rgba(255,120,50,.65)" />
      </>
    ),
  },
  /* 19 */ {
    id: 19, name: "ЧЁРНАЯ ДЫРА", c1: "#4a3470", c2: "#1a1033", c3: "#05030d", glow: "168,85,247",
    icon: (
      <>
        <path d="M14 29c4-16 32-16 36 0" stroke={W} strokeWidth="3" fill="none" strokeLinecap="round" opacity=".8" />
        <g transform="rotate(-20 32 34)">
          <ellipse cx="32" cy="34" rx="27" ry="9" stroke={W} strokeWidth="4" fill="none" strokeDasharray="34 9" className="rb-dash" />
        </g>
        <circle cx="32" cy="33" r="12" fill="#02010a" stroke={W} strokeWidth="1.8" />
      </>
    ),
  },
  /* 20 */ {
    id: 20, name: "СТРАЖ ГАЛАКТИК", c1: "#6ee7b7", c2: "#059669", c3: "#043d2b", glow: "52,211,153",
    icon: (
      <>
        <path d="M32 6l20 7v16c0 14-9 22-20 27C21 51 12 43 12 29V13l20-7Z" fill={W} />
        <polygon points={pts(32, 30, 5, 9, 3.8)} fill={D} className="rb-beat" />
        <g className="rb-spin-slow" style={{ animationDuration: "6s" }}>
          <ellipse cx="32" cy="30" rx="15" ry="15" stroke="rgba(0,0,0,.3)" strokeWidth="1.6" fill="none" />
          <circle cx="32" cy="15" r="2.6" fill="rgba(0,0,0,.45)" />
        </g>
      </>
    ),
  },
  /* 21 */ {
    id: 21, name: "ПОВЕЛИТЕЛЬ ЗВЁЗД", c1: "#ff8cc4", c2: "#db2777", c3: "#6b0f3a", glow: "244,114,182",
    icon: (
      <>
        <g className="rb-spin-slow" style={{ animationDuration: "16s" }}>
          {[...Array(10)].map((_, i) => {
            const a = (i * 36 * Math.PI) / 180;
            return <circle key={i} cx={32 + 25 * Math.cos(a)} cy={32 + 25 * Math.sin(a)} r={i % 2 ? 1.8 : 2.8} fill={W} />;
          })}
        </g>
        <circle cx="32" cy="32" r="19" stroke={W} strokeWidth="1.6" fill="none" opacity=".6" />
        <polygon points={pts(32, 33, 5, 16, 6.6)} fill={W} strokeLinejoin="round" className="rb-beat" />
      </>
    ),
  },
  /* 22 */ {
    id: 22, name: "ТИТАН", c1: "#a9c2f0", c2: "#3f5fb0", c3: "#14214f", glow: "110,150,240",
    icon: (
      <>
        <polygon points={pts(32, 32, 3, 27, 27)} stroke={W} strokeWidth="3" fill="none" strokeLinejoin="round" className="rb-beat" />
        <polygon points={pts(32, 32, 3, 20, 20)} fill={W} strokeLinejoin="round" />
        <path d="M35 15L22 35h9l-3 14 14-21h-9l2-13Z" fill="rgba(0,0,0,.38)" className="rb-flick" />
      </>
    ),
  },
  /* 23: бывший «Магистр» */ {
    id: 23, name: "ОРАКУЛ", c1: "#ff6a52", c2: "#b3170f", c3: "#5e0a08", glow: "255,60,40",
    icon: (
      <>
        <Wreath />
        <path d="M21 37l-3-14 8 7 6-11 6 11 8-7-3 14H21Z" fill={W} />
        <rect x="21" y="39" width="22" height="3" rx="1.5" fill={W} />
        <circle cx="18" cy="22" r="1.8" fill="#fff" />
        <circle cx="32" cy="18" r="1.8" fill="#fff" />
        <circle cx="46" cy="22" r="1.8" fill="#fff" />
      </>
    ),
  },
  /* 24 */ {
    id: 24, name: "АРХОНТ", c1: "#ffe66b", c2: "#d97706", c3: "#6b3105", glow: "250,190,40",
    icon: (
      <g className="rb-spin-slow">
        {[...Array(8)].map((_, i) => (
          <rect key={i} x="30" y="6" width="4" height={i % 2 ? 11 : 16} rx="2" fill={W} transform={`rotate(${i * 45} 32 32)`} />
        ))}
        <circle cx="32" cy="32" r="12" fill={W} />
        <circle cx="32" cy="32" r="6" fill="rgba(0,0,0,.25)" />
      </g>
    ),
  },
  /* 25 */ {
    id: 25, name: "ПЕРВОЗДАННЫЙ", c1: "#f8f4ff", c2: "#a78bfa", c3: "#3b2a7a", glow: "221,214,254",
    icon: (
      <>
        <path d="M32 32C38 22 52 22 52 32C52 42 38 42 32 32C26 22 12 22 12 32C12 42 26 42 32 32Z" stroke={W} strokeWidth="5.5" fill="none" strokeLinejoin="round" />
        <path d="M32 32C38 22 52 22 52 32C52 42 38 42 32 32C26 22 12 22 12 32C12 42 26 42 32 32Z" stroke="rgba(120,90,220,.7)" strokeWidth="2" fill="none" strokeLinejoin="round" strokeDasharray="10 38" className="rb-dash" />
        <Dot x={32} y={11} r={2.4} d={0.2} />
        <Dot x={32} y={53} r={2.4} d={0.9} />
      </>
    ),
  },
  /* 26 */ {
    id: 26, name: "ЛЕГЕНДА", c1: "#7df0ff", c2: "#a23bff", c3: "#2a0a5e", glow: "190,100,255", cosmic: true,
    icon: (
      <>
        <path d="M32 6c2 15 11 24 26 26-15 2-24 11-26 26-2-15-11-24-26-26 15-2 24-11 26-26Z" fill={W} className="rb-twinkle" />
        <Dot x={49} y={15} r={2.2} />
        <Dot x={14} y={49} r={2} d={0.6} />
        <Dot x={50} y={50} r={1.5} d={1.2} />
      </>
    ),
  },
];

/* ============================================================
   Бейдж
   ============================================================ */

/* ============================================================
   Тиры: чем выше ранг, тем больше слоёв и анимаций
   0 (1–4) · 1 (5–9) · 2 (10–14) · 3 (15–19) · 4 (20–23) · 5 (24–26)
   ============================================================ */

export const getTier = (id: number) => (id < 5 ? 0 : id < 10 ? 1 : id < 15 ? 2 : id < 20 ? 3 : id < 24 ? 4 : 5);

const GLOW_PX = [26, 30, 36, 44, 54, 66];
const RING_PX = [1.5, 2, 2, 2.5, 3, 3.5];
const SPARKS = [4, 6, 8, 10, 12, 14];
const WAVES = [0, 0, 1, 1, 2, 2];
const ORBIT = [0, 0, 0, 3, 5, 7];

export function RankBadge({ rank, size = 96 }: { rank: Rank; size?: number }) {
  const tier = getTier(rank.id);
  const ref = useRef<HTMLDivElement>(null);

  /**
   * Наклон и блик — через CSS-переменные на самом `.rb-badge`.
   *
   * Значения кладутся в инлайн-стиль, аtransform считает CSS (см. `.rb-badge`
   * ниже): так не нужен ни framer-motion, ни ре-рендер на каждое движение
   * мыши — браузер сам меняет только картинку. transition в CSS даёт то же
   * плавное «догоняющее» движение, что и useSpring со stiffness 200.
   */
  const move = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const fx = e.clientX - r.left - r.width / 2;
    const fy = e.clientY - r.top - r.height / 2;
    const badge = el.querySelector<HTMLElement>(".rb-badge");
    if (!badge) return;
    badge.style.setProperty("--rx", `${(-fy / r.height) * 36}deg`);
    badge.style.setProperty("--ry", `${(fx / r.width) * 36}deg`);
    badge.style.setProperty("--gx", `${((fx / r.width) + 0.5) * 100}%`);
    badge.style.setProperty("--gy", `${((fy / r.height) + 0.5) * 100}%`);
  };

  const leave = () => {
    const badge = ref.current?.querySelector<HTMLElement>(".rb-badge");
    if (!badge) return;
    badge.style.setProperty("--rx", "0deg");
    badge.style.setProperty("--ry", "0deg");
    badge.style.setProperty("--gx", "50%");
    badge.style.setProperty("--gy", "50%");
  };

  const vars = {
    "--s": `${size}px`,
    "--c1": rank.c1,
    "--c2": rank.c2,
    "--c3": rank.c3,
    "--glow": rank.glow,
    "--gs": `${GLOW_PX[tier]}px`,
    "--rw": `${RING_PX[tier]}px`,
  } as CSSProperties;

  const orbitN = ORBIT[tier];

  return (
    <div ref={ref} className={`rb rb-t${tier}`} style={vars} onMouseMove={move} onMouseLeave={leave}>
      <style>{css}</style>
      <div className="rb-aura" />
      {tier >= 4 && <span className="rb-corona" />}
      {tier >= 3 && <span className="rb-frame" />}
      {tier >= 4 && <span className="rb-frame rb-frame2" />}
      {[...Array(WAVES[tier])].map((_, i) => (
        <span key={i} className="rb-wave" style={{ animationDelay: `${i * 1.5}s` }} />
      ))}
      {orbitN > 0 && (
        <span className="rb-orbit">
          {[...Array(orbitN)].map((_, i) => (
            <i key={i} style={{ "--r": `${(i * 360) / orbitN}deg`, "--d": `${i % 2 ? 3 : 5}px` } as CSSProperties} />
          ))}
        </span>
      )}
      <div className={`rb-badge ${rank.cosmic ? "rb-cosmic" : ""}`}>
        <span className="rb-ring" />
        <span className="rb-inner" />
        <span className="rb-rays" />
        {tier >= 4 && <span className="rb-holo" />}
        <svg className="rb-icon" viewBox="0 0 64 64" fill="none">
          <defs>
            <linearGradient id="rbw" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" />
              <stop offset="1" stopColor="#ffe9e2" />
            </linearGradient>
          </defs>
          {rank.icon}
        </svg>
        <span className="rb-glare" />
        <span className="rb-sheen" />
      </div>
      {[...Array(SPARKS[tier])].map((_, i) => (
        <span
          key={i}
          className="rb-spark"
          style={{
            left: `${12 + ((i * 37) % 76)}%`,
            animationDelay: `${(i * 0.45) % 3.2}s`,
            animationDuration: `${2.6 + (i % 4) * 0.5}s`,
          }}
        />
      ))}
      {tier >= 4 && <span className="rb-glint" />}
      {tier >= 5 && <span className="rb-glint rb-glint2" />}
    </div>
  );
}

export const getRank = (name: string) => RANKS.find((r) => r.name === name.toUpperCase()) ?? RANKS[0];

/* ============================================================
   Сегментная полоска прогресса до следующего ранга
   value: 0..1
   ============================================================ */

export function RankProgress({ value, rank, segments = 16 }: { value: number; rank: Rank; segments?: number }) {
  const filled = Math.max(0, Math.min(1, value)) * segments;
  const cur = Math.floor(filled);
  const frac = filled - cur;
  const vars = { "--glow": rank.glow, "--c1": rank.c1, "--c2": rank.c2 } as CSSProperties;
  return (
    <div className="rp" style={vars} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <style>{progressCss}</style>
      {[...Array(segments)].map((_, i) => {
        const f = i < cur ? 1 : i === cur ? frac : 0;
        return (
          <span key={i} className={`rp-seg ${i === cur && f > 0 ? "rp-cur" : ""}`} style={{ "--i": i } as CSSProperties}>
            {/* scaleX вместо motion-анимации: значение подаётся через
                --f, раскрывается CSS-переходом с задержкой по сегментам —
                то же самое, что делал transition с delay: i * 0.07. */}
            <i className="rp-fill" style={{ "--f": f } as CSSProperties} />
          </span>
        );
      })}
    </div>
  );
}

/* ============================================================
   Галерея всех рангов
   ============================================================ */

export default function RankGallery() {
  return (
    <div className="rg">
      <style>{galleryCss}</style>
      {RANKS.map((r) => (
        <div key={r.id} className="rg-item">
          <RankBadge rank={r} size={96} />
          <span className="rg-num">{String(r.id).padStart(2, "0")}</span>
          <b className="rg-name">{r.name}</b>
        </div>
      ))}
    </div>
  );
}

/* ============================================================ */

const galleryCss = `
.rg{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:18px;padding:8px}
.rg-item{
  display:flex;flex-direction:column;align-items:center;gap:6px;padding:26px 10px 18px;border-radius:18px;
  background:linear-gradient(160deg,#0c0b16,#07070d);border:1px solid rgba(255,255,255,.07);
  font-family:var(--font-body);color:#fff;text-align:center
}
.rg-num{margin-top:14px;font-size:11px;letter-spacing:.14em;color:rgba(255,255,255,.4);font-weight:600}
.rg-name{font-family:var(--font-display);font-size:13px;font-weight:700;letter-spacing:.02em}
`;

const progressCss = `
.rp{display:flex;gap:4px;align-items:center}
.rp-seg{position:relative;width:22px;height:5px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;flex:none}
.rp-fill{
  position:absolute;inset:0;border-radius:3px;transform-origin:0 50%;
  /* Доля заполнения приходит из JS как --f (0..1); задержка по сегментам
     повторяет ту, что была у motion: i * 0.07 */
  transform:scaleX(var(--f,0));
  transition:transform .55s cubic-bezier(.22,1,.36,1);transition-delay:calc(var(--i)*.07s);
  background:linear-gradient(90deg,var(--c2),var(--c1));
  box-shadow:0 0 8px rgba(var(--glow),.8)
}
.rp-fill::after{
  content:"";position:absolute;inset:0;transform:translateX(-120%);
  background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.85) 50%,transparent 70%);
  animation:rp-shine 2.8s ease-in-out infinite;animation-delay:calc(var(--i)*.12s)
}
.rp-cur{overflow:visible}
.rp-cur .rp-fill{animation:rp-head 1.4s ease-in-out infinite}
@keyframes rp-shine{0%,45%{transform:translateX(-120%)}80%,100%{transform:translateX(120%)}}
@keyframes rp-head{0%,100%{filter:brightness(1);box-shadow:0 0 6px rgba(var(--glow),.7)}50%{filter:brightness(1.5);box-shadow:0 0 14px 2px rgba(var(--glow),1)}}
@media (prefers-reduced-motion:reduce){.rp *{animation:none!important}}
`;

const css = `
@property --a{syntax:'<angle>';initial-value:0deg;inherits:false}
.rb{position:relative;width:var(--s);height:var(--s);flex:none;perspective:600px}
.rb-aura{
  position:absolute;inset:-18%;border-radius:50%;filter:blur(8px);
  background:radial-gradient(closest-side,rgba(var(--glow),.6),transparent 70%);
  animation:rb-pulse 3s ease-in-out infinite
}
.rb-t3 .rb-aura{inset:-26%}
.rb-t4 .rb-aura{inset:-34%}
.rb-t5 .rb-aura{inset:-40%;animation-duration:2.2s}
.rb-badge{
  position:relative;width:100%;height:100%;border-radius:25%;overflow:hidden;cursor:pointer;z-index:2;
  /* Наклон при наведении: углы приходят из JS как --rx/--ry (см. RankBadge),
     transition даёт плавное «догоняющее» движение без framer-motion */
  --rx:0deg;--ry:0deg;--gx:50%;--gy:50%;
  transform:rotateX(var(--rx)) rotateY(var(--ry));transform-style:preserve-3d;
  transition:transform .18s cubic-bezier(.22,1,.36,1);
  background:linear-gradient(145deg,var(--c1) 0%,var(--c2) 55%,var(--c3) 100%);
  box-shadow:0 0 var(--gs) rgba(var(--glow),.55),0 0 calc(var(--gs)*2.2) rgba(var(--glow),.2),inset 0 1px 0 rgba(255,255,255,.4),inset 0 -10px 22px rgba(0,0,0,.45);
  display:grid;place-items:center;animation:rb-float 4s ease-in-out infinite
}
.rb-cosmic{animation:rb-float 4s ease-in-out infinite,rb-hue 6s linear infinite}

/* рамка: бегущая полоска. Анимируется УГОЛ градиента, а не сам элемент,
   поэтому маска не вращается и полоска не обрезается по углам */
.rb-ring{
  position:absolute;inset:0;border-radius:inherit;padding:var(--rw);
  background:conic-gradient(from var(--a),transparent 0 55%,rgba(255,255,255,.95) 75%,transparent 90%);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor;mask-composite:exclude;animation:rb-angle 3.2s linear infinite
}
.rb-t0 .rb-ring{animation:none;background:rgba(255,255,255,.28)}
.rb-t3 .rb-ring,.rb-t4 .rb-ring{
  background:conic-gradient(from var(--a),transparent 0 16%,rgba(255,255,255,.95) 30%,transparent 42% 58%,rgba(var(--glow),1) 72%,#fff 80%,transparent 92%)
}
.rb-t5 .rb-ring{
  background:conic-gradient(from var(--a),#ff6ad5,#ffd36a,#6affb0,#6ad5ff,#b06aff,#ff6ad5);animation-duration:4s
}
.rb-inner{
  position:absolute;inset:6%;border-radius:19%;border:1px solid rgba(255,255,255,.18);
  background:radial-gradient(circle at 50% 35%,rgba(255,255,255,.28),rgba(0,0,0,.18) 75%)
}
/* лучи: сдвиг ровно на период паттерна вдоль оси 115° (34px) = бесшовный цикл */
.rb-rays{
  position:absolute;inset:-30%;mix-blend-mode:screen;opacity:.35;
  background:repeating-linear-gradient(115deg,transparent 0 14px,rgba(255,255,255,.2) 14px 17px,transparent 17px 34px);
  animation:rb-rays 5s linear infinite
}
.rb-t1 .rb-rays{opacity:.5}
.rb-t2 .rb-rays,.rb-t3 .rb-rays{opacity:.7}
.rb-t4 .rb-rays,.rb-t5 .rb-rays{opacity:.9;animation-duration:3.5s}
.rb-holo{
  position:absolute;inset:0;pointer-events:none;mix-blend-mode:overlay;opacity:.5;
  background:conic-gradient(from var(--a),#ff6ad5,#ffd36a,#6affb0,#6ad5ff,#b06aff,#ff6ad5);
  animation:rb-angle 7s linear infinite
}
.rb-t5 .rb-holo{opacity:.85}
.rb-icon{
  position:relative;width:70%;height:70%;transform:translateZ(30px);
  filter:drop-shadow(0 0 6px rgba(255,255,255,.8)) drop-shadow(0 0 14px rgba(var(--glow),.95))
}

/* внешние слои высоких тиров */
.rb-corona{
  position:absolute;inset:-36%;border-radius:50%;pointer-events:none;opacity:.8;
  background:repeating-conic-gradient(rgba(var(--glow),.5) 0 3deg,transparent 3deg 15deg);
  -webkit-mask:radial-gradient(closest-side,transparent 40%,#000 55%,transparent 100%);
  mask:radial-gradient(closest-side,transparent 40%,#000 55%,transparent 100%);
  animation:rb-spin 30s linear infinite
}
.rb-t5 .rb-corona{inset:-48%}
.rb-corona::after{
  content:"";position:absolute;inset:0;border-radius:50%;
  background:repeating-conic-gradient(rgba(255,255,255,.45) 0 1.5deg,transparent 1.5deg 22.5deg);
  animation:rb-spin 45s linear infinite reverse
}
.rb-frame{
  position:absolute;inset:-10%;border-radius:30%;pointer-events:none;
  border:1.5px solid rgba(var(--glow),.65);
  box-shadow:0 0 12px rgba(var(--glow),.5),inset 0 0 12px rgba(var(--glow),.25);
  animation:rb-spin 26s linear infinite
}
.rb-frame::before,.rb-frame::after{
  content:"";position:absolute;left:50%;width:7px;height:7px;margin-left:-3.5px;background:#fff;
  transform:rotate(45deg);box-shadow:0 0 10px 2px rgba(var(--glow),1)
}
.rb-frame::before{top:-4px}
.rb-frame::after{bottom:-4px}
.rb-frame2{inset:-20%;border-radius:50%;border-style:dashed;border-width:1px;opacity:.7;animation:rb-spin 40s linear infinite reverse;box-shadow:none}
.rb-frame2::before,.rb-frame2::after{width:5px;height:5px;margin-left:-2.5px}
.rb-wave{
  position:absolute;inset:0;border-radius:25%;pointer-events:none;border:2px solid rgba(var(--glow),.8);
  animation:rb-wave 3s ease-out infinite
}
.rb-orbit{position:absolute;inset:0;pointer-events:none;animation:rb-spin 9s linear infinite}
.rb-t5 .rb-orbit{animation-duration:6s}
.rb-orbit i{
  position:absolute;left:50%;top:50%;width:var(--d);height:var(--d);margin:calc(var(--d)/-2);border-radius:50%;
  background:#fff;box-shadow:0 0 8px 2px rgba(var(--glow),.9);
  transform:rotate(var(--r)) translateY(calc(var(--s)*-.62))
}
.rb-glint{
  position:absolute;top:4%;right:2%;width:26%;height:26%;pointer-events:none;z-index:3;opacity:0;
  animation:rb-glint 3.8s ease-in-out infinite
}
.rb-glint::before,.rb-glint::after{
  content:"";position:absolute;left:50%;top:50%;background:#fff;border-radius:2px;
  box-shadow:0 0 8px 2px rgba(var(--glow),.9)
}
.rb-glint::before{width:2px;height:100%;transform:translate(-50%,-50%)}
.rb-glint::after{height:2px;width:100%;transform:translate(-50%,-50%)}
.rb-glint2{top:auto;right:auto;bottom:6%;left:4%;width:18%;height:18%;animation-delay:1.9s}

/* анимации частей иконок */
.rb-leaf{animation:rb-leaf 2.4s ease-in-out infinite}
.rb-twinkle,.rb-beat,.rb-ping,.rb-wobble,.rb-streak,.rb-flick,.rb-needle{transform-box:fill-box;transform-origin:center}
.rb-twinkle{animation:rb-twinkle 2.2s ease-in-out infinite}
.rb-beat{animation:rb-beat 2.2s ease-in-out infinite}
.rb-ping{animation:rb-ping 2s ease-out infinite}
.rb-wobble{animation:rb-wobble 3s ease-in-out infinite}
.rb-streak{animation:rb-streak 1.8s ease-in-out infinite}
.rb-flick{animation:rb-flick 1.1s ease-in-out infinite}
.rb-needle{animation:rb-needle 5s ease-in-out infinite}
.rb-spin-slow{transform-box:view-box;transform-origin:50% 50%;animation:rb-spin 14s linear infinite}
.rb-dash{animation:rb-dash 1.6s linear infinite}

.rb-glare{position:absolute;inset:0;mix-blend-mode:overlay;pointer-events:none;
  /* Блик следует за курсором: координаты приходят из JS как --gx/--gy */
  background:radial-gradient(circle at var(--gx) var(--gy),rgba(255,255,255,.45),transparent 55%)
}
.rb-sheen{
  position:absolute;inset:0;pointer-events:none;transform:translateX(-120%);
  background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.55) 50%,transparent 60%);
  animation:rb-sheen 4.5s ease-in-out infinite
}
.rb-t0 .rb-sheen{display:none}
.rb-t4 .rb-sheen,.rb-t5 .rb-sheen{animation-duration:3.2s}
.rb-spark{
  position:absolute;bottom:6%;width:4px;height:4px;border-radius:50%;opacity:0;pointer-events:none;z-index:3;
  background:#fff;box-shadow:0 0 8px 2px rgba(var(--glow),.95);animation:rb-rise 3s ease-out infinite
}

@keyframes rb-spin{to{transform:rotate(360deg)}}
@keyframes rb-angle{to{--a:360deg}}
@keyframes rb-float{0%,100%{translate:0 0}50%{translate:0 -4px}}
@keyframes rb-pulse{0%,100%{opacity:.55;transform:scale(.94)}50%{opacity:1;transform:scale(1.08)}}
@keyframes rb-rays{to{transform:translate(30.8px,14.4px)}}
@keyframes rb-sheen{0%,55%{transform:translateX(-120%)}85%,100%{transform:translateX(120%)}}
@keyframes rb-wave{0%{opacity:.8;transform:scale(1)}100%{opacity:0;transform:scale(1.7)}}
@keyframes rb-glint{0%,55%,100%{opacity:0;transform:scale(0) rotate(0)}72%{opacity:1;transform:scale(1) rotate(45deg)}90%{opacity:0;transform:scale(.3) rotate(90deg)}}
@keyframes rb-leaf{0%,100%{opacity:.85}50%{opacity:1;filter:brightness(1.25)}}
@keyframes rb-twinkle{0%,100%{opacity:.75;transform:scale(.9)}50%{opacity:1;transform:scale(1.12)}}
@keyframes rb-beat{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
@keyframes rb-ping{0%{opacity:.9;transform:scale(.35)}100%{opacity:0;transform:scale(1.35)}}
@keyframes rb-wobble{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
@keyframes rb-streak{0%,100%{transform:translate(0,0)}50%{transform:translate(3px,-3px)}}
@keyframes rb-flick{0%,100%{opacity:1;transform:scale(1,1)}50%{opacity:.7;transform:scale(.92,1.14)}}
@keyframes rb-needle{0%,100%{transform:rotate(-28deg)}35%{transform:rotate(22deg)}65%{transform:rotate(-8deg)}}
@keyframes rb-dash{to{stroke-dashoffset:-48}}
@keyframes rb-rise{0%{opacity:0;transform:translateY(0) scale(.6)}15%{opacity:1}100%{opacity:0;transform:translateY(-70px) scale(1.1)}}
@keyframes rb-hue{to{filter:hue-rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.rb,.rb *,.rb *::before,.rb *::after{animation:none!important}}
`;
