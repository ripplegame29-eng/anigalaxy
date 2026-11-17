/**
 * Детерминированная симуляция боя 4×4 с умениями.
 * Чистая функция: общий код сервера, интерфейса и тестов.
 *
 * Ход героя: горение → истечение эффектов → оглушение → перезарядка →
 * первое готовое умение из набора (порядок = приоритет) → иначе обычная атака.
 */

import { BATTLE, ELEMENTS, type CardClass, type Element } from "./config";
import { ENERGY, ultOf, levelled, skillDef, type Skill, type SkillFx } from "./skills";
import { bonusPerMember, type Synergy } from "./synergy";
import { cardDef } from "./catalog";
import { mergePerks, type Perks } from "./gear";
import { TACTIC_RULES, spellDeckOf, tacticDef, type Op, type Target } from "./tactics";

export interface Unit {
  key: string;
  side: "a" | "b";
  slot: number;
  cardId: string;
  name: string;
  rank: number;
  element: Element;
  cls: CardClass;
  atk: number;
  def: number;
  hp: number;
  maxHp: number;
  spd: number;
  foil: boolean;
  level: number;
  /** Экипированные умения в порядке приоритета */
  skills?: string[];
  /** Уровни умений по id */
  skillLv?: Record<string, number>;
  /** Пассивка героя */
  passive?: string;
  /** Аниме героя (для синергий) */
  series?: string;
}

export type StatusKind = "stun" | "burn" | "atkUp" | "defDown" | "taunt" | "shield";

export type BattleEvent =
  | { t: "cast"; from: string; skill: string; fx: SkillFx; targets: string[]; round: number; ult?: boolean }
  | { t: "energy"; to: string; en: number; round: number }
  | { t: "revive"; to: string; hp: number; round: number; /** Источник: снаряжение (реликвия или бустер) */ src?: "gear" }
  | { t: "hit"; from: string; to: string; dmg: number; crit: boolean; adv: number; round: number; hp: number; dead: boolean; guard?: string; skill?: string; absorbed: number; sh: number }
  | { t: "heal"; from: string; to: string; amount: number; round: number; hp: number; skill?: string }
  | { t: "shield"; from: string; to: string; amount: number; round: number; skill?: string }
  | { t: "status"; to: string; kind: StatusKind; on: boolean; round: number }
  | { t: "dot"; to: string; dmg: number; round: number; hp: number; dead: boolean; sh: number }
  | { t: "skip"; from: string; round: number }
  | { t: "card"; side: "a" | "b"; from: string; card: string; round: number };

/** Решение игрока на ход героя: действие ("auto" | "basic" | "ult" | id умения), цель и разыгранные тактические карты */
export interface Choice {
  a: string;
  t?: string;
  c?: string[];
}
/** Управляемый бой: свой ГСЧ по зерну и список решений стороны «a»; stop — остановиться, когда решения кончились */
export interface SimCtl {
  seed: number;
  choices: Choice[];
  stop?: boolean;
  /** Колода заклинаний стороны «a» (у соперника стартовый набор) */
  spells?: string[];
  /** Заполняет симуляция: с какими параметрами шёл бой (нужно клиенту, чтобы считать ходы у себя) */
  seen?: { perks?: SimOpts["perks"]; maxRounds: number };
}
export interface ActOpt {
  a: string;
  ready: boolean;
  cd: number;
  /** Кого можно выбрать целью; пусто — цель определяется сама */
  targets: string[];
}
/** Бой ждёт решения игрока */
export interface Pending {
  unit: string;
  round: number;
  mana: number;
  hand: string[];
  acts: ActOpt[];
}

export interface BattleOutcome {
  winner: "a" | "b";
  rounds: number;
  events: BattleEvent[];
  a: { key: string; hp: number; maxHp: number }[];
  b: { key: string; hp: number; maxHp: number }[];
  timeout: boolean;
  /** Только в управляемом бою: симуляция остановилась на ходу героя игрока */
  pending?: Pending;
}

export interface Mods {
  ban: Element;
  buff: Element;
}

export function applyMods(units: Unit[], mods: Mods): Unit[] {
  return units.map((u) => ({
    ...u,
    atk: Math.round(u.atk * (u.element === mods.buff ? 1.15 : u.element === mods.ban ? 0.8 : 1)),
  }));
}

