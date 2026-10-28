"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BattleEvent, BattleOutcome, Unit } from "@/lib/cards/battle";
import { cardDef } from "@/lib/cards/catalog";
import { BATTLE, DECK_SIZE, ELEMENTS, LEAGUES, type Element } from "@/lib/cards/config";
import { act, view, type CardsState } from "@/lib/cards/client";
import { GameCard } from "./GameCard";
import { InvPicker, Panel, RankFilter, fmt, fmtLeft, toast, useBusy, useNow } from "./common";
import { Cur, ELEMENT_ICON, Ico } from "./icons";

interface Report {
  outcome: BattleOutcome;
  you: Unit[];
  foe: Unit[];
  foeName: string;
  foeRating: number;
  pvp: boolean;
  win: boolean;
  reward: { diamonds: number; dust: number; rating: number; scroll: number };
  rating: number;
  training: boolean;
}

export function BattleTab({ s }: { s: CardsState }) {
  const [busy, run] = useBusy();
  const [picking, setPicking] = useState(false);
  const [rank, setRank] = useState(-1);
  const [report, setReport] = useState<Report | null>(null);
  const [top, setTop] = useState<{ place: number; nick: string; rating: number; wins: number; losses: number }[]>([]);
  const now = useNow();
  const w = s.wallet;
  const deck = useMemo(() => w.deck.map((id) => s.inventory.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c), [w.deck, s.inventory]);

  useEffect(() => {
    let alive = true;
    void view<typeof top>("top").then((r) => alive && r.ok && setTop(r.data));
    return () => {
      alive = false;
    };
  }, [w.rating]);

  const saveDeck = (ids: number[]) =>
    run(async () => {
      const r = await act("deck", { ids });
      if (!r.ok) toast(r.error, true);
    });
  const toggle = (id: number) => {
    const ids = w.deck.includes(id) ? w.deck.filter((x) => x !== id) : [...w.deck, id];
    if (ids.length > DECK_SIZE) return;
    void saveDeck(ids);
  };
  const autoDeck = () => {
    const seen = new Set<string>();
    const best = [...s.inventory]
      .filter((c) => !c.listed)
      .sort((a, b) => (cardDef(b.cardId)!.atk * (1 + 0.06 * b.level)) - (cardDef(a.cardId)!.atk * (1 + 0.06 * a.level)))
      .filter((c) => (seen.has(c.cardId) ? false : (seen.add(c.cardId), true)))
      .slice(0, DECK_SIZE);
    void saveDeck(best.map((c) => c.id));
  };
  const fight = (training: boolean) =>
    run(async () => {
      const r = await act<Report>("fight", { training });
      if (!r.ok) return toast(r.error, true);
      setReport(r.result);
    });

  const league = s.league;
  const next = LEAGUES.find((l) => l.from > w.rating);
  const energyLeft = w.nextEnergyAt ? w.nextEnergyAt - now : 0;
  const mods = s.mods as { ban: Element; buff: Element };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {report && <Arena report={report} onClose={() => setReport(null)} />}
      <div className="cg-grid2">
        <Panel
          title="Ваш отряд"
          hint={`Соберите ${DECK_SIZE} разных персонажей. Бой идёт автоматически: ходят по скорости, стихии бьют друг друга (+30% / −20%), Стражи прикрывают союзников, Хилеры лечат.`}
          right={
            <span className="cg-league" style={{ color: league.color }}>
              {league.name} · {fmt(w.rating)}
            </span>
          }
        >
          <div className="cg-slots" style={{ marginBottom: 14 }}>
            {Array.from({ length: DECK_SIZE }).map((_, i) =>
              deck[i] ? (
                <GameCard key={i} cardId={deck[i].cardId} foil={deck[i].foil} level={deck[i].level} onClick={() => toggle(deck[i].id)} />
              ) : (
                <button key={i} type="button" className="cg-slot" onClick={() => setPicking(true)} style={{ cursor: "pointer" }}>
                  + Карта
                </button>
              ),
            )}
          </div>
          <div className="cg-row">
            <button type="button" className="cg-btn pri" disabled={busy || deck.length < DECK_SIZE || w.energy < BATTLE.energyCost} onClick={() => void fight(false)}>
              В бой · <Cur k="energy" /> {BATTLE.energyCost}
            </button>
            <button type="button" className="cg-btn" disabled={busy || deck.length < DECK_SIZE} onClick={() => void fight(true)}>
              Тренировка
            </button>
            <button type="button" className="cg-btn" onClick={autoDeck} disabled={busy}>
              Собрать лучший
            </button>
            <button type="button" className="cg-btn sm" onClick={() => setPicking((p) => !p)}>
              {picking ? "Скрыть коллекцию" : "Изменить"}
            </button>
          </div>
          <div className="cg-row" style={{ marginTop: 12, fontSize: 13 }}>
            <span className="cg-chip">
              <Cur k="energy" /> {w.energy}/{w.energyMax} {energyLeft > 0 && <small>+1 через {fmtLeft(energyLeft)}</small>}
            </span>
            {w.energy < w.energyMax && (
              <button type="button" className="cg-btn sm" onClick={() => void run(async () => { const r = await act("energy"); if (!r.ok) toast(r.error, true); })}>
                Восстановить за 15 <Cur k="diamonds" />
              </button>
            )}
            <span className="cg-chip">
              <Ico name="trophy" size={15} /> {w.wins} · <Ico name="skull" size={15} /> {w.losses}
            </span>
          </div>
          {next && (
            <p className="cg-hint" style={{ marginTop: 10 }}>
              До лиги «{next.name}»: {next.from - w.rating} очков.
            </p>
          )}
          {picking && (
            <div style={{ marginTop: 14 }}>
              <RankFilter value={rank} onChange={setRank} />
              <InvPicker cards={s.inventory.filter((c) => !c.listed)} selected={w.deck} onToggle={toggle} max={DECK_SIZE} size="xs" rankFilter={rank} />
            </div>
          )}
        </Panel>

        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <Panel title="Правила недели">
            <div className="cg-row">
              <div className="cg-mod">
                <Ico name="trend" size={15} style={{ transform: "scaleY(-1)" }} /> Штраф: <Ico name={ELEMENT_ICON[mods.ban]} size={15} /> {ELEMENTS[mods.ban].name} <b>−20% к атаке</b>
              </div>
              <div className="cg-mod">
                <Ico name="trend" size={15} /> Усиление: <Ico name={ELEMENT_ICON[mods.buff]} size={15} /> {ELEMENTS[mods.buff].name} <b>+15% к атаке</b>
              </div>
            </div>
          </Panel>
          <Panel title="Задания дня">
            <ul className="cg-list">
              {s.missions.map((m) => (
                <li key={m.id}>
                  <span>
                    {m.text} · {m.progress}/{m.goal}
                    <br />
                    <small style={{ color: "var(--cg-mut)" }}>
                      {[m.reward.diamonds && `${m.reward.diamonds} алм.`, m.reward.dust && `${m.reward.dust} пыли`, m.reward.scroll && `${m.reward.scroll} свиток`].filter(Boolean).join(" · ")}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="cg-btn sm pri"
                    disabled={m.claimed || m.progress < m.goal}
                    onClick={() => void run(async () => { const r = await act("mission", { id: m.id }); toast(r.ok ? "Награда получена" : r.error, !r.ok); })}
                  >
                    {m.claimed ? "Получено" : "Забрать"}
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Топ сезона">
            {top.length === 0 ? (
              <div className="cg-empty">Рейтинг появится после первых боёв</div>
            ) : (
              <ul className="cg-list">
                {top.slice(0, 10).map((t) => (
                  <li key={t.place}>
                    <span>
                      <b>#{t.place}</b> {t.nick}
                    </span>
                    <span>
                      {fmt(t.rating)} · {t.wins}/{t.losses}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Арена боя -------------------------------- */
function Arena({ report, onClose }: { report: Report; onClose: () => void }) {
  const events = report.outcome.events;
  const [step, setStep] = useState(0);
  const [hp, setHp] = useState<Record<string, number>>(() => Object.fromEntries([...report.you, ...report.foe].map((u) => [u.key, u.maxHp])));
  const [flash, setFlash] = useState<{ key: string; text: string; kind: string; n: number } | null>(null);
  const ref = useRef(0);
  const done = step >= events.length;

  const apply = useCallback((e: BattleEvent) => {
    setHp((p) => ({ ...p, [e.to]: e.hp }));
    setFlash(e.t === "hit" ? { key: e.to, text: `${e.crit ? "КРИТ " : ""}−${e.dmg}`, kind: e.crit ? "crit" : "dmg", n: ++ref.current } : { key: e.to, text: `+${e.amount}`, kind: "heal", n: ++ref.current });
  }, []);

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => {
      apply(events[step]);
      setStep(step + 1);
    }, 520);
    return () => clearTimeout(t);
  }, [step, done, events, apply]);

  const skip = () => {
    const finalHp: Record<string, number> = {};
    [...report.outcome.a, ...report.outcome.b].forEach((u) => (finalHp[u.key] = u.hp));
    setHp(finalHp);
    setFlash(null);
    setStep(events.length);
  };

  const side = (units: Unit[]) => (
    <div className="cg-side">
      {units.map((u) => {
        const cur = hp[u.key] ?? 0;
        return (
          <div key={u.key} className={`cg-unit ${cur <= 0 ? "dead" : ""} ${flash?.key === u.key && flash.kind !== "heal" ? "hit" : ""}`}>
            <GameCard cardId={u.cardId} foil={u.foil} level={u.level} stats={false} />
            <div className="cg-hp">
              <i style={{ width: `${Math.max(0, (cur / u.maxHp) * 100)}%` }} />
            </div>
            {flash?.key === u.key && (
              <span key={flash.n} className={`cg-float ${flash.kind}`}>
                {flash.text}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="cg-modal" role="dialog" aria-modal="true" aria-label="Бой">
      <div style={{ width: "min(1040px, 100%)" }}>
        <div className="cg-row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <b style={{ fontFamily: "var(--font-display, inherit)", fontSize: 18 }}>
            Вы vs {report.foeName} {report.pvp ? "· игрок" : "· бот"}
          </b>
          <span className="cg-chip">Раунд {done ? report.outcome.rounds : events[Math.min(step, events.length - 1)]?.round ?? 1}</span>
        </div>
        <div className="cg-arena">
          {side(report.you)}
          <div className="cg-vs">VS</div>
          {side(report.foe)}
        </div>
        {done ? (
          <div className="cg-panel" style={{ marginTop: 16, textAlign: "center" }}>
            <h2 style={{ color: report.win ? "#6df0b0" : "#ff7a90" }}>{report.win ? "Победа!" : "Поражение"}</h2>
            {report.training ? (
              <p className="cg-hint">Тренировка: награды и рейтинг не меняются.</p>
            ) : (
              <p className="cg-hint">
                {report.reward.diamonds} <Cur k="diamonds" /> · {report.reward.dust} пыли{report.reward.scroll ? " · свиток заточки" : ""} · рейтинг {report.reward.rating > 0 ? "+" : ""}
                {report.reward.rating}
              </p>
            )}
            <button type="button" className="cg-btn pri" onClick={onClose}>
              Закрыть
            </button>
          </div>
        ) : (
          <div className="cg-row" style={{ justifyContent: "center", marginTop: 16 }}>
            <button type="button" className="cg-btn" onClick={skip}>
              Пропустить анимацию
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
