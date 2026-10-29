"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { CLASSES, ELEMENTS, RANKS, type CardClass, type Element } from "@/lib/cards/config";
import { ENERGY, SKILL_LEVEL_BONUS, SKILL_MAX_LEVEL, SKILL_SLOTS, ULTIMATES, PASSIVES, levelled, passivesFor, skillDef, skillPool, skillUpCost, slotsOf, type Skill, type SkillFx, type SkillTarget } from "@/lib/cards/skills";
import type { Synergy } from "@/lib/cards/synergy";
import { act, useCards, type InvCard } from "@/lib/cards/client";
import { GameCard } from "./GameCard";
import { Portal, fmt, toast, useBusy } from "./common";
import { Cur, ELEMENT_ICON, Ico, type IcoName } from "./icons";

/** Запасные иконки (оставлены для совместимости: используются в других местах интерфейса) */
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

/**
 * Собственные глифы умений (сетка 24×24). Метки: `f` — полупрозрачная заливка,
 * `a` — акцентный штрих (оживает при наведении / выборе / в бою).
 */
type GlyphPath = [d: string, mark?: "f" | "a"];
const GLYPH: Record<SkillFx, GlyphPath[]> = {
  slash: [["M4 20L19.5 4.5"], ["M9.5 21.5L21.5 9.5"], ["M2.5 14.5L14.5 2.5", "a"], ["M17 17l3.5 3.5M6.5 6.5L4 4", "a"]],
  whirl: [["M12 3a9 9 0 1 1-9 9"], ["M12 7.5a4.5 4.5 0 1 1-4.5 4.5", "a"], ["M3 12l-1.4-3.6M3 12l3.4-1.6"]],
  pierce: [["M12 2l3.2 6.5H8.8z", "f"], ["M12 2l3.2 6.5H8.8z"], ["M12 8.5V21"], ["M8 13h8", "a"]],
  burst: [["M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2z", "f"], ["M12 2v4M12 18v4M2 12h4M18 12h4"], ["M5 5l2.8 2.8M16.2 16.2L19 19M19 5l-2.8 2.8M7.8 16.2L5 19", "a"]],
  rain: [["M6 3.5L4 10.5M12 2l-2 9M18 3.5l-2 7"], ["M7 14.5l-1.2 4.5M13 14l-1.2 5.5M19 14.5l-1.2 4.5", "a"], ["M3 21.5h18", "a"]],
  debuff: [["M12 3v10"], ["M6.5 9l5.5 5.5L17.5 9"], ["M5 19.5h14", "a"], ["M8 22h8", "a"]],
  fire: [["M12 2.5c.6 3.6 5.5 5.4 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.2 1-3.7 2.2-4.8.1 1.8.9 2.8 2 3.2C10.4 7.6 10.4 5 12 2.5z", "f"], ["M12 2.5c.6 3.6 5.5 5.4 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.2 1-3.7 2.2-4.8.1 1.8.9 2.8 2 3.2C10.4 7.6 10.4 5 12 2.5z"], ["M12 21a2.8 2.8 0 0 0 2.8-2.8c0-1.6-1.4-2.4-2.8-4-1.4 1.6-2.8 2.4-2.8 4A2.8 2.8 0 0 0 12 21z", "a"]],
  drain: [["M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11z", "f"], ["M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11z"], ["M9.2 14.5a2.9 2.9 0 0 0 2.8 2.8", "a"]],
  heal: [["M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z", "f"], ["M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z"], ["M19 2.5v3M17.5 4h3", "a"]],
  shield: [["M12 2.5l8 3v6.2c0 4.8-3.3 8.1-8 9.8-4.7-1.7-8-5-8-9.8V5.5z", "f"], ["M12 2.5l8 3v6.2c0 4.8-3.3 8.1-8 9.8-4.7-1.7-8-5-8-9.8V5.5z"], ["M8.5 12l2.4 2.5 4.6-5", "a"]],
  buff: [["M12 3l6.5 7.5h-4V15h-5v-4.5h-4z", "f"], ["M12 3l6.5 7.5h-4V15h-5v-4.5h-4z"], ["M9.5 18.5h5M10.5 21.5h3", "a"]],
  poison: [["M9.5 3h5M10.5 3v6.2L5.4 18a2.2 2.2 0 0 0 1.9 3.3h9.4a2.2 2.2 0 0 0 1.9-3.3L13.5 9.2V3"], ["M7.2 16.5h9.6l1.2 2a1 1 0 0 1-.9 1.5H6.9a1 1 0 0 1-.9-1.5z", "f"], ["M10 13.2h.01M14 12h.01M12.4 9.8h.01", "a"]],
  quake: [["M2.5 18h19"], ["M12 18l-1.6-4.6 3-2.2L11.8 6"], ["M6 18l-2-3.2M18 18l2-3.6", "a"], ["M7 21h.01M12 21h.01M17 21h.01", "a"]],
  taunt: [["M4 9.5v5h3.5l8.5 4.5V5L7.5 9.5z", "f"], ["M4 9.5v5h3.5l8.5 4.5V5L7.5 9.5z"], ["M19 8.5a5 5 0 0 1 0 7", "a"], ["M21.2 6a8.5 8.5 0 0 1 0 12", "a"]],
  ice: [["M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6"], ["M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5", "a"]],
  wind: [["M3 8h11a3 3 0 1 0-3-3"], ["M3 12h16a3 3 0 1 1-3 3", "a"], ["M3 16h8a2.5 2.5 0 1 1-2.5 2.5"]],
  earth: [["M2.5 20.5l6-12 3.5 6 3-5 6.5 11z", "f"], ["M2.5 20.5l6-12 3.5 6 3-5 6.5 11z"], ["M8.5 8.5l1.3 2.4", "a"]],
  beam: [["M13.5 2L5 13.5h6L10 22l9-12h-6.5z", "f"], ["M13.5 2L5 13.5h6L10 22l9-12h-6.5z"], ["M19.5 3v2.6M18.2 4.3h2.6", "a"]],
  dark: [["M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a6.8 6.8 0 0 0 11 11z", "f"], ["M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a6.8 6.8 0 0 0 11 11z"], ["M16.5 4.5v3M15 6h3", "a"]],
};