/** Бонусы синергий: возвращает усиленных героев и список активных синергий */
export function applySynergies(units: Unit[]): { units: Unit[]; list: Synergy[] } {
  const members = units.map((u) => ({ series: u.series ?? cardDef(u.cardId)?.series ?? u.cardId, element: u.element, cls: u.cls }));
  const per = bonusPerMember(members);
  const list = new Map<string, Synergy>();
  per.forEach((p) => p.list.forEach((s) => list.set(s.id, s)));
  return {
    units: units.map((u, i) => {
      const b = per[i].bonus;
      const hp = Math.round(u.maxHp * (1 + b.hp));
      return { ...u, atk: Math.round(u.atk * (1 + b.atk)), def: Math.round(u.def * (1 + b.def)), spd: Math.round(u.spd * (1 + b.spd)), maxHp: hp, hp: Math.round(u.hp * (1 + b.hp)) };
    }),
    list: [...list.values()],
  };
}

/** Статовые бонусы снаряжения (реликвии, бустеры): атака, защита, здоровье, скорость */
export function applyGearStats(units: Unit[], p: Perks): Unit[] {
  if (!p.atk && !p.def && !p.hp && !p.spd) return units;
  return units.map((u) => ({
    ...u,
    atk: Math.round(u.atk * (1 + (p.atk ?? 0))),
    def: Math.round(u.def * (1 + (p.def ?? 0))),
    spd: Math.round(u.spd * (1 + (p.spd ?? 0))),
    maxHp: Math.round(u.maxHp * (1 + (p.hp ?? 0))),
    hp: Math.round(u.hp * (1 + (p.hp ?? 0))),
  }));
}

/** Статовые пассивки (поведенческие обрабатывает симуляция) */
export function applyPassives(units: Unit[]): Unit[] {
  return units.map((u) => {
    switch (u.passive) {
      case "p-vigor":
        return { ...u, maxHp: Math.round(u.maxHp * 1.12), hp: Math.round(u.hp * 1.12) };
      case "p-edge":
        return { ...u, atk: Math.round(u.atk * 1.1) };
      case "p-bulwark":
        return { ...u, def: Math.round(u.def * 1.18) };
      case "p-swift":
        return { ...u, spd: Math.round(u.spd * 1.2) };
      default:
        return u;
    }
  });
}

const alive = (xs: Unit[]) => xs.filter((u) => u.hp > 0);

function advantage(att: Element, def: Element): number {
  if (ELEMENTS[att].beats === def) return 1.3;
  if (ELEMENTS[def].beats === att) return 0.8;
  return 1;
}

interface State {
  cd: Map<string, number>;
  stun: number;
  atkUp: { n: number; v: number };
  defDown: { n: number; v: number };
  burn: { n: number; dmg: number };
  taunt: number;
  shield: number;
  shieldN: number;
  en: number;
  revived: boolean;
}

const EFFECT_TURNS = 3;

/** Параметры боя: лимит раундов и бонусы снаряжения сторон и правила арены */
export interface SimOpts {
  maxRounds?: number;
  perks?: { a?: Perks; b?: Perks; arena?: Perks };
  ctl?: SimCtl;
}

/* Управление боем для серверных функций, которые вызывают simulate внутри себя */
let CTX: SimCtl | null = null;
export function withCtl<T>(ctl: SimCtl, fn: () => T): T {
  const prev = CTX;
  CTX = ctl;
  try {
    return fn();
  } finally {
    CTX = prev;
  }
}

