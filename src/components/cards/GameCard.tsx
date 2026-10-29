"use client";

import type { CSSProperties, ReactNode } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { ELEMENTS, RANKS } from "@/lib/cards/config";
import { hasArt } from "@/lib/cards/client";
import { ELEMENT_ICON, Ico } from "./icons";

const EL_COLOR: Record<string, string> = {
  fire: "#ff6a3d",
  water: "#3aa0ff",
  wind: "#4fdca8",
  earth: "#d49b4f",
  light: "#ffe27a",
  dark: "#a073ff",
};

export interface GameCardProps {
  cardId: string;
  foil?: boolean;
  level?: number;
  selected?: boolean;
  dim?: boolean;
  locked?: boolean;
  /** Подпись-счётчик в углу, например «×3» */
  count?: number;
  /** Показать характеристики */
  stats?: boolean;
  /** Оживить арт (эпические и выше): дыхание, блики, частицы */
  live?: boolean;
  /** Ступень пробуждения (0..2) */
  evo?: number;
  /** Закрыть арт (неоткрытая карта в альбоме) */
  unknown?: boolean;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}

/** Эмблема ранга: у каждого ранга собственный силуэт */
export function RankMark({ rank }: { rank: number }) {
  const shapes = [
    <circle key="c" cx="8" cy="8" r="4.5" />,
    <path key="r" d="M8 2l5 3v6l-5 3-5-3V5z" />,
    <path key="e" d="M8 1.5l2 3.5 4 .6-2.9 2.9.7 4L8 10.5 4.2 12.5l.7-4L2 5.6 6 5z" />,
    <path key="l" d="M8 1l1.8 4.2L14.5 6l-3.4 3 1 4.5L8 11.2 3.9 13.5l1-4.5L1.5 6l4.7-.8z M8 4.4v4" />,
    <path key="m" d="M1.5 12.5L2.5 5l3 3L8 2.5 10.5 8l3-3 1 7.5z" />,
  ];
  return (
    <svg className="gc-mark" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      {shapes[rank] ?? shapes[0]}
    </svg>
  );
}

/** Карточка персонажа: арт + рамка ранга + плашка имени. Размер задаёт родитель (ширина). */
export function GameCard({ cardId, foil, level = 1, selected, dim, locked, count, stats = true, unknown, live, evo = 0, onClick, className = "", children }: GameCardProps) {
  const def = cardDef(cardId);
  if (!def) return null;
  const rank = RANKS[def.rank];
  const el = ELEMENTS[def.element];
  const style = { "--gc-c": rank.color, "--gc-el": EL_COLOR[def.element] } as CSSProperties;
  const initials = def.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`gc gc-${rank.key} ${foil ? "gc-foil-on" : ""} ${selected ? "gc-sel" : ""} ${dim ? "gc-dim" : ""} ${unknown ? "gc-unknown" : ""} ${live && def.rank >= 2 ? "gc-live" : ""} ${evo > 0 ? `gc-evo gc-evo${evo}` : ""} ${className}`}
      style={style}
      aria-label={unknown ? "Неизвестная карта" : `${def.name}, ${rank.name}${foil ? ", анимированная" : ""}${evo > 0 ? `, пробуждение ${evo}` : ""}`}
    >
      <div className="gc-art">
        {hasArt(def.id) && !unknown ? (
          <img src={`/api/cards/art/${def.id}`} alt="" loading="lazy" draggable={false} />
        ) : (
          <div className="gc-ph" aria-hidden>
            <span>{unknown ? "?" : initials}</span>
          </div>
        )}
      </div>
      <div className="gc-deco" aria-hidden />
      <img className="gc-frame" src={`/cards/frames/${rank.key}.webp`} alt="" draggable={false} loading="lazy" />
      {!unknown && (
        <>
          <div className="gc-top">
            <span className="gc-rank">
              <RankMark rank={def.rank} />
              {rank.short}
            </span>
            <span className="gc-el" title={el.name}>
              <Ico name={ELEMENT_ICON[def.element]} size={14} />
            </span>
          </div>
          <div className="gc-plate">
            <b>{def.name}</b>
            <small>{def.series}</small>
            {stats && (
              <div className="gc-stats">
                <span>
                  <Ico name="sword" size={12} />
                  {def.atk}
                </span>
                <span>
                  <Ico name="shield" size={12} />
                  {def.def}
                </span>
                <span>
                  <Ico name="heart" size={12} />
                  {def.hp}
                </span>
              </div>
            )}
          </div>
          {level > 1 && <div className="gc-lv">+{level - 1}</div>}
          {foil && <div className="gc-foil" aria-hidden />}
          {evo > 0 && (
            <>
              <div className="gc-aura" aria-hidden />
              <div className="gc-evo-mark" aria-hidden title={`Пробуждение ${evo}`}>
                {Array.from({ length: evo }).map((_, i) => (
                  <Ico key={i} name="star" size={11} />
                ))}
              </div>
            </>
          )}
        </>
      )}
      {locked && <div className="gc-lock" aria-hidden>
          <Ico name="lock" size={14} />
        </div>}
      {count && count > 1 ? <div className="gc-count">×{count}</div> : null}
      {children}
    </Tag>
  );
}
