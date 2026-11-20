"use client";

/** Векторные знаки кланов: значки лиг, кристалл, кубок, сундуки, медали спонсоров и предметы оформления. */

import { useId } from "react";
import { leagueOf } from "@/lib/clan-rules";

const uid = (raw: string) => raw.replace(/:/g, "");

export function LeagueBadge({ league, size = 72 }: { league: number; size?: number }) {
  const l = leagueOf(league);
  const id = Math.min(Math.max(0, league | 0), 5);
  /* Объёмные эмблемы лиг (те же, что у рангов карточной арены):
     маленькая копия для списков, большая — для героя и лестницы лиг */
  return (
    <img
      className="ca-lbadge"
      src={size > 120 ? `/clans/leagues/${id}.webp` : `/clans/leagues/${id}-sm.webp`}
      srcSet={size > 120 ? undefined : `/clans/leagues/${id}-sm.webp 192w, /clans/leagues/${id}.webp 512w`}
      sizes={size > 120 ? undefined : `${size}px`}
      width={size}
      height={size}
      alt={`Лига ${l.name}`}
      draggable={false}
      style={{ ["--lc" as string]: l.color, width: size, height: size, objectFit: "contain" }}
    />
  );
}

export function CrystalIcon({ size = 20, color = "#7ecbff" }: { size?: number; color?: string }) {
  const id = uid(useId());
  return (
    <svg viewBox="0 0 24 28" width={size} height={size * 1.16} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".45" stopColor={color} />
          <stop offset="1" stopColor="#3b4fd8" />
        </linearGradient>
      </defs>
      <path d="M12 1 L22 9 L12 27 L2 9Z" fill={`url(#${id})`} stroke="#fff" strokeOpacity=".6" strokeWidth=".8" strokeLinejoin="round" />
      <path d="M2 9 H22 M12 1 L8 9 L12 27 L16 9Z" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".8" strokeLinejoin="round" />
    </svg>
  );
}

export function TrophyIcon({ size = 20, color = "#ffc65a" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" fill={color} fillOpacity=".25" />
      <path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8M9.5 18h5" />
    </svg>
  );
}

export function CrownIcon({ size = 16, color = "#ffc65a" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 20" width={size} height={size * 0.83} aria-hidden>
      <path d="M2 16 L1 5 L7 10 L12 2 L17 10 L23 5 L22 16Z" fill={color} stroke="#fff" strokeOpacity=".5" strokeWidth=".8" strokeLinejoin="round" />
      <rect x="2" y="17" width="20" height="2.2" rx="1" fill={color} />
    </svg>
  );
}

export function ChestIcon({ color, size = 64, open = false }: { color: string; size?: number; open?: boolean }) {
  const id = uid(useId());
  return (
    <svg viewBox="0 0 80 72" width={size} height={size * 0.9} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor="#2a1a12" />
        </linearGradient>
      </defs>
      {open && <ellipse cx="40" cy="26" rx="26" ry="14" fill={color} opacity=".35" />}
      <path d={open ? "M10 28 L16 6 H64 L70 28Z" : "M8 30 C8 12 22 6 40 6 C58 6 72 12 72 30Z"} fill={`url(#${id})`} stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <rect x="8" y="30" width="64" height="34" rx="4" fill={`url(#${id})`} stroke={color} strokeWidth="2" />
      <path d="M8 40 H72" stroke={color} strokeWidth="2.5" />
      <rect x="34" y="34" width="12" height="16" rx="3" fill="#fff" stroke={color} strokeWidth="2" />
      <circle cx="40" cy="42" r="2.3" fill="#2a1a12" />
    </svg>
  );
}

export function DonorMedal({ color, size = 28 }: { color: string; size?: number }) {
  const id = uid(useId());
  return (
    <svg viewBox="0 0 32 40" width={size} height={size * 1.25} aria-hidden>
      <defs>
        <radialGradient id={id} cx=".35" cy=".3" r=".9">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".4" stopColor={color} />
          <stop offset="1" stopColor="#3a2a10" />
        </radialGradient>
      </defs>
      <path d="M8 0 L16 14 L24 0Z" fill={color} opacity=".75" />
      <circle cx="16" cy="25" r="12" fill={`url(#${id})`} stroke={color} strokeWidth="1.6" />
      <path d="M16 17 l2.4 5 5.4.6-4 3.7 1.1 5.3-4.9-2.7-4.9 2.7 1.1-5.3-4-3.7 5.4-.6z" fill="#fff" fillOpacity=".92" />
    </svg>
  );
}

/** Превью предмета оформления клана */
export { CosmeticArt as ItemArt } from "./ClanCosmetics";