export function simulate(aIn: Unit[], bIn: Unit[], rng: () => number, opts: SimOpts = {}): BattleOutcome {
  const maxRounds = opts.maxRounds ?? BATTLE.maxRounds;
  const ctl = opts.ctl ?? CTX;
  if (ctl) {
    rng = seeded(ctl.seed);
    ctl.seen = { perks: opts.perks, maxRounds };
  }
  let ci = 0;
  /* эффекты тактических карт на текущий ход */
  let turnCrit = false;
  let turnDmg = 1;
  const a = aIn.map((u) => ({ ...u }));
  const b = bIn.map((u) => ({ ...u }));
  const all = [...a, ...b];
  const events: BattleEvent[] = [];
  let round = 0;
  const foes = (u: Unit) => alive(u.side === "a" ? b : a);
  const friends = (u: Unit) => alive(u.side === "a" ? a : b);

  const skillOf = (u: Unit, id: string): Skill | undefined => {
    const sk = skillDef(id);
    return sk ? levelled(sk, u.skillLv?.[id] ?? 1) : undefined;
  };
  const PK = { a: mergePerks(opts.perks?.a, opts.perks?.arena), b: mergePerks(opts.perks?.b, opts.perks?.arena) };
  const pk = (u: Unit): Perks => PK[u.side];
  const foePk = (u: Unit): Perks => PK[u.side === "a" ? "b" : "a"];
  /** Возрождение от снаряжения: один раз на отряд */
  const team = { a: { pct: PK.a.revive ?? 0, used: false }, b: { pct: PK.b.revive ?? 0, used: false } };
  const st = new Map<string, State>();
  for (const u of all) {
    const cd = new Map<string, number>();
    for (const id of u.skills ?? []) {
      const sk = skillOf(u, id);
      if (sk) cd.set(id, Math.max(0, sk.cd - 2));
    }
    st.set(u.key, { cd, stun: 0, atkUp: { n: 0, v: 0 }, defDown: { n: 0, v: 0 }, burn: { n: 0, dmg: 0 }, taunt: 0, shield: 0, shieldN: 0, en: u.passive === "p-swift" ? 30 : 0, revived: false });
  }
  const gainEnergy = (u: Unit, n: number, flat = 0) => {
    const s = st.get(u.key)!;
    const before = s.en;
    const mul = Math.max(0, 1 + (pk(u).enMul ?? 0) + (foePk(u).foeEnMul ?? 0));
    s.en = Math.min(ENERGY.max, s.en + Math.round(n * mul) + flat);
    if (s.en !== before) events.push({ t: "energy", to: u.key, en: s.en, round });
  };
  const canRevive = (u: Unit) => u.hp <= 0 && ((u.passive === "p-revive" && !st.get(u.key)!.revived) || (team[u.side].pct > 0 && !team[u.side].used));
  const revive = (u: Unit) => {
    if (u.passive === "p-revive" && !st.get(u.key)!.revived) {
      st.get(u.key)!.revived = true;
      u.hp = Math.max(1, Math.round(u.maxHp * 0.3));
      events.push({ t: "revive", to: u.key, hp: u.hp, round });
      return;
    }
    team[u.side].used = true;
    u.hp = Math.max(1, Math.round(u.maxHp * team[u.side].pct));
    events.push({ t: "revive", to: u.key, hp: u.hp, round, src: "gear" });
  };
  const S = (u: Unit) => st.get(u.key)!;
  const effAtk = (u: Unit) => u.atk * (1 + (S(u).atkUp.n > 0 ? S(u).atkUp.v : 0) + (round <= (pk(u).burstN ?? 0) ? (pk(u).burstAtk ?? 0) : 0));
  const effDef = (u: Unit) => u.def * (1 - (S(u).defDown.n > 0 ? S(u).defDown.v : 0));
  const status = (u: Unit, kind: StatusKind, on: boolean) => events.push({ t: "status", to: u.key, kind, on, round });

  /** Урон с учётом щита; возвращает итоговый урон */
  const damage = (target: Unit, dmg: number): { absorbed: number } => {
    const s = S(target);
    const absorbed = Math.min(s.shield, dmg);
    s.shield -= absorbed;
    target.hp = Math.max(0, target.hp - (dmg - absorbed));
    return { absorbed };
  };

  const strike = (u: Unit, target: Unit, power: number, skill?: Skill, guard?: string): number => {
    let adv = advantage(u.element, target.element);
    if (adv > 1) adv += pk(u).advUp ?? 0;
    else if (adv < 1) adv += pk(u).advDown ?? 0;
    const critChance = (u.cls === "assassin" ? 0.2 : 0.08) + (u.passive === "p-focus" ? 0.12 : 0) + (pk(u).crit ?? 0);
    const crit = rng() < critChance || turnCrit;
    let raw = effAtk(u) * power * (u.cls === "warrior" ? 1.1 : 1) * (crit ? 1.6 : 1) * adv * (0.9 + rng() * 0.2);
    if (skill?.exec && target.hp / target.maxHp < 0.35) raw *= skill.exec;
    if (pk(u).exec && target.hp / target.maxHp < 0.35) raw *= 1 + pk(u).exec!;
    raw *= Math.max(0.2, 1 + (pk(u).dmg ?? 0) + (pk(target).taken ?? 0));
    if (turnDmg !== 1) raw *= turnDmg;
    const dmg = Math.max(1, Math.round((raw * 100) / (100 + effDef(target) * 0.8)));
    const { absorbed } = damage(target, dmg);
    const saved = canRevive(target);
    events.push({ t: "hit", from: u.key, to: target.key, dmg, crit, adv, round, hp: target.hp, dead: target.hp <= 0 && !saved, guard, skill: skill?.id, absorbed, sh: S(target).shield });
    if (pk(u).vamp && u.hp > 0 && !saved) heal(u, u, dmg * pk(u).vamp!, undefined, "g-vamp", true);
    if (saved) revive(target);
    else if (target.hp <= 0) {
      const s = S(target);
      s.stun = 0;
      s.shield = 0;
    } else {
      gainEnergy(target, ENERGY.perHit);
      const thorns = (target.passive === "p-thorns" ? 0.15 : 0) + (pk(target).thorns ?? 0);
      if (thorns > 0 && u.hp > 0) {
        const back = Math.max(1, Math.round(dmg * thorns));
        const r = damage(u, back);
        const sv = canRevive(u);
        events.push({ t: "hit", from: target.key, to: u.key, dmg: back, crit: false, adv: 1, round, hp: u.hp, dead: u.hp <= 0 && !sv, skill: "p-thorns", absorbed: r.absorbed, sh: S(u).shield });
        if (sv) revive(u);
        else if (u.hp <= 0) {
          S(u).stun = 0;
          S(u).shield = 0;
        }
      }
    }
    return dmg;
  };

  const heal = (from: Unit, to: Unit, amount: number, skill?: Skill, id?: string, raw = false) => {
    const real = Math.min(to.maxHp - to.hp, Math.round(raw ? amount : amount * (1 + (pk(from).heal ?? 0))));
    if (real <= 0) return;
    to.hp += real;
    events.push({ t: "heal", from: from.key, to: to.key, amount: real, round, hp: to.hp, skill: skill?.id ?? id });
  };

  const addShield = (from: Unit, to: Unit, amount: number, skill?: Skill) => {
    const s = S(to);
    s.shield += Math.round(amount * (1 + (pk(from).shield ?? 0)));
    s.shieldN = EFFECT_TURNS;
    events.push({ t: "shield", from: from.key, to: to.key, amount: s.shield, round, skill: skill?.id });
  };

  const enemyPick = (u: Unit): Unit => {
    const enemies = foes(u);
    const taunter = enemies.find((e) => S(e).taunt > 0);
    return taunter ?? enemies[Math.floor(rng() * enemies.length)];
  };
  const lowest = (xs: Unit[]) => [...xs].sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];

  const targetsOf = (u: Unit, sk: Skill): Unit[] => {
    switch (sk.target) {
      case "enemy":
        return [enemyPick(u)];
      case "enemyLow":
        return [[...foes(u)].sort((x, y) => x.hp - y.hp)[0]];
      case "enemies":
        return foes(u);
      case "ally":
        return [lowest(friends(u))];
      case "allies":
        return friends(u);
      default:
        return [u];
    }
  };

  const useful = (u: Unit, sk: Skill): boolean => {
    if (sk.power || sk.burn || sk.stun || sk.defDown) return true;
    if (sk.heal || sk.healPct) return friends(u).some((f) => f.hp < f.maxHp * (sk.target === "self" ? 0.85 : 0.9));
    if (sk.shield || sk.shieldPct) return sk.target === "self" ? S(u).shield <= 0 : friends(u).some((f) => S(f).shield <= 0);
    if (sk.atkUp) return sk.target === "self" ? S(u).atkUp.n <= 0 : friends(u).some((f) => S(f).atkUp.n <= 0);
    if (sk.taunt) return S(u).taunt <= 0;
    return true;
  };

  const cast = (u: Unit, sk: Skill, ult = false, forced?: Unit) => {
    const targets = (forced ? [forced] : targetsOf(u, sk)).filter((t) => t.hp > 0);
    if (!targets.length) return false;
    events.push({ t: "cast", from: u.key, skill: sk.id, fx: sk.fx, targets: targets.map((t) => t.key), round, ult: ult || undefined });
    for (const t of targets) {
      if (u.hp <= 0) break;
      let dealt = 0;
      if (sk.power) dealt = strike(u, t, sk.power, sk);
      if (t.hp <= 0) continue;
      if (sk.drain && dealt && u.hp > 0) heal(u, u, dealt * sk.drain, sk);
      const ts = S(t);
      if (sk.stun && ts.stun <= 0) {
        ts.stun = sk.stun;
        status(t, "stun", true);
      }
      if (sk.burn) {
        ts.burn = { n: EFFECT_TURNS, dmg: Math.max(1, Math.round(effAtk(u) * sk.burn * (1 + (pk(u).dot ?? 0)))) };
        status(t, "burn", true);
      }
      if (sk.defDown) {
        ts.defDown = { n: EFFECT_TURNS, v: sk.defDown };
        status(t, "defDown", true);
      }
      if (sk.atkUp) {
        ts.atkUp = { n: EFFECT_TURNS, v: sk.atkUp };
        status(t, "atkUp", true);
      }
      if (sk.heal) heal(u, t, effAtk(u) * sk.heal, sk);
      if (sk.healPct) heal(u, t, t.maxHp * sk.healPct, sk);
      if (sk.shield) addShield(u, t, effAtk(u) * sk.shield, sk);
      if (sk.shieldPct) addShield(u, t, t.maxHp * sk.shieldPct, sk);
      if (sk.taunt) {
        ts.taunt = sk.taunt;
        status(t, "taunt", true);
      }
    }
    return true;
  };

  const basic = (u: Unit, forced?: Unit): void => {
    const enemies = foes(u);
    if (forced && forced.side === u.side) {
      heal(u, forced, u.atk * 1.1);
      return;
    }
    if (!forced && u.cls === "support") {
      const hurt = lowest(friends(u).filter((f) => f.hp < f.maxHp));
      if (hurt) {
        heal(u, hurt, u.atk * 1.1);
        return;
      }
    }
    let target: Unit;
    if (forced) target = forced;
    else if (u.cls === "mage") target = [...enemies].sort((x, y) => x.hp - y.hp)[0];
    else target = enemyPick(u);
    let guard: string | undefined;
    const tank = enemies.find((e) => e.cls === "tank" && e.key !== target.key);
    if (tank && target.cls !== "tank" && !S(target).taunt && rng() < 0.35) {
      guard = target.key;
      target = tank;
    }
    const dealt = strike(u, target, 1, undefined, guard);
    if (u.passive === "p-vamp" && u.hp > 0) heal(u, u, dealt * 0.2);
  };

  const expire = (u: Unit) => {
    const s = S(u);
    if (s.atkUp.n > 0 && --s.atkUp.n === 0) status(u, "atkUp", false);
    if (s.defDown.n > 0 && --s.defDown.n === 0) status(u, "defDown", false);
    if (s.taunt > 0 && --s.taunt === 0) status(u, "taunt", false);
    if (s.shieldN > 0 && --s.shieldN === 0) {
      s.shield = 0;
      status(u, "shield", false);
    }
  };

  /* ---- управляемый бой: тактические карты, решения игрока ---- */
  const mkT = (own?: string[]) => {
    const deck = [...spellDeckOf(own)];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return { deck, hand: [] as string[], mana: TACTIC_RULES.start - TACTIC_RULES.perRound };
  };
  const TS = ctl ? { a: mkT(ctl.spells), b: mkT() } : null;
  /** Кого касается эффект карты (только живые) */
  const pickT = (u: Unit, to: Target): Unit[] => {
    const fs = foes(u);
    const as = friends(u);
    const first = (xs: Unit[]): Unit[] => (xs.length ? [xs[0]] : []);
    switch (to) {
      case "self":
        return u.hp > 0 ? [u] : [];
      case "allies":
        return as;
      case "foes":
        return [...fs];
      case "lowAlly":
        return first([...as].sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp));
      case "strongAlly":
        return first([...as].sort((x, y) => y.atk - x.atk));
      case "lowFoe":
        return first([...fs].sort((x, y) => x.hp - y.hp));
      case "strongFoe":
        return first([...fs].sort((x, y) => y.atk - x.atk));
      case "woundedFoe":
        return first([...fs].sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp));
      case "randFoe":
        return fs.length ? [fs[Math.floor(rng() * fs.length)]] : [];
      case "backFoe":
        return first([...fs].sort((x, y) => y.slot - x.slot));
      case "frontFoe":
        return first([...fs].sort((x, y) => x.slot - y.slot));
    }
  };
  /** Выполнить один эффект карты */
  const runOp = (u: Unit, op: Op, id: string, t: { deck: string[]; hand: string[]; mana: number }) => {
    switch (op.k) {
      case "dmg":
        for (let h = 0; h < (op.hits ?? 1); h++) {
          for (const f of pickT(u, op.to)) {
            if (f.hp <= 0 || u.hp <= 0) continue;
            strike(u, f, op.exec && f.hp / f.maxHp < op.exec.below ? op.exec.p : op.p);
          }
        }
        break;
      case "drain":
        for (const f of pickT(u, op.to)) {
          if (u.hp <= 0) break;
          const dmg = strike(u, f, op.p);
          if (u.hp > 0) heal(u, u, dmg * op.heal, undefined, id, true);
        }
        break;
      case "heal":
        for (const f of pickT(u, op.to)) heal(u, f, f.maxHp * op.pct, undefined, id, true);
        break;
      case "shield":
        for (const f of pickT(u, op.to)) addShield(u, f, f.maxHp * op.pct);
        break;
      case "atkUp":
        for (const f of pickT(u, op.to)) {
          S(f).atkUp = { n: EFFECT_TURNS, v: op.v };
          status(f, "atkUp", true);
        }
        break;
      case "defDown":
        for (const f of pickT(u, op.to)) {
          S(f).defDown = { n: EFFECT_TURNS, v: op.v };
          status(f, "defDown", true);
        }
        break;
      case "burn":
        for (const f of pickT(u, op.to)) {
          S(f).burn = { n: EFFECT_TURNS, dmg: Math.max(1, Math.round(effAtk(u) * op.m * (1 + (pk(u).dot ?? 0)))) };
          status(f, "burn", true);
        }
        break;
      case "stun":
        for (const f of pickT(u, op.to)) {
          if (S(f).stun <= 0) {
            S(f).stun = 1;
            status(f, "stun", true);
          }
        }
        break;
      case "taunt":
        S(u).taunt = EFFECT_TURNS;
        status(u, "taunt", true);
        break;
      case "energy":
        for (const f of pickT(u, op.to)) gainEnergy(f, 0, op.n);
        break;
      case "cleanse":
        for (const f of pickT(u, op.to)) {
          const fs = S(f);
          if (fs.burn.n > 0) {
            fs.burn.n = 0;
            status(f, "burn", false);
          }
          if (fs.defDown.n > 0) {
            fs.defDown.n = 0;
            status(f, "defDown", false);
          }
        }
        break;
      case "cdreset":
        for (const k of S(u).cd.keys()) S(u).cd.set(k, 0);
        break;
      case "crit":
        turnCrit = true;
        break;
      case "amp":
        turnDmg = Math.max(turnDmg, op.v);
        break;
      case "revive": {
        const f = (u.side === "a" ? a : b).filter((x) => x.hp <= 0).sort((x, y) => y.atk - x.atk)[0];
        if (f) {
          f.hp = Math.max(1, Math.round(f.maxHp * op.pct));
          const fs = S(f);
          fs.burn = { n: 0, dmg: 0 };
          fs.defDown = { n: 0, v: 0 };
          fs.atkUp = { n: 0, v: 0 };
          fs.taunt = 0;
          events.push({ t: "revive", to: f.key, hp: f.hp, round });
        }
        break;
      }
      case "mana":
        t.mana = Math.min(TACTIC_RULES.max, t.mana + op.n);
        break;
      case "draw":
        for (let i = 0; i < op.n && t.deck.length && t.hand.length < TACTIC_RULES.hand + 2; i++) t.hand.push(t.deck.shift()!);
        break;
    }
  };
  const playCard = (u: Unit, id: string): boolean => {
    if (!TS) return false;
    const t = TS[u.side];
    const def = tacticDef(id);
    const at = t.hand.indexOf(id);
    if (!def || at < 0 || def.cost > t.mana) return false;
    t.mana -= def.cost;
    t.hand.splice(at, 1);
    t.deck.push(id);
    events.push({ t: "card", side: u.side, from: u.key, card: id, round });
    for (const op of def.ops) {
      if (u.hp <= 0 && op.k !== "revive") break;
      if (!foes(u).length) break;
      runOp(u, op, id, t);
    }
    return true;
  };
  /** Стоит ли ИИ разыгрывать карту сейчас */
  const aiWants = (u: Unit, id: string, t: { hand: string[]; mana: number }): boolean => {
    const def = tacticDef(id);
    const op = def?.ops[0];
    if (!def || !op) return false;
    const low = lowest(friends(u));
    const s = S(u);
    switch (op.k) {
      case "heal":
        return op.to === "allies" ? friends(u).filter((f) => f.hp / f.maxHp < 0.7).length >= 2 : low.hp / low.maxHp < 0.55;
      case "shield":
        return op.to === "allies" ? friends(u).every((f) => S(f).shield <= 0) && t.mana >= 4 : op.to === "self" ? S(u).shield <= 0 && u.hp / u.maxHp < 0.85 : low.hp / low.maxHp < 0.7 && S(low).shield <= 0;
      case "cleanse":
        return friends(u).some((f) => S(f).burn.n > 0 || S(f).defDown.n > 0);
      case "energy":
        return op.to === "allies" ? friends(u).filter((f) => S(f).en < ENERGY.max - 25).length >= 3 : s.en < ENERGY.max && s.en >= ENERGY.max - op.n;
      case "cdreset":
        return [...s.cd.values()].some((v) => v >= 2);
      case "crit":
      case "amp":
        return u.cls !== "support" && (s.en >= ENERGY.max || t.mana >= 4);
      case "revive":
        return (u.side === "a" ? a : b).some((x) => x.hp <= 0);
      case "mana":
        return t.hand.some((h) => (tacticDef(h)?.cost ?? 0) === t.mana + 1);
      case "draw":
        return t.hand.length < TACTIC_RULES.hand;
      default:
        return t.mana >= 3 && u.cls !== "support" ? true : t.mana >= 4;
    }
  };
  /** ИИ разыгрывает карты, когда от них есть толк */
  const aiCards = (u: Unit) => {
    if (!TS) return;
    const t = TS[u.side];
    let left = t.mana >= 5 ? 2 : 1;
    for (const id of [...t.hand]) {
      if (left <= 0 || u.hp <= 0 || !foes(u).length || !friends(u).length) break;
      if (aiWants(u, id, t) && playCard(u, id)) left -= 1;
    }
  };
  const pendingOf = (u: Unit): Pending => {
    const s = S(u);
    const en = foes(u);
    const taunter = en.find((e) => S(e).taunt > 0);
    const foeKeys = (taunter ? [taunter] : en).map((x) => x.key);
    const tOf = (sk: Skill): string[] => (sk.target === "enemy" ? foeKeys : sk.target === "ally" ? friends(u).map((x) => x.key) : []);
    const acts: ActOpt[] = [{ a: "basic", ready: true, cd: 0, targets: [...foeKeys, ...(u.cls === "support" ? friends(u).filter((f) => f.hp < f.maxHp).map((x) => x.key) : [])] }];
    for (const id of u.skills ?? []) {
      const sk = skillOf(u, id);
      if (!sk) continue;
      const cd = s.cd.get(id) ?? 0;
      acts.push({ a: id, ready: cd <= 0, cd, targets: tOf(sk) });
    }
    acts.push({ a: "ult", ready: s.en >= ENERGY.max, cd: 0, targets: tOf(ultOf(u.cardId, u.cls)) });
    return { unit: u.key, round, mana: TS?.a.mana ?? 0, hand: [...(TS?.a.hand ?? [])], acts };
  };
  /** Выполняет решение игрока; false — решение недопустимо, ход отдаётся ИИ */
  const perform = (u: Unit, ch: Choice): boolean => {
    for (const id of (Array.isArray(ch.c) ? ch.c : []).slice(0, TACTIC_RULES.hand)) {
      if (u.hp <= 0 || !foes(u).length || !friends(u).length) break;
      playCard(u, String(id));
    }
    /* карта могла добить последнего врага или самого героя — действия не будет */
    if (u.hp <= 0 || !foes(u).length) return true;
    const s = S(u);
    const tgt = ch.t ? all.find((x) => x.key === ch.t && x.hp > 0) : undefined;
    const okFoe = (x: Unit): boolean => {
      if (x.side === u.side) return false;
      const taunter = foes(u).find((e) => S(e).taunt > 0);
      return !taunter || taunter.key === x.key;
    };
    /* undefined — цель выберет движок, null — цель недопустима */
    const forcedFor = (sk: Skill): Unit | undefined | null => {
      if (!tgt) return undefined;
      if (sk.target === "enemy") return okFoe(tgt) ? tgt : null;
      if (sk.target === "ally") return tgt.side === u.side ? tgt : null;
      return undefined;
    };
    if (ch.a === "basic") {
      if (tgt && tgt.side === u.side) {
        if (u.cls !== "support" || tgt.hp >= tgt.maxHp) return false;
      } else if (tgt && !okFoe(tgt)) return false;
      basic(u, tgt);
      return true;
    }
    if (ch.a === "ult") {
      if (s.en < ENERGY.max) return false;
      const f = forcedFor(ultOf(u.cardId, u.cls));
      if (f === null || !cast(u, ultOf(u.cardId, u.cls), true, f)) return false;
      s.en = 0;
      events.push({ t: "energy", to: u.key, en: 0, round });
      return true;
    }
    if (!(u.skills ?? []).includes(ch.a)) return false;
    const sk = skillOf(u, ch.a);
    if (!sk || (s.cd.get(ch.a) ?? 0) > 0) return false;
    const f = forcedFor(sk);
    if (f === null || !cast(u, sk, false, f)) return false;
    s.cd.set(ch.a, sk.cd);
    return true;
  };
  const finish = (pending?: Pending): BattleOutcome => {
    const left = (xs: Unit[]) => xs.reduce((sum, u) => sum + Math.max(0, u.hp), 0) / xs.reduce((sum, u) => sum + u.maxHp, 0);
    const timeout = alive(a).length > 0 && alive(b).length > 0;
    const winner: "a" | "b" = timeout ? (left(a) >= left(b) ? "a" : "b") : alive(a).length ? "a" : "b";
    const snap = (xs: Unit[]) => xs.map((u) => ({ key: u.key, hp: u.hp, maxHp: u.maxHp }));
    return { winner, rounds: round, events, a: snap(a), b: snap(b), timeout, ...(pending ? { pending } : {}) };
  };

  /* старт боя: энергия и щиты от снаряжения */
  for (const u of all) {
    const p = pk(u);
    if (p.startEn) gainEnergy(u, 0, p.startEn);
    if (p.startShield) addShield(u, u, u.maxHp * p.startShield);
  }

  while (round < maxRounds && alive(a).length && alive(b).length) {
    round += 1;
    if (TS) {
      for (const sd of ["a", "b"] as const) {
        const t = TS[sd];
        t.mana = Math.min(TACTIC_RULES.max, t.mana + TACTIC_RULES.perRound);
        while (t.hand.length < TACTIC_RULES.hand && t.deck.length) t.hand.push(t.deck.shift()!);
      }
    }
    const order = alive(all).sort((x, y) => {
      const sx = x.spd + (x.cls === "assassin" ? 12 : 0) + rng();
      const sy = y.spd + (y.cls === "assassin" ? 12 : 0) + rng();
      return sy - sx;
    });
    for (const u of order) {
      if (u.hp <= 0) continue;
      if (!foes(u).length) break;
      const s = S(u);

      if (s.burn.n > 0) {
        s.burn.n -= 1;
        const { absorbed } = damage(u, s.burn.dmg);
        const saved = canRevive(u);
        events.push({ t: "dot", to: u.key, dmg: s.burn.dmg, round, hp: u.hp, dead: u.hp <= 0 && !saved, sh: s.shield });
        void absorbed;
        if (s.burn.n === 0) status(u, "burn", false);
        if (saved) revive(u);
        if (u.hp <= 0) {
          s.stun = 0;
          continue;
        }
        if (!foes(u).length) break;
      }
      expire(u);
      if (s.stun > 0) {
        s.stun -= 1;
        events.push({ t: "skip", from: u.key, round });
        if (s.stun === 0) status(u, "stun", false);
        continue;
      }
      for (const [id, v] of s.cd) if (v > 0) s.cd.set(id, v - 1);
      gainEnergy(u, ENERGY.perTurn + (u.passive === "p-flow" ? 8 : 0));

      turnCrit = false;
      turnDmg = 1;
      if (ctl && u.side === "a") {
        let ch = ctl.choices[ci];
        /* розыгрыш карты боя: не тратит ход, герой по-прежнему ждёт выбора действия */
        while (ch && ch.a === "card") {
          ci += 1;
          const id = Array.isArray(ch.c) ? ch.c[0] : undefined;
          if (id && u.hp > 0 && foes(u).length && friends(u).length) playCard(u, String(id));
          if (u.hp <= 0 || !foes(u).length) break;
          ch = ctl.choices[ci];
        }
        if (u.hp <= 0 || !foes(u).length) continue;
        if (!ch && ctl.stop) return finish(pendingOf(u));
        ci += 1;
        /* «Сдаться»: весь отряд игрока выбывает, бой засчитывается как поражение */
        if (ch && ch.a === "forfeit") {
          for (const m of alive(a)) {
            const was = m.hp;
            m.hp = 0;
            events.push({ t: "dot", to: m.key, dmg: Math.max(1, Math.round(was)), round, hp: 0, dead: true, sh: 0 });
          }
          break;
        }
        if (ch && typeof ch.a === "string" && ch.a !== "auto" && perform(u, ch)) continue;
      }
      aiCards(u);
      if (u.hp <= 0 || !foes(u).length) continue;

      let used = false;
      if (s.en >= ENERGY.max && cast(u, ultOf(u.cardId, u.cls), true)) {
        s.en = 0;
        events.push({ t: "energy", to: u.key, en: 0, round });
        used = true;
      }
      if (!used) {
        for (const id of u.skills ?? []) {
          const sk = skillOf(u, id);
          if (!sk || (s.cd.get(id) ?? 0) > 0 || !useful(u, sk)) continue;
          cast(u, sk);
          s.cd.set(id, sk.cd);
          used = true;
          break;
        }
      }
      if (!used) basic(u);
    }
  }

  return finish();
}

/** Генератор: быстрый детерминированный ГСЧ (mulberry32) */
export function seeded(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
