"use client";

import { useMemo, useState } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { MELT, RANKS, SPLIT, UPGRADE } from "@/lib/cards/config";
import { act, type CardsState, type InvCard } from "@/lib/cards/client";
import { GameCard } from "./GameCard";
import { InvPicker, Panel, RankFilter, Reveal, toast, useBusy } from "./common";

type Mode = "melt" | "split" | "upgrade";
type Shown = { cardId: string; foil?: boolean; level?: number }[];

const free = (c: InvCard) => !c.locked && !c.listed;
const rankOf = (c: InvCard) => cardDef(c.cardId)?.rank ?? 0;

export function ForgeTab({ s }: { s: CardsState }) {
  const [mode, setMode] = useState<Mode>("melt");
  const [reveal, setReveal] = useState<{ title: string; cards: Shown } | null>(null);
  return (
    <div>
      <div className="cg-sub" role="group" aria-label="Кузница">
        {(
          [
            ["melt", "Переплавка"],
            ["split", "Раскол"],
            ["upgrade", "Улучшение"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)}>
            {label}
          </button>
        ))}
      </div>
      {mode === "melt" && <Melt s={s} show={(title, cards) => setReveal({ title, cards })} />}
      {mode === "split" && <Split s={s} show={(title, cards) => setReveal({ title, cards })} />}
      {mode === "upgrade" && <Upgrade s={s} show={(title, cards) => setReveal({ title, cards })} />}
      {reveal && <Reveal title={reveal.title} cards={reveal.cards} onClose={() => setReveal(null)} />}
    </div>
  );
}

type Props = { s: CardsState; show: (title: string, cards: Shown) => void };

function Melt({ s, show }: Props) {
  const [rank, setRank] = useState(0);
  const [sel, setSel] = useState<number[]>([]);
  const [busy, run] = useBusy();
  const pool = useMemo(() => s.inventory.filter((c) => free(c) && rankOf(c) === rank), [s.inventory, rank]);
  const toggle = (id: number) => setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const auto = () => setSel(pool.sort((a, b) => a.level - b.level || Number(a.foil) - Number(b.foil)).slice(0, MELT.need).map((c) => c.id));
  const go = () =>
    run(async () => {
      const r = await act<{ cardId: string }>("melt", { ids: sel });
      if (!r.ok) return toast(r.error, true);
      setSel([]);
      show("Результат переплавки", [{ cardId: r.result.cardId }]);
    });
  return (
    <div className="cg-grid2">
      <Panel title="Переплавка" hint={`Отдайте ${MELT.need} карты одного ранга и получите 1 случайную карту рангом выше. Мифические переплавить нельзя. Заблокированные и выставленные карты не участвуют.`}>
        <div className="cg-forge">
          {Array.from({ length: MELT.need }).map((_, i) => {
            const c = s.inventory.find((x) => x.id === sel[i]);
            return c ? <GameCard key={i} cardId={c.cardId} foil={c.foil} level={c.level} stats={false} onClick={() => toggle(c.id)} /> : <div key={i} className="cg-slot">Карта {i + 1}</div>;
          })}
          <div className="cg-arrow">→</div>
          <div className="cg-slot" style={{ borderColor: RANKS[Math.min(4, rank + 1)].color, color: RANKS[Math.min(4, rank + 1)].color }}>
            {rank >= 4 ? "—" : `Случайная «${RANKS[rank + 1].name}»`}
          </div>
        </div>
        <div className="cg-row">
          <button type="button" className="cg-btn gold" disabled={busy || sel.length !== MELT.need || rank >= 4} onClick={() => void go()}>
            Переплавить
          </button>
          <button type="button" className="cg-btn" onClick={auto} disabled={pool.length < MELT.need}>
            Выбрать 3 слабейшие
          </button>
          <button type="button" className="cg-btn sm" onClick={() => setSel([])}>
            Сбросить
          </button>
        </div>
      </Panel>
      <Panel title="Ваши карты">
        <RankFilter value={rank} onChange={(r) => { setRank(r); setSel([]); }} all={false} only={[0, 1, 2, 3]} />
        <InvPicker cards={pool} selected={sel} onToggle={toggle} max={MELT.need} size="xs" empty={`Нет свободных карт ранга «${RANKS[rank].name}»`} />
      </Panel>
    </div>
  );
}

