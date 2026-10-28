"use client";

import type { CSSProperties, ReactNode } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { ELEMENTS, RANKS } from "@/lib/cards/config";
import { hasArt } from "@/lib/cards/client";

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
  /** Закрыть арт (неоткрытая карта в альбоме) */
  unknown?: boolean;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}

/** Карточка персонажа: арт + рамка ранга + плашка имени. Размер задаёт родитель (ширина). */
export function GameCard({ cardId, foil, level = 1, selected, dim, locked, count, stats = true, unknown, onClick, className = "", children }: GameCardProps) {
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
      className={`gc gc-${rank.key} ${foil ? "gc-foil-on" : ""} ${selected ? "gc-sel" : ""} ${dim ? "gc-dim" : ""} ${unknown ? "gc-unknown" : ""} ${className}`}
      style={style}
      aria-label={unknown ? "Неизвестная карта" : `${def.name}, ${rank.name}${foil ? ", анимированная" : ""}`}
    >
      <div className="gc-art">
        {hasArt(def.id) && !unknown ? (
          <img src={`/cards/art/${def.id}.jpg`} alt="" loading="lazy" draggable={false} />
        ) : (
          <div className="gc-ph" aria-hidden>
            <span>{unknown ? "?" : initials}</span>
          </div>
        )}
      </div>
      <img className="gc-frame" src={`/cards/frames/${rank.key}.webp`} alt="" draggable={false} loading="lazy" />
      {!unknown && (
        <>
          <div className="gc-top">
            <span className="gc-rank">{rank.short}</span>
            <span className="gc-el" title={el.name}>
              {el.icon}
            </span>
          </div>
          <div className="gc-plate">
            <b>{def.name}</b>
            <small>{def.series}</small>
            {stats && (
              <div className="gc-stats">
                <span>⚔ {def.atk}</span>
                <span>🛡 {def.def}</span>
                <span>❤ {def.hp}</span>
              </div>
            )}
          </div>
          {level > 1 && <div className="gc-lv">+{level - 1}</div>}
          {foil && <div className="gc-foil" aria-hidden />}
        </>
      )}
      {locked && <div className="gc-lock" aria-hidden>🔒</div>}
      {count && count > 1 ? <div className="gc-count">×{count}</div> : null}
      {children}
    </Tag>
  );
}
