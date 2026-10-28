"use client";

import { cardDef } from "@/lib/cards/catalog";
import { CLASSES, ELEMENTS, FOIL_BONUS, LEVEL_BONUS, RANKS } from "@/lib/cards/config";
import { ULTIMATES, defaultLoadout, skillDef } from "@/lib/cards/skills";
import type { InvCard } from "@/lib/cards/client";
import { GameCard } from "./GameCard";
import { Portal } from "./common";
import { ELEMENT_ICON, Ico } from "./icons";
import { SkillChips } from "./skillui";

const mulOf = (c?: InvCard) => (c ? 1 + LEVEL_BONUS * (c.level - 1) + (c.foil ? FOIL_BONUS : 0) : 1);

/** Сравнение двух героев: характеристики с учётом лучшей копии игрока, умения, ультимейт */
export function CompareModal({ ids, best, onClose }: { ids: [string, string]; best: Map<string, InvCard>; onClose: () => void }) {
  const defs = ids.map((id) => cardDef(id));
  if (!defs[0] || !defs[1]) return null;
  const [a, b] = defs as [NonNullable<(typeof defs)[0]>, NonNullable<(typeof defs)[0]>];
  const ma = mulOf(best.get(a.id));
  const mb = mulOf(best.get(b.id));
  const rows: { k: string; label: string; va: number; vb: number }[] = [
    { k: "atk", label: "Атака", va: Math.round(a.atk * ma), vb: Math.round(b.atk * mb) },
    { k: "def", label: "Защита", va: Math.round(a.def * ma), vb: Math.round(b.def * mb) },
    { k: "hp", label: "Здоровье", va: Math.round(a.hp * ma), vb: Math.round(b.hp * mb) },
    { k: "spd", label: "Скорость", va: a.spd, vb: b.spd },
  ];
  const total = (d: typeof a, m: number) => Math.round((d.atk * 1 + d.def * 0.8 + d.hp * 0.15 + d.spd * 2) * m);
  const sa = total(a, ma);
  const sb = total(b, mb);
  const head = (d: typeof a, id: string) => (
    <div className="cmp-h">
      <div className="cmp-card">
        <GameCard cardId={id} foil={best.get(id)?.foil} level={best.get(id)?.level ?? 1} stats={false} live />
      </div>
      <b>{d.name}</b>
      <small>
        <span style={{ color: RANKS[d.rank].color }}>{RANKS[d.rank].name}</span> · {CLASSES[d.cls].name} · <Ico name={ELEMENT_ICON[d.element]} size={13} /> {ELEMENTS[d.element].name}
      </small>
      <small>{d.series}</small>
    </div>
  );
  const sk = (d: typeof a, id: string) => best.get(id)?.skills ?? defaultLoadout(d.cls, d.element, d.rank);
  return (
    <Portal>
      <div className="cg-modal" role="dialog" aria-modal="true" aria-label="Сравнение героев" onClick={onClose}>
        <div className="cmp-modal" onClick={(e) => e.stopPropagation()}>
          <h2 className="cg-h2">Сравнение героев</h2>
          <div className="cmp-grid">
            {head(a, a.id)}
            <div className="cmp-mid">
              {rows.map((r) => {
                const max = Math.max(r.va, r.vb) || 1;
                return (
                  <div key={r.k} className="cmp-row">
                    <span className={r.va > r.vb ? "win" : r.va < r.vb ? "lose" : ""}>{r.va}</span>
                    <div className="cmp-bars">
                      <i className={r.va >= r.vb ? "win" : ""} style={{ width: `${(r.va / max) * 100}%` }} />
                      <em>{r.label}</em>
                      <i className={r.vb >= r.va ? "win" : ""} style={{ width: `${(r.vb / max) * 100}%` }} />
                    </div>
                    <span className={r.vb > r.va ? "win" : r.vb < r.va ? "lose" : ""}>{r.vb}</span>
                  </div>
                );
              })}
              <div className="cmp-row total">
                <span className={sa > sb ? "win" : sa < sb ? "lose" : ""}>{sa}</span>
                <em>Общая сила</em>
                <span className={sb > sa ? "win" : sb < sa ? "lose" : ""}>{sb}</span>
              </div>
            </div>
            {head(b, b.id)}
          </div>
          <div className="cmp-sk">
            {[a, b].map((d) => (
              <div key={d.id}>
                <SkillChips ids={sk(d, d.id)} />
                <p className="cg-hint" style={{ margin: "6px 0 0" }}>
                  Ультимейт: <b>{ULTIMATES[d.cls].name}</b>
                  {sk(d, d.id).some((s) => !skillDef(s)) ? "" : ""}
                </p>
              </div>
            ))}
          </div>
          <div className="cg-row" style={{ justifyContent: "flex-end", marginTop: 14 }}>
            <button type="button" className="cg-btn pri" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
