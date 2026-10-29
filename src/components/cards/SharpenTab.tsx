"use client";

import { useMemo, useState } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { LEVEL_BONUS, MAX_LEVEL, RANKS, SCROLL_DUST, sharpenChance } from "@/lib/cards/config";
import { act, type CardsState } from "@/lib/cards/client";
import { GameCard } from "./GameCard";
import { InvPicker, Panel, RankFilter, Stepper, fmt, toast, useBusy } from "./common";
import { Ico } from "./icons";

interface Step {
  success: boolean;
  level: number;
  pity: number;
  chance: number;
}

export function SharpenTab({ s }: { s: CardsState }) {
  const [rank, setRank] = useState(-1);
  const [id, setId] = useState<number | null>(null);
  const [useDust, setUseDust] = useState(true);
  const [target, setTarget] = useState(5);
  const [budget, setBudget] = useState(10);
  const [log, setLog] = useState<Step[]>([]);
  const [fx, setFx] = useState<"" | "cg-flash" | "cg-fail">("");
  const [busy, run] = useBusy();
  const card = s.inventory.find((c) => c.id === id) ?? null;
  const def = card ? cardDef(card.cardId) : null;
  const pool = useMemo(() => s.inventory.filter((c) => !c.listed && c.level < MAX_LEVEL), [s.inventory]);
  const chance = card ? (card.pity >= 100 ? 1 : sharpenChance(card.level)) : 0;
  const scrollHave = def ? s.wallet.scrolls[def.rank] : 0;

  const go = (auto: boolean) =>
    run(async () => {
      if (!card) return;
      const r = await act<{ steps: Step[]; level: number; scrolls: number; dust: number }>("sharpen", {
        id: card.id,
        useDust,
        target: auto ? target : card.level + 1,
        maxSpend: auto ? budget : 1,
      });
      if (!r.ok) return toast(r.error, true);
      setLog(r.result.steps);
      const ok = r.result.steps.some((x) => x.success);
      setFx(ok ? "cg-flash" : "cg-fail");
      setTimeout(() => setFx(""), 800);
      toast(ok ? `Заточка удалась: уровень ${r.result.level}` : "Неудача — уровень сохранён, прогресс гарантии вырос");
    });

  const buy = (n: number) =>
    run(async () => {
      if (!def) return;
      const r = await act("scrolls", { rank: def.rank, n });
      if (!r.ok) toast(r.error, true);
      else toast(`Куплено свитков: ${n}`);
    });

  return (
    <div className="cg-grid2">
      <Panel title="Заточка" hint={`Каждая заточка тратит свиток ранга карты (или пыль, если свитков нет). Уровень повышает характеристики на ${LEVEL_BONUS * 100}%. При неудаче уровень не падает, а копится гарантия: после 3 неудач подряд следующая заточка всегда успешна.`}>
        {!card || !def ? (
          <div className="cg-empty">Выберите карту справа</div>
        ) : (
          <div className="cg-sharp">
            <div style={{ width: "100%", maxWidth: 220 }} className={fx}>
              <GameCard cardId={card.cardId} foil={card.foil} level={card.level} />
            </div>
            <div>
              <h3 style={{ fontSize: 18 }}>{def.name}</h3>
              <div className="cg-levels" aria-label={`Уровень ${card.level} из ${MAX_LEVEL}`}>
                {Array.from({ length: MAX_LEVEL }).map((_, i) => (
                  <i key={i} className={i < card.level ? "on" : ""} />
                ))}
              </div>
              <div className="cg-row" style={{ fontSize: 13, justifyContent: "space-between", marginBottom: 4 }}>
                <span>Шанс успеха</span>
                <b>{Math.round(chance * 100)}%</b>
              </div>
              <div className="cg-bar">
                <i style={{ width: `${chance * 100}%` }} />
              </div>
              <div className="cg-row" style={{ fontSize: 13, justifyContent: "space-between", margin: "10px 0 4px" }}>
                <span>Гарантия</span>
                <b>{card.pity}%</b>
              </div>
              <div className="cg-bar">
                <i style={{ width: `${card.pity}%`, background: "linear-gradient(90deg,#ffc233,#ff8a00)" }} />
              </div>
              <p className="cg-hint" style={{ marginTop: 10 }}>
                Свитков «{RANKS[def.rank].name}»: <b>{scrollHave}</b> · если нет — {fmt(SCROLL_DUST[def.rank])} пыли за попытку.
              </p>
              <div className="cg-row">
                <button type="button" className="cg-btn pri" disabled={busy || card.level >= MAX_LEVEL} onClick={() => void go(false)}>
                  Заточить
                </button>
                <button type="button" className="cg-btn" disabled={busy} onClick={() => void buy(5)}>
                  +5 свитков ({fmt(SCROLL_DUST[def.rank] * 5)} пыли)
                </button>
              </div>
              <div className="cg-panel" style={{ marginTop: 14, padding: 12 }}>
                <h3>Автозаточка</h3>
                <div className="cg-row" style={{ fontSize: 13 }}>
                  <div className="cg-field">
                    <span>До уровня</span>
                    <Stepper label="До уровня" value={target} min={card.level + 1} max={MAX_LEVEL} onChange={setTarget} width={140} />
                  </div>
                  <div className="cg-field">
                    <span>Не больше попыток</span>
                    <Stepper label="Не больше попыток" value={budget} min={1} max={200} step={5} onChange={setBudget} width={150} />
                  </div>
                </div>
                <label className="cg-row" style={{ fontSize: 13, margin: "8px 0" }}>
                  <input type="checkbox" checked={useDust} onChange={(e) => setUseDust(e.target.checked)} /> Докупать свитки за пыль
                </label>
                <button type="button" className="cg-btn gold" disabled={busy || card.level >= MAX_LEVEL} onClick={() => void go(true)}>
                  Запустить
                </button>
              </div>
              {log.length > 0 && (
                <ul className="cg-list" style={{ marginTop: 12 }}>
                  {log.slice(-6).map((x, i) => (
                    <li key={i}>
                      <span style={{ color: x.success ? "#6df0b0" : "#ff7a90", fontWeight: 800 }}>{x.success ? "Успех" : "Неудача"}</span>
                      <span>
                        шанс {Math.round(x.chance * 100)}% · ур. {x.level}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Panel>
      <Panel title="Ваши карты">
        <div className="cg-scrolls" style={{ marginBottom: 10 }}>
          {RANKS.map((r) => (
            <span key={r.id} className="cg-chip" style={{ color: r.color }}>
              <Ico name="scroll" size={15} /> {s.wallet.scrolls[r.id]} <small>{r.short}</small>
            </span>
          ))}
        </div>
        <RankFilter value={rank} onChange={setRank} />
        <InvPicker cards={pool} selected={id ? [id] : []} onToggle={(x) => setId(x === id ? null : x)} max={1} size="xs" rankFilter={rank} />
      </Panel>
    </div>
  );
}
