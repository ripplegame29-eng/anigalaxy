"use client";

import { useEffect, useState, type CSSProperties, type JSX } from "react";
import { MedalArt, medalOf } from "./medals";

/* ==== Палитра редкостей: точно как в эталоне ==== */
export const AE_RARITY = {
  common: { n: "Обычный", c: "#34e0a1", c2: "#18a0ff", c3: "#d7ff6a", go: 0.55 },
  rare: { n: "Редкий", c: "#38b6ff", c2: "#7a7dff", c3: "#6ef0ff", go: 0.65 },
  epic: { n: "Эпический", c: "#b06bff", c2: "#ff5fd2", c3: "#ffd0ff", go: 0.75 },
  legendary: { n: "Легендарный", c: "#ffd04d", c2: "#ff8a1f", c3: "#fff3a0", go: 0.9 },
  mythic: { n: "Мифический", c: "#6cf0ff", c2: "#ff6bd6", c3: "#ffd04d", go: 1 },
} as const;

export type AERarity = keyof typeof AE_RARITY;

const AE_ORDER: AERarity[] = ["common", "rare", "epic", "legendary", "mythic"];

/* ==== GL иконки (viewBox 24×24, stroke, round) ==== */
const GL: Record<string, JSX.Element> = {
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-5 4-7 8-7s8 2 8 7" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  flame: (
    <path d="M12 2c1 4 6 6 6 12a6 6 0 01-12 0c0-3 2-4 3-6 1 1 1 2 2 2 0-3 0-5 1-8z" />
  ),
  crown: <path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" />,
  planet: (
    <>
      <circle cx="12" cy="12" r="5" />
      <path d="M2.5 15c4 3 16-3 19-6" />
    </>
  ),
  bolt: <path d="M13 2L5 14h6l-1 8 8-12h-6z" />,
  star: (
    <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
  ),
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  play: <path d="M6 4l14 8-14 8z" />,
  flag: <path d="M5 21V4m0 1h12l-2.5 3.5L17 12H5" />,
  book: (
    <>
      <path d="M4 6a2 2 0 012-2h14v14H6a2 2 0 00-2 2z" />
      <path d="M20 16H6a2 2 0 00-2 2" />
    </>
  ),
  bookmark: <path d="M6 3h12v18l-6-4-6 4z" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 109.8 9.8z" />,
  heart: <path d="M12 21C7 16.5 3 13.3 3 9a5 5 0 019-3 5 5 0 019 3c0 4.3-4 7.5-9 12z" />,
  users: (
    <>
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8" />
    </>
  ),
  share: <path d="M4 12v8h16v-8M12 3v13M8 7l4-4 4 4" />,
  gift: (
    <>
      <rect x="3" y="8" width="18" height="4" />
      <path d="M12 8v13M5 12v9h14v-9M12 8s-2-5-5-5-3 4 0 5zM12 8s2-5 5-5 3 4 0 5z" />
    </>
  ),
  bag: (
    <>
      <path d="M6 7h12l1 13H5z" />
      <path d="M9 7a3 3 0 016 0" />
    </>
  ),
  layers: <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" />,
  medal: (
    <>
      <path d="M8 2h8v6H8z" />
      <circle cx="12" cy="15" r="6" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4h10v6a5 5 0 01-10 0zM7 5H4v3a3 3 0 003 3M17 5h3v3a3 3 0 01-3 3" />
      <path d="M12 15v3M8 21h8M12 18v3" />
    </>
  ),
  shield: <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19" />
    </>
  ),
  hourglass: <path d="M6 2h12M6 22h12M8 2v4l4 4 4-4V2M8 22v-4l4-4 4 4v4" />,
  gem: <path d="M6 3h12l4 6-10 13L2 9zM2 9h20M9 3l3 6 3-6" />,
  rotate: <path d="M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0114.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0020.5 15" />,
  leaf: <path d="M5 21c0-9 4-15 14-15 0 10-4 15-11 15-1.7 0-3-1-3-3z" />,
};

/* ==== хелперы, как в эталоне ==== */
const pol = (r: number, a: number): [string, string] =>
  [50 + r * Math.cos((a * Math.PI) / 180), 50 + r * Math.sin((a * Math.PI) / 180)].map((v) =>
    v.toFixed(1),
  ) as [string, string];
const ps = (r: number, a: number) => pol(r, a).join(",");
const hx = (r: number, rot = -90) => [0, 1, 2, 3, 4, 5].map((i) => ps(r, rot + 60 * i)).join(" ");

