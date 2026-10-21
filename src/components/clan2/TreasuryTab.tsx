"use client";

import { useState, type CSSProperties } from "react";
import { can } from "@/lib/clan2/data";
import { CHESTS, RARITY_LABEL, type Chest } from "@/lib/clan2/shop";
import { chestLocked, openChest, type ClanV2State, type LootDrop } from "@/lib/clan2/store";
import { ChestArt } from "./ChestArt";
import { num, useNote } from "./common";

const CUR = { vault: "AC казны", prestige: "престижа" } as const;

export function TreasuryTab({ s }: { s: ClanV2State }) {
  const clan = s.clan!;
  const [phase, setPhase] = useState<"idle" | "shake" | "open">("idle");
  const [picked, setPicked] = useState<Chest>(CHESTS[0]);
  const [drop, setDrop] = useState<LootDrop | null>(null);
  const [note, say] = useNote();
  const manage = can.manage(s.selfRole);
  const lock = chestLocked(s, picked);
  const have = picked.currency === "vault" ? clan.vault : clan.prestige;
  const afford = have >= picked.price;

  const open = () => {
    if (phase !== "idle") return;
    setDrop(null);
    setPhase("shake");
    window.setTimeout(() => {
      const r = openChest(picked.tier);
      if (r.ok && r.loot) {
        setDrop(r.loot);
        setPhase("open");
      } else {
        setPhase("idle");
        say(r);
      }
    }, 900);
  };

  return (
    <div className="c2-grid2">
      <section className="c2-card c2-stage-chest" style={{ ["--cc" as string]: picked.color } as CSSProperties}>
        <h2>{picked.name}</h2>
        <p className="c2-sub">Открытие тратит общую казну, поэтому право есть у офицеров и главы. Шансы наград видны заранее — выпадает ровно то, что в таблице.</p>
        <div className={`c2-chest-stage ${phase}`}>
          <ChestArt color={picked.color} state={phase} size={220} />
          {phase === "open" && drop && (
            <div className="c2-drop" role="status">
              <small>{drop.entry.to === "unlock" && !drop.duplicate ? "Новый предмет" : "Награда"}</small>
              <b>{drop.text}</b>
            </div>
          )}
        </div>
        <div className="c2-chest-act">
          <button type="button" className="c2-btn" disabled={!manage || !!lock || !afford || phase === "shake"} onClick={phase === "open" ? () => { setPhase("idle"); setDrop(null); } : open}>
            {phase === "open" ? "Ещё раз" : phase === "shake" ? "Открываем…" : `Открыть за ${num(picked.price)} ${CUR[picked.currency]}`}
          </button>
          <span className="c2-hint">В наличии: {num(have)} {CUR[picked.currency]}</span>
        </div>
        {!manage && <p className="c2-err">Открывать сундуки могут офицеры и глава.</p>}
        {lock && <p className="c2-err">{lock}</p>}
        {note && <p className="c2-note" role="status">{note}</p>}
      </section>

      <div className="c2-col">
        <section className="c2-card">
          <h3>Сундуки</h3>
          <ul className="c2-chest-list">
            {CHESTS.map((c) => {
              const l = chestLocked(s, c);
              return (
                <li key={c.tier}>
                  <button type="button" aria-pressed={picked.tier === c.tier} className={l ? "lock" : ""} style={{ ["--cc" as string]: c.color } as CSSProperties} onClick={() => { setPicked(c); setPhase("idle"); setDrop(null); }}>
                    <ChestArt color={c.color} size={54} />
                    <span className="grow"><b>{c.name}</b><small>{RARITY_LABEL[c.rarity]} · {num(c.price)} {CUR[c.currency]}{l ? ` · ${l}` : ""}</small></span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="c2-card">
          <h3>Что внутри</h3>
          <ul className="c2-loot">
            {picked.loot.map((e) => (
              <li key={e.id}>
                <span>{e.label}{e.amount ? ` · ${num(e.amount)}` : ""}</span>
                <b>{e.chance}%</b>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
