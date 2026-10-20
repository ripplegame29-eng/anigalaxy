"use client";

/**
 * Модалка награды: крупный арт, редкость, тип и линия, описание, условия
 * и действие. Состояние берётся из того же `bpRewardStatus`, что и у клетки,
 * поэтому карточка и дорожка никогда не расходятся.
 */

import { useEffect } from "react";

import { AE_RARITY } from "@/components/progression/AchievementEmblem";
import { RewardArt } from "@/components/battlepass/RewardArt";
import type { BpRewardCard } from "@/components/battlepass/model";
import type { BpRewardStatus } from "@/lib/battlepass/logic";
import type { BattlepassLine } from "@/lib/progression/types";

export interface RewardModalProps {
  card: BpRewardCard | null;
  status: BpRewardStatus | null;
  premium: boolean;
  nickname?: string;
  onClaim: (line: BattlepassLine, level: number) => void;
  onClose: () => void;
}

export function RewardModal({ card, status, premium, nickname, onClaim, onClose }: RewardModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!card || !status) return null;

  const R = AE_RARITY[card.rarity];
  const vip = card.line === "premium";
  const can = status === "claimable";
  const got = status === "claimed";

  const msg = got
    ? "Награда получена"
    : can
      ? "Доступно к получению"
      : vip && !premium
        ? "Требуется Premium"
        : `Откроется на уровне ${card.level}`;

  const action = can
    ? { text: "Забрать награду", cls: "pri", disabled: false }
    : got
      ? { text: "Получено ✓", cls: "", disabled: true }
      : vip && !premium
        ? { text: "Нужен AniGalaxy Premium", cls: "vip", disabled: false }
        : { text: `Нужен уровень ${card.level}`, cls: "", disabled: true };

  return (
    <div
      className="bp-ov on"
      role="dialog"
      aria-modal="true"
      aria-label={card.label}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="bp-mdl bp-panel"
        style={{ "--c": R.c, "--c2": R.c2 } as React.CSSProperties}
      >
        <RewardArt card={card} size="lg" live claimable={can} locked={status === "locked"} nickname={nickname} />
        <h2>{card.label}</h2>

        <div className="bp-chips">
          <span className="rc">{card.rarityLabel}</span>
          <span>{card.kindLabel}</span>
          <span>{vip ? "Premium-линия" : "Free-линия"}</span>
          {card.bundle > 1 && <span>Комплект ×{card.bundle}</span>}
        </div>

        <div className="bp-box">
          <small>ОПИСАНИЕ</small>
          {card.desc}
          <div className={`ok ${can || got ? "" : "mu"}`}>{msg}</div>
          <div className="row">
            Условие<b>Достичь уровня {card.level}</b>
          </div>
          <div className="row">
            Линия
            <b style={{ color: vip ? "var(--color-accent-2)" : "var(--bp-cy)" }}>
              {vip ? "Premium" : "Free"}
            </b>
          </div>
          {card.extras.length > 0 && (
            <div className="row">
              В пакете ещё<b>{card.extras.map((view) => view.label).join(" · ")}</b>
            </div>
          )}
        </div>

        <button
          type="button"
          className={`btn ${action.cls}`}
          disabled={action.disabled}
          onClick={() => {
            if (can) onClaim(card.line, card.level);
            else if (vip && !premium) onClose();
          }}
        >
          {action.text}
        </button>
        <button type="button" className="x" aria-label="Закрыть" onClick={onClose}>
          ×
        </button>
      </div>
    </div>
  );
}
