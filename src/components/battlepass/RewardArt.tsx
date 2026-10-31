"use client";

/**
 * Визуал награды боевого пропуска.
 *
 * В макете дорожки любая награда рисовалась монеткой. Здесь у каждого типа
 * свой арт из проекта — монетка AC, молния XP, капсула титула (`AgTag`),
 * аватар в рамке (`AvatarView`) — и вокруг него ровно тот же эмблемный
 * язык, что у титулов и значков сайта: дышащая аура, расходящиеся
 * ripple-кольца, искры-твлинги, медленные лучи и бегущая conic-рамка
 * для доступных к выдаче наград.
 *
 * Оптимизация: слои анимации монтируются только для «живых» клеток
 * (доступных к выдаче), в кадре их единицы; координаты искр считаются
 * детерминированно из ключа — рендер сервера и клиента совпадает.
 */

import { BoltIcon } from "./BoltIcon";
import type { CSSProperties } from "react";
import { useMemo } from "react";

import { AE_RARITY } from "@/components/progression/AchievementEmblem";
import { AgTag } from "@/components/progression/AgTag";
import { AvatarFrame } from "@/components/profile/AvatarFrame";
import { FRAMES } from "@/lib/cosmetics";
import type { BpRewardCard } from "@/components/battlepass/model";
import { DecorArt } from "@/components/battlepass/DecorArt";

type ArtSize = "sm" | "md" | "lg" | "xl";

/** Детерминированный ГПСЧ — искры не «прыгают» между рендерами */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), h | 1);
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
}

const FRAME_SIZE: Record<ArtSize, string> = {
  sm: "h-14 w-14",
  md: "h-[72px] w-[72px]",
  lg: "h-28 w-28",
  xl: "h-40 w-40",
};

const SIZE_CLASS: Record<ArtSize, string> = {
  sm: "",
  md: "",
  lg: "lg",
  xl: "xl",
};

export interface RewardArtProps {
  card: BpRewardCard;
  size?: ArtSize;
  /** Включить эмблемные слои (аура/ripple/искры/лучи) */
  live?: boolean;
  /** Бегущая рамка — награда доступна к выдаче */
  claimable?: boolean;
  /** Приглушённый вид (закрыто) */
  locked?: boolean;
  /** Ник для превью рамки */
  nickname?: string;
  className?: string;
  style?: CSSProperties;
}

export function RewardArt({
  card,
  size = "md",
  live = false,
  claimable = false,
  locked = false,
  nickname = "Гость",
  className = "",
  style,
}: RewardArtProps) {
  const R = AE_RARITY[card.rarity];
  const isDecor = card.kind === "decor";
  const holo = (card.rarity === "legendary" || card.rarity === "mythic") && !isDecor;
  const colorPrimary = isDecor ? "#ff3d62" : R.c;
  const colorSecondary = isDecor ? "#ff8fa5" : R.c2;
  const colorTertiary = isDecor ? "#ffd0d8" : R.c3;

  /** Искры: позиции и тайминги из ключа клетки — стабильны между рендерами */
  const sparks = useMemo(() => {
    if (!live) return [];
    const rnd = seeded(card.key);
    return Array.from({ length: 4 }, () => ({
      left: `${Math.round(rnd() * 92)}%`,
      top: `${Math.round(rnd() * 92)}%`,
      t: `${(1.6 + rnd() * 2).toFixed(1)}s`,
      d: `${(-rnd() * 3).toFixed(2)}s`,
      z: (0.6 + rnd() * 0.9).toFixed(2),
    }));
  }, [live, card.key]);

  const view = card.view;
  const frame = view.kind === "frame" ? FRAMES.find((item) => item.id === view.itemId) : undefined;

  return (
    <span
      className={`bp-art ${SIZE_CLASS[size]} ${holo ? "holo" : ""} ${className}`}
      style={
        {
          "--c": colorPrimary,
          "--c2": colorSecondary,
          "--c3": colorTertiary,
          "--as": size === "sm" ? "72px" : size === "lg" ? "150px" : size === "xl" ? "200px" : "88px",
          ...style,
        } as CSSProperties
      }
      aria-hidden
    >
      {live && !isDecor && <i className="aura" />}
      {live && !isDecor && <i className="rp" style={{ "--d": "0s" } as CSSProperties} />}
      {live && !isDecor && <i className="rp" style={{ "--d": "1.2s" } as CSSProperties} />}
      {sparks.map((spark, index) => (
        <i
          key={index}
          className="sk"
          style={
            {
              left: spark.left,
              top: spark.top,
              "--t": spark.t,
              "--d": spark.d,
              "--z": spark.z,
            } as CSSProperties
          }
        />
      ))}

      <span className="inner">
        {card.kind === "ac" && <span className="bp-coin" />}
        {card.kind === "bpXp" && <span className="bp-bolt"><BoltIcon id={`bp-bolt-${card.key}`} /></span>}
        {card.kind === "tag" && card.view.kind === "tag" && (
          <AgTag tag={card.view.tag} size={size === "sm" || size === "md" ? "sm" : "lg"} locked={locked} />
        )}
        {card.kind === "decor" && <DecorArt size={size} />}
        {card.kind === "frame" && (
          <AvatarFrame nickname={nickname} frame={frame} size={size === "lg" ? "lg" : "sm"} />
        )}
      </span>

      {claimable && <i className="ring" />}
    </span>
  );
}
