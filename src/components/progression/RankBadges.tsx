"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";

/* ============================================================
   26 рангов AniGalaxy: от Статиста до Легенды (аниме-иерархия: ронин, шиноби, демон, монарх…).
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
    id: 1, name: "СТАТИСТ", c1: "#b4bccb", c2: "#5b6577", c3: "#1f2430", glow: "148,163,184",
    icon: (
      <>
        <circle cx="32" cy="21" r="10" fill={W} className="rb-beat" />
        <path d="M13 56c0-12 8-20 19-20s19 8 19 20Z" fill={W} />
        <path d="M24 44h16" stroke={D} strokeWidth="2.4" strokeLinecap="round" />
      </>
    ),
  },
  /* 02 */ {
    id: 2, name: "УЧЕНИК", c1: "#c4a58a", c2: "#7a5a45", c3: "#2e1f16", glow: "196,160,130",
    icon: (
      <>
        <path d="M32 19C25 14 17 13 8 15v34c9-2 17-1 24 4Z" fill={W} />
        <path d="M32 19c7-5 15-6 24-4v34c-9-2-17-1-24 4Z" fill={W} />
        <path d="M32 19v34" stroke={D} strokeWidth="2.2" />
        <path d="M14 24c4-1 8 0 12 2M14 31c4-1 8 0 12 2M38 26c4-2 8-3 12-2M38 33c4-2 8-3 12-2" stroke={D} strokeWidth="2" strokeLinecap="round" />
        <circle cx="32" cy="9" r="2.4" fill="#fff" className="rb-twinkle" />
      </>
    ),
  },
  /* 03 */ {
    id: 3, name: "ОХОТНИК", c1: "#ffb067", c2: "#ea580c", c3: "#6b2305", glow: "251,146,60",
    icon: (
      <>
        <circle cx="32" cy="32" r="18" stroke={W} strokeWidth="3.6" fill="none" />
        <path d="M32 5v15M32 44v15M5 32h15M44 32h15" stroke={W} strokeWidth="3.4" strokeLinecap="round" />
        <circle cx="32" cy="32" r="5.5" fill={W} className="rb-beat" />
      </>
    ),
  },
  /* 04 */ {
    id: 4, name: "ЗАКЛИНАТЕЛЬ", c1: "#a5f3fc", c2: "#0ea5e9", c3: "#0c3a5c", glow: "56,189,248",
    icon: (
      <g className="rb-spin-slow">
        <circle cx="32" cy="32" r="25" stroke={W} strokeWidth="3.2" fill="none" />
        <circle cx="32" cy="32" r="20" stroke={W} strokeWidth="1.6" fill="none" strokeDasharray="3 4" />
        <path d="M32 14l15.6 27H16.4Z" stroke={W} strokeWidth="2.8" fill="none" strokeLinejoin="round" />
        <path d="M32 50L16.4 23h31.2Z" stroke={W} strokeWidth="2.8" fill="none" strokeLinejoin="round" />
        <circle cx="32" cy="32" r="3" fill={W} />
      </g>
    ),
  },
  /* 05 */ {
    id: 5, name: "РОНИН", c1: "#e2e8f0", c2: "#64748b", c3: "#1e293b", glow: "186,200,225",
    icon: (
      <>
        <path d="M5 40L32 11l27 29c-9 6-18 8-27 8s-18-2-27-8Z" fill={W} />
        <path d="M17 31c10 5 20 5 30 0M11 38c14 6 28 6 42 0" stroke={D} strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <path d="M23 46v10M41 46v10" stroke={W} strokeWidth="3" strokeLinecap="round" />
        <circle cx="32" cy="11" r="2.4" fill="#fff" className="rb-twinkle" />
      </>
    ),
  },
  /* 06 */ {
    id: 6, name: "ШИНОБИ", c1: "#e6e9f5", c2: "#8b93b8", c3: "#2e3354", glow: "200,205,240",
    icon: (
      <g className="rb-spin-slow">
        <path d="M32 4l7 21 21 7-21 7-7 21-7-21-21-7 21-7Z" fill={W} strokeLinejoin="round" />
        <circle cx="32" cy="32" r="6" fill={D} />
      </g>
    ),
  },
  /* 07 */ {
    id: 7, name: "САМУРАЙ", c1: "#5eead4", c2: "#0d9488", c3: "#073f3a", glow: "45,212,191",
    icon: (
      <g transform="rotate(38 32 32)">
        <path d="M32 3l3.4 5V40H28.6V8Z" fill={W} />
        <path d="M32 9v30" stroke={D} strokeWidth="1.4" />
        <ellipse cx="32" cy="43" rx="11" ry="3.4" fill={W} />
        <rect x="29" y="46" width="6" height="14" rx="2.4" fill={W} />
        <path d="M29 50h6M29 54h6" stroke={D} strokeWidth="1.6" />
        <path d="M31 12v6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" className="rb-flick" />
      </g>
    ),
  },
  /* 08 */ {
    id: 8, name: "ЭКЗОРЦИСТ", c1: "#fff08a", c2: "#eab308", c3: "#6b4a03", glow: "253,224,71",
    icon: (
      <g className="rb-wobble">
        <rect x="19" y="7" width="26" height="50" rx="3" fill={W} />
        <rect x="19" y="7" width="26" height="6" rx="3" fill={D} />
        <path d="M32 18v12M25 24h14" stroke={D} strokeWidth="3.2" strokeLinecap="round" />
        <path d="M25 37h14M25 43h14M32 37v14" stroke={D} strokeWidth="2.4" strokeLinecap="round" />
      </g>
    ),
  },
  /* 09 */ {
    id: 9, name: "ГРОМОВЕРЖЕЦ", c1: "#93a4ff", c2: "#3b4ce8", c3: "#151a6b", glow: "99,102,241",
    icon: (
      <>
        <path d="M37 3L15 36h14l-4 25 24-36H34Z" fill={W} strokeLinejoin="round" className="rb-flick" />
        <Dot x={50} y={14} r={2} d={0.2} />
        <Dot x={13} y={50} r={1.8} d={0.9} />
      </>
    ),
  },
  /* 10 */ {
    id: 10, name: "ЧАРОДЕЙ", c1: "#ffa6e6", c2: "#c026d3", c3: "#4a0a56", glow: "232,121,249",
    icon: (
      <>
        <path d="M13 52L41 24" stroke={W} strokeWidth="5.4" strokeLinecap="round" />
        <path d="M13 52L19 46" stroke={D} strokeWidth="5.4" strokeLinecap="round" />
        <polygon points={pts(45, 19, 4, 13, 4)} fill={W} className="rb-beat" />
        <Dot x={16} y={15} r={2.4} d={0.3} />
        <Dot x={52} y={46} r={2} d={0.8} />
        <Dot x={30} y={10} r={1.6} d={1.3} />
      </>
    ),
  },
  /* 11 */ {
    id: 11, name: "КИЦУНЭ", c1: "#fda4af", c2: "#e11d48", c3: "#5c0a22", glow: "251,113,133",
    icon: (
      <>
        <path d="M8 6l17 14c4-1 10-1 14 0L56 6l-1 28C51 47 43 57 32 58 21 57 13 47 9 34Z" fill={W} />
        <path d="M13 14l8 8M51 14l-8 8" stroke={D} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M16 34l11 4-4 4Z" fill={D} />
        <path d="M48 34l-11 4 4 4Z" fill={D} />
        <path d="M29 48h6l-3 4Z" fill={D} />
        <path d="M14 44l6 1M50 44l-6 1" stroke={D} strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
  },
  /* 12 */ {
    id: 12, name: "ОНМЁДЗИ", c1: "#a5b4fc", c2: "#4f46e5", c3: "#1e1b5e", glow: "129,140,248",
    icon: (
      <g className="rb-spin-slow">
        <circle cx="32" cy="32" r="25" stroke={W} strokeWidth="3.2" fill="none" />
        <path d="M32 8a24 24 0 0 1 0 48 12 12 0 0 1 0-24 12 12 0 0 0 0-24Z" fill={W} />
        <circle cx="32" cy="20" r="3.8" fill={D} />
        <circle cx="32" cy="44" r="3.8" fill={W} />
      </g>
    ),
  },
  /* 13 */ {
    id: 13, name: "ЦЕЛИТЕЛЬ", c1: "#86efac", c2: "#16a34a", c3: "#0a3d1c", glow: "74,222,128",
    icon: (
      <>
        <g className="rb-leaf">
          <path d="M10 54C8 28 24 9 55 9c0 29-14 46-39 46Z" fill={W} />
          <path d="M15 50C26 38 37 27 47 17" stroke={D} strokeWidth="2.8" strokeLinecap="round" fill="none" />
          <path d="M27 36c-1-7 0-11 3-14M36 28c-1-5 0-8 2-11" stroke={D} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </g>
        <Dot x={52} y={50} r={2.2} d={0.4} />
      </>
    ),
  },
  /* 14 */ {
    id: 14, name: "РЫЦАРЬ", c1: "#d9f99d", c2: "#65a30d", c3: "#2b4a05", glow: "163,230,53",
    icon: (
      <>
        <path d="M10 9h44v23c0 14-10 23-22 27C20 55 10 46 10 32Z" fill={W} />
        <path d="M32 14v40M14 28h36" stroke={D} strokeWidth="5" strokeLinecap="round" />
        <circle cx="32" cy="28" r="4.200" fill="#fff" className="rb-beat" />
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
    id: 17, name: "ДЕМОН", c1: "#d8b4fe", c2: "#9333ea", c3: "#3b0a66", glow: "192,132,252",
    icon: (
      <>
        <path d="M15 30C7 22 9 11 15 6c1 9 6 15 12 18Z" fill={W} />
        <path d="M49 30c8-8 6-19 0-24-1 9-6 15-12 18Z" fill={W} />
        <circle cx="32" cy="38" r="17" fill={W} />
        <path d="M21 34l8 3-3 4Z" fill={D} />
        <path d="M43 34l-8 3 3 4Z" fill={D} />
        <path d="M24 46q8 6 16 0" stroke={D} strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <path d="M27 48.500l2 4 2-3.500M37 48.500l-2 4-2-3.500" fill={W} stroke={D} strokeWidth="1.2" strokeLinejoin="round" />
      </>
    ),
  },
  /* 18 */ {
    id: 18, name: "ВЫСШИЙ ДЕМОН", c1: "#ffe08a", c2: "#ef4444", c3: "#5c0a0a", glow: "248,113,80",
    icon: (
      <>
        <path d="M32 3c4 7 9 9 7 17-2-2-5-3-7 1-2-4-5-3-7-1-2-8 3-10 7-17Z" fill={W} className="rb-flick" />
        <path d="M17 38C6 32 4 19 10 9c3 10 9 18 18 22Z" fill={W} />
        <path d="M47 38c11-6 13-19 7-29-3 10-9 18-18 22Z" fill={W} />
        <circle cx="32" cy="42" r="15" fill={W} />
        <path d="M21 38l9 3-3 4Z" fill={D} />
        <path d="M43 38l-9 3 3 4Z" fill={D} />
        <path d="M24 51q8 5 16 0" stroke={D} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      </>
    ),
  },
  /* 19 */ {
    id: 19, name: "АРХИДЕМОН", c1: "#4a3470", c2: "#1a1033", c3: "#05030d", glow: "168,85,247",
    icon: (
      <>
        <path d="M32 21L27 5l5 7 5-7Z" fill={W} />
        <path d="M21 27C11 24 6 14 8 3c6 7 12 13 19 18Z" fill={W} />
        <path d="M43 27c10-3 15-13 13-24-6 7-12 13-19 18Z" fill={W} />
        <path d="M17 41C17 27 23 21 32 21s15 6 15 20c0 4-2 6-4 7v8H21v-8c-2-1-4-3-4-7Z" fill={W} />
        <circle cx="25.500" cy="39" r="4.600" fill={D} />
        <circle cx="38.500" cy="39" r="4.600" fill={D} />
        <circle cx="25.500" cy="39" r="2" fill="#ff6a52" className="rb-flick" />
        <circle cx="38.500" cy="39" r="2" fill="#ff6a52" className="rb-flick" />
        <path d="M32 44l-3 5h6Z" fill={D} />
        <path d="M26 52v6M32 52v6M38 52v6" stroke={D} strokeWidth="1.8" />
      </>
    ),
  },
  /* 20 */ {
    id: 20, name: "ХАШИРА", c1: "#6ee7b7", c2: "#059669", c3: "#043d2b", glow: "52,211,153",
    icon: (
      <>
        <path d="M5 14Q32 8 59 14l-2 8Q32 16 7 22Z" fill={W} />
        <rect x="13" y="27" width="38" height="5" rx="2.500" fill={W} />
        <rect x="15" y="20" width="6" height="40" rx="2.400" fill={W} />
        <rect x="43" y="20" width="6" height="40" rx="2.400" fill={W} />
        <rect x="28.500" y="16" width="7" height="12" rx="1.500" fill={D} />
        <circle cx="32" cy="40" r="2.600" fill="#fff" className="rb-twinkle" />
      </>
    ),
  },
  /* 21 */ {
    id: 21, name: "ДРАКОН", c1: "#ff8cc4", c2: "#db2777", c3: "#6b0f3a", glow: "244,114,182",
    icon: (
      <>
        <path d="M3 32C13 14 51 14 61 32 51 50 13 50 3 32Z" fill={W} />
        <g className="rb-beat">
          <circle cx="32" cy="32" r="12" fill={D} />
          <ellipse cx="32" cy="32" rx="3" ry="10.500" fill="rgba(0,0,0,.7)" />
        </g>
        <circle cx="37" cy="27" r="2.600" fill="#fff" />
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
    id: 23, name: "МОНАРХ", c1: "#ff6a52", c2: "#b3170f", c3: "#5e0a08", glow: "255,60,40",
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
    id: 24, name: "ИМПЕРАТОР", c1: "#ffe66b", c2: "#d97706", c3: "#6b3105", glow: "250,190,40",
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
    id: 25, name: "БЕССМЕРТНЫЙ", c1: "#f8f4ff", c2: "#a78bfa", c3: "#3b2a7a", glow: "221,214,254",
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
