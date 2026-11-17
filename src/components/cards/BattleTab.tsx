"use client";

import { LEAGUE_PLATE_Y } from "@/lib/cards/league-art";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { BATTLE, CLASSES, DECK_SIZE, ELEMENTS, LEAGUES, type CardClass, type Element } from "@/lib/cards/config";
import { act, view, type CardsState } from "@/lib/cards/client";
import { Arena, type BattleReport as Report } from "./Arena";
import { GameCard } from "./GameCard";
import { SkillChips, SkillEditor, SynChips } from "./skillui";
import { synergyList } from "@/lib/cards/synergy";
import { CollectorModal } from "./collector";
import { Leaderboard, type TopRow } from "./Leaderboard";
import { useAccount } from "@/lib/use-account";
import { InvPicker, Panel, RankFilter, fmt, fmtLeft, toast, useBusy, useNow } from "./common";
import { Cur, ELEMENT_ICON, Ico, type IcoName } from "./icons";
import { CampaignView, DuelPanel, RaidPanel } from "./PveTabs";
import { TabHero } from "./TabHero";
import { CLASS_ICO, ClassSection, DeckRail, TacticsSection } from "./DeckHub";
import { CLASS_ORDER, HERO_CLASSES } from "@/lib/cards/heroclass";
import "../../app/cards-decks.css";
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

const LADDER_SUBS: ["fight" | "rules" | "top", string, IcoName][] = [
  ["fight", "Отряд и бой", "swords"],
  ["rules", "Правила и задания", "target"],
  ["top", "Лидеры сезона", "trophy"],
];

