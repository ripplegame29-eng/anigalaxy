"use client";

import { useState, type CSSProperties } from "react";
import { RIVALS } from "@/lib/clan2/data";
import { createClan, joinRival, validateCreate } from "@/lib/clan2/store";
import { useLevelInfo } from "@/lib/progression/events";
import { Emblem, useNote } from "./common";

const EMBLEMS = ["🛡️", "⚔️", "🔥", "🐺", "🦅", "🐉", "🌿", "💎", "👑", "⚡", "🌙", "❄️", "🌸", "🎯", "☀️", "🔱"];
const COLORS = ["#4d8bff", "#00c2a8", "#a56bff", "#ffb020", "#ff5c7a", "#7ed957", "#ff8a4c", "#9aa6c2"];

/** Экран без клана: основать свой или вступить в готовый */
export function Landing({ selfName }: { selfName: string }) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [emblem, setEmblem] = useState(EMBLEMS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [motto, setMotto] = useState("");
  const [note, say] = useNote();
  const level = useLevelInfo().level;
  const input = { name, tag, emblem, color, motto, selfName };
  const error = name || tag ? validateCreate(input) : null;

  return (
    <div className="c2-grid2">
      <section className="c2-card c2-create" style={{ ["--c" as string]: color } as CSSProperties}>
        <header>
          <Emblem clan={{ emblem, color }} size={72} />
          <div>
            <h2>Основать клан</h2>
            <p>Вы станете главой: управляйте составом, казной и картой территорий.</p>
          </div>
        </header>
        <label className="c2-f">
          <span>Название</span>
          <input value={name} maxLength={24} placeholder="Ночной дозор" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="c2-f">
          <span>Метка (2–4 символа)</span>
          <input value={tag} maxLength={4} placeholder="НДЗ" onChange={(e) => setTag(e.target.value)} />
        </label>
        <label className="c2-f">
          <span>Девиз</span>
          <input value={motto} maxLength={80} placeholder="Смотрим до конца" onChange={(e) => setMotto(e.target.value)} />
        </label>
        <div className="c2-f">
          <span>Эмблема</span>
          <div className="c2-pick">
            {EMBLEMS.map((e) => (
              <button key={e} type="button" aria-pressed={emblem === e} onClick={() => setEmblem(e)}>{e}</button>
            ))}
          </div>
        </div>
        <div className="c2-f">
          <span>Цвет</span>
          <div className="c2-pick">
            {COLORS.map((c) => (
              <button key={c} type="button" aria-pressed={color === c} aria-label={c} style={{ background: c }} className="sw" onClick={() => setColor(c)} />
            ))}
          </div>
        </div>
        {(error || note) && <p className="c2-err">{error || note}</p>}
        <button type="button" className="c2-btn" disabled={!!validateCreate(input)} onClick={() => say(createClan(input), "Клан основан")}>
          Основать клан
        </button>
      </section>

      <section className="c2-card">
        <h2>Вступить в клан</h2>
        <p className="c2-sub">Новобранцем вы получите доступ к боссу недели и сундуку. Повышение до бойца — через двое суток.</p>
        <ul className="c2-rivals">
          {RIVALS.map((r) => {
            const locked = level < r.minLevel;
            return (
              <li key={r.id} style={{ ["--c" as string]: r.color } as CSSProperties}>
                <Emblem clan={r} size={46} />
                <div className="grow">
                  <b>{r.name} <em>[{r.tag}]</em></b>
                  <small>Ур. {r.level} · {r.members} уч. · «{r.motto}»</small>
                </div>
                <button type="button" className="c2-btn ghost" disabled={locked} title={locked ? `Нужен ${r.minLevel} уровень` : undefined} onClick={() => say(joinRival(r.id, selfName), `Вы в клане «${r.name}»`)}>
                  {locked ? `с ${r.minLevel} ур.` : "Вступить"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