function Split({ s, show }: Props) {
  const [rank, setRank] = useState(1);
  const [sel, setSel] = useState<number[]>([]);
  const [busy, run] = useBusy();
  const pool = useMemo(() => s.inventory.filter((c) => free(c) && rankOf(c) === rank), [s.inventory, rank]);
  const u = s.split;
  const paid = u.used >= u.free;
  const left = Math.max(0, u.max - u.used);
  const toggle = (id: number) => setSel((p) => (p[0] === id ? [] : [id]));
  const go = () =>
    run(async () => {
      const r = await act<{ cards: { cardId: string }[]; paid: number }>("split", { id: sel[0] });
      if (!r.ok) return toast(r.error, true);
      setSel([]);
      show("Раскол: две новые карты", r.result.cards);
      if (r.result.paid) toast(`Списано ${r.result.paid} 💎`);
    });
  return (
    <div className="cg-grid2">
      <Panel title="Раскол" hint={`Одна карта распадается на 2 случайные карты рангом ниже. Бесплатно сегодня: ${u.free} раскол${s.premium ? "ов (Premium)" : "ов"}, дальше ${SPLIT.extraDiamonds} 💎 за раскол, максимум ${u.max} в день.`}>
        <div className="cg-prog" style={{ marginBottom: 14 }}>
          <div className="cg-row" style={{ justifyContent: "space-between", fontSize: 13 }}>
            <span>Сегодня</span>
            <b>
              {u.used} / {u.max}
            </b>
          </div>
          <div className="cg-bar">
            <i style={{ width: `${(u.used / u.max) * 100}%` }} />
          </div>
        </div>
        <div className="cg-forge two">
          {sel[0] ? (
            (() => {
              const c = s.inventory.find((x) => x.id === sel[0])!;
              return <GameCard cardId={c.cardId} foil={c.foil} level={c.level} stats={false} onClick={() => setSel([])} />;
            })()
          ) : (
            <div className="cg-slot">Выберите карту</div>
          )}
          <div className="cg-arrow">→</div>
          {[0, 1].map((i) => (
            <div key={i} className="cg-slot" style={{ borderColor: RANKS[Math.max(0, rank - 1)].color, color: RANKS[Math.max(0, rank - 1)].color }}>
              Случайная «{RANKS[Math.max(0, rank - 1)].name}»
            </div>
          ))}
        </div>
        <div className="cg-row">
          <button type="button" className="cg-btn gold" disabled={busy || !sel[0] || left === 0} onClick={() => void go()}>
            {paid ? `Расколоть за ${SPLIT.extraDiamonds} 💎` : "Расколоть бесплатно"}
          </button>
          <span className="cg-hint" style={{ margin: 0 }}>
            Обычные карты раскалывать нельзя — их можно превратить в пыль в коллекции.
          </span>
        </div>
      </Panel>
      <Panel title="Ваши карты">
        <RankFilter value={rank} onChange={(r) => { setRank(r); setSel([]); }} all={false} only={[1, 2, 3, 4]} />
        <InvPicker cards={pool} selected={sel} onToggle={toggle} max={1} size="xs" empty={`Нет свободных карт ранга «${RANKS[rank].name}»`} />
      </Panel>
    </div>
  );
}

function Upgrade({ s, show }: Props) {
  const [cardId, setCardId] = useState("");
  const [busy, run] = useBusy();
  const groups = useMemo(() => {
    const m = new Map<string, InvCard[]>();
    for (const c of s.inventory) if (free(c) && !c.foil) m.set(c.cardId, [...(m.get(c.cardId) ?? []), c]);
    return [...m.entries()].filter(([, v]) => v.length >= UPGRADE.need).map(([id, v]) => ({ id, cards: v.sort((a, b) => b.level - a.level) }));
  }, [s.inventory]);
  const group = groups.find((g) => g.id === cardId);
  const picked = group ? group.cards.slice(0, UPGRADE.need) : [];
  const level = picked.length ? Math.max(...picked.map((c) => c.level)) : 1;
  const go = () =>
    run(async () => {
      const r = await act<{ cardId: string; level: number }>("upgrade", { ids: picked.map((c) => c.id) });
      if (!r.ok) return toast(r.error, true);
      setCardId("");
      show("Анимированная карта!", [{ cardId: r.result.cardId, foil: true, level: r.result.level }]);
    });
  return (
    <div className="cg-grid2">
      <Panel title="Улучшение" hint="Три одинаковые карты превращаются в анимированную версию с голографической рамкой и бонусом +20% к характеристикам. Уровень заточки и прогресс переносятся с лучшей из трёх карт.">
        <div className="cg-forge up">
          {Array.from({ length: UPGRADE.need }).map((_, i) =>
            picked[i] ? <GameCard key={i} cardId={picked[i].cardId} level={picked[i].level} stats={false} /> : <div key={i} className="cg-slot">Копия {i + 1}</div>,
          )}
          <div className="cg-arrow">→</div>
          {group ? <GameCard cardId={group.id} foil level={level} stats={false} /> : <div className="cg-slot">Анимированная версия</div>}
        </div>
        <div className="cg-row">
          <button type="button" className="cg-btn gold" disabled={busy || !group} onClick={() => void go()}>
            Улучшить
          </button>
          {group && <span className="cg-hint" style={{ margin: 0 }}>Уровень результата: {level}</span>}
        </div>
      </Panel>
      <Panel title="Доступно для улучшения" hint="Показаны карты, у которых есть 3 и более свободных копий.">
        {groups.length === 0 ? (
          <div className="cg-empty">Нужно три одинаковых свободных карты. Они выпадают из паков, а дубли можно докупить на аукционе.</div>
        ) : (
          <div className="cg-cards xs">
            {groups.map((g) => (
              <button key={g.id} type="button" className="cg-cell" onClick={() => setCardId(g.id)}>
                <GameCard cardId={g.id} count={g.cards.length} selected={cardId === g.id} stats={false} />
              </button>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
