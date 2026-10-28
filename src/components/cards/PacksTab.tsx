"use client";

import { useState } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { PACK, RANKS } from "@/lib/cards/config";
import { act, type CardsState } from "@/lib/cards/client";
import { GameCard } from "./GameCard";
import { Panel, fmt, toast, useBusy } from "./common";

interface PackResult {
  offers: string[];
  picked: number | null;
  chosen: { invId: number; cardId: string } | null;
  dustBack: number;
}

const QUICK_KEY = "animehub:cards:quick";
const readQuick = (): boolean => {
  try {
    return window.localStorage.getItem(QUICK_KEY) === "1";
  } catch {
    return false;
  }
};

export function PacksTab({ s }: { s: CardsState }) {
  const [busy, run] = useBusy();
  const [pay, setPay] = useState<"token" | "diamonds" | "dust">("token");
  const [quick, setQuick] = useState(readQuick);
  const [results, setResults] = useState<PackResult[]>([]);
  const [shake, setShake] = useState(false);
  const w = s.wallet;

  const effectivePay = pay === "token" && w.packs < 1 ? "diamonds" : pay;

  const toggleQuick = () => {
    const v = !quick;
    setQuick(v);
    try {
      window.localStorage.setItem(QUICK_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const open = (count: number) =>
    run(async () => {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      const r = await act<{ results: PackResult[]; pending: string[] | null }>("open", { count, pay: effectivePay, quick });
      if (!r.ok) return toast(r.error, true);
      setResults(r.result.results);
      if (r.result.results.length) toast(`Открыто паков: ${count}`);
    });

  const pick = (index: number) =>
    run(async () => {
      const r = await act<PackResult>("pick", { index });
      if (!r.ok) return toast(r.error, true);
      setResults([r.result]);
      if (r.result.dustBack) toast(`Остальные карты ушли в пыль: +${r.result.dustBack}`);
    });

  const price = (b: { n: number; pay: number }) =>
    effectivePay === "token" ? `${b.n} жет.` : effectivePay === "diamonds" ? `${fmt(PACK.diamonds * b.pay)} 💎` : `${fmt(PACK.dust * b.pay)} пыли`;

  const pendingOffers = s.pending;
  const epicLeft = Math.max(0, PACK.pityEpic - w.pityEpic);
  const legendLeft = Math.max(0, PACK.pityLegend - w.pityLegend);

  return (
    <div className="cg-grid2">
      <div style={{ display: "grid", gap: 16 }}>
        <div className="cg-packstage">
          {pendingOffers ? (
            <div style={{ width: "100%", display: "grid", gap: 14, justifyItems: "center" }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-display, inherit)" }}>Выберите одну карту</h2>
              <div className="cg-offers">
                {pendingOffers.map((id, i) => (
                  <GameCard key={id} cardId={id} onClick={() => void pick(i)} />
                ))}
              </div>
              <p className="cg-hint" style={{ margin: 0 }}>
                Две оставшиеся карты превратятся в пыль — вы получите четверть их стоимости.
              </p>
            </div>
          ) : results.length === 1 && results[0].chosen ? (
            <div style={{ display: "grid", gap: 14, justifyItems: "center", width: "min(220px, 60vw)" }}>
              <div className="cg-result" style={{ width: "100%" }}>
                <GameCard cardId={results[0].chosen.cardId} />
              </div>
              <b>Новая карта в коллекции!</b>
              <button type="button" className="cg-btn" onClick={() => setResults([])}>
                Закрыть
              </button>
            </div>
          ) : results.length > 1 ? (
            <div style={{ width: "100%", display: "grid", gap: 14 }}>
              <div className="cg-row" style={{ justifyContent: "space-between" }}>
                <b>Добыча: {results.length} карт</b>
                <button type="button" className="cg-btn sm" onClick={() => setResults([])}>
                  Закрыть
                </button>
              </div>
              <div className="cg-cards xs" style={{ ["--cg-w" as string]: "104px" }}>
                {results.map((r, i) => r.chosen && <GameCard key={i} cardId={r.chosen.cardId} stats={false} />)}
              </div>
              <p className="cg-hint" style={{ margin: 0 }}>
                Быстрое открытие забирает лучшую карту из каждого пака. Пыль за остальные: +{fmt(results.reduce((a, r) => a + r.dustBack, 0))}.
              </p>
            </div>
          ) : (
            <div style={{ textAlign: "center", display: "grid", gap: 16, justifyItems: "center" }}>
              <div className={`cg-pack ${shake ? "shake" : ""}`}>
                <span>
                  ПАК
                  <br />
                  КАРТ
                  <small>3 КАРТЫ · ВЫБЕРИ 1</small>
                </span>
              </div>
              <div className="cg-row" style={{ justifyContent: "center" }}>
                <button type="button" className="cg-btn pri" disabled={busy} onClick={() => void open(1)}>
                  Открыть пак
                </button>
                <label className="cg-chip" style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={quick} onChange={toggleQuick} /> Быстрое открытие
                </label>
              </div>
            </div>
          )}
        </div>

        <Panel title="Оплата и наборы" hint="Набор из 6 паков стоит как 5, набор из 20 — как 15. Быстрое открытие нужно для наборов: лучшую карту забираем сами.">
          <div className="cg-row" style={{ marginBottom: 12 }}>
            {(
              [
                ["token", `Жетоны: ${w.packs}`],
                ["diamonds", `${PACK.diamonds} 💎 за пак`],
                ["dust", `${PACK.dust} пыли за пак`],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" className="cg-chip" style={{ cursor: "pointer", borderColor: effectivePay === id ? "#5aa0ff" : undefined, background: effectivePay === id ? "rgba(43,127,255,.25)" : undefined }} onClick={() => setPay(id)}>
                {label}
              </button>
            ))}
          </div>
          <div className="cg-bundles">
            {PACK.bundles.map((b) => (
              <div key={b.n} className="cg-bundle">
                <b>×{b.n}</b>
                {b.n > b.pay ? <em>выгода {b.n - b.pay} пак.</em> : <em>&nbsp;</em>}
                <button type="button" className="cg-btn pri sm" disabled={busy || !!pendingOffers} onClick={() => void open(b.n)}>
                  {price(b)}
                </button>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
        <Panel title="Гарантии" hint="Счётчик считает паки подряд без редкой добычи.">
          <div className="cg-prog">
            <div className="cg-row" style={{ justifyContent: "space-between", fontSize: 13 }}>
              <span>Эпическая и выше</span>
              <b>{epicLeft <= 1 ? "в следующем паке" : `через ${epicLeft}`}</b>
            </div>
            <div className="cg-bar">
              <i style={{ width: `${(w.pityEpic / PACK.pityEpic) * 100}%`, background: RANKS[2].color }} />
            </div>
            <div className="cg-row" style={{ justifyContent: "space-between", fontSize: 13, marginTop: 8 }}>
              <span>Легендарная и выше</span>
              <b>{legendLeft <= 1 ? "в следующем паке" : `через ${legendLeft}`}</b>
            </div>
            <div className="cg-bar">
              <i style={{ width: `${(w.pityLegend / PACK.pityLegend) * 100}%`, background: RANKS[3].color }} />
            </div>
          </div>
          <p className="cg-hint" style={{ marginTop: 12 }}>
            Шансы с одной карты: {RANKS.map((r, i) => `${r.name} ${(PACK.weights[i] / 10).toFixed(1)}%`).join(" · ")}.
            {s.premium ? " Premium: шансы на редкие карты ×1,25." : " С Premium шансы на редкие карты выше на 25%."}
          </p>
        </Panel>

        <Panel title="Победители" hint="Легендарные и мифические карты, выпавшие игрокам.">
          {(["today", "yesterday"] as const).map((k) => (
            <div key={k} style={{ marginBottom: 10 }}>
              <h3>{k === "today" ? "Сегодня" : "Вчера"}</h3>
              {s.pulls[k].length === 0 ? (
                <p className="cg-hint" style={{ margin: 0 }}>
                  Пока никого — станьте первым.
                </p>
              ) : (
                <ul className="cg-list">
                  {s.pulls[k].map((p, i) => {
                    const d = cardDef(p.cardId);
                    return (
                      <li key={i}>
                        <span>
                          <b>{p.nick}</b> · {d?.name}
                        </span>
                        <span className="cg-tag" style={{ color: RANKS[p.rank]?.color }}>
                          {RANKS[p.rank]?.name}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}
