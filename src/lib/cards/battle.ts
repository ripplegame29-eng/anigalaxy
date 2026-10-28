/**
 * Детерминированная симуляция боя 4×4 с умениями.
 * Чистая функция: общий код сервера, интерфейса и тестов.
 *
 * Ход героя: горение → истечение эффектов → оглушение → перезарядка →
 * первое готовое умение из набора (порядок = приоритет) → иначе обычная атака.
 */

import { BATTLE, ELEMENTS, type CardClass, type Element } from "./config";
import { ENERGY, ULTIMATES, levelled, skillDef, type Skill, type SkillFx } from "./skills";
import { bonusPerMember, type Synergy } from "./synergy";
import { cardDef } from "./catalog";

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
  | { t: "revive"; to: string; hp: number; round: number }
  | { t: "hit"; from: string; to: string; dmg: number; crit: boolean; adv: number; round: number; hp: number; dead: boolean; guard?: string; skill?: string; absorbed: number; sh: number }
  | { t: "heal"; from: string; to: string; amount: number; round: number; hp: number; skill?: string }
  | { t: "shield"; from: string; to: string; amount: number; round: number; skill?: string }
  | { t: "status"; to: string; kind: StatusKind; on: boolean; round: number }
  | { t: "dot"; to: string; dmg: number; round: number; hp: number; dead: boolean; sh: number }
  | { t: "skip"; from: string; round: number };

export interface BattleOutcome {
  winner: "a" | "b";
  rounds: number;
  events: BattleEvent[];
  a: { key: string; hp: number; maxHp: number }[];
  b: { key: string; hp: number; maxHp: number }[];
  timeout: boolean;
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

export function simulate(aIn: Unit[], bIn: Unit[], rng: () => number, opts: { maxRounds?: number } = {}): BattleOutcome {
  const maxRounds = opts.maxRounds ?? BATTLE.maxRounds;
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
  const st = new Map<string, State>();
  for (const u of all) {
    const cd = new Map<string, number>();
    for (const id of u.skills ?? []) {
      const sk = skillOf(u, id);
      if (sk) cd.set(id, Math.max(0, sk.cd - 2));
    }
    st.set(u.key, { cd, stun: 0, atkUp: { n: 0, v: 0 }, defDown: { n: 0, v: 0 }, burn: { n: 0, dmg: 0 }, taunt: 0, shield: 0, shieldN: 0, en: u.passive === "p-swift" ? 30 : 0, revived: false });
  }
  const gainEnergy = (u: Unit, n: number) => {
    const s = st.get(u.key)!;
    const before = s.en;
    s.en = Math.min(ENERGY.max, s.en + n);
    if (s.en !== before) events.push({ t: "energy", to: u.key, en: s.en, round });
  };
  const canRevive = (u: Unit) => u.hp <= 0 && u.passive === "p-revive" && !st.get(u.key)!.revived;
  const revive = (u: Unit) => {
    st.get(u.key)!.revived = true;
    u.hp = Math.max(1, Math.round(u.maxHp * 0.3));
    events.push({ t: "revive", to: u.key, hp: u.hp, round });
  };
  const S = (u: Unit) => st.get(u.key)!;
  const effAtk = (u: Unit) => u.atk * (1 + (S(u).atkUp.n > 0 ? S(u).atkUp.v : 0));
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
    const adv = advantage(u.element, target.element);
    const critChance = (u.cls === "assassin" ? 0.25 : 0.08) + (u.passive === "p-focus" ? 0.12 : 0);
    const crit = rng() < critChance;
    let raw = effAtk(u) * power * (u.cls === "warrior" ? 1.1 : 1) * (crit ? 1.6 : 1) * adv * (0.9 + rng() * 0.2);
    if (skill?.exec && target.hp / target.maxHp < 0.35) raw *= skill.exec;
    const dmg = Math.max(1, Math.round((raw * 100) / (100 + effDef(target) * 0.8)));
    const { absorbed } = damage(target, dmg);
    const saved = canRevive(target);
    events.push({ t: "hit", from: u.key, to: target.key, dmg, crit, adv, round, hp: target.hp, dead: target.hp <= 0 && !saved, guard, skill: skill?.id, absorbed, sh: S(target).shield });
    if (saved) revive(target);
    else if (target.hp <= 0) {
      const s = S(target);
      s.stun = 0;
      s.shield = 0;
    } else {
      gainEnergy(target, ENERGY.perHit);
      if (target.passive === "p-thorns" && u.hp > 0) {
        const back = Math.max(1, Math.round(dmg * 0.15));
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

  const heal = (from: Unit, to: Unit, amount: number, skill?: Skill) => {
    const real = Math.min(to.maxHp - to.hp, Math.round(amount));
    if (real <= 0) return;
    to.hp += real;
    events.push({ t: "heal", from: from.key, to: to.key, amount: real, round, hp: to.hp, skill: skill?.id });
  };

  const addShield = (from: Unit, to: Unit, amount: number, skill?: Skill) => {
    const s = S(to);
    s.shield += Math.round(amount);
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

  const cast = (u: Unit, sk: Skill, ult = false) => {
    const targets = targetsOf(u, sk).filter((t) => t.hp > 0);
    if (!targets.length) return false;
    events.push({ t: "cast", from: u.key, skill: sk.id, fx: sk.fx, targets: targets.map((t) => t.key), round, ult: ult || undefined });
    for (const t of targets) {
      let dealt = 0;
      if (sk.power) dealt = strike(u, t, sk.power, sk);
      if (t.hp <= 0) continue;
      if (sk.drain && dealt) heal(u, u, dealt * sk.drain, sk);
      const ts = S(t);
      if (sk.stun && ts.stun <= 0) {
        ts.stun = sk.stun;
        status(t, "stun", true);
      }
      if (sk.burn) {
        ts.burn = { n: EFFECT_TURNS, dmg: Math.max(1, Math.round(effAtk(u) * sk.burn)) };
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

  const basic = (u: Unit): void => {
    const enemies = foes(u);
    if (u.cls === "support") {
      const hurt = lowest(friends(u).filter((f) => f.hp < f.maxHp));
      if (hurt) {
        heal(u, hurt, u.atk * 1.1);
        return;
      }
    }
    let target: Unit;
    if (u.cls === "mage") target = [...enemies].sort((x, y) => x.hp - y.hp)[0];
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

  while (round < maxRounds && alive(a).length && alive(b).length) {
    round += 1;
    const order = alive(all).sort((x, y) => {
      const sx = x.spd + (x.cls === "assassin" ? 20 : 0) + rng();
      const sy = y.spd + (y.cls === "assassin" ? 20 : 0) + rng();
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

      let used = false;
      if (s.en >= ENERGY.max && cast(u, ULTIMATES[u.cls], true)) {
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

  const left = (xs: Unit[]) => xs.reduce((sum, u) => sum + Math.max(0, u.hp), 0) / xs.reduce((sum, u) => sum + u.maxHp, 0);
  const timeout = alive(a).length > 0 && alive(b).length > 0;
  const winner: "a" | "b" = timeout ? (left(a) >= left(b) ? "a" : "b") : alive(a).length ? "a" : "b";
  const snap = (xs: Unit[]) => xs.map((u) => ({ key: u.key, hp: u.hp, maxHp: u.maxHp }));
  return { winner, rounds: round, events, a: snap(a), b: snap(b), timeout };
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
