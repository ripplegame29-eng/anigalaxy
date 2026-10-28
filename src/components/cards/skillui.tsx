"use client";

import { useState } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { CLASSES, ELEMENTS, RANKS } from "@/lib/cards/config";
import { ENERGY, SKILL_LEVEL_BONUS, SKILL_MAX_LEVEL, ULTIMATES, passivesFor, PASSIVES, skillDef, skillPool, skillUpCost, slotsOf, type Skill, type SkillFx } from "@/lib/cards/skills";
import type { Synergy } from "@/lib/cards/synergy";
import { act, useCards, type InvCard } from "@/lib/cards/client";
import { GameCard } from "./GameCard";
import { Portal, fmt, toast, useBusy } from "./common";
import { Cur, ELEMENT_ICON, Ico, type IcoName } from "./icons";

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

/** Плашки активных синергий отряда */
export function SynChips({ list, right }: { list: Synergy[]; right?: boolean }) {
  if (!list.length) return <span />;
  return (
    <span className={`syn-chips ${right ? "r" : ""}`}>
      {list.map((s) => (
        <span key={s.id} className={`syn-chip t${s.tier} k-${s.kind}`} title={`${s.name}: ${s.desc}`}>
          <Ico name={s.kind === "element" ? "fire" : s.kind === "classes" ? "shield" : "swords"} size={13} />
          <b>{s.name}</b>
          <i>×{s.count}</i>
          <small>{s.desc}</small>
        </span>
      ))}
    </span>
  );
}

function SkillRow({ s, index, lv, children }: { s: Skill; index?: number; lv?: number; children?: React.ReactNode }) {
  return (
    <div className={`sk-row fx-c-${s.fx}`}>
      {index !== undefined && <b className="sk-n">{index + 1}</b>}
      <span className="sk-ico">
        <SkillGlyph fx={s.fx} size={20} />
      </span>
      <span className="sk-txt">
        <b>
          {s.name}
          {lv !== undefined && (
            <em className="sk-lv" title={`Уровень умения: сила +${Math.round((lv - 1) * SKILL_LEVEL_BONUS * 100)}%${lv >= SKILL_MAX_LEVEL ? ", перезарядка −1" : ""}`}>
              Ур. {lv}
              <span className="sk-pips" aria-hidden>
                {Array.from({ length: SKILL_MAX_LEVEL }).map((_, i) => (
                  <i key={i} className={i < lv ? "on" : ""} />
                ))}
              </span>
            </em>
          )}
        </b>
        <small>{s.desc}</small>
      </span>
      {s.cd > 0 ? (
        <span className="sk-cd" title="Перезарядка">
          <Ico name="clock" size={13} /> {lv !== undefined && lv >= SKILL_MAX_LEVEL && s.cd > 1 ? s.cd - 1 : s.cd}
        </span>
      ) : (
        <span />
      )}
      {children}
    </div>
  );
}