export const SkillGlyph = ({ fx, size = 18 }: { fx: SkillFx; size?: number }) => (
  <svg className={`sk-g g-${fx}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {GLYPH[fx].map(([d, m], i) => (
      <path key={i} d={d} className={m === "a" ? "ga" : m === "f" ? "gf" : undefined} stroke={m === "f" ? "none" : undefined} />
    ))}
  </svg>
);

/* ---------------------------- вспомогательные данные ---------------------------- */

const ELEM_COL: Record<Element, string> = { fire: "#ff7a45", water: "#4db8ff", wind: "#6af0c0", earth: "#d09a52", light: "#ffe27a", dark: "#a07bff" };
const CLASS_COL: Record<CardClass, string> = { warrior: "#ff7a6a", mage: "#b88bff", tank: "#6ac8ff", assassin: "#ff5a96", support: "#5eeaa8" };
const CLASS_ICON: Record<CardClass, IcoName> = { warrior: "sword", mage: "dust", tank: "shield", assassin: "bolt", support: "heart" };
export const TARGET_LABEL: Record<SkillTarget, string> = { enemy: "Один враг", enemyLow: "Слабейший враг", enemies: "Все враги", ally: "Раненый союзник", allies: "Вся команда", self: "На себя" };
const TARGET_ICO: Record<SkillTarget, IcoName> = { enemy: "target", enemyLow: "target", enemies: "swords", ally: "heart", allies: "user", self: "shield" };
/** Ранг, с которого открывается слот №n */
const slotRank = (n: number): number => {
  for (let r = 0; r <= 4; r++) if (slotsOf(r) >= n) return r;
  return 4;
};
const MAX_SLOTS = Math.max(...Object.values(SKILL_SLOTS));

const kindVars = (s: Skill): CSSProperties => ({ ["--kc" as string]: s.el ? ELEM_COL[s.el] : s.cls ? CLASS_COL[s.cls] : "#9fb4ff" });
const pct = (v: number) => `${Math.round(v * 100)}%`;

interface Stat {
  k: string;
  ico: IcoName;
  text: string;
}

/** Главное число умения (крупно на плитке) */
function primary(s: Skill): { v: string; l: string } | null {
  if (s.power) return { v: pct(s.power), l: "урон" };
  if (s.heal) return { v: pct(s.heal), l: "лечение" };
  if (s.healPct) return { v: pct(s.healPct), l: "лечение" };
  if (s.shield) return { v: pct(s.shield), l: "щит" };
  if (s.shieldPct) return { v: pct(s.shieldPct), l: "щит" };
  if (s.burn) return { v: `3×${pct(s.burn)}`, l: "яд / ожог" };
  if (s.atkUp) return { v: `+${pct(s.atkUp)}`, l: "атака" };
  return null;
}

/** Все числа умения с учётом уровня */
function statsOf(s: Skill): Stat[] {
  const r: Stat[] = [];
  if (s.exec) r.push({ k: "exec", ico: "skull", text: `×${s.exec} по цели <35% HP` });
  if (s.drain) r.push({ k: "drain", ico: "heart", text: `Вампиризм ${pct(s.drain)}` });
  if (s.stun) r.push({ k: "stun", ico: "clock", text: `Оглушение ${s.stun} ход` });
  if (s.defDown) r.push({ k: "def", ico: "shield", text: `Защита −${pct(s.defDown)}` });
  if (s.atkUp && s.power) r.push({ k: "atk", ico: "bolt", text: `Атака +${pct(s.atkUp)}` });
  if (s.burn && s.power) r.push({ k: "burn", ico: "fire", text: `Ожог 3×${pct(s.burn)}` });
  if (s.taunt) r.push({ k: "taunt", ico: "ban", text: `Провокация ${s.taunt} р.` });
  if (s.shieldPct && s.taunt) r.push({ k: "sh", ico: "shield", text: `Щит ${pct(s.shieldPct)} HP` });
  if (s.healPct && s.atkUp) r.push({ k: "atk2", ico: "bolt", text: `Атака +${pct(s.atkUp)}` });
  return r;
}

/** Плитка-арт умения: рамка по уровню, глиф по эффекту, знак стихии/класса */
function SkillArt({ s, lv, size = "md" }: { s: Skill; lv?: number; size?: "sm" | "md" | "lg" }) {
  const px = size === "lg" ? 40 : size === "sm" ? 20 : 30;
  return (
    <span className={`sk-art sz-${size} fx-c-${s.fx} ${lv ? `lv${lv}` : ""}`} style={kindVars(s)}>
      <i className="sk-art-bg" aria-hidden />
      <i className="sk-art-ring" aria-hidden />
      <SkillGlyph fx={s.fx} size={px} />
      {s.el ? (
        <em className="sk-art-k" title={ELEMENTS[s.el].name}>
          <Ico name={ELEMENT_ICON[s.el]} size={10} />
        </em>
      ) : s.cls ? (
        <em className="sk-art-k" title={CLASSES[s.cls].name}>
          <Ico name={CLASS_ICON[s.cls]} size={10} />
        </em>
      ) : null}
      {lv ? <b className="sk-art-lv">{lv}</b> : null}
    </span>
  );
}

function Pips({ lv }: { lv: number }) {
  return (
    <span className="sk-pips" aria-hidden>
      {Array.from({ length: SKILL_MAX_LEVEL }).map((_, i) => (
        <i key={i} className={i < lv ? "on" : ""} />
      ))}
    </span>
  );
}

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

/** Редактор героя: умения (выбор, порядок, уровни), пассивка, ультимейт */
export function SkillEditor({ card, onClose }: { card: InvCard; onClose: () => void }) {
  const def = cardDef(card.cardId);
  const { state } = useCards();
  const [sel, setSel] = useState<string[]>(card.skills);
  const [pas, setPas] = useState<string>(card.passive);
  const [tab, setTab] = useState<"cls" | "el">("cls");
  const [ups, setUps] = useState<Record<string, number>>({});
  const [busy, run] = useBusy();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);
  if (!def) return null;
  const wallet = state?.wallet;
  const slots = slotsOf(def.rank);
  const pool = skillPool(def.cls, def.element);
  const ult = ULTIMATES[def.cls];
  const clsCol = CLASS_COL[def.cls];
  const elCol = ELEM_COL[def.element];
  const groups = {
    cls: { title: `Класс «${CLASSES[def.cls].name}»`, short: CLASSES[def.cls].name, list: pool.filter((s) => s.cls), ico: CLASS_ICON[def.cls] },
    el: { title: `Стихия «${ELEMENTS[def.element].name}»`, short: ELEMENTS[def.element].name, list: pool.filter((s) => s.el), ico: ELEMENT_ICON[def.element] },
  };
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
      if (r.ok) {
        const n = Date.now();
        setUps((p) => ({ ...p, [id]: n }));
        timers.current.push(setTimeout(() => setUps((p) => (p[id] === n ? Object.fromEntries(Object.entries(p).filter(([k]) => k !== id)) : p)), 1500));
      }
    });

  const UpBtn = ({ id }: { id: string }) => {
    const lv = lvOf(id);
    if (lv >= SKILL_MAX_LEVEL) return <span className="sk-max">MAX</span>;
    const c = skillUpCost(def.rank, lv);
    const lack = !wallet || wallet.dust < c.dust || (c.scroll > 0 && (wallet.scrolls[def.rank] ?? 0) < c.scroll);
    return (
      <button
        type="button"
        className={`cg-btn sm sk-up ${lack ? "lack" : ""}`}
        disabled={busy || lack}
        title={lack ? "Не хватает пыли или свитков" : `Прокачать до ${lv + 1} ур.`}
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

  /** Эффект прокачки: кольца и искры вокруг плитки */
  const LvFx = ({ id }: { id: string }) =>
    ups[id] ? (
      <span key={ups[id]} className="sk-lvfx" aria-hidden>
        <i />
        <i />
        {Array.from({ length: 8 }).map((_, k) => (
          <u key={k} style={{ ["--a" as string]: `${k * 45}deg` }} />
        ))}
        <b>Ур. {lvOf(id)}</b>
      </span>
    ) : null;

  const Cd = ({ s, lv }: { s: Skill; lv: number }) => {
    const l = levelled(s, lv);
    return s.cd > 0 ? (
      <span className="sk-cd" title="Перезарядка в ходах героя">
        <Ico name="clock" size={12} /> {l.cd} {l.cd < s.cd ? <s>{s.cd}</s> : null}
      </span>
    ) : null;
  };

  const lvTitle = (lv: number) => `Уровень умения: сила +${Math.round((lv - 1) * SKILL_LEVEL_BONUS * 100)}%${lv >= SKILL_MAX_LEVEL ? ", перезарядка −1" : ""}`;
  const slotList = Array.from({ length: MAX_SLOTS }, (_, i) => i);
  const activeGroup = groups[tab];
  const selHere = (k: "cls" | "el") => groups[k].list.filter((s) => sel.includes(s.id)).length;
  const pasSel = PASSIVES.find((p) => p.id === pas);

  return (
    <Portal>
      <div className="cg-modal" role="dialog" aria-modal="true" aria-label={`Умения: ${def.name}`} onClick={onClose}>
        <div className="sk-modal" style={{ ["--cc" as string]: clsCol, ["--ec" as string]: elCol }} onClick={(e) => e.stopPropagation()}>
          <div className="sk-body">
            <div className="sk-head">
              <div className="sk-card">
                <GameCard cardId={card.cardId} foil={card.foil} level={card.level} stats={false} live />
              </div>
              <div className="sk-info">
                <span className="cg-tag" style={{ color: RANKS[def.rank].color }}>
                  {RANKS[def.rank].name}
                </span>
                <h2 className="cg-h2">{def.name}</h2>
                <p className="sk-sub">
                  <span className="sk-kind" style={{ ["--kc" as string]: clsCol }}>
                    <Ico name={CLASS_ICON[def.cls]} size={13} /> {CLASSES[def.cls].name}
                  </span>
                  <span className="sk-kind" style={{ ["--kc" as string]: elCol }}>
                    <Ico name={ELEMENT_ICON[def.element]} size={13} /> {ELEMENTS[def.element].name}
                  </span>
                  <span className="sk-series">{def.series}</span>
                </p>
                <p className="cg-hint sk-rule">
                  Слотов умений: <b>{slots}</b>. Порядок важен: в свой ход герой применяет первое готовое умение слева направо, иначе бьёт обычной атакой. Ультимейт срабатывает сам, когда шкала энергии заполнена.
                </p>
                {wallet && (
                  <p className="cg-hint sk-bank">
                    <span>
                      <Cur k="dust" /> {fmt(wallet.dust)}
                    </span>
                    <span>
                      <Ico name="scroll" size={14} /> {wallet.scrolls[def.rank] ?? 0} <small>({RANKS[def.rank].name})</small>
                    </span>
                  </p>
                )}
              </div>
            </div>

            <h3 className="sk-h">
              <span>Боевой порядок</span>
              <em>
                {sel.length}/{slots}
              </em>
            </h3>
            <div className="sk-slots" style={{ ["--n" as string]: MAX_SLOTS }}>
              {slotList.map((i) => {
                const id = sel[i];
                const s = id ? skillDef(id) : undefined;
                const locked = i >= slots;
                if (locked) {
                  return (
                    <div key={`l${i}`} className="sk-slot locked">
                      <b className="sk-slot-n">{i + 1}</b>
                      <span className="sk-slot-lock">
                        <Ico name="lock" size={20} />
                      </span>
                      <span className="sk-slot-t">
                        <b>Слот закрыт</b>
                        <small>Откроется на ранге «{RANKS[slotRank(i + 1)].name}»</small>
                      </span>
                    </div>
                  );
                }
                if (!s) {
                  return (
                    <div key={`e${i}`} className="sk-slot empty">
                      <b className="sk-slot-n">{i + 1}</b>
                      <span className="sk-slot-plus">
                        <Ico name="plus" size={20} />
                      </span>
                      <span className="sk-slot-t">
                        <b>Пустой слот</b>
                        <small>Выберите умение ниже</small>
                      </span>
                    </div>
                  );
                }
                const lv = lvOf(s.id);
                const pr = primary(levelled(s, lv));
                return (
                  <div key={s.id} className={`sk-slot filled fx-c-${s.fx} ${ups[s.id] ? "lvup" : ""}`} style={kindVars(s)}>
                    <b className="sk-slot-n" title="Приоритет: чем меньше номер, тем раньше применяется">
                      {i + 1}
                    </b>
                    <div className="sk-slot-top">
                      <span className="sk-art-wrap">
                        <SkillArt s={s} lv={lv} size="lg" />
                        <LvFx id={s.id} />
                      </span>
                      <span className="sk-slot-t">
                        <b>{s.name}</b>
                        <span className="sk-meta">
                          <span className="sk-lv" title={lvTitle(lv)}>
                            Ур. {lv}
                            <Pips lv={lv} />
                          </span>
                          <Cd s={s} lv={lv} />
                        </span>
                        {pr && (
                          <span className="sk-pri">
                            <strong>{pr.v}</strong> {pr.l}
                          </span>
                        )}
                      </span>
                    </div>
                    <span className="sk-ctl">
                      <UpBtn id={s.id} />
                      <span className="sk-mv">
                        <button type="button" className="cg-btn sm" aria-label="Выше" disabled={i === 0} onClick={() => move(i, -1)}>
                          <Ico name="down" size={14} className="mv-prev" />
                        </button>
                        <button type="button" className="cg-btn sm" aria-label="Ниже" disabled={i === sel.length - 1} onClick={() => move(i, 1)}>
                          <Ico name="down" size={14} className="mv-next" />
                        </button>
                        <button type="button" className="cg-btn sm danger" aria-label="Убрать" onClick={() => toggle(s.id)}>
                          <Ico name="close" size={14} />
                        </button>
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>

            <h3 className="sk-h">
              <span>Умения</span>
              <em>коснитесь, чтобы поставить в слот</em>
            </h3>
            <div className="sk-tabs" role="tablist" aria-label="Источник умений">
              {(["cls", "el"] as const).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} className={`sk-tab ${k}`} onClick={() => setTab(k)}>
                  <Ico name={groups[k].ico} size={15} />
                  <span>{groups[k].title}</span>
                  {selHere(k) > 0 && <b>{selHere(k)}</b>}
                </button>
              ))}
            </div>
            <div className="sk-grid" key={tab}>
              {activeGroup.list.map((s) => {
                const on = sel.includes(s.id);
                const off = !on && sel.length >= slots;
                const lv = lvOf(s.id);
                const ls = levelled(s, lv);
                const pr = primary(ls);
                const idx = sel.indexOf(s.id);
                return (
                  <div
                    key={s.id}
                    className={`sk-pick fx-c-${s.fx} ${on ? "on" : ""} ${off ? "off" : ""} ${ups[s.id] ? "lvup" : ""}`}
                    style={kindVars(s)}
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
                    <span className="sk-art-wrap">
                      <SkillArt s={s} lv={lv} />
                      <LvFx id={s.id} />
                    </span>
                    <span className="sk-pick-t">
                      <span className="sk-pick-name">
                        <b>{s.name}</b>
                        {pr && (
                          <span className="sk-pri">
                            <strong>{pr.v}</strong> {pr.l}
                          </span>
                        )}
                      </span>
                      <small>{s.desc}</small>
                      <span className="sk-tags">
                        <span className="sk-tag tg">
                          <Ico name={TARGET_ICO[s.target]} size={11} /> {TARGET_LABEL[s.target]}
                        </span>
                        <Cd s={s} lv={lv} />
                        {statsOf(ls).map((x) => (
                          <span key={x.k} className="sk-tag">
                            <Ico name={x.ico} size={11} /> {x.text}
                          </span>
                        ))}
                      </span>
                      <span className="sk-pick-foot">
                        <span className="sk-lv" title={lvTitle(lv)}>
                          Ур. {lv}
                          <Pips lv={lv} />
                        </span>
                        <UpBtn id={s.id} />
                      </span>
                    </span>
                    <span className="sk-state" aria-hidden>
                      {on ? <b>{idx + 1}</b> : off ? <Ico name="lock" size={14} /> : <Ico name="plus" size={16} />}
                    </span>
                  </div>
                );
              })}
            </div>

            <h3 className="sk-h">
              <span>Пассивка</span>
              <em>{pasSel ? pasSel.name : ""}</em>
            </h3>
            <div className="pas-grid">
              {PASSIVES.map((p) => {
                const locked = !passivesFor(def.rank).some((x) => x.id === p.id);
                return (
                  <button key={p.id} type="button" className={`pas fx-c-${p.fx}`} aria-pressed={pas === p.id} disabled={locked} onClick={() => setPas(p.id)} title={locked ? `Нужен ранг ${RANKS[p.minRank].name}` : p.desc}>
                    <span className="pas-crest">
                      <i aria-hidden />
                      {locked ? <Ico name="lock" size={18} /> : <SkillGlyph fx={p.fx} size={22} />}
                    </span>
                    <b>{p.name}</b>
                    <small>{locked ? `с ранга «${RANKS[p.minRank].name}»` : p.desc}</small>
                    {pas === p.id && (
                      <span className="pas-on" aria-hidden>
                        <Ico name="check" size={12} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <h3 className="sk-h">
              <span>Ультимейт класса</span>
              <em>срабатывает сам</em>
            </h3>
            <div className={`sk-ult fx-c-${ult.fx}`} style={{ ["--kc" as string]: clsCol }}>
              <i className="sk-ult-rays" aria-hidden />
              <span className="sk-ult-art">
                <i aria-hidden />
                <i aria-hidden />
                <SkillGlyph fx={ult.fx} size={54} />
              </span>
              <span className="sk-ult-t">
                <small className="sk-ult-tag">Сигнатурный приём · {CLASSES[def.cls].name}</small>
                <b>{ult.name}</b>
                <span className="sk-ult-d">{ult.desc}</span>
                <span className="sk-tags">
                  <span className="sk-tag tg">
                    <Ico name={TARGET_ICO[ult.target]} size={11} /> {TARGET_LABEL[ult.target]}
                  </span>
                  {primary(ult) && (
                    <span className="sk-tag">
                      <Ico name="bolt" size={11} /> {primary(ult)!.v} {primary(ult)!.l}
                    </span>
                  )}
                  {statsOf(ult).map((x) => (
                    <span key={x.k} className="sk-tag">
                      <Ico name={x.ico} size={11} /> {x.text}
                    </span>
                  ))}
                </span>
                <span className="sk-gauge" title="Шкала энергии">
                  <span className="sk-gauge-bar" aria-hidden>
                    {Array.from({ length: 10 }).map((_, k) => (
                      <i key={k} style={{ ["--d" as string]: `${k * 90}ms` }} />
                    ))}
                  </span>
                  <span className="sk-ult-meta">
                    <Ico name="bolt" size={14} /> {ENERGY.max}
                  </span>
                </span>
                <small className="sk-gauge-hint">
                  Энергия: +{ENERGY.perTurn} за ход и +{ENERGY.perHit} за каждый полученный удар. Когда шкала полна, герой применяет ультимейт вместо умения.
                </small>
              </span>
            </div>
          </div>

          <div className="sk-foot">
            <span className="sk-foot-st">{same ? "Изменений нет" : "Есть несохранённые изменения"}</span>
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
