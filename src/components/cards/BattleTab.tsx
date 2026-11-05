"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { BATTLE, CLASSES, DECK_SIZE, ELEMENTS, LEAGUES, type Element } from "@/lib/cards/config";
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
import { TabHero } from "./TabHero";
import { Arsenal, PreFight, getPick } from "./gearui";

const MODES = [
  ["ladder", "Рейтинг", "trophy", "Лига и лидеры"],
  ["campaign", "Кампания", "flag", "Главы и боссы"],
  ["raid", "Рейд", "skull", "Босс недели"],
  ["duel", "Дуэли и журнал", "swords", "Бои с игроками"],
  ["arsenal", "Арсенал", "crown", "Реликвии и бустеры"],
] as const;
type Mode = (typeof MODES)[number][0];

const powerOf = (d: { atk: number; def: number; hp: number; spd: number }, level = 0) => Math.round((d.atk + d.def * 0.8 + d.hp * 0.15 + d.spd * 2) * (1 + 0.06 * level));

const HOW: { ico: "bolt" | "fire" | "shield" | "scroll"; t: string; d: string }[] = [
  { ico: "bolt", t: "Ходят по скорости", d: "Чем выше скорость героя, тем раньше он действует в раунде." },
  { ico: "fire", t: "Стихии бьют друг друга", d: "Удар по слабой стихии +30%, по устойчивой −20%." },
  { ico: "shield", t: "Стражи и Хилеры", d: "Стражи прикрывают союзников, Хилеры лечат отряд." },
  { ico: "scroll", t: "Умения по приоритету", d: "Порядок умений героя настраивается кнопкой под картой." },
];

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
      const r = await act<Report>("fight", { training, booster: getPick() ?? undefined });
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
  const squadPower = deck.reduce((sum, c) => {
    const d = cardDef(c.cardId);
    return sum + (d ? powerOf(d, c.level) : 0);
  }, 0);
  const games = w.wins + w.losses;
  const winRate = games ? Math.round((w.wins / games) * 100) : 0;
  const curIdx = Math.max(0, LEAGUES.findIndex((l) => l.id === league.id));
  const ladderPct = next ? Math.min(100, ((curIdx + (w.rating - league.from) / Math.max(1, next.from - league.from)) / (LEAGUES.length - 1)) * 100) : 100;

  return (
    <div className="cg-bt cg-hx" style={{ display: "grid", gap: 16 }}>
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
      {mode === "arsenal" && <Arsenal s={s} />}
      {mode === "campaign" && (
        <>
          <PreFight s={s} onArsenal={() => setMode("arsenal")} />
          <CampaignView s={s} onReport={setReport} />
        </>
      )}
      {mode === "raid" && (
        <>
          <PreFight s={s} onArsenal={() => setMode("arsenal")} />
          <RaidPanel s={s} onReport={setReport} />
        </>
      )}
      {mode === "duel" && (
        <>
          <PreFight s={s} arena onArsenal={() => setMode("arsenal")} />
          <DuelPanel s={s} onReport={setReport} onProfile={setProfile} nick={duelNick} setNick={setDuelNick} />
        </>
      )}
      {mode === "ladder" && (
      <>
      <TabHero
        eyebrow="Арена"
        title="Рейтинговые бои"
        text="Соберите отряд из четырёх героев и поднимайтесь по лигам. Бой автоматический: исход решают состав, умения и синергии."
        badges={[
          { icon: "trophy", text: `${league.name} · ${fmt(w.rating)}`, hot: true },
          { icon: "bolt", text: `Энергия ${w.energy}/${w.energyMax}` },
        ]}
        kpi={[
          { icon: "trophy", value: fmt(w.rating), label: "рейтинг" },
          { icon: "swords", value: `${w.wins} / ${w.losses}`, label: `победы / поражения · ${winRate}%` },
          { icon: "shield", value: deck.length ? fmt(squadPower) : "—", label: "сила отряда" },
          { icon: "target", value: next ? fmt(next.from - w.rating) : "MAX", label: next ? `очков до лиги «${next.name}»` : "высшая лига" },
        ]}
        extra={
          <div className="bt-lg" aria-label="Лиги">
            <span className="bt-lg-bar">
              <i style={{ width: `${ladderPct}%` }} />
            </span>
            <ol>
              {LEAGUES.map((l, i) => (
                <li key={l.id} className={l.id === league.id ? "cur" : w.rating >= l.from ? "done" : ""} style={{ ["--lc" as string]: l.color, left: `${(i / (LEAGUES.length - 1)) * 100}%` } as CSSProperties}>
                  <img src={`/cards/leagues/${l.id}.webp`} alt={l.name} width={100} height={85} draggable={false} />
                  <small>{l.from} оч.</small>
                </li>
              ))}
            </ol>
          </div>
        }
      />
      <div className="cg-grid2 bt-grid">
        <Panel
          title="Ваш отряд"
          right={
            <span className="bt-pow" title="Суммарная боевая мощность отряда">
              <Ico name="swords" size={15} /> Сила отряда <b>{deck.length ? fmt(squadPower) : "—"}</b>
            </span>
          }
        >
          <p className="bt-lead">
            Выберите {DECK_SIZE} разных героев. Нажмите на карту в слоте, чтобы убрать её, или на «+», чтобы добавить.
          </p>
          <div className="cg-slots bt-slots">
            {Array.from({ length: DECK_SIZE }).map((_, i) => {
              const d = deck[i] ? cardDef(deck[i].cardId) : undefined;
              return deck[i] && d ? (
                <div key={i} className="bt-slot">
                  <div className="bt-sh">
                    <b>{i + 1}</b>
                    <span>{CLASSES[d.cls].name}</span>
                    <em>{fmt(powerOf(d, deck[i].level))}</em>
                  </div>
                  <GameCard cardId={deck[i].cardId} foil={deck[i].foil} level={deck[i].level} evo={deck[i].evo} onClick={() => toggle(deck[i].id)} />
                  <SkillChips ids={deck[i].skills} />
                  <button type="button" className="cg-btn sm" onClick={() => setEditing(deck[i].id)}>
                    <Ico name="scroll" size={14} /> Умения
                  </button>
                </div>
              ) : (
                <div key={i} className="bt-slot empty">
                  <div className="bt-sh">
                    <b>{i + 1}</b>
                    <span>Пусто</span>
                  </div>
                  <button type="button" className="bt-add" onClick={() => setPicking(true)}>
                    <Ico name="plus" size={26} />
                    <span>Добавить героя</span>
                  </button>
                </div>
              );
            })}
          </div>
          <div className="bt-syn">
            <h4>
              <Ico name="star" size={15} /> Синергии отряда <em>{syn.length ? `активно: ${syn.length}` : "нет"}</em>
            </h4>
            {syn.length ? (
              <SynChips list={syn} />
            ) : (
              <p className="cg-hint">Соберите 2–4 героя из одного аниме, 3–4 одной стихии или по одному герою четырёх разных классов: отряд получит бонусы к характеристикам.</p>
            )}
          </div>
          <PreFight s={s} arena onArsenal={() => setMode("arsenal")} />
          <div className="bt-act">
            <button type="button" className="bt-go" disabled={busy || deck.length < DECK_SIZE || w.energy < BATTLE.energyCost} onClick={() => void fight(false)}>
              <Ico name="swords" size={20} />
              <span>
                <b>В бой</b>
                <small>
                  {deck.length < DECK_SIZE ? `нужно ещё героев: ${DECK_SIZE - deck.length}` : w.energy < BATTLE.energyCost ? "не хватает энергии" : "рейтинговая схватка"}
                </small>
              </span>
              <em>
                <Cur k="energy" /> {BATTLE.energyCost}
              </em>
            </button>
            <div className="bt-act2">
              <button type="button" className="cg-btn" disabled={busy || deck.length < DECK_SIZE} onClick={() => void fight(true)} title="Бой без траты энергии и рейтинга">
                <Ico name="target" size={15} /> Тренировка
              </button>
              <button type="button" className="cg-btn" onClick={autoDeck} disabled={busy} title="Подобрать четырёх самых сильных героев">
                <Ico name="crown" size={15} /> Собрать лучший
              </button>
              <button type="button" className="cg-btn" onClick={() => setPicking((p) => !p)}>
                <Ico name="grid" size={15} /> {picking ? "Скрыть коллекцию" : "Изменить состав"}
              </button>
            </div>
          </div>
          {picking && (
            <div className="bt-pick">
              <RankFilter value={rank} onChange={setRank} />
              <InvPicker cards={s.inventory.filter((c) => !c.listed)} selected={w.deck} onToggle={toggle} max={DECK_SIZE} size="xs" rankFilter={rank} />
            </div>
          )}
          <details className="bt-how">
            <summary>
              <Ico name="book" size={16} /> Как проходит бой
            </summary>
            <ul>
              {HOW.map((h) => (
                <li key={h.t}>
                  <Ico name={h.ico} size={18} />
                  <span>
                    <b>{h.t}</b>
                    <small>{h.d}</small>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </Panel>

        <div className="bt-side">
          <Panel title="Готовность">
            <div className="bt-en">
              <div className="bt-en-top">
                <span>
                  <Cur k="energy" /> Энергия
                </span>
                <b>
                  {w.energy}
                  <small> / {w.energyMax}</small>
                </b>
              </div>
              <span className="bt-bar">
                <i style={{ width: `${Math.min(100, (w.energy / Math.max(1, w.energyMax)) * 100)}%` }} />
              </span>
              <div className="bt-en-bot">
                <small>{w.energy >= w.energyMax ? "Энергия полная" : energyLeft > 0 ? `+1 через ${fmtLeft(energyLeft)}` : "Восстанавливается"}</small>
                {w.energy < w.energyMax && (
                  <button type="button" className="cg-btn sm" onClick={() => void run(async () => { const r = await act("energy"); if (!r.ok) toast(r.error, true); })}>
                    Восстановить за 15 <Cur k="diamonds" />
                  </button>
                )}
              </div>
            </div>
            <div className="bt-rec">
              <span>
                <b>{w.wins}</b>
                <small>победы</small>
              </span>
              <span>
                <b>{w.losses}</b>
                <small>поражения</small>
              </span>
              <span>
                <b>{winRate}%</b>
                <small>винрейт</small>
              </span>
            </div>
          </Panel>
          <Panel title="Правила недели" hint="Меняются каждую неделю и действуют на все рейтинговые бои.">
            <div className="bt-rules">
              <div className="bt-rule bad">
                <Ico name={ELEMENT_ICON[mods.ban]} size={26} />
                <span>
                  <small>Штраф</small>
                  <b>{ELEMENTS[mods.ban].name}</b>
                </span>
                <em>−20% к атаке</em>
              </div>
              <div className="bt-rule good">
                <Ico name={ELEMENT_ICON[mods.buff]} size={26} />
                <span>
                  <small>Усиление</small>
                  <b>{ELEMENTS[mods.buff].name}</b>
                </span>
                <em>+15% к атаке</em>
              </div>
            </div>
          </Panel>
          <Panel title="Задания дня" right={<span className="bt-pow"><b>{s.missions.filter((m) => m.claimed).length}/{s.missions.length}</b> выполнено</span>}>
            <ul className="bt-miss">
              {s.missions.map((m) => {
                const pct = Math.min(100, (m.progress / Math.max(1, m.goal)) * 100);
                const ready = !m.claimed && m.progress >= m.goal;
                return (
                  <li key={m.id} className={m.claimed ? "done" : ready ? "ready" : ""}>
                    <div className="bt-miss-top">
                      <span>
                        <b>{m.text}</b>
                        <small>
                          {m.reward.diamonds ? <em><Cur k="diamonds" /> {m.reward.diamonds}</em> : null}
                          {m.reward.dust ? <em><Cur k="dust" /> {m.reward.dust}</em> : null}
                          {m.reward.scroll ? <em><Ico name="scroll" size={14} /> {m.reward.scroll}</em> : null}
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
                    </div>
                    <span className="bt-bar">
                      <i style={{ width: `${pct}%` }} />
                    </span>
                    <small className="bt-miss-n">
                      {m.progress}/{m.goal}
                    </small>
                  </li>
                );
              })}
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
