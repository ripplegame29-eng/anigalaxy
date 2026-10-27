"use client";

/** Векторные знаки кланов: значки лиг, кристалл, кубок, сундуки, медали спонсоров и предметы оформления. */

import { useId } from "react";
import { leagueOf, type ClanItem } from "@/lib/clan-rules";

const uid = (raw: string) => raw.replace(/:/g, "");

export function LeagueBadge({ league, size = 72 }: { league: number; size?: number }) {
  const id = uid(useId());
  const l = leagueOf(league);
  const gems = Math.min(league + 1, 6);
  return (
    <svg viewBox="0 0 100 112" width={size} height={size * 1.12} role="img" aria-label={`Лига ${l.name}`}>
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={l.color} />
          <stop offset="1" stopColor={l.deep} />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".75" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}c`} cx=".5" cy=".4" r=".7">
          <stop offset="0" stopColor={l.color} stopOpacity=".55" />
          <stop offset="1" stopColor={l.color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="56" r="52" fill={`url(#${id}c)`} />
      {/* крылья */}
      <path d="M12 38 L2 60 L18 56 L10 78 L32 62Z" fill={l.color} opacity=".55" />
      <path d="M88 38 L98 60 L82 56 L90 78 L68 62Z" fill={l.color} opacity=".55" />
      {/* щит */}
      <path d="M50 4 L88 18 V56 C88 82 70 98 50 108 C30 98 12 82 12 56 V18Z" fill={`url(#${id}a)`} stroke={l.color} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M50 12 L80 23 V55 C80 76 66 90 50 98 C34 90 20 76 20 55 V23Z" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.5" />
      <path d="M50 4 L88 18 V56 C88 60 87.6 64 87 67 L50 4Z" fill={`url(#${id}b)`} opacity=".5" />
      {/* центральный ромб */}
      <path d="M50 30 L66 52 L50 78 L34 52Z" fill={l.deep} stroke={l.color} strokeWidth="2" strokeLinejoin="round" />
      <path d="M50 30 L66 52 L50 52Z" fill={l.color} opacity=".85" />
      <path d="M50 52 L34 52 L50 30Z" fill="#fff" opacity=".35" />
      <path d="M50 52 L66 52 L50 78Z" fill={l.color} opacity=".35" />
      {/* камни ранга */}
      {Array.from({ length: gems }, (_, i) => (
        <circle key={i} cx={50 + (i - (gems - 1) / 2) * 9} cy="90" r="3" fill="#fff" stroke={l.color} strokeWidth="1.2" />
      ))}
    </svg>
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
export function ItemArt({ item, size = 96 }: { item: ClanItem; size?: number }) {
  const id = uid(useId());
  const grad = (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor={item.a} />
      <stop offset="1" stopColor={item.b} />
    </linearGradient>
  );
  if (item.slot === "banner") {
    return (
      <svg viewBox="0 0 80 100" width={size * 0.8} height={size} aria-hidden>
        <defs>{grad}</defs>
        <rect x="6" y="4" width="68" height="4" rx="2" fill="#d9dce8" />
        <path d="M12 8 H68 V76 L40 94 L12 76Z" fill={`url(#${id})`} stroke="#fff" strokeOpacity=".5" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M40 24 l5 11 12 1.4-9 8 2.6 12-10.6-6.2-10.6 6.2 2.6-12-9-8 12-1.4z" fill="#fff" fillOpacity=".85" />
        <path d="M12 8 H68 V30 C50 22 30 36 12 28Z" fill="#fff" fillOpacity=".14" />
      </svg>
    );
  }
  if (item.slot === "aura") {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
        <defs>
          <radialGradient id={id} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor={item.a} stopOpacity=".95" />
            <stop offset=".6" stopColor={item.b} stopOpacity=".5" />
            <stop offset="1" stopColor={item.b} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill={`url(#${id})`} />
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d="M50 50 L47 8 L53 8Z" fill={item.a} opacity={i % 2 ? 0.35 : 0.65} transform={`rotate(${i * 30} 50 50)`} />
        ))}
        <circle cx="50" cy="50" r="10" fill="#fff" opacity=".9" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <defs>{grad}</defs>
      <circle cx="50" cy="50" r="42" fill="none" stroke={`url(#${id})`} strokeWidth="9" />
      <circle cx="50" cy="50" r="46.5" fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="1.2" />
      <circle cx="50" cy="50" r="37.5" fill="none" stroke="#000" strokeOpacity=".35" strokeWidth="1.2" />
      {[0, 90, 180, 270].map((a) => (
        <path key={a} d="M50 2 L55 10 L50 16 L45 10Z" fill={item.a} stroke="#fff" strokeOpacity=".7" strokeWidth=".8" transform={`rotate(${a} 50 50)`} />
      ))}
    </svg>
  );
}