/* детерминированный rng (mulberry32) — как в эталоне */
function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashId(id: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface AchievementEmblemProps {
  achievement: { id: string; name: string; glyph: string; tier: number; maxTier: number };
  rarity: AERarity;
  progress: number;
  unlocked: boolean;
  locked: boolean;
  size: number;
  animated: boolean;
  burst?: boolean;
  tilt?: boolean;
}

export function AchievementEmblem({
  achievement: a,
  rarity,
  progress,
  unlocked,
  locked,
  size,
  animated,
  burst = false,
  tilt = false,
}: AchievementEmblemProps) {
  const uid = `ae${hashId(a.id).toString(36)}${size}${rarity}`;
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  const R = AE_RARITY[rarity] ?? AE_RARITY.common;
  const k = AE_ORDER.indexOf(rarity);
  const lite = size < 64;
  const r = mulberry32(hashId(a.id || "x") + k * 17 + size);
  const p = unlocked ? 100 : locked ? 0 : Math.max(0, Math.min(100, progress));
  const anim = animated && !reduced;

  const f = (n: number) => (+n).toFixed(1);

  /* задний план */
  const back: JSX.Element[] = [];
  if (k === 3) {
    const w = [0, 1, 2].map((i) => (
      <path
        key={i}
        d={`M14 ${40 + i * 5}Q-4 ${30 + i * 8} ${-12 - i * 2} ${34 + i * 9}Q4 ${44 + i * 8} 16 ${50 + i * 4}Z`}
        fill={`url(#${uid})`}
        opacity={0.95 - i * 0.12}
      />
    ));
    back.push(
      <g key="lw" className="ae-wg">
        {w}
      </g>,
      <g key="rw" transform="translate(100 0) scale(-1 1)">
        <g className="ae-wg">{w}</g>
      </g>,
    );
  }
  if (k >= 2) {
    const r1 = k === 4 ? 58 : 55;
    const w = k === 4 ? 4.5 : 6;
    for (let i = 0; i < 6; i++) {
      const ang = -90 + 60 * i;
      back.push(
        <polygon
          key={`sp${i}`}
          points={`${ps(45, ang - w)} ${ps(r1, ang)} ${ps(45, ang + w)}`}
          fill={`url(#${uid})`}
          opacity={0.9}
        />,
      );
    }
  }
  if (k >= 1) {
    back.push(
      <polygon
        key="outer-d"
        className={anim ? "ae-r" : ""}
        style={{ "--t": "50s" } as CSSProperties}
        points={hx(51, -60)}
        fill="none"
        stroke={R.c3}
        strokeOpacity={0.55}
        strokeWidth={0.6}
        strokeDasharray="1 3"
      />,
    );
  }
  if (k === 4) {
    back.push(
      <circle
        key="mythic-ring"
        className="ae-r"
        style={{ "--t": "40s" } as CSSProperties}
        cx="50"
        cy="50"
        r={53}
        fill="none"
        stroke={`url(#${uid}h)`}
        strokeWidth={1.2}
        strokeDasharray="1.5 4"
      />,
    );
  }

  /* корпус */
  const facets = [0, 1, 2, 3, 4, 5].map((i) => (
    <polygon
      key={i}
      points={`50,50 ${ps(35, -90 + 60 * i)} ${ps(35, -30 + 60 * i)}`}
      fill={[R.c, R.c2, R.c3][i % 3]}
      fillOpacity={(0.16 + (i % 3) * 0.07).toFixed(2)}
    />
  ));
  const front: JSX.Element[] = [
    <polygon
      key="bg"
      points={hx(46)}
      fill={`url(#${uid})`}
      stroke={`url(#${uid})`}
      strokeWidth={2}
      strokeLinejoin="round"
    />,
    <polygon
      key="plate"
      points={hx(43.2)}
      fill="#0b0d16"
      stroke="rgba(0,0,0,.5)"
      strokeWidth={0.6}
      strokeLinejoin="round"
    />,
    <polygon key="top" points={hx(35)} fill={`url(#${uid}p)`} />,
    ...facets,
    <polygon
      key="edge"
      points={hx(35)}
      fill="none"
      stroke={R.c}
      strokeOpacity={0.5}
      strokeWidth={0.7}
      strokeLinejoin="round"
    />,
  ];
  if (k >= 1) {
    front.push(
      <polygon
        key="inner-dash"
        className={anim ? "ae-r ae-rv" : ""}
        style={{ "--t": "30s" } as CSSProperties}
        points={hx(28, -60)}
        fill="none"
        stroke={R.c2}
        strokeOpacity={0.55}
        strokeWidth={0.7}
        strokeDasharray="2.5 3"
      />,
    );
  }
  front.push(
    <g
      key="glyph"
      className="ae-gy"
      transform="translate(50 50) scale(1.42) translate(-12 -12)"
      fill="none"
      stroke="#fff"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {GL[a.glyph] ?? GL.star}
    </g>,
  );
  if (!lite) {
    front.push(
      <g key="sheenmask" clipPath={`url(#${uid}c)`}>
        <g className="ae-sh">
          <polygon points={`0,0 14,0 4,100 -10,100`} fill={`url(#${uid}s)`} />
        </g>
      </g>,
    );
  }

  /* прогресс по периметру */
  let arc: JSX.Element | null = null;
  if (!locked) {
    arc = (
      <polygon
        points={hx(40.2)}
        fill="none"
        stroke="rgba(255,255,255,.1)"
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
    );
    /* ring filler must be separate element to get animation delay — build separately below */
  }

  const gems: JSX.Element[] = [];
  if (k >= 1) {
    for (let i = 0; i < 6; i++) {
      if (k <= 1 && i % 2 !== 0) continue;
      const [x, y] = pol(46, -90 + 60 * i);
      gems.push(
        <polygon
          key={`gem${i}`}
          points={`${x},${+y - 2.2 * 1.3} ${+x + 2.2},${y} ${x},${+y + 2.2 * 1.3} ${+x - 2.2},${y}`}
          fill="#fff"
        />,
      );
    }
  }
  if (k === 3) {
    gems.push(
      <path
        key="crown"
        d="M38 8L40-2 45 4 50-6 55 4 60-2 62 8Z"
        fill={`url(#${uid})`}
        stroke="#fff3a0"
        strokeWidth={0.6}
        strokeLinejoin="round"
      />,
    );
  }
  if (k >= 1 && anim && unlocked) {
    gems.push(
      <circle key="orb-motion" className="ae-orb" r={1.9} fill="#fff">
        <animateMotion dur={k === 4 ? "5s" : "8s"} repeatCount="indefinite" path={`M${hx(46).replace(/ /g, " L")}Z`} />
      </circle>,
    );
  }

  /* частицы вокруг */
  const h: JSX.Element[] = [];
  if (!lite && anim && unlocked) {
    const n = k === 3 ? 6 : k >= 2 ? 4 : 0;
    for (let i = 0; i < n; i++) {
      if (k === 3) {
        h.push(
          <i
            key={`em${i}`}
            className="ae-em"
            style={
              {
                "--x": `${f(25 + r() * 50)}%`,
                "--dx": `${f((r() - 0.5) * 24)}px`,
                "--t": `${f(1.6 + r() * 1.6)}s`,
                "--d": `${f(-r() * 3)}s`,
              } as CSSProperties
            }
          />,
        );
      } else {
        h.push(
          <i
            key={`st${i}`}
            className="ae-st"
            style={
              {
                left: `${f(r() * 100)}%`,
                top: `${f(r() * 100)}%`,
                "--t": `${f(1.8 + r() * 2)}s`,
                "--d": `${f(-r() * 3)}s`,
              } as CSSProperties
            }
          />,
        );
      }
    }
  }
  if (!lite && anim) {
    if (k >= 2) h.push(<i key="rays" className="ae-rays" />);
    if (k >= 1) {
      for (let i = 0; i < 2 + (k > 2 ? 1 : 0); i++) {
        h.push(<i key={`rp${i}`} className="ae-rp" style={{ "--d": `${i * 1.2}s` } as CSSProperties} />);
      }
    }
    if (k >= 2) {
      for (let i = 0; i < k - 1; i++) {
        h.push(
          <i
            key={`cm${i}`}
            className="ae-cm"
            style={
              {
                "--i": `${-2 - i * 4}%`,
                "--t": `${f(3 + r() * 3)}s`,
                "--cc": i % 2 ? R.c2 : R.c3,
              } as CSSProperties
            }
          />,
        );
      }
    }
    for (let i = 0; i < 3 + k; i++) {
      const g = r() * 6.283;
      const d = 50 + r() * 16;
      h.push(
        <i
          key={`sk${i}`}
          className="ae-sk"
          style={
            {
              left: `${f(50 + Math.cos(g) * d)}%`,
              top: `${f(50 + Math.sin(g) * d)}%`,
              "--t": `${f(1.6 + r() * 2)}s`,
              "--d": `${f(-r() * 3)}s`,
              "--z": f(0.6 + r() * 0.9),
            } as CSSProperties
          }
        />,
      );
    }
  }
  if (burst) {
    for (let i = 0; i < 18; i++) {
      h.push(
        <i
          key={`cf${i}`}
          className="ae-cf"
          style={
            {
              "--a": `${i * 20}deg`,
              "--col": [R.c, R.c2, R.c3, "#fff"][i % 4],
              "--l": f(0.7 + r() * 0.5),
            } as CSSProperties
          }
        />,
      );
    }
  }

  const lit = unlocked ? a.tier || 1 : Math.max(0, (a.tier || 1) - 1);
  const pips = Array.from({ length: a.maxTier || 5 }, (_, i) => (
    <b key={i} className={i < lit ? "on" : ""} />
  ));
  const dim = !unlocked;

  /* Девять достижений переодеты в медали из макетов: у них своя форма,
     свой объём и своя иконка, а не цвет редкости. Их рисуем отдельно —
     иначе пришлось бы подгонять круглую эмблему под шестиугольник. */
  const medal = medalOf(a.id);
  if (medal) {
    return (
      <div
        className={["ae-md", dim ? "ae-md-dim" : "", anim ? "" : "ae-still"].filter(Boolean).join(" ")}
        role="img"
        aria-label={`${medal.code}. ${medal.description}. ${unlocked ? "получено" : `прогресс ${p}%`}`}
        style={{ "--s": `${size}px` } as CSSProperties}
      >
        <MedalArt medal={medal} size={size} dimmed={dim} />
      </div>
    );
  }

  return (
    <div
      className={[
        "ae",
        dim ? "ae-dim" : "",
        locked ? "ae-lk" : "",
        k === 4 && unlocked ? "ae-holo" : "",
        anim ? "" : "ae-still",
        burst ? "ae-pop" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="img"
      aria-label={`${a.name || "Достижение"}, ${R.n}, ${unlocked ? "получено" : locked ? "закрыто" : `прогресс ${p}%`}`}
      style={
        {
          "--s": `${size}px`,
          "--c": R.c,
          "--c2": R.c2,
          "--c3": R.c3,
          "--go": String(R.go),
          "--d0": `${f(-r() * 3)}s`,
        } as CSSProperties
      }
      onPointerMove={(event) => {
        if (!tilt) return;
        const el = event.currentTarget;
        const b = el.getBoundingClientRect();
        const c = (v: number) => Math.max(-0.5, Math.min(0.5, v));
        el.style.setProperty("--ry", `${c((event.clientX - b.left) / b.width - 0.5) * 30}deg`);
        el.style.setProperty("--rx", `${-c((event.clientY - b.top) / b.height - 0.5) * 30}deg`);
      }}
      onPointerLeave={(event) => {
        if (!tilt) return;
        const el = event.currentTarget;
        el.style.setProperty("--ry", "0deg");
        el.style.setProperty("--rx", "0deg");
      }}
    >
      <svg viewBox="0 0 100 100">
        <defs>
          <linearGradient id={uid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={R.c} />
            <stop offset=".5" stopColor={R.c3} />
            <stop offset="1" stopColor={R.c2} />
          </linearGradient>
          <linearGradient id={`${uid}h`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6cf0ff" />
            <stop offset=".33" stopColor="#ff6bd6" />
            <stop offset=".66" stopColor="#ffd04d" />
            <stop offset="1" stopColor="#6cf0ff" />
          </linearGradient>
          <radialGradient id={`${uid}p`} cx=".5" cy=".35" r=".8">
            <stop offset="0" stopColor={R.c} stopOpacity=".6" />
            <stop offset="1" stopColor="#090a12" />
          </radialGradient>
          <linearGradient id={`${uid}s`}>
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".5" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${uid}c`}>
            <polygon points={hx(35)} />
          </clipPath>
        </defs>
        <g className="ae-pl">
          {back}
          {front}
        </g>
        {arc}
        {!locked && p > 0 && (
          <polygon
            className="ae-arc"
            points={hx(40.2)}
            pathLength={100}
            fill="none"
            stroke={`url(#${uid}${k === 4 ? "h" : ""})`}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${p} 100`}
          />
        )}
        {gems}
      </svg>
      {h}
      {burst ? <i className="ae-bu" /> : null}
      <div className="ae-pips">{pips}</div>
    </div>
  );
}
