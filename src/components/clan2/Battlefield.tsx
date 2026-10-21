"use client";

import type { CSSProperties } from "react";
import type { Clan2, WarState } from "@/lib/clan2/store";
import { FRONT_NAMES } from "@/lib/clan2/store";
import type { Rival } from "@/lib/clan2/data";

const LANES = [112, 250, 388];
const X0 = 150;
const X1 = 850;
const fx = (pos: number) => 500 + pos * 3.5;

/**
 * Поле битвы: три фронта между цитаделью клана и крепостью соперника.
 * Всё векторное: плазменные дорожки с цветом сторон, движущиеся отряды,
 * линия соприкосновения с искрами, купол щита, флаги захваченных участков.
 */
export function Battlefield({ clan, rival, war, now, flash }: { clan: Clan2; rival: Rival; war: WarState; now: number; flash: { front: number; id: number } | null }) {
  const mine = clan.color;
  const theirs = rival.color;
  return (
    <svg className="c2-bf" viewBox="0 0 1000 500" role="img" aria-label="Поле битвы" style={{ ["--m" as string]: mine, ["--t" as string]: theirs } as CSSProperties}>
      <defs>
        <radialGradient id="bf-sky" cx="50%" cy="40%" r="75%">
          <stop offset="0" stopColor="#1b1f3d" />
          <stop offset="1" stopColor="#07080f" />
        </radialGradient>
        <linearGradient id="bf-mine" x1="0" x2="1"><stop offset="0" stopColor={mine} stopOpacity=".35" /><stop offset="1" stopColor={mine} /></linearGradient>
        <linearGradient id="bf-them" x1="1" x2="0"><stop offset="0" stopColor={theirs} stopOpacity=".35" /><stop offset="1" stopColor={theirs} /></linearGradient>
        <radialGradient id="bf-fm" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor={mine} stopOpacity=".9" /><stop offset="1" stopColor={mine} stopOpacity="0" /></radialGradient>
        <radialGradient id="bf-ft" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor={theirs} stopOpacity=".9" /><stop offset="1" stopColor={theirs} stopOpacity="0" /></radialGradient>
        <filter id="bf-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id="bf-soft"><feGaussianBlur stdDeviation="14" /></filter>
        <pattern id="bf-hex" width="46" height="40" patternUnits="userSpaceOnUse" patternTransform="scale(1.1)">
          <path d="M23 2 L43 12 L43 30 L23 40 L3 30 L3 12 Z" fill="none" stroke="#9fb0ff" strokeOpacity=".09" />
        </pattern>
        <linearGradient id="bf-ridge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#141830" /><stop offset="1" stopColor="#07080f" /></linearGradient>
        {LANES.map((y, i) => (
          <g key={i}>
            <clipPath id={`bf-cm-${i}`}><rect x="0" y="0" width={fx(war.fronts[i].pos)} height="500" /></clipPath>
            <clipPath id={`bf-ct-${i}`}><rect x={fx(war.fronts[i].pos)} y="0" width="1000" height="500" /></clipPath>
          </g>
        ))}
      </defs>

      <rect width="1000" height="500" fill="url(#bf-sky)" />
      <rect width="1000" height="500" fill="url(#bf-hex)" />
      <ellipse cx="170" cy="250" rx="260" ry="220" fill="url(#bf-fm)" opacity=".35" />
      <ellipse cx="830" cy="250" rx="260" ry="220" fill="url(#bf-ft)" opacity=".35" />

      {/* хребты */}
      <path d="M0 500 L0 440 L70 400 L130 436 L210 380 L300 440 L380 410 L470 450 L560 400 L650 446 L740 396 L830 440 L920 404 L1000 446 L1000 500 Z" fill="url(#bf-ridge)" opacity=".9" />

      {/* дорожки */}
      {LANES.map((y, i) => {
        const f = war.fronts[i];
        const x = fx(f.pos);
        const shield = f.shieldUntil > now;
        return (
          <g key={i} className={`bf-lane${flash && flash.front === i ? " flash" : ""}`}>
            <line x1={X0} x2={X1} y1={y} y2={y} className="trk" />
            <g clipPath={`url(#bf-cm-${i})`}>
              <line x1={X0} x2={X1} y1={y} y2={y} className="fill m" stroke="url(#bf-mine)" filter="url(#bf-glow)" />
              <line x1={X0} x2={X1} y1={y} y2={y} className="flow m" />
            </g>
            <g clipPath={`url(#bf-ct-${i})`}>
              <line x1={X0} x2={X1} y1={y} y2={y} className="fill t" stroke="url(#bf-them)" filter="url(#bf-glow)" />
              <line x1={X0} x2={X1} y1={y} y2={y} className="flow t" />
            </g>

            {/* отряды */}
            {Array.from({ length: 5 }).map((_, k) => (
              <g key={`m${k}`} transform={`translate(${X0},${y})`}>
                <polygon points="0,-6 9,0 0,6" className="unit m" style={{ ["--d" as string]: `${Math.max(0, x - X0 - 24)}px`, animationDelay: `${-k * 1.3}s` }} />
              </g>
            ))}
            {Array.from({ length: 5 }).map((_, k) => (
              <g key={`t${k}`} transform={`translate(${X1},${y})`}>
                <polygon points="0,-6 -9,0 0,6" className="unit t" style={{ ["--d" as string]: `${-Math.max(0, X1 - x - 24)}px`, animationDelay: `${-k * 1.1}s` }} />
              </g>
            ))}

            {/* линия соприкосновения */}
            <g transform={`translate(${x},${y})`} className="clash" key={flash && flash.front === i ? flash.id : 0}>
              <circle r="46" fill="url(#bf-fm)" className="ring" opacity=".25" />
              <circle r="30" className="pulse" />
              <g className="spin"><polygon points="0,-20 8,0 0,20 -8,0" fill="#fff" filter="url(#bf-glow)" /><polygon points="-20,0 0,-8 20,0 0,8" fill="#fff" opacity=".7" /></g>
              {Array.from({ length: 8 }).map((_, k) => (
                <line key={k} x1="0" y1="0" x2="0" y2="-34" className="spark" transform={`rotate(${k * 45})`} style={{ animationDelay: `${k * 0.1}s` }} />
              ))}
              {shield && (
                <g className="dome">
                  <path d="M0 -46 A46 46 0 0 0 0 46" fill="none" stroke={mine} strokeWidth="3" filter="url(#bf-glow)" />
                  <path d="M0 -46 A46 46 0 0 0 0 46 Z" fill={mine} opacity=".14" />
                </g>
              )}
            </g>

            <text x={X0 + 8} y={y - 22} className="lane-name">{FRONT_NAMES[i]}</text>
            {f.pos >= 100 && <text x={X1 - 6} y={y - 20} className="flag m">⚑</text>}
            {f.pos <= -100 && <text x={X0 + 6} y={y - 20} className="flag t">⚑</text>}
          </g>
        );
      })}

      {/* наша цитадель */}
      <g transform="translate(78,250)" className="fort m">
        <circle r="84" fill="url(#bf-fm)" opacity=".5" className="halo" />
        <circle r="70" className="orb" fill="none" />
        <polygon points="0,-52 46,-26 46,26 0,52 -46,26 -46,-26" fill="#0c1022" stroke={mine} strokeWidth="3" filter="url(#bf-glow)" />
        <polygon points="0,-36 31,-18 31,18 0,36 -31,18 -31,-18" fill={mine} opacity=".18" />
        <text y="14" textAnchor="middle" fontSize="44">{clan.emblem}</text>
      </g>
      {/* крепость соперника */}
      <g transform="translate(922,250)" className="fort t">
        <circle r="84" fill="url(#bf-ft)" opacity=".5" className="halo" />
        <circle r="70" className="orb rev" fill="none" />
        <polygon points="0,-56 14,-18 52,-18 22,6 34,44 0,22 -34,44 -22,6 -52,-18 -14,-18" fill="#0c1022" stroke={theirs} strokeWidth="3" filter="url(#bf-glow)" />
        <polygon points="0,-34 9,-10 32,-10 14,4 20,28 0,14 -20,28 -14,4 -32,-10 -9,-10" fill={theirs} opacity=".2" />
        <text y="14" textAnchor="middle" fontSize="40">{rival.emblem}</text>
      </g>

      {/* искры в воздухе */}
      {Array.from({ length: 16 }).map((_, i) => (
        <circle key={i} cx={40 + ((i * 61) % 920)} cy={470} r={1 + (i % 3)} className="ember" style={{ animationDelay: `${-i * 0.7}s`, animationDuration: `${7 + (i % 5)}s` }} fill={i % 2 ? mine : theirs} />
      ))}
    </svg>
  );
}
