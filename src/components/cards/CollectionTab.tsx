"use client";

import { useEffect, useMemo, useState } from "react";
import { CATALOG, cardDef } from "@/lib/cards/catalog";
import { DUST_VALUE, RANKS } from "@/lib/cards/config";
import { act, view, type CardsState, type InvCard } from "@/lib/cards/client";
import { GameCard } from "./GameCard";
import { Panel, RankFilter, fmt, toast, useBusy } from "./common";

type Own = "all" | "have" | "miss";

export function CollectionTab({ s }: { s: CardsState }) {
  const [rank, setRank] = useState(-1);
  const [own, setOwn] = useState<Own>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
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
  const have = CATALOG.filter((c) => byCard.has(c.id)).length;
  const needle = q.trim().toLowerCase();
  const list = CATALOG.filter((c) => (rank < 0 || c.rank === rank) && (own === "all" || (own === "have") === byCard.has(c.id)) && (!needle || c.name.toLowerCase().includes(needle) || c.series.toLowerCase().includes(needle) || c.search.toLowerCase().includes(needle)));
  const copies = open ? (byCard.get(open) ?? []).slice().sort((a, b) => Number(b.foil) - Number(a.foil) || b.level - a.level) : [];
  const def = open ? cardDef(open) : null;

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
              <button key={c.id} type="button" className="cg-cell" onClick={() => mine && setOpen(c.id)} aria-label={mine ? c.name : "Не открыта"} style={{ cursor: mine ? "pointer" : "default" }}>
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
        <div className="cg-modal" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ display: "grid", gap: 14 }}>
            <div className="cg-row" style={{ justifyContent: "space-between" }}>
              <b style={{ fontSize: 18 }}>{def.name}</b>
              <span className="cg-tag" style={{ color: RANKS[def.rank].color }}>
                {RANKS[def.rank].name}
              </span>
            </div>
            <p className="cg-hint" style={{ margin: 0 }}>
              {def.series} · сила {def.atk}/{def.def}/{def.hp} · скорость {def.spd}
            </p>
            <div className="cg-cards xs" style={{ ["--cg-w" as string]: "110px" }}>
              {copies.map((c) => (
                <div key={c.id} style={{ display: "grid", gap: 6 }}>
                  <GameCard cardId={c.cardId} foil={c.foil} level={c.level} locked={c.locked} stats={false} />
                  <div className="cg-row" style={{ gap: 4 }}>
                    <button type="button" className="cg-btn sm" disabled={busy || c.listed} onClick={() => void run(async () => { const r = await act("lock", { id: c.id }); if (!r.ok) toast(r.error, true); })}>
                      {c.locked ? "Разблок." : "Блок"}
                    </button>
                    <button
                      type="button"
                      className="cg-btn sm danger"
                      disabled={busy || c.locked || c.listed}
                      title={`В пыль: ~${fmt(Math.round(DUST_VALUE[def.rank] * (c.foil ? 2.5 : 1) * (1 + (c.level - 1) * 0.15)))}`}
                      onClick={() => void run(async () => { const r = await act<{ dust: number }>("dust", { ids: [c.id] }); if (r.ok) { toast(`+${r.result.dust} пыли`); if (copies.length === 1) setOpen(null); } else toast(r.error, true); })}
                    >
                      В пыль
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="cg-btn" onClick={() => setOpen(null)}>
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
