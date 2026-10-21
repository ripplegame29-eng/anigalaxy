"use client";

import type { CSSProperties } from "react";
import { CHEST_TIERS, ROLES, TERRITORIES, levelFromXp, memberCap } from "@/lib/clan2/data";
import { bonuses, bossOf, goalsDone, heldList, isClaimed, type ClanV2State } from "@/lib/clan2/store";
import { num, timeLeft, useNow } from "./common";
import { weekEndsAt } from "@/lib/clan2/data";
import { emblemOf } from "@/lib/clan2/shop";
import { EmblemArt } from "./EmblemArt";
import "../../app/clan-map.css";

export type TabId = "citadel" | "events" | "land" | "roster" | "vault" | "war" | "treasury" | "shop";

interface Spot {
  id: string;
  x: number;
  y: number;
  glyph: string;
  name: string;
  stat: string;
  pct?: number;
  alert?: string;
  go: TabId;
  hue: string;
  small?: boolean;
}

const LOG_ICON: Record<string, string> = { join: "➕", leave: "➖", role: "🎖️", boss: "⚔️", vault: "💰", land: "🏴", event: "📣", system: "✨" };

export function Citadel({ s, onGo }: { s: ClanV2State; onGo: (t: TabId) => void }) {
  const now = useNow();
  const clan = s.clan!;
  const ev = s.event!;
  const boss = bossOf(ev);
  const held = heldList(s);
  const done = goalsDone(s);
  const lvl = levelFromXp(clan.xp);
  const hp = Math.max(0, 1 - ev.damage / ev.max);
  const claimable = CHEST_TIERS.filter((t) => done >= t.need && !isClaimed(s, t.id)).length;
  const b = bonuses(s);
  const art = s.equipped.emblem ? emblemOf(s.equipped.emblem) : undefined;

  const spots: Spot[] = [
    { id: "boss", x: 50, y: 13, glyph: boss.glyph, name: "Босс недели", stat: ev.defeated ? "Повержен" : `${boss.name} · ${Math.round(hp * 100)}% HP`, pct: Math.round(hp * 100), alert: ev.defeated ? undefined : "RAID", go: "events", hue: boss.hue },
    { id: "land", x: 84, y: 50, glyph: "🗺️", name: "Территории", stat: `Захвачено ${held.length}/${TERRITORIES.length}`, pct: Math.round((held.length / TERRITORIES.length) * 100), go: "land", hue: "#5df0c0" },
    { id: "vault", x: 50, y: 87, glyph: "💰", name: "Сундук и казна", stat: `${num(clan.vault)} AC · цели ${done}/3`, alert: claimable ? String(claimable) : undefined, go: "vault", hue: "#ffc65a" },
    { id: "roster", x: 16, y: 50, glyph: "👥", name: "Состав", stat: `${s.members.length}/${memberCap(lvl)} · ${ROLES[s.selfRole].name}`, alert: s.applicants.length ? String(s.applicants.length) : undefined, go: "roster", hue: "#5ec8ff" },
    { id: "war", x: 66, y: 28, glyph: "⚔️", name: "Война", stat: s.war ? (s.war.result ? "Итоги боя" : "Идёт бой") : "Мир", alert: s.war && !s.war.result ? "LIVE" : undefined, go: "war", hue: "#ff5c7a", small: true },
    { id: "treasury", x: 34, y: 72, glyph: "🗝️", name: "Сокровищница", stat: `${num(clan.prestige)} престижа`, go: "treasury", hue: "#ffd27a", small: true },
    { id: "shop", x: 66, y: 72, glyph: "🛍️", name: "Лавка", stat: "Фоны, эмблемы, декор", go: "shop", hue: "#b98cff", small: true },
    { id: "xp", x: 80, y: 18, glyph: "⭐", name: `Уровень ${lvl}`, stat: `${num(clan.xp)} опыта${b.xp ? ` · +${b.xp}%` : ""}`, go: "roster", hue: "#ffd27a", small: true },
    { id: "chest", x: 80, y: 82, glyph: "🎁", name: "Сундуки", stat: claimable ? `Ждут: ${claimable}` : "Ждём цели", go: "vault", hue: "#ff9b5c", small: true },
  ];

  const todo: { text: string; go: TabId; cta: string }[] = [];
  if (claimable) todo.push({ text: `Заберите награды из сундуков: ${claimable}`, go: "vault", cta: "К сундукам" });
  if (!ev.defeated) todo.push({ text: `Босс «${boss.name}» ещё жив — ${num(Math.max(0, ev.max - ev.damage))} HP. Смотрите серии и бейте его`, go: "events", cta: "На рейд" });
  if (s.applicants.length) todo.push({ text: `Заявок на вступление: ${s.applicants.length}`, go: "roster", cta: "Рассмотреть" });
  if (clan.influence >= 150 && held.length < TERRITORIES.length) todo.push({ text: `Накоплено ${num(clan.influence)} влияния — пора занять территорию`, go: "land", cta: "К карте" });
  if (todo.length === 0) todo.push({ text: "Всё под контролем. Загляните на карту территорий", go: "land", cta: "К карте" });

  return (
    <div className="cm-wrap" style={{ ["--c" as string]: clan.color } as CSSProperties}>
      <section className="cm-stage" aria-label="Цитадель клана">
        <svg className="cm-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {spots.map((p) => (
            <line key={p.id} x1={50} y1={50} x2={p.x} y2={p.y} className={p.small ? "far" : ""} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        <i className="cm-ring r1" />
        <i className="cm-ring r2" />
        <div className="cm-core" style={{ left: "50%", top: "50%" }}>
          <span className="cm-core-orb" aria-hidden>{art ? <EmblemArt emblem={art} size={92} interactive={false} /> : clan.emblem}</span>
          <b>{clan.name}</b>
          <small>[{clan.tag}] · уровень {lvl}</small>
        </div>
        {spots.map((p) => (
          <button key={p.id} type="button" className={`cm-node${p.small ? " small" : ""}`} style={{ left: `${p.x}%`, top: `${p.y}%`, ["--h" as string]: p.hue } as CSSProperties} onClick={() => onGo(p.go)}>
            {p.alert && <em className="cm-alert">{p.alert}</em>}
            <span className="cm-glyph" aria-hidden>{p.glyph}</span>
            <b>{p.name}</b>
            <small>{p.stat}</small>
            {p.pct !== undefined && <span className="cm-bar"><i style={{ width: `${p.pct}%` }} /></span>}
          </button>
        ))}
      </section>

      <aside className="cm-side">
        <h3>Что делать сейчас</h3>
        <ul>
          {todo.slice(0, 4).map((t) => (
            <li key={t.text}>
              <p>{t.text}</p>
              <button type="button" onClick={() => onGo(t.go)}>{t.cta}</button>
            </li>
          ))}
        </ul>
        <div className="cm-legend"><span>Новая неделя через {timeLeft(weekEndsAt(now) - now)}</span></div>
        <h3>Журнал клана</h3>
        <ol className="c2-feed">
          {s.log.slice(0, 7).map((l) => (
            <li key={l.id}><span aria-hidden>{LOG_ICON[l.kind] ?? "•"}</span>{l.text}</li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
