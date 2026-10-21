"use client";

import { useState, type CSSProperties } from "react";
import { TERRITORIES, can, territoryOf, weekEndsAt, type TerritoryId } from "@/lib/clan2/data";
import { bonuses, heldList, invest, isHeld, reachable, rivalOfId, type ClanV2State } from "@/lib/clan2/store";
import { Bar, num, timeLeft, useNote, useNow } from "./common";

export function LandTab({ s, onAssault }: { s: ClanV2State; onAssault: (rivalId: string, t: TerritoryId) => void }) {
  const clan = s.clan!;
  const now = useNow();
  const [sel, setSel] = useState<TerritoryId>("gate");
  const [note, say] = useNote();
  const b = bonuses(s);
  const held = heldList(s);
  const t = territoryOf(sel);
  const power = s.land[sel] ?? 0;
  const cap = Math.round(t.cost * 1.5);
  const canTry = can.invest(s.selfRole);
  const ok = reachable(s, sel);
  const owner = s.rivalLand[sel] && !isHeld(s, sel) ? rivalOfId(s.rivalLand[sel]!) : null;
  const status = owner ? `Занято: ${owner.name}` : isHeld(s, sel) ? (power < t.cost * 1.1 ? "Под угрозой" : "Под контролем") : ok ? "Можно захватить" : "Недоступно";

  const edges: [number, number, number, number, boolean][] = [];
  for (const a of TERRITORIES) {
    if (a.start) edges.push([6, 50, a.x, a.y, true]);
    for (const n of a.near) {
      const o = territoryOf(n);
      if (TERRITORIES.indexOf(a) < TERRITORIES.indexOf(o)) edges.push([a.x, a.y, o.x, o.y, isHeld(s, a.id) && isHeld(s, o.id)]);
    }
  }

  return (
    <div className="c2-grid2 land">
      <section className="c2-card c2-map" style={{ ["--c" as string]: clan.color } as CSSProperties}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs><pattern id="ld-hex" width="9" height="8" patternUnits="userSpaceOnUse"><path d="M4.5 .4 L8.4 2.6 L8.4 6.2 L4.5 8 L.6 6.2 L.6 2.6Z" fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth=".12" /></pattern></defs>
          <rect width="100" height="100" fill="url(#ld-hex)" className="hexbg" />
          {edges.map((e, i) => (
            <line key={i} x1={e[0]} y1={e[1]} x2={e[2]} y2={e[3]} className={e[4] ? "on" : ""} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        <div className="c2-home" style={{ left: "6%", top: "50%" }}>
          <span>{clan.emblem}</span>
          <small>Цитадель</small>
        </div>
        {TERRITORIES.map((x) => {
          const p = s.land[x.id] ?? 0;
          const own = s.rivalLand[x.id] && !isHeld(s, x.id) ? rivalOfId(s.rivalLand[x.id]!) : null;
          const state = own ? "rival" : isHeld(s, x.id) ? (p < x.cost * 1.1 ? "weak" : "held") : reachable(s, x.id) ? "open" : "lock";
          return (
            <button key={x.id} type="button" className={`c2-land ${state}${sel === x.id ? " sel" : ""}`} style={{ left: `${x.x}%`, top: `${x.y}%`, ...(own ? { ["--rc" as string]: own.color } : {}) } as CSSProperties} onClick={() => setSel(x.id)} aria-label={x.name}>
              <span className="ring" style={{ ["--p" as string]: Math.min(1, p / x.cost) } as CSSProperties} />
              <span className="g" aria-hidden>{own ? own.emblem : x.glyph}</span>
              <b>{x.name}</b>
            </button>
          );
        })}
        <div className="c2-map-foot">
          <span>Захвачено {held.length}/{TERRITORIES.length} · престиж {num(clan.prestige)}</span>
          <span>Осада соперников через {timeLeft(weekEndsAt(now) - now)}</span>
        </div>
      </section>

      <div className="c2-col">
        <section className="c2-card c2-land-info">
          <header>
            <span className="big" aria-hidden>{t.glyph}</span>
            <div>
              <h3>{t.name}</h3>
              <small className={`st ${status === "Под контролем" ? "good" : status === "Под угрозой" ? "warn" : ""}`}>{status}</small>
            </div>
          </header>
          <p className="c2-sub">{t.lore}</p>
          <p className="c2-bonus">✦ {t.bonus.text}</p>
          <div className="c2-powr">
            <div><span>Влияние на территории</span><b>{num(power)} / {num(t.cost)}{power >= t.cost ? ` (макс. ${num(cap)})` : ""}</b></div>
            <Bar pct={Math.min(1, power / t.cost)} color={power >= t.cost ? "#5df0c0" : undefined} label="Влияние на территории" />
          </div>
          {owner && (
            <div className="c2-assault" style={{ ["--rc" as string]: owner.color } as CSSProperties}>
              <p>Территорией владеет «{owner.name}». Выиграйте войну со ставкой на неё — и она станет вашей.</p>
              <button type="button" className="c2-cta" disabled={!ok || !can.manage(s.selfRole)} onClick={() => onAssault(owner.id, sel)}>
                {ok ? "Штурм: объявить войну" : "Нужна соседняя земля"}
              </button>
            </div>
          )}
          <div className="c2-quick">
            {[50, 200].map((n) => (
              <button key={n} type="button" disabled={!canTry || !ok || !!owner || clan.influence < Math.min(n, 1)} onClick={() => say(invest(sel, n), `Вложено до ${n} влияния`)}>+{n}</button>
            ))}
            <button type="button" disabled={!canTry || !ok || !!owner} onClick={() => say(invest(sel, cap), "Вложено всё возможное")}>Максимум</button>
          </div>
          <p className="c2-hint">В казне влияния: {num(clan.influence)}. {canTry ? (ok ? "Укрепляйте территорию, чтобы её не отняли соперники." : "Сначала захватите соседнюю территорию.") : "Укреплять территории могут элита, офицеры и глава."}</p>
          {note && <p className="c2-note" role="status">{note}</p>}
        </section>

        <section className="c2-card">
          <h3>Бонусы клана</h3>
          <ul className="c2-bonuses">
            <li><span>Урон по боссу</span><b>+{b.damage}%</b></li>
            <li><span>Опыт клана</span><b>+{b.xp}%</b></li>
            <li><span>Награда сундука</span><b>+{b.chest}%</b></li>
            <li><span>Доход казны</span><b>{b.income} AC/день</b></li>
            <li><span>Влияние</span><b>{b.influence}/день</b></li>
          </ul>
          <p className="c2-hint">Каждую неделю соперники осаждают одну из ваших территорий и сбивают часть влияния. Если оно упадёт ниже стоимости — территория потеряна.</p>
        </section>
      </div>
    </div>
  );
}
