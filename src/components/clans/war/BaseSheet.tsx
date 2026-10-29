"use client";

import type { CwSlotView, CwWarView } from "@/lib/cards/clanwar";
import { STAR_TEXT } from "@/lib/cards/campaign";
import { Ico } from "@/components/cards/icons";
import { GameCard } from "@/components/cards/GameCard";
import { fmt } from "@/components/cards/common";
import { Pips, Sheet, Stars, useCardArt } from "./shared";
import { CW } from "@/lib/cards/clanwar";

/** Шторка базы: четыре защитника и кнопка «Атаковать» */
export function BaseSheet({
  war,
  slot,
  busy,
  err,
  onAttack,
  onClose,
}: {
  war: CwWarView;
  slot: CwSlotView;
  busy: boolean;
  err: string;
  onAttack: () => void;
  onClose: () => void;
}) {
  useCardArt();
  const me = war.me;
  const already = !!me?.attacked.includes(slot.pos);
  const reason = war.phase !== "battle"
    ? "Бой ещё не начался"
    : !me
      ? "Вы не в составе войны"
      : me.attacksLeft <= 0
        ? "Атаки закончились"
        : already
          ? "Эту базу вы уже атаковали"
          : "";
  return (
    <Sheet
      wide
      tone="foe"
      onClose={onClose}
      title={
        <>
          <span className="cw-sheet-no">{slot.pos}</span> База · {slot.nick}
        </>
      }
      sub={
        <span className="cw-sheet-sub">
          <span className="cw-pow">
            <Ico name="sword" size={13} />
            {fmt(slot.power)}
          </span>
          <Stars n={slot.stars} size={15} dim={slot.stars === 0} />
          {slot.held > 0 ? (
            <span className="cw-held">
              <Ico name="shield" size={13} />
              отбила ×{slot.held}
            </span>
          ) : null}
        </span>
      }
      footer={
        <div className="cw-foot">
          <div className="cw-foot-info">
            <span className="cw-me-label">Ваши атаки</span>
            <Pips filled={me?.attacksLeft ?? 0} total={CW.attacksEach} label="Осталось атак" />
          </div>
          <button type="button" className="cw-btn danger lg" disabled={!!reason || busy} onClick={onAttack}>
            <Ico name="swords" size={19} />
            {busy ? "Бой идёт…" : reason || "Атаковать"}
          </button>
          {err ? (
            <p className="cw-err" role="alert">
              {err}
            </p>
          ) : null}
        </div>
      }
    >
      <div className="cw-def-grid">
        {slot.units.map((u, i) => (
          <div key={i} className="cw-def-unit">
            <GameCard cardId={u.cardId} level={u.level} stats />
          </div>
        ))}
      </div>
      <ul className="cw-star-rules" aria-label="Как получить звёзды">
        {STAR_TEXT.map((t, i) => (
          <li key={i} className={slot.stars > i ? "got" : ""}>
            <Stars n={1} max={1} size={15} dim={slot.stars <= i} />
            {t}
          </li>
        ))}
      </ul>
      <p className="cw-note">Проигрыш не стоит звёзд, но приносит очко защитнику. Лучший результат на базе засчитывается клану.</p>
    </Sheet>
  );
}
