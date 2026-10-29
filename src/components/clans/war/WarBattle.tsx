"use client";

import { CW, type CwWarView } from "@/lib/cards/clanwar";
import { Ico } from "@/components/cards/icons";
import { BaseCard, Versus } from "./WarBases";
import { Pips, Stars, agoText, clock, useNowTick } from "./shared";

/** Бой: табло, мои атаки, базы соперника, защита и лента событий */
export function WarBattle({ war, onOpen }: { war: CwWarView; onOpen: (pos: number) => void }) {
  const now = useNowTick(1000);
  const left = Math.max(0, war.endsAt - now);
  const pct = Math.min(100, Math.max(0, (left / CW.battleMs) * 100));
  const me = war.me;
  const urgent = left < 3_600_000;
  const taken = war.foe.slots.reduce((a, s) => a + s.stars, 0);
  const maxStars = war.size * CW.maxStars;
  return (
    <>
      <section className="cw-card cw-stage battle" aria-label="Табло войны">
        <p className="cw-eyebrow center">
          <span className="cw-dot live" />
          Идёт бой · {war.size}×{war.size}
        </p>
        <Versus mine={war.mine} foe={war.foe} bot={war.bot} scored>
          <span className="cw-vs-label">До конца</span>
          <b className={`cw-count ${urgent ? "urgent" : ""}`} role="timer">
            {clock(left)}
          </b>
        </Versus>
        <div className="cw-bar rev" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Осталось времени">
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="cw-me">
          {me ? (
            <>
              <div>
                <span className="cw-me-label">Ваши атаки</span>
                <Pips filled={me.attacksLeft} total={CW.attacksEach} label="Осталось атак" />
              </div>
              <p>
                {me.attacksLeft > 0
                  ? `Осталось ${me.attacksLeft} из ${CW.attacksEach}. Выберите базу соперника ниже.`
                  : "Все атаки использованы. Следите за ходом войны."}
              </p>
            </>
          ) : (
            <p className="cw-me-out">
              <Ico name="ban" size={16} /> Вы не в составе этой войны — болейте за клан.
            </p>
          )}
          <div className="cw-me-stat">
            <Stars n={Math.min(3, Math.round((taken / maxStars) * 3))} size={14} dim />
            <span>
              Взято {taken} из {maxStars} звёзд
            </span>
          </div>
        </div>
      </section>

      <section className="cw-card" aria-label="Базы соперника">
        <div className="cw-card-head">
          <h3 className="cw-h3 foe">Базы соперника</h3>
          <span className="cw-note">нажмите, чтобы атаковать</span>
        </div>
        <div className="cw-bases battle">
          {war.foe.slots.map((s) => (
            <BaseCard
              key={s.pos}
              slot={s}
              side="foe"
              showStars
              attacked={!!me?.attacked.includes(s.pos)}
              locked={!!me && me.attacksLeft <= 0}
              onOpen={() => onOpen(s.pos)}
            />
          ))}
        </div>
      </section>

      <div className="cw-rosters">
        <details className="cw-card cw-fold" open={false}>
          <summary>
            <h3 className="cw-h3 mine">Наша защита</h3>
            <span className="cw-note">
              соперник взял {war.mine.slots.reduce((a, s) => a + s.stars, 0)}★
            </span>
            <Ico name="down" size={18} />
          </summary>
          <div className="cw-bases">
            {war.mine.slots.map((s) => (
              <BaseCard key={s.pos} slot={s} side="mine" showStars />
            ))}
          </div>
        </details>

        <section className="cw-card" aria-label="Лента атак">
          <div className="cw-card-head">
            <h3 className="cw-h3">Лента боя</h3>
            <span className="cw-note">{war.log.length ? `последние ${war.log.length}` : ""}</span>
          </div>
          {war.log.length ? (
            <ul className="cw-log">
              {war.log.map((a) => {
                const ours = a.clanId === war.mine.clanId;
                return (
                  <li key={a.id} className={`${ours ? "ours" : "theirs"} ${a.win ? "hit" : "miss"}`}>
                    <span className="cw-log-dot" aria-hidden />
                    <span className="cw-log-txt">
                      <b>{a.nick}</b>
                      {a.win ? " взял" : " не прошёл"} базу №{a.targetPos}
                      <small>
                        {ours ? "наш клан" : war.foe.name} · {agoText(a.at, now)}
                        {!a.win ? (ours ? " · очко сопернику" : " · очко нам") : ""}
                      </small>
                    </span>
                    {a.win ? <Stars n={a.stars} size={14} /> : <Ico name="shield" size={16} />}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="cw-note pad">Пока никто не нападал. Первая атака задаёт тон войне.</p>
          )}
        </section>
      </div>
    </>
  );
}
