"use client";

import { CW, type CwWarView } from "@/lib/cards/clanwar";
import { Ico } from "@/components/cards/icons";
import { BaseCard, Versus } from "./WarBases";
import { clock, useNowTick } from "./shared";

/** Подготовка: плакат противостояния, обратный отсчёт и составы обеих сторон */
export function WarPrep({ war }: { war: CwWarView }) {
  const now = useNowTick(1000);
  const left = Math.max(0, war.prepUntil - now);
  const pct = Math.min(100, Math.max(0, (1 - left / CW.prepMs) * 100));
  const meIn = !!war.me;
  return (
    <>
      <section className="cw-card cw-stage" aria-label="Подготовка к войне">
        <p className="cw-eyebrow center">
          <span className="cw-dot prep" />
          Подготовка · {war.size}×{war.size}
        </p>
        <Versus mine={war.mine} foe={war.foe} bot={war.bot}>
          <span className="cw-vs-label">До начала боя</span>
          <b className="cw-count" role="timer">
            {clock(left)}
          </b>
        </Versus>
        <div className="cw-bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Время подготовки">
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className={`cw-hint ${meIn ? "" : "warn"}`}>
          <Ico name={meIn ? "flag" : "ban"} size={18} />
          <p>
            {meIn
              ? `Нападать пока нельзя. Вы — база №${war.me!.pos}: прокачайте колоду до начала боя, защита обновится по текущему отряду.`
              : "Вас нет в составе этой войны: в неё берут сильнейших бойцов клана с колодой из 4 карт."}
          </p>
        </div>
      </section>

      <div className="cw-rosters">
        <section className="cw-card" aria-label="Наши базы">
          <div className="cw-card-head">
            <h3 className="cw-h3 mine">Наш отряд</h3>
            <span className="cw-note">{war.mine.slots.length} баз</span>
          </div>
          <div className="cw-bases">
            {war.mine.slots.map((s) => (
              <BaseCard key={s.pos} slot={s} side="mine" />
            ))}
          </div>
        </section>
        <section className="cw-card" aria-label="Базы соперника">
          <div className="cw-card-head">
            <h3 className="cw-h3 foe">{war.bot ? war.foe.name : `Соперник · ${war.foe.name}`}</h3>
            <span className="cw-note">{war.foe.slots.length} баз</span>
          </div>
          <div className="cw-bases">
            {war.foe.slots.map((s) => (
              <BaseCard key={s.pos} slot={s} side="foe" />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
