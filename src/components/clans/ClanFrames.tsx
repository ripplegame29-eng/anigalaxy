"use client";

/**
 * Рамки клана — свои, рисуются кодом (SVG 200×200, круг аватара r=60 в центре).
 * Каждая — отдельный мотив: венок, крылья, кристаллы, корона и т. д.
 * Цвета: a — светлый металл, b — тёмный тон, c — камень/акцент.
 */

import { useId } from "react";

export type FrameMotif = "laurel" | "wings" | "crystal" | "crown" | "thorns" | "moon" | "flame" | "sakura" | "galaxy";

const C = 100;
const R = 60;
const pol = (r: number, deg: number): [number, number] => {
  const t = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(t), C + r * Math.sin(t)];
};
const f = (n: number) => n.toFixed(2);

function Leaf({ r, deg, len, w, tilt, fill }: { r: number; deg: number; len: number; w: number; tilt: number; fill: string }) {
  const [x, y] = pol(r, deg);
  return (
    <path
      d={`M0 0 C ${f(w)} ${f(-len * 0.35)} ${f(w * 0.6)} ${f(-len * 0.8)} 0 ${f(-len)} C ${f(-w * 0.6)} ${f(-len * 0.8)} ${f(-w)} ${f(-len * 0.35)} 0 0Z`}
      transform={`translate(${f(x)} ${f(y)}) rotate(${f(deg + tilt)})`}
      fill={fill}
      stroke="rgba(0,0,0,.35)"
      strokeWidth=".6"
    />
  );
}