export function BattleTab({ s }: { s: CardsState }) {
  const [busy, run] = useBusy();
  const [picking, setPicking] = useState(false);
  const [rank, setRank] = useState(-1);
  const [clsF, setClsF] = useState<CardClass | "all">("all");
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
  const deckCls = s.decks.slots[s.decks.active].cls;
  const hc = HERO_CLASSES[deckCls];
  const autoDeck = () => {
    const seen = new Set<string>();
    const best = [...s.inventory]
      .filter((c) => !c.listed)
      .sort((a, b) => cardDef(b.cardId)!.atk * (1 + 0.06 * b.level) * (cardDef(b.cardId)!.cls === deckCls ? 1.12 : 1) - cardDef(a.cardId)!.atk * (1 + 0.06 * a.level) * (cardDef(a.cardId)!.cls === deckCls ? 1.12 : 1))
      .filter((c) => (seen.has(c.cardId) ? false : (seen.add(c.cardId), true)))
      .slice(0, DECK_SIZE);
    void saveDeck(best.map((c) => c.id));
  };
  const fight = (training: boolean) =>
    run(async () => {
      const r = await act<Report>("fight", { training, booster: getPick() ?? undefined, live: true });
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
  const [lview, setLview] = useState<"fight" | "rules" | "top">("fight");
  const missReady = s.missions.filter((m) => !m.claimed && m.progress >= m.goal).length;
  const winRate = games ? Math.round((w.wins / games) * 100) : 0;
  const curIdx = Math.max(0, LEAGUES.findIndex((l) => l.id === league.id));
  const ladderPct = next ? Math.min(100, ((curIdx + (w.rating - league.from) / Math.max(1, next.from - league.from)) / (LEAGUES.length - 1)) * 100) : 100;

  return (
    <div className={`cg-bt cg-hx`} style={{ display: "grid", gap: 16 }}>
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
      {lview === "top" && (
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
                  <span className="lg-emb" style={{ ["--img" as string]: `url(/cards/leagues/${l.id}.webp)`, ["--py" as string]: `${LEAGUE_PLATE_Y[l.id] ?? 82}%` } as CSSProperties}>
                    <img src={`/cards/leagues/${l.id}.webp`} alt={l.name} width={140} height={180} draggable={false} />
                    <b className="lg-plate">{l.name}</b>
                    <u aria-hidden className="lg-sp s1" />
                    <u aria-hidden className="lg-sp s2" />
                    <u aria-hidden className="lg-sp s3" />
                  </span>
                  <small>{l.from} оч.</small>
                </li>
              ))}
            </ol>
          </div>
        }
      />
      )}
      <div className="pg-sub" role="tablist" aria-label="Разделы рейтинговых боёв">
        {LADDER_SUBS.map(([id, label, ic]) => (
          <button key={id} type="button" role="tab" aria-selected={lview === id} className="pg-sub-b" onClick={() => setLview(id)}>
            <Ico name={ic} size={16} />
            <span>{label}</span>
            {id === "rules" && missReady > 0 && <em aria-label={`Наград: ${missReady}`}>{missReady}</em>}
          </button>
        ))}
      </div>
      {lview === "fight" && (
      <div className="bt2">
        <section className="gp cg2-glass" aria-label="Начать бой" style={{ ["--c" as string]: hc.color }}>
          <span className="gp-em" aria-hidden>
            <Ico name={CLASS_ICO[deckCls]} size={28} />
          </span>
          <div className="gp-id">
            <small>Активная колода · {hc.name}</small>
            <b>{s.decks.slots[s.decks.active].name}</b>
            <span>
              <Ico name="swords" size={14} /> Сила отряда <em>{deck.length ? fmt(squadPower) : "—"}</em>
            </span>
          </div>
          <span className="gp-mini" aria-hidden>
            {Array.from({ length: DECK_SIZE }, (_, k) => (
              <i key={k}>{deck[k] ? <img src={`/api/cards/art/${deck[k].cardId}`} alt="" draggable={false} /> : null}</i>
            ))}
          </span>

          <div className="gp-en">
            <div className="gp-enh">
              <span className="gp-enl">
                <Cur k="energy" /> Энергия
              </span>
              <b>
                {w.energy}
                <small> / {w.energyMax}</small>
              </b>
            </div>
            <div className="gp-seg" aria-hidden>
              {Array.from({ length: w.energyMax }, (_, k) => (
                <i key={k} className={k < w.energy ? "on" : ""} />
              ))}
            </div>
            <div className="gp-enf">
              <small>{w.energy >= w.energyMax ? "Энергия полная" : energyLeft > 0 ? `+1 через ${fmtLeft(energyLeft)}` : "Восстанавливается"}</small>
              {w.energy < w.energyMax && (
                <button type="button" className="cg-btn sm" onClick={() => void run(async () => { const r = await act("energy"); if (!r.ok) toast(r.error, true); })}>
                  Восстановить за 15 <Cur k="diamonds" />
                </button>
              )}
            </div>
          </div>

          <div className="gp-act">
            <div className="gp-go">
              <button type="button" className="cg-btn pri bt-go-btn" disabled={busy || deck.length < DECK_SIZE || w.energy < BATTLE.energyCost} onClick={() => void fight(false)}>
                В бой · <Cur k="energy" /> {BATTLE.energyCost}
              </button>
              {(deck.length < DECK_SIZE || w.energy < BATTLE.energyCost) && <small className="bt-fight-hint">{deck.length < DECK_SIZE ? `Нужно ещё героев: ${DECK_SIZE - deck.length}` : "Не хватает энергии"}</small>}
            </div>
            <button type="button" className="cg-btn gp-tr" disabled={busy || deck.length < DECK_SIZE} onClick={() => void fight(true)} title="Бой без траты энергии и рейтинга">
              <Ico name="target" size={15} /> Тренировка
            </button>
          </div>
        </section>

        <section className="cg2-sec" aria-labelledby="bt2-decks-t">
          <div className="cg2-sh">
            <div>
              <span className="cg2-eye">Колоды</span>
              <h2 id="bt2-decks-t">Выберите колоду</h2>
            </div>
            <p>Пять колод с разными составами и классами. Активная идёт в рейтинг, кампанию, рейд и защиту.</p>
          </div>
          <DeckRail s={s} />
        </section>

        <section className="cg2-sec" aria-labelledby="bt2-class-t">
          <div className="cg2-sh">
            <div>
              <span className="cg2-eye">Класс колоды</span>
              <h2 id="bt2-class-t">Способность класса</h2>
            </div>
            <p>Класс усиливает весь отряд, а героям этого же класса даёт бонус побольше.</p>
          </div>
          <ClassSection s={s} />
        </section>

        <section className="cg2-sec" aria-labelledby="bt2-spell-t">
          <div className="cg2-sh">
            <div>
              <span className="cg2-eye">Карты боя</span>
              <h2 id="bt2-spell-t">Колода заклинаний</h2>
            </div>
            <p>В бою вам раздают по 3 карты. Мана растёт каждый раунд: разыгрывайте карты в ход героя перед действием.</p>
          </div>
          <TacticsSection s={s} />
        </section>

        <section className="cg2-sec" aria-labelledby="bt2-squad-t">
          <div className="cg2-sh">
            <div>
              <span className="cg2-eye">Состав</span>
              <h2 id="bt2-squad-t">Герои колоды</h2>
            </div>
            <div className="bt2-tools">
              <button type="button" className="cg-btn" onClick={autoDeck} disabled={busy} title="Подобрать четырёх самых сильных героев">
                <Ico name="crown" size={15} /> Собрать лучший
              </button>
              <button type="button" className="cg-btn" onClick={() => setPicking((p) => !p)}>
                <Ico name="grid" size={15} /> {picking ? "Скрыть коллекцию" : "Изменить состав"}
              </button>
            </div>
          </div>
          <div className="bt-stage" style={{ ["--c" as string]: hc.color }}>
            <i className="bt-tick tl" /><i className="bt-tick tr" /><i className="bt-tick bl" /><i className="bt-tick br" />
            <header className="bt-stage-h">
              <span className="bt-stage-t"><Ico name={CLASS_ICO[deckCls]} size={16} /> Отряд · {hc.name}</span>
              <div className="bt-stage-m">
                <span><small>Сила отряда</small><b>{fmt(deck.reduce((a, c) => { const d = cardDef(c.cardId); return a + (d ? powerOf(d, c.level) : 0); }, 0))}</b></span>
                <span><small>Героев</small><b>{deck.length}<em>/{DECK_SIZE}</em></b></span>
              </div>
            </header>
          <div className="cg-slots bt-slots">
            {Array.from({ length: DECK_SIZE }).map((_, i) => {
              const d = deck[i] ? cardDef(deck[i].cardId) : undefined;
              return deck[i] && d ? (
                <div key={i} className={`bt-slot ${d.cls === deckCls ? "own" : ""}`}>
                  <div className="bt-sh">
                    <b>{i + 1}</b>
                    <span>{CLASSES[d.cls].name}{d.cls === deckCls && <i className="bt-own" title="Бонус класса колоды">★</i>}</span>
                    <em>{fmt(powerOf(d, deck[i].level))}</em>
                  </div>
                  <GameCard cardId={deck[i].cardId} foil={deck[i].foil} level={deck[i].level} evo={deck[i].evo} onClick={() => toggle(deck[i].id)} />
                  <span className="bt-pw" aria-hidden><u style={{ width: `${Math.max(8, Math.min(100, (powerOf(d, deck[i].level) / Math.max(1, ...deck.map((c) => { const x = cardDef(c.cardId); return x ? powerOf(x, c.level) : 0; }))) * 100))}%` }} /></span>
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
          </div>
          <div className="bt2-syn cg2-glass">
            <h4>
              <Ico name="star" size={15} /> Синергии отряда <em>{syn.length ? `активно: ${syn.length}` : "нет"}</em>
            </h4>
            {syn.length ? (
              <SynChips list={syn} />
            ) : (
              <p className="cg-hint">Соберите 2–4 героя из одного аниме, 3–4 одной стихии или по одному герою четырёх разных классов: отряд получит бонусы к характеристикам.</p>
            )}
          </div>
        </section>

        {picking && (
          <section className="cg2-sec" aria-labelledby="bt2-coll-t">
            <div className="cg2-sh">
              <div>
                <span className="cg2-eye">Коллекция</span>
                <h2 id="bt2-coll-t">Выберите героев</h2>
              </div>
              <p>Нажмите на карту, чтобы добавить её в колоду или убрать.</p>
            </div>
            <div className="bt2-pick cg2-glass">
              <div className="bt-clsf" role="group" aria-label="Класс героя">
                <button type="button" aria-pressed={clsF === "all"} onClick={() => setClsF("all")}>
                  Все классы
                </button>
                {CLASS_ORDER.map((k) => (
                  <button key={k} type="button" aria-pressed={clsF === k} style={{ ["--c" as string]: HERO_CLASSES[k].color }} onClick={() => setClsF(k)}>
                    <Ico name={CLASS_ICO[k]} size={14} /> {HERO_CLASSES[k].name}
                  </button>
                ))}
              </div>
              <RankFilter value={rank} onChange={setRank} />
              <InvPicker cards={s.inventory.filter((c) => !c.listed && (clsF === "all" || cardDef(c.cardId)?.cls === clsF))} selected={w.deck} onToggle={toggle} max={DECK_SIZE} size="xs" rankFilter={rank} />
            </div>
          </section>
        )}

        <section className="cg2-sec" aria-labelledby="bt2-prep-t">
          <div className="cg2-sh">
            <div>
              <span className="cg2-eye">Подготовка</span>
              <h2 id="bt2-prep-t">Арена, реликвии и бустер</h2>
            </div>
            <p>Правило арены дня и снаряжение, которое возьмёте в бой.</p>
          </div>
          <PreFight s={s} arena onArsenal={() => setMode("arsenal")} />
        </section>

        <section className="cg2-sec" aria-labelledby="bt2-how-t">
          <div className="cg2-sh">
            <div>
              <span className="cg2-eye">Правила</span>
              <h2 id="bt2-how-t">Как проходит бой</h2>
            </div>
          </div>
          <ul className="bt2-how">
            {HOW.map((h) => (
              <li key={h.t} className="cg2-glass">
                <span className="ic">
                  <Ico name={h.ico} size={20} />
                </span>
                <b>{h.t}</b>
                <small>{h.d}</small>
              </li>
            ))}
          </ul>
        </section>
      </div>
      )}
      {lview === "rules" && (
        <div className="pg-view bt-two">
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
      )}
      {lview === "top" && (
        <Leaderboard rows={top} me={account?.nickname ?? ""} myRating={w.rating} onOpen={setProfile} />
      )}
      </>
      )}
    </div>
  );
}
