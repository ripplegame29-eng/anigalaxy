"use client";

import { useState } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { CLASSES, ELEMENTS, RANKS } from "@/lib/cards/config";
import { skillDef, skillPool, slotsOf, type Skill, type SkillFx } from "@/lib/cards/skills";
import { act, type InvCard } from "@/lib/cards/client";
import { GameCard } from "./GameCard";
import { Portal, toast, useBusy } from "./common";
import { ELEMENT_ICON, Ico, type IcoName } from "./icons";

export const FX_ICON: Record<SkillFx, IcoName> = {
  slash: "sword",
  whirl: "swords",
  pierce: "sword",
  burst: "fire",
  rain: "water",
  debuff: "skull",
  fire: "fire",
  drain: "heart",
  heal: "heart",
  shield: "shield",
  buff: "bolt",
  poison: "skull",
  quake: "earth",
  taunt: "shield",
  ice: "water",
  wind: "wind",
  earth: "earth",
  beam: "light",
  dark: "dark",
};

export const SkillGlyph = ({ fx, size = 18 }: { fx: SkillFx; size?: number }) => <Ico name={FX_ICON[fx]} size={size} />;

/** Компактные «пилюли» умений под картой */
export function SkillChips({ ids }: { ids: string[] }) {
  return (
    <span className="sk-chips">
      {ids.map((id) => {
        const s = skillDef(id);
        return s ? (
          <span key={id} className={`sk-chip fx-c-${s.fx}`} title={`${s.name}: ${s.desc}`}>
            <SkillGlyph fx={s.fx} size={13} />
            {s.name}
          </span>
        ) : null;
      })}
    </span>
  );
}

function SkillRow({ s, index, children }: { s: Skill; index?: number; children?: React.ReactNode }) {
  return (
    <div className={`sk-row fx-c-${s.fx}`}>
      {index !== undefined && <b className="sk-n">{index + 1}</b>}
      <span className="sk-ico">
        <SkillGlyph fx={s.fx} size={20} />
      </span>
      <span className="sk-txt">
        <b>{s.name}</b>
        <small>{s.desc}</small>
      </span>
      <span className="sk-cd" title="Перезарядка">
        <Ico name="clock" size={13} /> {s.cd}
      </span>
      {children}
    </div>
  );
}

/** Редактор умений героя: выбор, порядок (приоритет) и сохранение */
export function SkillEditor({ card, onClose }: { card: InvCard; onClose: () => void }) {
  const def = cardDef(card.cardId);
  const [sel, setSel] = useState<string[]>(card.skills);
  const [busy, run] = useBusy();
  if (!def) return null;
  const slots = slotsOf(def.rank);
  const pool = skillPool(def.cls, def.element);
  const groups: { title: string; list: Skill[] }[] = [
    { title: `Класс «${CLASSES[def.cls].name}»`, list: pool.filter((s) => s.cls) },
    { title: `Стихия «${ELEMENTS[def.element].name}»`, list: pool.filter((s) => s.el) },
  ];
  const move = (i: number, d: number) =>
    setSel((p) => {
      const n = [...p];
      const j = i + d;
      if (j < 0 || j >= n.length) return p;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const toggle = (id: string) => setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= slots ? p : [...p, id]));
  const same = sel.length === card.skills.length && sel.every((x, i) => x === card.skills[i]);
  const save = () =>
    run(async () => {
      const r = await act("skills", { id: card.id, skills: sel });
      if (!r.ok) return toast(r.error, true);
      toast("Умения сохранены");
      onClose();
    });

  return (
    <Portal>
    <div className="cg-modal" role="dialog" aria-modal="true" aria-label={`Умения: ${def.name}`} onClick={onClose}>
      <div className="sk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sk-head">
          <div className="sk-card">
            <GameCard cardId={card.cardId} foil={card.foil} level={card.level} stats={false} />
          </div>
          <div className="sk-info">
            <span className="cg-tag" style={{ color: RANKS[def.rank].color }}>
              {RANKS[def.rank].name}
            </span>
            <h2 className="cg-h2">{def.name}</h2>
            <p className="cg-hint" style={{ margin: 0 }}>
              {CLASSES[def.cls].name} · <Ico name={ELEMENT_ICON[def.element]} size={14} /> {ELEMENTS[def.element].name}
            </p>
            <p className="cg-hint" style={{ margin: "6px 0 0" }}>
              Слотов умений: <b>{slots}</b>. Порядок важен: в свой ход герой применяет первое готовое умение, иначе бьёт обычной атакой.
            </p>
          </div>
        </div>

        <h3 className="sk-h">
          Выбрано {sel.length}/{slots}
        </h3>
        <div className="sk-list">
          {sel.map((id, i) => {
            const s = skillDef(id);
            return s ? (
              <SkillRow key={id} s={s} index={i}>
                <span className="sk-ctl">
                  <button type="button" className="cg-btn sm" aria-label="Выше" disabled={i === 0} onClick={() => move(i, -1)}>
                    <Ico name="down" size={14} style={{ transform: "rotate(180deg)" }} />
                  </button>
                  <button type="button" className="cg-btn sm" aria-label="Ниже" disabled={i === sel.length - 1} onClick={() => move(i, 1)}>
                    <Ico name="down" size={14} />
                  </button>
                  <button type="button" className="cg-btn sm danger" aria-label="Убрать" onClick={() => toggle(id)}>
                    <Ico name="close" size={14} />
                  </button>
                </span>
              </SkillRow>
            ) : null;
          })}
          {sel.length === 0 && <div className="cg-empty">Выберите умение из списка ниже</div>}
        </div>

        {groups.map((g) => (
          <div key={g.title}>
            <h3 className="sk-h">{g.title}</h3>
            <div className="sk-list">
              {g.list.map((s) => {
                const on = sel.includes(s.id);
                return (
                  <button key={s.id} type="button" className="sk-pick" aria-pressed={on} disabled={!on && sel.length >= slots} onClick={() => toggle(s.id)}>
                    <SkillRow s={s}>
                      <span className="sk-state">{on ? <Ico name="check" size={16} /> : <Ico name="plus" size={16} />}</span>
                    </SkillRow>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="cg-row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="cg-btn" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="cg-btn pri" disabled={busy || same || sel.length === 0} onClick={() => void save()}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
