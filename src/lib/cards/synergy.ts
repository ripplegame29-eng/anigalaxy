/**
 * Синергии отряда: бонусы за героев одного аниме, одной стихии и разнообразие классов.
 * Чистый код: считает и сервер (бой), и интерфейс (подсказки в отряде).
 */

import type { CardClass, Element } from "./config";
import { ELEMENTS } from "./config";

export interface Member {
  series: string;
  element: Element;
  cls: CardClass;
}

export interface Bonus {
  atk?: number;
  def?: number;
  hp?: number;
  spd?: number;
}

export interface Synergy {
  id: string;
  kind: "series" | "element" | "classes";
  name: string;
  /** Сколько героев участвует */
  count: number;
  tier: 1 | 2 | 3;
  desc: string;
  bonus: Bonus;
  /** Индексы героев в исходном массиве */
  members: number[];
}

const pct = (v: number) => `+${Math.round(v * 100)}%`;
const text = (b: Bonus) =>
  [b.atk && `${pct(b.atk)} атаки`, b.hp && `${pct(b.hp)} здоровья`, b.def && `${pct(b.def)} защиты`, b.spd && `${pct(b.spd)} скорости`].filter(Boolean).join(", ");

const SERIES: Bonus[] = [{}, {}, { atk: 0.06 }, { atk: 0.12, hp: 0.08 }, { atk: 0.2, hp: 0.14, def: 0.1 }];
const ELEMENT: Bonus[] = [{}, {}, {}, { atk: 0.08 }, { atk: 0.15, spd: 0.1 }];

export function synergyList(members: Member[]): Synergy[] {
  const out: Synergy[] = [];
  const bySeries = new Map<string, number[]>();
  const byEl = new Map<Element, number[]>();
  members.forEach((m, i) => {
    bySeries.set(m.series, [...(bySeries.get(m.series) ?? []), i]);
    byEl.set(m.element, [...(byEl.get(m.element) ?? []), i]);
  });
  for (const [series, idx] of bySeries) {
    const n = Math.min(4, idx.length);
    if (n < 2) continue;
    const bonus = SERIES[n];
    out.push({ id: `series:${series}`, kind: "series", name: series, count: idx.length, tier: (n - 1) as 1 | 2 | 3, desc: text(bonus), bonus, members: idx });
  }
  for (const [el, idx] of byEl) {
    const n = Math.min(4, idx.length);
    if (n < 3) continue;
    const bonus = ELEMENT[n];
    out.push({ id: `element:${el}`, kind: "element", name: `Стихия «${ELEMENTS[el].name}»`, count: idx.length, tier: (n - 2) as 1 | 2 | 3, desc: text(bonus), bonus, members: idx });
  }
  if (members.length >= 4 && new Set(members.map((m) => m.cls)).size >= 4) {
    const bonus: Bonus = { hp: 0.06, def: 0.06 };
    out.push({ id: "classes", kind: "classes", name: "Сбалансированный отряд", count: members.length, tier: 1, desc: text(bonus), bonus, members: members.map((_, i) => i) });
  }
  return out;
}

/** Суммарный бонус каждому герою */
export function bonusPerMember(members: Member[]): { bonus: Required<Bonus>; list: Synergy[] }[] {
  const list = synergyList(members);
  return members.map((_, i) => {
    const mine = list.filter((s) => s.members.includes(i));
    const bonus = { atk: 0, def: 0, hp: 0, spd: 0 };
    for (const s of mine) for (const k of ["atk", "def", "hp", "spd"] as const) bonus[k] += s.bonus[k] ?? 0;
    return { bonus, list: mine };
  });
}