/** Редактор героя: умения (выбор, порядок, уровни), пассивка, ультимейт */
export function SkillEditor({ card, onClose }: { card: InvCard; onClose: () => void }) {
  const def = cardDef(card.cardId);
  const { state } = useCards();
  const [sel, setSel] = useState<string[]>(card.skills);
  const [pas, setPas] = useState<string>(card.passive);
  const [busy, run] = useBusy();
  if (!def) return null;
  const wallet = state?.wallet;
  const slots = slotsOf(def.rank);
  const pool = skillPool(def.cls, def.element);
  const ult = ULTIMATES[def.cls];
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
  const same = sel.length === card.skills.length && sel.every((x, i) => x === card.skills[i]) && pas === card.passive;
  const lvOf = (id: string) => card.skillLv[id] ?? 1;
  const save = () =>
    run(async () => {
      const r = await act("skills", { id: card.id, skills: sel, passive: pas });
      if (!r.ok) return toast(r.error, true);
      toast("Герой сохранён");
      onClose();
    });
  const levelUp = (id: string) =>
    run(async () => {
      const r = await act<{ level: number }>("skill-up", { id: card.id, skill: id });
      toast(r.ok ? `Умение прокачано до ${r.result.level} ур.` : r.error, !r.ok);
    });

  const UpBtn = ({ id }: { id: string }) => {
    const lv = lvOf(id);
    if (lv >= SKILL_MAX_LEVEL) return <span className="sk-max">MAX</span>;
    const c = skillUpCost(def.rank, lv);
    const lack = !wallet || wallet.dust < c.dust || (c.scroll > 0 && (wallet.scrolls[def.rank] ?? 0) < c.scroll);
    return (
      <button
        type="button"
        className="cg-btn sm sk-up"
        disabled={busy || lack}
        title={lack ? "Не хватает пыли или свитков" : "Прокачать умение"}
        onClick={(e) => {
          e.stopPropagation();
          void levelUp(id);
        }}
      >
        <Ico name="trend" size={13} /> {fmt(c.dust)} <Cur k="dust" />
        {c.scroll > 0 && (
          <>
            {" "}+ <Ico name="scroll" size={13} />
          </>
        )}
      </button>
    );
  };

  return (
    <Portal>
      <div className="cg-modal" role="dialog" aria-modal="true" aria-label={`Умения: ${def.name}`} onClick={onClose}>
        <div className="sk-modal" onClick={(e) => e.stopPropagation()}>
          <div className="sk-head">
            <div className="sk-card">
              <GameCard cardId={card.cardId} foil={card.foil} level={card.level} stats={false} live />
            </div>
            <div className="sk-info">
              <span className="cg-tag" style={{ color: RANKS[def.rank].color }}>
                {RANKS[def.rank].name}
              </span>
              <h2 className="cg-h2">{def.name}</h2>
              <p className="cg-hint" style={{ margin: 0 }}>
                {CLASSES[def.cls].name} · <Ico name={ELEMENT_ICON[def.element]} size={14} /> {ELEMENTS[def.element].name} · {def.series}
              </p>
              <p className="cg-hint" style={{ margin: "6px 0 0" }}>
                Слотов умений: <b>{slots}</b>. Порядок важен: в свой ход герой применяет первое готовое умение, иначе бьёт обычной атакой. Ультимейт срабатывает сам, когда шкала энергии заполнена.
              </p>
              {wallet && (
                <p className="cg-hint sk-bank" style={{ margin: "6px 0 0" }}>
                  <Cur k="dust" /> {fmt(wallet.dust)} · <Ico name="scroll" size={14} /> {wallet.scrolls[def.rank] ?? 0} ({RANKS[def.rank].name})
                </p>
              )}
            </div>
          </div>

          <h3 className="sk-h">
            Выбрано {sel.length}/{slots}
          </h3>
          <div className="sk-list">
            {sel.map((id, i) => {
              const s = skillDef(id);
              return s ? (
                <SkillRow key={id} s={s} index={i} lv={lvOf(id)}>
                  <span className="sk-ctl">
                    <UpBtn id={id} />
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
                  const off = !on && sel.length >= slots;
                  return (
                    <div
                      key={s.id}
                      className="sk-pick"
                      role="button"
                      tabIndex={off ? -1 : 0}
                      aria-pressed={on}
                      aria-disabled={off}
                      onClick={() => !off && toggle(s.id)}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && !off) {
                          e.preventDefault();
                          toggle(s.id);
                        }
                      }}
                    >
                      <SkillRow s={s} lv={lvOf(s.id)}>
                        <span className="sk-ctl">
                          <UpBtn id={s.id} />
                          <span className="sk-state">{on ? <Ico name="check" size={16} /> : <Ico name="plus" size={16} />}</span>
                        </span>
                      </SkillRow>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <h3 className="sk-h">Пассивка</h3>
          <div className="pas-grid">
            {PASSIVES.map((p) => {
              const locked = !passivesFor(def.rank).some((x) => x.id === p.id);
              return (
                <button key={p.id} type="button" className={`pas fx-c-${p.fx}`} aria-pressed={pas === p.id} disabled={locked} onClick={() => setPas(p.id)} title={locked ? `Нужен ранг ${RANKS[p.minRank].name}` : p.desc}>
                  <span className="sk-ico">{locked ? <Ico name="lock" size={18} /> : <SkillGlyph fx={p.fx} size={18} />}</span>
                  <b>{p.name}</b>
                  <small>{locked ? `с ранга «${RANKS[p.minRank].name}»` : p.desc}</small>
                </button>
              );
            })}
          </div>

          <h3 className="sk-h">Ультимейт класса</h3>
          <SkillRow s={{ ...ult, cd: 0 }}>
            <span className="sk-ult-meta" title="Шкала энергии">
              <Ico name="bolt" size={14} /> {ENERGY.max}
            </span>
          </SkillRow>
          <p className="cg-hint" style={{ margin: "6px 2px 0" }}>
            Энергия: +{ENERGY.perTurn} за ход и +{ENERGY.perHit} за каждый полученный удар. Когда шкала полна, герой применяет ультимейт вместо умения.
          </p>

          <div className="cg-row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
            <button type="button" className="cg-btn" onClick={onClose}>
              Закрыть
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
