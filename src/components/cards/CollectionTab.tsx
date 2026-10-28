"use client";

import { useEffect, useMemo, useState } from "react";
import { cardDef, visibleCatalog } from "@/lib/cards/catalog";
import { CLASSES, DUST_VALUE, ELEMENTS, RANKS } from "@/lib/cards/config";
import { act, view, type CardsState, type InvCard } from "@/lib/cards/client";
import { GameCard } from "./GameCard";
import { Panel, Portal, RankFilter, fmt, toast, useBusy } from "./common";
import { ELEMENT_ICON, Ico } from "./icons";
import { SkillChips, SkillEditor } from "./skillui";

type Own = "all" | "have" | "miss";

export function CollectionTab({ s }: { s: CardsState }) {
  const [rank, setRank] = useState(-1);
  const [own, setOwn] = useState<Own>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [copy, setCopy] = useState<number | null>(null);
  const [editing, setEditing] = useState<InvCard | null>(null);
  const [history, setHistory] = useState<{ id: number; text: string; at: number }[]>([]);
  const [busy, run] = useBusy();

  useEffect(() => {
    let alive = true;
    void view<typeof history>("history").then((r) => alive && r.ok && setHistory(r.data));
    return () => {
      alive = false;
    };
  }, [s.inventory.length, s.wallet.dust]);

  const byCard = useMemo(() => {
    const m = new Map<string, InvCard[]>();
    for (const c of s.inventory) m.set(c.cardId, [...(m.get(c.cardId) ?? []), c]);
    return m;
  }, [s.inventory]);
  const CATALOG = useMemo(() => visibleCatalog(new Set(byCard.keys())), [byCard]);
  const have = CATALOG.filter((c) => byCard.has(c.id)).length;
  const needle = q.trim().toLowerCase();
  const list = CATALOG.filter((c) => (rank < 0 || c.rank === rank) && (own === "all" || (own === "have") === byCard.has(c.id)) && (!needle || c.name.toLowerCase().includes(needle) || c.series.toLowerCase().includes(needle) || c.search.toLowerCase().includes(needle)));
  const copies = open ? (byCard.get(open) ?? []).slice().sort((a, b) => Number(b.foil) - Number(a.foil) || b.level - a.level) : [];
  const def = open ? cardDef(open) : null;
  const current = copies.find((c) => c.id === copy) ?? copies[0];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel
        title="Альбом"
        right={
          <span className="cg-chip">
            {have} / {CATALOG.length} собрано
          </span>
        }
      >
        <div className="cg-bar" style={{ marginBottom: 12 }}>
          <i style={{ width: `${(have / CATALOG.length) * 100}%` }} />
        </div>
        <div className="cg-row" style={{ marginBottom: 10 }}>
          <input className="cg-input" placeholder="Поиск по имени или аниме" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: "1 1 220px" }} />
          <div className="cg-filter" style={{ margin: 0 }}>
            {(
              [
                ["all", "Все"],
                ["have", "Есть"],
                ["miss", "Нет"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={own === id} onClick={() => setOwn(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <RankFilter value={rank} onChange={setRank} />
        <div className="cg-album">
          {list.map((c) => {
            const mine = byCard.get(c.id);
            return (
              <button key={c.id} type="button" className="cg-cell" onClick={() => { if (mine) { setCopy(null); setOpen(c.id); } }} aria-label={mine ? c.name : "Не открыта"} style={{ cursor: mine ? "pointer" : "default" }}>
                <GameCard cardId={c.id} unknown={!mine} count={mine?.length} foil={mine?.some((x) => x.foil)} level={mine ? Math.max(...mine.map((x) => x.level)) : 1} stats={false} />
              </button>
            );
          })}
        </div>
        {list.length === 0 && <div className="cg-empty">Ничего не найдено</div>}
      </Panel>

      <Panel title="История">
        {history.length === 0 ? (
          <div className="cg-empty">Здесь появятся ваши паки, бои и сделки</div>
        ) : (
          <ul className="cg-list">
            {history.slice(0, 25).map((h) => (
              <li key={h.id}>
                <span>{h.text}</span>
                <span>{new Date(h.at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {open && def && (
        <Portal>
        <div className="cg-modal" role="dialog" aria-modal="true" aria-label={def.name} onClick={() => setOpen(null)}>
          <div className="cd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cd-main">
              <div className="cd-big">{current && <GameCard key={current.id} cardId={current.cardId} foil={current.foil} level={current.level} locked={current.locked} stats={false} live />}</div>
              <div className="cd-info">
                <span className="cg-tag" style={{ color: RANKS[def.rank].color, justifySelf: "start" }}>
                  {RANKS[def.rank].name}
                </span>
                <h2 className="cg-h2">{def.name}</h2>
                <p className="cg-hint" style={{ margin: 0 }}>
                  {def.series} · {CLASSES[def.cls].name} · <Ico name={ELEMENT_ICON[def.element]} size={14} /> {ELEMENTS[def.element].name}
                </p>
                <div className="cd-stats">
                  <span><Ico name="sword" size={15} /> {def.atk}<small>атака</small></span>
                  <span><Ico name="shield" size={15} /> {def.def}<small>защита</small></span>
                  <span><Ico name="heart" size={15} /> {def.hp}<small>здоровье</small></span>
                  <span><Ico name="bolt" size={15} /> {def.spd}<small>скорость</small></span>
                </div>
                {current && (
                  <>
                    <h3 className="sk-h" style={{ margin: "6px 0 0" }}>Умения</h3>
                    <SkillChips ids={current.skills} />
                    <div className="cg-row">
                      <button type="button" className="cg-btn pri sm" onClick={() => setEditing(current)}>
                        <Ico name="scroll" size={14} /> Изменить умения
                      </button>
                      <button type="button" className="cg-btn sm" disabled={busy || current.listed} onClick={() => void run(async () => { const r = await act("lock", { id: current.id }); if (!r.ok) toast(r.error, true); })}>
                        {current.locked ? "Разблокировать" : "Заблокировать"}
                      </button>
                      <button
                        type="button"
                        className="cg-btn sm danger"
                        disabled={busy || current.locked || current.listed}
                        title={`В пыль: ~${fmt(Math.round(DUST_VALUE[def.rank] * (current.foil ? 2.5 : 1) * (1 + (current.level - 1) * 0.15)))}`}
                        onClick={() => void run(async () => { const r = await act<{ dust: number }>("dust", { ids: [current.id] }); if (r.ok) { toast(`+${r.result.dust} пыли`); if (copies.length === 1) setOpen(null); } else toast(r.error, true); })}
                      >
                        В пыль
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            {copies.length > 1 && (
              <div>
                <h3 className="sk-h">Копии: {copies.length}</h3>
                <div className="cd-copies">
                  {copies.map((c) => (
                    <button key={c.id} type="button" className="cg-cell" aria-pressed={current?.id === c.id} onClick={() => setCopy(c.id)} aria-label={`Копия, уровень ${c.level}`}>
                      <GameCard cardId={c.cardId} foil={c.foil} level={c.level} locked={c.locked} stats={false} selected={current?.id === c.id} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button type="button" className="cg-btn" onClick={() => setOpen(null)}>
              Закрыть
            </button>
          </div>
        </div>
        </Portal>
      )}
      {editing && <SkillEditor key={editing.id} card={s.inventory.find((c) => c.id === editing.id) ?? editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
