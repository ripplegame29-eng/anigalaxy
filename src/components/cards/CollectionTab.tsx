"use client";

import { useEffect, useMemo, useState } from "react";
import { cardDef, visibleCatalog } from "@/lib/cards/catalog";
import { CLASSES, DUST_VALUE, ELEMENTS, RANKS, type CardClass, type Element } from "@/lib/cards/config";
import { act, view, type CardsState, type InvCard } from "@/lib/cards/client";
import { GameCard } from "./GameCard";
import { Panel, RankFilter, fmt, toast, useBusy } from "./common";
import { ELEMENT_ICON, Ico } from "./icons";
import { SkillChips, SkillEditor } from "./skillui";
import { CompareModal } from "./compare";
import { CardViewer } from "./CardViewer";
import { TabHero } from "./TabHero";

type Own = "all" | "have" | "miss";

export function CollectionTab({ s }: { s: CardsState }) {
  const [rank, setRank] = useState(-1);
  const [own, setOwn] = useState<Own>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [copy, setCopy] = useState<number | null>(null);
  const [editing, setEditing] = useState<InvCard | null>(null);
  const [cls, setCls] = useState<CardClass | "">("");
  const [el, setEl] = useState<Element | "">("");
  const [sort, setSort] = useState<"rank" | "name" | "power">("rank");
  const [cmpMode, setCmpMode] = useState(false);
  const [cmp, setCmp] = useState<string[]>([]);
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
  const inv = s.inventory;
  const heroCount = byCard.size;
  const total = CATALOG.length;
  const foilCount = inv.filter((c) => c.foil).length;
  const dist = RANKS.map((r) => [...byCard.keys()].filter((id) => cardDef(id)?.rank === r.id).length);
  const topCount = dist[3] + dist[4];
  const needle = q.trim().toLowerCase();
  const best = useMemo(() => {
    const m = new Map<string, InvCard>();
    for (const [id, cs] of byCard) m.set(id, [...cs].sort((a, b) => Number(b.foil) - Number(a.foil) || b.level - a.level)[0]);
    return m;
  }, [byCard]);
  const power = (id: string) => {
    const d = cardDef(id)!;
    return d.atk + d.def * 0.8 + d.hp * 0.15 + d.spd * 2;
  };
  const filtered = CATALOG.filter((c) => (!cls || c.cls === cls) && (!el || c.element === el)).filter((c) => (rank < 0 || c.rank === rank) && (own === "all" || (own === "have") === byCard.has(c.id)) && (!needle || c.name.toLowerCase().includes(needle) || c.series.toLowerCase().includes(needle) || c.search.toLowerCase().includes(needle)));
  const list = sort === "rank" ? filtered : [...filtered].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name, "ru") : power(b.id) - power(a.id)));
  const copies = open ? (byCard.get(open) ?? []).slice().sort((a, b) => Number(b.foil) - Number(a.foil) || b.level - a.level) : [];
  const def = open ? cardDef(open) : null;
  const current = copies.find((c) => c.id === copy) ?? copies[0];
  const navIds = (() => {
    const a = list.filter((c) => byCard.has(c.id)).map((c) => c.id);
    return open && !a.includes(open) ? [...a, open] : a;
  })();

  return (
    <div className="cg-hx" style={{ display: "grid", gap: 16 }}>
      <TabHero
        eyebrow="Ваш архив"
        title="Коллекция героев"
        text="Все ваши карты в одном месте: фильтруйте по рангу, классу и стихии, сравнивайте героев, открывайте умения и копии."
        badges={[
          { icon: "grid", text: `Открыто ${heroCount} из ${total} героев`, hot: true },
          { icon: "dust", text: `Фольга: ${foilCount}` },
        ]}
        kpi={[
          { icon: "grid", value: fmt(inv.length), label: "карт в коллекции" },
          { icon: "user", value: fmt(heroCount), label: "разных героев" },
          { icon: "crown", value: fmt(topCount), label: "ранга S и SS" },
          { icon: "star", value: `${Math.round((heroCount / Math.max(1, total)) * 100)}%`, label: "альбом заполнен" },
        ]}
        extra={
          <div className="hx-dist" role="img" aria-label="Распределение карт по рангам">
            <div className="hx-dist-bar">
              {RANKS.map((r) => (
                <i key={r.id} style={{ flexGrow: Math.max(0, dist[r.id]), background: r.color }} title={`${r.name}: ${dist[r.id]}`} />
              ))}
            </div>
            <div className="hx-dist-lg">
              {RANKS.map((r) => (
                <span key={r.id} style={{ ["--c" as string]: r.color }}>
                  <i /> {r.short} · {dist[r.id]}
                </span>
              ))}
            </div>
          </div>
        }
      />
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
        <div className="cg-row" style={{ margin: "10px 0 12px", gap: 8 }}>
          <div className="cg-filter" style={{ margin: 0 }} role="group" aria-label="Класс">
            <button type="button" aria-pressed={!cls} onClick={() => setCls("")}>
              Все классы
            </button>
            {(Object.keys(CLASSES) as CardClass[]).map((c) => (
              <button key={c} type="button" aria-pressed={cls === c} onClick={() => setCls(cls === c ? "" : c)}>
                {CLASSES[c].name}
              </button>
            ))}
          </div>
          <div className="cg-filter" style={{ margin: 0 }} role="group" aria-label="Стихия">
            <button type="button" aria-pressed={!el} onClick={() => setEl("")}>
              Все стихии
            </button>
            {(Object.keys(ELEMENTS) as Element[]).map((e) => (
              <button key={e} type="button" aria-pressed={el === e} onClick={() => setEl(el === e ? "" : e)} aria-label={ELEMENTS[e].name} title={ELEMENTS[e].name}>
                <Ico name={ELEMENT_ICON[e]} size={15} />
              </button>
            ))}
          </div>
          <div className="cg-filter" style={{ margin: 0 }} role="group" aria-label="Сортировка">
            {(
              [
                ["rank", "По рангу"],
                ["power", "По силе"],
                ["name", "По имени"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={sort === id} onClick={() => setSort(id)}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" className={`cg-btn sm ${cmpMode ? "pri" : ""}`} onClick={() => { setCmpMode((v) => !v); setCmp([]); }}>
            <Ico name="swap" size={14} /> {cmpMode ? `Сравнение: выберите ${2 - cmp.length}` : "Сравнить героев"}
          </button>
        </div>
        <div className="cg-album">
          {list.map((c) => {
            const mine = byCard.get(c.id);
            return (
              <button key={c.id} type="button" className="cg-cell" onClick={() => {
                if (cmpMode) return setCmp((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : p.length >= 2 ? p : [...p, c.id]));
                if (mine) { setCopy(null); setOpen(c.id); }
              }} aria-label={mine ? c.name : "Не открыта"} aria-pressed={cmpMode ? cmp.includes(c.id) : undefined} style={{ cursor: mine || cmpMode ? "pointer" : "default" }}>
                <GameCard cardId={c.id} selected={cmpMode && cmp.includes(c.id)} unknown={!mine} count={mine?.length} foil={mine?.some((x) => x.foil)} level={mine ? Math.max(...mine.map((x) => x.level)) : 1} stats={false} />
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
        <CardViewer
          ids={navIds}
          index={Math.max(0, navIds.indexOf(open))}
          onIndex={(i) => {
            setCopy(null);
            setOpen(navIds[i]);
          }}
          onClose={() => setOpen(null)}
          card={current}
          owned={copies.length > 0}
        >
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
          {copies.length > 1 && (
            <div>
              <h3 className="sk-h">Копии: {copies.length}</h3>
              <div className="cd-copies">
                {copies.map((c) => (
                  <button key={c.id} type="button" className="cg-cell" aria-pressed={current?.id === c.id} onClick={() => setCopy(c.id)} aria-label={`Копия, уровень ${c.level}`}>
                    <GameCard cardId={c.cardId} foil={c.foil} level={c.level} evo={c.evo} locked={c.locked} stats={false} selected={current?.id === c.id} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardViewer>
      )}
      {cmp.length === 2 && <CompareModal ids={[cmp[0], cmp[1]]} best={best} onClose={() => { setCmp([]); setCmpMode(false); }} />}
      {editing && <SkillEditor key={editing.id} card={s.inventory.find((c) => c.id === editing.id) ?? editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
