"use client";

import { useEffect, useMemo, useState } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { BATTLE, DECK_SIZE, ELEMENTS, LEAGUES, type Element } from "@/lib/cards/config";
import { act, view, type CardsState } from "@/lib/cards/client";
import { Arena, type BattleReport as Report } from "./Arena";
import { GameCard } from "./GameCard";
import { SkillChips, SkillEditor, SynChips } from "./skillui";
import { synergyList } from "@/lib/cards/synergy";
import { CollectorModal } from "./collector";
import { Leaderboard, type TopRow } from "./Leaderboard";
import { useAccount } from "@/lib/use-account";
import { InvPicker, Panel, RankFilter, fmt, fmtLeft, toast, useBusy, useNow } from "./common";
import { Cur, ELEMENT_ICON, Ico } from "./icons";
import { CampaignView, DuelPanel, RaidPanel } from "./PveTabs";

const MODES = [
  ["ladder", "Рейтинг", "trophy", "Лига и лидеры"],
  ["campaign", "Кампания", "flag", "Главы и боссы"],
  ["raid", "Рейд", "skull", "Босс недели"],
  ["duel", "Дуэли и журнал", "swords", "Бои с игроками"],
] as const;
type Mode = (typeof MODES)[number][0];

export function BattleTab({ s }: { s: CardsState }) {
  const [busy, run] = useBusy();
  const [picking, setPicking] = useState(false);
  const [rank, setRank] = useState(-1);
  const [report, setReport] = useState<Report | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [profile, setProfile] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("ladder");
  const [duelNick, setDuelNick] = useState("");
  const [top, setTop] = useState<TopRow[]>([]);
  const account = useAccount();
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

  const syn = useMemo(
    () => synergyList(deck.map((c) => cardDef(c.cardId)).filter((d): d is NonNullable<typeof d> => !!d).map((d) => ({ series: d.series, element: d.element, cls: d.cls }))),
    [deck],
  );
  const league = s.league;
  const next = LEAGUES.find((l) => l.from > w.rating);
  const energyLeft = w.nextEnergyAt ? w.nextEnergyAt - now : 0;
  const mods = s.mods as { ban: Element; buff: Element };

  return (
    <div className="cg-bt" style={{ display: "grid", gap: 16 }}>
      {report && <Arena report={report} onClose={() => setReport(null)} />}
      {profile && (
        <CollectorModal
          nick={profile}
          onClose={() => setProfile(null)}
          onChallenge={(n) => {
            setDuelNick(n);
            setMode("duel");
            setProfile(null);
          }}
        />
      )}
      {editing !== null && deck.find((c) => c.id === editing) && <SkillEditor key={editing} card={deck.find((c) => c.id === editing)!} onClose={() => setEditing(null)} />}
      <div className="bt-modes" role="tablist" aria-label="Режим боёв">
        {MODES.map(([id, label, ico, sub]) => (
          <button key={id} type="button" role="tab" aria-selected={mode === id} className="bt-mode" onClick={() => setMode(id)}>
            <Ico name={ico} size={22} />
            <span>
              <b>{label}</b>
              <small>{sub}</small>
            </span>
          </button>
        ))}
      </div>
      {mode === "campaign" && <CampaignView s={s} onReport={setReport} />}
      {mode === "raid" && <RaidPanel s={s} onReport={setReport} />}
      {mode === "duel" && <DuelPanel s={s} onReport={setReport} onProfile={setProfile} nick={duelNick} setNick={setDuelNick} />}
      {mode === "ladder" && (
      <>
      <div className="cg-grid2">
        <Panel
          title="Ваш отряд"
          hint={`Соберите ${DECK_SIZE} разных персонажей. Бой идёт автоматически: ходят по скорости, применяют умения по приоритету, стихии бьют друг друга (+30% / −20%), Стражи прикрывают союзников, Хилеры лечат. Умения героя выбираются кнопкой под картой.`}
          right={
            <span className="cg-league" style={{ color: league.color }}>
              {league.name} · {fmt(w.rating)}
            </span>
          }
        >
          <div className="cg-slots bt-slots" style={{ marginBottom: 14 }}>
            {Array.from({ length: DECK_SIZE }).map((_, i) =>
              deck[i] ? (
                <div key={i} className="bt-slot">
                  <GameCard cardId={deck[i].cardId} foil={deck[i].foil} level={deck[i].level} evo={deck[i].evo} onClick={() => toggle(deck[i].id)} />
                  <SkillChips ids={deck[i].skills} />
                  <button type="button" className="cg-btn sm" onClick={() => setEditing(deck[i].id)}>
                    <Ico name="scroll" size={14} /> Умения
                  </button>
                </div>
              ) : (
                <button key={i} type="button" className="cg-slot" onClick={() => setPicking(true)} style={{ cursor: "pointer" }}>
                  + Карта
                </button>
              ),
            )}
          </div>
          <div className="bt-syn">
            <h4>Синергии отряда</h4>
            {syn.length ? (
              <SynChips list={syn} />
            ) : (
              <p className="cg-hint">Соберите 2–4 героя из одного аниме, 3–4 одной стихии или по одному герою четырёх разных классов: отряд получит бонусы к характеристикам.</p>
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
        </div>
      </div>
      <Leaderboard rows={top} me={account?.nickname ?? ""} myRating={w.rating} onOpen={setProfile} />
      </>
      )}
    </div>
  );
}
