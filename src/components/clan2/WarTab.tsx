"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { RIVALS, can, territoryOf, type TerritoryId } from "@/lib/clan2/data";
import {
  ABILITY, FRONT_NAMES, WAR_FEE, WAR_HOURS, closeWar, declareWar, deploy, reachable, rivalOfId, setFocus, castAbility,
  type ClanV2State, type Front,
} from "@/lib/clan2/store";
import { Battlefield } from "./Battlefield";
import { num, timeLeft, useNote, useNow } from "./common";

const RESULT_TEXT = { win: "Победа", loss: "Поражение", draw: "Ничья" } as const;

export function WarTab({ s, preset }: { s: ClanV2State; preset?: { rivalId: string; stake: TerritoryId } | null }) {
  return s.war ? <ActiveWar s={s} /> : <Declare s={s} preset={preset ?? null} />;
}

function Declare({ s, preset }: { s: ClanV2State; preset: { rivalId: string; stake: TerritoryId } | null }) {
  const clan = s.clan!;
  const now = useNow();
  const [note, say] = useNote();
  const [rivalId, setRivalId] = useState(preset?.rivalId ?? RIVALS[0].id);
  const [stake, setStake] = useState<TerritoryId | null>(preset?.stake ?? null);
  const rival = rivalOfId(rivalId);
  const lands = (Object.entries(s.rivalLand) as [TerritoryId, string][]).filter(([, r]) => r === rivalId).map(([t]) => t);
  const lock = s.warLock - now;
  const allowed = can.manage(s.selfRole);

  return (
    <div className="c2-grid2 war">
      <section className="c2-card">
        <h3>Выберите соперника</h3>
        <p className="c2-sub">Война длится {WAR_HOURS} часов на трёх фронтах. Побеждает тот, кто удержит больше фронтов.</p>
        <ul className="c2-wrivals">
          {RIVALS.map((r) => {
            const held = Object.values(s.rivalLand).filter((x) => x === r.id).length;
            return (
              <li key={r.id}>
                <button type="button" className={rivalId === r.id ? "on" : ""} style={{ ["--rc" as string]: r.color } as CSSProperties} onClick={() => { setRivalId(r.id); setStake(null); }}>
                  <span className="e" aria-hidden>{r.emblem}</span>
                  <b>{r.name}</b>
                  <small>Ур. {r.level} · {r.members} игроков{held ? ` · земель: ${held}` : ""}</small>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="c2-col">
        <section className="c2-card c2-declare" style={{ ["--rc" as string]: rival.color } as CSSProperties}>
          <header>
            <span className="big" aria-hidden>{rival.emblem}</span>
            <div><h3>{rival.name}</h3><small>«{rival.motto}»</small></div>
          </header>
          <h4>Ставка</h4>
          <div className="c2-stakes">
            <button type="button" className={stake === null ? "on" : ""} onClick={() => setStake(null)}>
              <b>Без ставки</b><small>Только престиж и награда</small>
            </button>
            {lands.map((t) => {
              const ter = territoryOf(t);
              const ok = reachable(s, t);
              return (
                <button key={t} type="button" disabled={!ok} className={stake === t ? "on" : ""} onClick={() => setStake(t)}>
                  <b>{ter.glyph} {ter.name}</b>
                  <small>{ok ? "Победа отдаст её вам" : "Нужна соседняя земля"}</small>
                </button>
              );
            })}
          </div>
          <button type="button" className="c2-btn" disabled={!allowed || lock > 0 || clan.vault < WAR_FEE} onClick={() => say(declareWar(rivalId, stake), "Война объявлена!")}>
            Объявить войну · {WAR_FEE} AC из казны
          </button>
          <p className="c2-hint">
            {!allowed ? "Объявить войну может офицер или глава." : lock > 0 ? `Войско отдыхает ещё ${timeLeft(lock)}.` : `В казне: ${num(clan.vault)} AC.`}
          </p>
          {note && <p className="c2-note" role="status">{note}</p>}
        </section>

        <section className="c2-card">
          <h3>Летопись войн</h3>
          {s.history.length === 0 ? <p className="c2-hint">Вы ещё не воевали. Первая победа принесёт престиж и земли.</p> : (
            <ol className="c2-feed">
              {s.history.map((h, i) => (
                <li key={i}><span aria-hidden>{h.result === "win" ? "🏆" : h.result === "loss" ? "💀" : "🤝"}</span>
                  {RESULT_TEXT[h.result]} против «{rivalOfId(h.rivalId).name}»{h.stake ? ` · ${territoryOf(h.stake).name}` : ""}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

function ActiveWar({ s }: { s: ClanV2State }) {
  const clan = s.clan!;
  const war = s.war!;
  const now = useNow();
  const [note, say] = useNote();
  const rival = rivalOfId(war.rivalId);
  const [amount, setAmount] = useState(50);
  const [flash, setFlash] = useState<{ front: number; id: number } | null>(null);
  const prev = useRef(war.fronts.map((f) => f.pos));
  const id = useRef(0);
  const left = war.endsAt - now;
  const done = !!war.result;
  const allowed = can.invest(s.selfRole);

  useEffect(() => {
    const p = prev.current;
    const i = war.fronts.findIndex((f, k) => f.pos !== p[k]);
    prev.current = war.fronts.map((f) => f.pos);
    if (i >= 0) {
      const t = window.setTimeout(() => setFlash({ front: i, id: ++id.current }), 0);
      return () => window.clearTimeout(t);
    }
  }, [war.fronts]);

  const total = Math.max(1, war.score.me + war.score.them);
  const mine = Math.round((war.score.me / total) * 100);
  const holding = war.fronts.filter((f) => f.pos > 0).length;

  return (
    <div className="c2-war" style={{ ["--c" as string]: clan.color, ["--rc" as string]: rival.color } as CSSProperties}>
      <section className="c2-card c2-bf-card">
        <div className="c2-bf-hud">
          <div className="side m"><b>{clan.name}</b><small>удерживает фронтов: {holding}/3</small></div>
          <div className="mid">
            <strong>{done ? RESULT_TEXT[war.result!] : timeLeft(left)}</strong>
            <small>{war.stake ? `Ставка: ${territoryOf(war.stake).name}` : "Без ставки"}</small>
            <div className="split" aria-hidden><i style={{ width: `${mine}%` }} /></div>
          </div>
          <div className="side t"><b>{rival.name}</b><small>фронтов: {3 - holding}/3</small></div>
        </div>
        <Battlefield clan={clan} rival={rival} war={war} now={now} flash={flash} />
        {done && (
          <div className={`c2-verdict ${war.result}`} role="status">
            <h3>{RESULT_TEXT[war.result!]}</h3>
            {war.reward && (
              <ul>
                <li>Престиж <b>+{war.reward.prestige}</b></li>
                <li>Казна <b>+{war.reward.vault} AC</b></li>
                <li>Влияние <b>{war.reward.influence ? `+${war.reward.influence}` : war.reward.lostInfluence ? `−${war.reward.lostInfluence}` : "0"}</b></li>
                <li>Опыт клана <b>+{war.reward.xp}</b></li>
                {war.reward.captured && <li>Захвачено <b>{territoryOf(war.reward.captured).name}</b></li>}
              </ul>
            )}
            <button type="button" className="c2-btn" onClick={() => say(closeWar())}>Закрыть итоги</button>
          </div>
        )}
      </section>

      {!done && (
        <div className="c2-grid2 war-ctl">
          <section className="c2-card">
            <h3>Фронты</h3>
            <div className="c2-quick" role="group" aria-label="Сумма отряда">
              {[50, 100, 200].map((n) => <button key={n} type="button" className={amount === n ? "on" : ""} onClick={() => setAmount(n)}>{n} AC</button>)}
            </div>
            <ul className="c2-lanes">
              {war.fronts.map((f, i) => {
                const lane = i as Front;
                const shield = f.shieldUntil > now;
                return (
                  <li key={i} className={war.focus === lane ? "focus" : ""}>
                    <div className="top"><b>{FRONT_NAMES[i]}</b><span className={f.pos >= 0 ? "m" : "t"}>{f.pos >= 0 ? "+" : ""}{Math.round(f.pos)}</span></div>
                    <div className="track" aria-hidden><i style={{ left: `${50 + f.pos / 2}%` }} /></div>
                    <div className="row">
                      <button type="button" disabled={!allowed} onClick={() => say(deploy(lane, amount), "Отряд отправлен")}>Отправить отряд</button>
                      <button type="button" className="ghost" onClick={() => say(setFocus(lane))}>{war.focus === lane ? "Фокус ✓" : "Фокус"}</button>
                      {shield && <small>🛡 {timeLeft(f.shieldUntil - now)}</small>}
                    </div>
                  </li>
                );
              })}
            </ul>
            {note && <p className="c2-note" role="status">{note}</p>}
          </section>

          <section className="c2-card">
            <h3>Способности</h3>
            <ul className="c2-abil">
              {(Object.keys(ABILITY) as (keyof typeof ABILITY)[]).map((k) => {
                const a = ABILITY[k];
                const cd = war.cd[k] - now;
                return (
                  <li key={k}>
                    <div><b>{a.name}</b><small>{k === "volley" ? "+25 на фокусном фронте" : k === "shield" ? "Щит на фокусном фронте, 4 ч" : "+8 на всех фронтах"}</small></div>
                    <button type="button" disabled={!allowed || cd > 0} onClick={() => say(castAbility(k, war.focus), `${a.name}!`)}>
                      {cd > 0 ? timeLeft(cd) : `${a.cost} AC`}
                    </button>
                  </li>
                );
              })}
            </ul>
            <h3>Хроника боя</h3>
            <ol className="c2-feed">
              {war.log.slice(0, 8).map((l, i) => <li key={i} className={`wl ${l.side}`}>{l.text}</li>)}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}
