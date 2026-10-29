"use client";

import type { CwSideView, CwSlotView } from "@/lib/cards/clanwar";
import { Ico } from "@/components/cards/icons";
import { fmt } from "@/components/cards/common";
import { Crest, Stars, UnitThumb, useCardArt } from "./shared";

/** Карточка «базы» — отряд одного бойца: номер, ник, сила, четыре героя, звёзды и щиты */
export function BaseCard({
  slot,
  side,
  onOpen,
  attacked = false,
  showStars = false,
  locked = false,
}: {
  slot: CwSlotView;
  side: "mine" | "foe";
  onOpen?: () => void;
  attacked?: boolean;
  showStars?: boolean;
  locked?: boolean;
}) {
  useCardArt();
  const full = showStars && slot.stars >= 3;
  const inner = (
    <>
      <span className="cw-base-no">{slot.pos}</span>
      <span className="cw-base-main">
        <span className="cw-base-top">
          <b className="cw-base-nick">{slot.nick}</b>
          {slot.isMe ? <span className="cw-tag me">Вы</span> : null}
        </span>
        <span className="cw-base-meta">
          <span className="cw-pow" title="Сила отряда">
            <Ico name="sword" size={13} />
            {fmt(slot.power)}
          </span>
          {showStars ? <Stars n={slot.stars} size={15} dim={slot.stars === 0} /> : null}
          {slot.held > 0 ? (
            <span className="cw-held" title={`Отбила нападений: ${slot.held}`}>
              <Ico name="shield" size={13} />×{slot.held}
            </span>
          ) : null}
        </span>
        <span className="cw-base-units">
          {slot.units.map((u, i) => (
            <UnitThumb key={i} cardId={u.cardId} level={u.level} rank={u.rank} size={44} />
          ))}
        </span>
      </span>
      {onOpen ? (
        <span className="cw-base-act" aria-hidden>
          {attacked ? <Ico name="check" size={18} /> : locked ? <Ico name="lock" size={16} /> : <Ico name="swords" size={18} />}
        </span>
      ) : null}
    </>
  );
  const cls = `cw-base ${side} ${slot.isMe ? "is-me" : ""} ${attacked ? "done" : ""} ${full ? "full" : ""}`;
  return onOpen ? (
    <button type="button" className={cls} onClick={onOpen} aria-label={`База ${slot.pos}, ${slot.nick}, звёзд ${slot.stars} из 3`}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/** Шапка противостояния: гербы, счёт, звёзды и очки защиты */
export function Versus({
  mine,
  foe,
  bot,
  scored = false,
  children,
}: {
  mine: CwSideView;
  foe: CwSideView;
  bot: boolean;
  scored?: boolean;
  children?: React.ReactNode;
}) {
  const lead = mine.score === foe.score ? "" : mine.score > foe.score ? "mine" : "foe";
  return (
    <div className={`cw-vs ${lead ? `lead-${lead}` : ""}`}>
      <div className="cw-vs-side mine">
        <Crest tag={mine.tag} size={78} side="mine" />
        <b className="cw-vs-name">{mine.name}</b>
        <span className="cw-vs-tag">[{mine.tag}]</span>
        {scored ? (
          <span className="cw-vs-sub">
            <Ico name="star" size={13} />
            {mine.stars} <i>·</i> <Ico name="shield" size={13} />
            {mine.defense}
          </span>
        ) : null}
      </div>
      <div className="cw-vs-mid">
        <div className="cw-vs-score" aria-label={`Счёт ${mine.score} : ${foe.score}`}>
          <strong className="mine">{mine.score}</strong>
          <span>:</span>
          <strong className="foe">{foe.score}</strong>
        </div>
        {children}
      </div>
      <div className="cw-vs-side foe">
        <Crest tag={foe.tag} size={78} side="foe" bot={bot} />
        <b className="cw-vs-name">{foe.name}</b>
        <span className="cw-vs-tag">{bot ? "Отряд сервера" : `[${foe.tag}]`}</span>
        {scored ? (
          <span className="cw-vs-sub">
            <Ico name="star" size={13} />
            {foe.stars} <i>·</i> <Ico name="shield" size={13} />
            {foe.defense}
          </span>
        ) : null}
      </div>
    </div>
  );
}