function Gem({ x, y, s, g }: { x: number; y: number; s: number; g: string }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)})`}>
      <path d={`M0 ${-s} L${s * 0.75} 0 L0 ${s} L${-s * 0.75} 0Z`} fill={g} stroke="rgba(255,255,255,.7)" strokeWidth=".7" />
      <path d={`M0 ${-s} L${s * 0.25} 0 L0 ${s * 0.4} L${-s * 0.25} 0Z`} fill="rgba(255,255,255,.55)" />
    </g>
  );
}

function Spark({ x, y, s, c }: { x: number; y: number; s: number; c: string }) {
  return <path d={`M${f(x)} ${f(y - s)} Q${f(x)} ${f(y)} ${f(x + s)} ${f(y)} Q${f(x)} ${f(y)} ${f(x)} ${f(y + s)} Q${f(x)} ${f(y)} ${f(x - s)} ${f(y)} Q${f(x)} ${f(y)} ${f(x)} ${f(y - s)}Z`} fill={c} className="xf-tw" />;
}

export function ClanFrameArt({ motif, a, b, c, size }: { motif: FrameMotif; a: string; b: string; c: string; size: number }) {
  const id = useId().replace(/:/g, "");
  const metal = `url(#${id}m)`;
  const gem = `url(#${id}g)`;
  const ring = (
    <>
      <circle cx={C} cy={C} r={R + 4} fill="none" stroke={metal} strokeWidth="7" />
      <circle cx={C} cy={C} r={R + 0.5} fill="none" stroke="rgba(0,0,0,.55)" strokeWidth="1.5" />
      <circle cx={C} cy={C} r={R + 7.6} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth=".6" />
    </>
  );
  let art: React.ReactNode = null;

  if (motif === "laurel" || motif === "sakura") {
    const leaves = [];
    for (let side = -1; side <= 1; side += 2)
      for (let k = 0; k < 11; k++) {
        const deg = 180 + side * (22 + k * 13.5);
        leaves.push(<Leaf key={`${side}${k}`} r={R + 9} deg={deg} len={18 - k * 0.4} w={7} tilt={side * -28} fill={motif === "sakura" && k % 3 === 1 ? `url(#${id}p)` : metal} />);
        if (motif === "sakura" && k % 3 === 0) {
          const [x, y] = pol(R + 24, deg);
          leaves.push(
            <g key={`f${side}${k}`} transform={`translate(${f(x)} ${f(y)})`}>
              {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} rx="3" ry="5.2" cy="-4.4" transform={`rotate(${r})`} fill={`url(#${id}p)`} stroke="rgba(120,20,60,.4)" strokeWidth=".4" />)}
              <circle r="1.8" fill="#ffe08a" />
            </g>,
          );
        }
      }
    art = (
      <>
        {leaves}
        {ring}
        <Gem x={C} y={C + R + 6} s={7} g={gem} />
        <path d={`M${C - 14} ${C + R + 10} q14 10 28 0`} fill="none" stroke={metal} strokeWidth="3" />
      </>
    );
  } else if (motif === "wings") {
    const feathers = [];
    for (let side = -1; side <= 1; side += 2)
      for (let k = 0; k < 9; k++) {
        const deg = 90 * side + side * (k * 9 - 28);
        feathers.push(<Leaf key={`${side}${k}`} r={R + 4} deg={deg} len={30 + (k < 5 ? k * 4 : (8 - k) * 4)} w={6.5} tilt={side * 8} fill={k % 2 ? metal : `url(#${id}w)`} />);
      }
    art = (
      <>
        {feathers}
        {ring}
        <Gem x={C} y={C - R - 6} s={9} g={gem} />
        <Spark x={C} y={C - R - 24} s={7} c="#fff" />
      </>
    );
  } else if (motif === "crystal" || motif === "galaxy") {
    const shards = [];
    for (let k = 0; k < 14; k++) {
      const deg = k * (360 / 14) + (k % 2) * 6;
      const len = k % 2 ? 16 : 26;
      const [x, y] = pol(R + 6, deg);
      shards.push(<path key={k} d={`M-5 0 L0 ${-len} L5 0 L0 4Z`} transform={`translate(${f(x)} ${f(y)}) rotate(${deg})`} fill={gem} stroke="rgba(255,255,255,.75)" strokeWidth=".6" />);
    }
    art = (
      <>
        {motif === "galaxy" && <circle cx={C} cy={C} r={R + 26} fill={`url(#${id}n)`} className="xf-spin" />}
        {shards}
        {ring}
        {motif === "galaxy" && [20, 95, 160, 230, 300].map((d, k) => { const [x, y] = pol(R + 30, d); return <Spark key={k} x={x} y={y} s={3 + (k % 2) * 2} c="#fff" />; })}
      </>
    );
  } else if (motif === "crown") {
    const spikes = [];
    for (let k = -3; k <= 3; k++) {
      const deg = k * 14;
      const len = 26 - Math.abs(k) * 4;
      const [x, y] = pol(R + 6, deg);
      spikes.push(
        <g key={k} transform={`translate(${f(x)} ${f(y)}) rotate(${deg})`}>
          <path d={`M-6 0 L0 ${-len} L6 0Z`} fill={metal} stroke="rgba(0,0,0,.35)" strokeWidth=".6" />
          <circle cy={-len - 2} r="2.6" fill={gem} stroke="#fff" strokeWidth=".5" />
        </g>,
      );
    }
    const studs = [];
    for (let k = 0; k < 16; k++) { const [x, y] = pol(R + 4, k * 22.5 + 11); studs.push(<circle key={k} cx={x} cy={y} r="1.6" fill="rgba(255,255,255,.85)" />); }
    art = (
      <>
        {spikes}
        {ring}
        {studs}
        <Gem x={C} y={C - R - 3} s={8} g={gem} />
        <Gem x={C - R - 3} y={C} s={5} g={gem} />
        <Gem x={C + R + 3} y={C} s={5} g={gem} />
      </>
    );
  } else if (motif === "thorns") {
    const t = [];
    for (let k = 0; k < 24; k++) {
      const deg = k * 15;
      const [x, y] = pol(R + 5, deg);
      t.push(<path key={k} d="M-3 0 Q-1 -9 2 -15 Q1 -7 3 0Z" transform={`translate(${f(x)} ${f(y)}) rotate(${deg + 18})`} fill={metal} />);
    }
    art = (
      <>
        <circle cx={C} cy={C} r={R + 9} fill="none" stroke={metal} strokeWidth="2.4" strokeDasharray="10 4" />
        {t}
        {ring}
        {[45, 135, 225, 315].map((d) => { const [x, y] = pol(R + 4, d); return <Gem key={d} x={x} y={y} s={6} g={gem} />; })}
      </>
    );
  } else if (motif === "moon") {
    art = (
      <>
        <path d={`M${C - 70} ${C + 6} A 72 72 0 1 0 ${C + 30} ${C - 64} A 62 62 0 1 1 ${C - 70} ${C + 6}Z`} fill={metal} stroke="rgba(255,255,255,.6)" strokeWidth=".8" />
        {ring}
        {[30, 70, 110, 330].map((d, k) => { const [x, y] = pol(R + 20 + (k % 2) * 8, d); return <Spark key={d} x={x} y={y} s={4 + (k % 2) * 3} c="#fff" />; })}
        <Gem x={C + 46} y={C - 46} s={8} g={gem} />
      </>
    );
  } else if (motif === "flame") {
    const fl = [];
    for (let k = 0; k < 18; k++) {
      const deg = k * 20;
      const len = 18 + ((k * 7) % 3) * 6;
      const [x, y] = pol(R + 5, deg);
      fl.push(
        <g key={k} transform={`translate(${f(x)} ${f(y)}) rotate(${deg})`}>
          <path className="xf-flick" style={{ animationDelay: `${-k * 0.13}s` }} d={`M-7 0 C-7 ${-len * 0.5} 2 ${-len * 0.6} 0 ${-len} C6 ${-len * 0.55} 7 ${-len * 0.3} 7 0Z`} fill={`url(#${id}f)`} />
        </g>,
      );
    }
    art = (
      <>
        {fl}
        {ring}
      </>
    );
  }

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} overflow="visible" aria-hidden className="xf">
      <defs>
        <linearGradient id={`${id}m`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".25" stopColor={a} />
          <stop offset=".6" stopColor={b} />
          <stop offset=".85" stopColor={a} />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".35" stopColor={c} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor={c} />
        </linearGradient>
        <radialGradient id={`${id}p`}>
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#ff8fbf" />
        </radialGradient>
        <linearGradient id={`${id}f`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={b} />
          <stop offset=".55" stopColor={c} />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
        <radialGradient id={`${id}n`}>
          <stop offset=".55" stopColor="transparent" />
          <stop offset=".75" stopColor={c} stopOpacity=".45" />
          <stop offset="1" stopColor={b} stopOpacity="0" />
        </radialGradient>
      </defs>
      {art}
    </svg>
  );
}
