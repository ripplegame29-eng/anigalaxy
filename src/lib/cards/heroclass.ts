/**
 * Классы колод (как классы героя в Hearthstone): каждая колода выбирает один из пяти классов.
 * Класс даёт бонус всему отряду и усиленный бонус героям своего класса.
 * Чистый код: считает и сервер (бой), и интерфейс (описание, подсказки).
 */

import type { Unit } from "./battle";
import type { CardClass } from "./config";
import { DECK_SIZE } from "./config";
import type { Bonus } from "./synergy";

export const DECK_SLOTS = 5;

export interface HeroClassDef {
  name: string;
  /** Звание «героя» колоды */
  title: string;
  /** Название способности класса */
  power: string;
  desc: string;
  color: string;
  /** Бонус всем героям колоды */
  all: Bonus;
  /** Дополнительно героям этого класса */
  own: Bonus;
}

export const HERO_CLASSES: Record<CardClass, HeroClassDef> = {
  warrior: { name: "Воин", title: "Полководец", power: "Боевой клич", desc: "Отряд идёт в атаку: больше урона у всех, воины ещё и крепче держат удар.", color: "#ff6a4d", all: { atk: 0.05 }, own: { atk: 0.08, def: 0.06 } },
  mage: { name: "Маг", title: "Архимаг", power: "Арканный поток", desc: "Магия усиливает весь отряд, а маги бьют заметно сильнее.", color: "#8a7bff", all: { atk: 0.04, spd: 0.03 }, own: { atk: 0.12 } },
  tank: { name: "Страж", title: "Хранитель", power: "Несокрушимость", desc: "Отряд получает запас здоровья, а стражи становятся настоящей стеной.", color: "#4aa8ff", all: { hp: 0.06 }, own: { hp: 0.1, def: 0.08 } },
  assassin: { name: "Убийца", title: "Тень", power: "Засада", desc: "Отряд действует быстрее, убийцы ещё и бьют точнее.", color: "#c44dff", all: { spd: 0.05 }, own: { spd: 0.08, atk: 0.08 } },
  support: { name: "Хилер", title: "Целитель", power: "Дар жизни", desc: "Отряд крепче и живучее, хилеры получают много здоровья.", color: "#4de3a0", all: { hp: 0.04, def: 0.03 }, own: { hp: 0.12 } },
};

export const CLASS_ORDER: CardClass[] = ["warrior", "mage", "tank", "assassin", "support"];
export const isHeroClass = (v: unknown): v is CardClass => typeof v === "string" && v in HERO_CLASSES;

export interface DeckSlot {
  name: string;
  cls: CardClass;
  ids: number[];
  /** Колода заклинаний (id из tactics.ts); пусто — стартовый набор */
  tac: string[];
}
export interface DecksState {
  slots: DeckSlot[];
  active: number;
}

export const DECK_NAME_MAX = 18;

const pct = (v: number) => `+${Math.round(v * 100)}%`;
const LBL: Record<keyof Bonus, string> = { atk: "атаки", def: "защиты", hp: "здоровья", spd: "скорости" };
/** «+5% атаки, +3% скорости» */
export const bonusText = (b: Bonus): string =>
  (Object.keys(LBL) as (keyof Bonus)[])
    .filter((k) => b[k])
    .map((k) => `${pct(b[k]!)} ${LBL[k]}`)
    .join(", ");

/** Сколько героев своего класса в отряде */
export const ownCount = (cls: CardClass, members: { cls: CardClass }[]): number => members.filter((m) => m.cls === cls).length;

/** Итоговый бонус одного героя от класса колоды */
export function classBonus(deckCls: CardClass, heroCls: CardClass): Required<Bonus> {
  const d = HERO_CLASSES[deckCls];
  const own = heroCls === deckCls ? d.own : {};
  return {
    atk: (d.all.atk ?? 0) + (own.atk ?? 0),
    def: (d.all.def ?? 0) + (own.def ?? 0),
    hp: (d.all.hp ?? 0) + (own.hp ?? 0),
    spd: (d.all.spd ?? 0) + (own.spd ?? 0),
  };
}

/** Применить способность класса колоды к отряду (только в бою, до синергий) */
export function applyHeroClass(units: Unit[], cls: CardClass): Unit[] {
  return units.map((u) => {
    const b = classBonus(cls, u.cls);
    const hp = Math.round(u.maxHp * (1 + b.hp));
    return { ...u, atk: Math.round(u.atk * (1 + b.atk)), def: Math.round(u.def * (1 + b.def)), spd: Math.round(u.spd * (1 + b.spd)), maxHp: hp, hp: Math.round(u.hp * (1 + b.hp)) };
  });
}

export { DECK_SIZE };
