"use client";

import { useState, type CSSProperties } from "react";
import { SMITES, bonuses, bossOf, goalTargets, smite, type ClanV2State } from "@/lib/clan2/store";
import { weekEndsAt } from "@/lib/clan2/data";
import { useProgress } from "@/lib/progression/events";
import { Bar, RoleChip, num, timeLeft, useNote, useNow } from "./common";

export function EventsTab({ s }: { s: ClanV2State }) {
  const ev = s.event!;
  const boss = bossOf(ev);
  const now = useNow();
  const ac = useProgress().progress.acBalance;
  const [note, say] = useNote();
  const [hit, setHit] = useState(0);
  const b = bonuses(s);
  const hp = Math.max(0, ev.max - ev.damage);
  const g = goalTargets(s.members.length);
  const board = [...s.members].sort((a, c) => c.weekDmg - a.weekDmg).slice(0, 8);
  const topDmg = Math.max(1, board[0]?.weekDmg ?? 1);

  const goals = [
    { id: "watch", glyph: "📺", title: "Серии клана", text: "Все вместе посмотрите серии на сайте", have: Math.floor(ev.watch), need: g.watch },
    { id: "vault", glyph: "💰", title: "Казна недели", text: "Внесите AC в общую казну", have: Math.floor(ev.vaultWeek), need: g.vault },
    { id: "boss", glyph: boss.glyph, title: "Победа над боссом", text: `Снимите ${num(ev.max)} HP`, have: Math.min(ev.damage, ev.max), need: ev.max },
  ];

  return (
    <div className="c2-grid2">
      <section className={`c2-card c2-boss${hit ? " hit" : ""}`} style={{ ["--bh" as string]: boss.hue } as CSSProperties}>
        <div className="c2-boss-head">
          <span className="c2-boss-lbl">Босс недели · до сброса {timeLeft(weekEndsAt(now) - now)}</span>
          <h2>{boss.name}</h2>
          <p>{boss.title}</p>
        </div>
        <div className="c2-boss-art" key={hit} aria-hidden>
          <i className="halo" />
          <span>{boss.glyph}</span>
          {ev.defeated && <em>ПОВЕРЖЕН</em>}
        </div>
        <div className="c2-hp">
          <div className="c2-hp-top"><b>{num(hp)} HP</b><small>из {num(ev.max)}</small></div>
          <Bar pct={hp / ev.max} color={boss.hue} label="Здоровье босса" />
        </div>
        <div className="c2-smites">
          {SMITES.map((x) => (
            <button key={x.id} type="button" disabled={ev.defeated || ac < x.cost} onClick={() => { const r = smite(x.id); say(r, `${x.name}: ${num(Math.round(x.dmg * (1 + b.damage / 100)))} урона`); if (r.ok) setHit((v) => v + 1); }}>
              <b>{x.name}</b>
              <span>{num(Math.round(x.dmg * (1 + b.damage / 100)))} урона</span>
              <em>{x.cost} AC</em>
            </button>
          ))}
        </div>
        <p className="c2-hint">Бесплатный урон: каждая серия — 120, каждая глава манги — 80{b.damage ? `, плюс ${b.damage}% от территорий` : ""}. Ваш баланс: {num(ac)} AC.</p>
        {note && <p className="c2-note" role="status">{note}</p>}
      </section>

      <div className="c2-col">
        <section className="c2-card">
          <h3>Цели недели</h3>
          <p className="c2-sub">Каждая выполненная цель открывает ступень сундука и даёт клану влияние.</p>
          <ul className="c2-goals">
            {goals.map((x) => {
              const ok = x.have >= x.need;
              return (
                <li key={x.id} className={ok ? "ok" : ""}>
                  <span className="g" aria-hidden>{x.glyph}</span>
                  <div className="grow">
                    <b>{x.title}</b>
                    <small>{x.text}</small>
                    <Bar pct={x.have / x.need} color={ok ? "#5df0c0" : undefined} label={x.title} />
                  </div>
                  <span className="n">{ok ? "✓" : `${num(x.have)} / ${num(x.need)}`}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="c2-card">
          <h3>Урон за неделю</h3>
          <ol className="c2-board">
            {board.map((m, i) => (
              <li key={m.id} className={m.id === "self" ? "me" : ""}>
                <span className="pos">{i + 1}</span>
                <div className="grow">
                  <b>{m.name}{m.id === "self" ? " (вы)" : ""}</b>
                  <RoleChip role={m.role} />
                  <Bar pct={m.weekDmg / topDmg} label={m.name} />
                </div>
                <span className="n">{num(m.weekDmg)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
