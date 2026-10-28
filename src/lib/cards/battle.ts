/**
 * Детерминированная симуляция боя 4×4 с умениями.
 * Чистая функция: общий код сервера, интерфейса и тестов.
 *
 * Ход героя: горение → истечение эффектов → оглушение → перезарядка →
 * первое готовое умение из набора (порядок = приоритет) → иначе обычная атака.
 */

import { BATTLE, ELEMENTS, type CardClass, type Element } from "./config";
import { skillDef, type Skill, type SkillFx } from "./skills";

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
}

export type StatusKind = "stun" | "burn" | "atkUp" | "defDown" | "taunt" | "shield";

export type BattleEvent =
  | { t: "cast"; from: string; skill: string; fx: SkillFx; targets: string[]; round: number }
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
}

const EFFECT_TURNS = 3;

export function simulate(aIn: Unit[], bIn: Unit[], rng: () => number): BattleOutcome {
  const a = aIn.map((u) => ({ ...u }));
  const b = bIn.map((u) => ({ ...u }));
  const all = [...a, ...b];
  const events: BattleEvent[] = [];
  let round = 0;
  const foes = (u: Unit) => alive(u.side === "a" ? b : a);
  const friends = (u: Unit) => alive(u.side === "a" ? a : b);

  const st = new Map<string, State>();
  for (const u of all) {
    const cd = new Map<string, number>();
    for (const id of u.skills ?? []) {
      const sk = skillDef(id);
      if (sk) cd.set(id, Math.max(0, sk.cd - 2));
    }
    st.set(u.key, { cd, stun: 0, atkUp: { n: 0, v: 0 }, defDown: { n: 0, v: 0 }, burn: { n: 0, dmg: 0 }, taunt: 0, shield: 0, shieldN: 0 });
  }
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
    const critChance = u.cls === "assassin" ? 0.25 : 0.08;
    const crit = rng() < critChance;
    let raw = effAtk(u) * power * (u.cls === "warrior" ? 1.1 : 1) * (crit ? 1.6 : 1) * adv * (0.9 + rng() * 0.2);
    if (skill?.exec && target.hp / target.maxHp < 0.35) raw *= skill.exec;
    const dmg = Math.max(1, Math.round((raw * 100) / (100 + effDef(target) * 0.8)));
    const { absorbed } = damage(target, dmg);
    events.push({ t: "hit", from: u.key, to: target.key, dmg, crit, adv, round, hp: target.hp, dead: target.hp <= 0, guard, skill: skill?.id, absorbed, sh: S(target).shield });
    if (target.hp <= 0) {
      const s = S(target);
      s.stun = 0;
      s.shield = 0;
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

  const cast = (u: Unit, sk: Skill) => {
    const targets = targetsOf(u, sk).filter((t) => t.hp > 0);
    if (!targets.length) return;
    events.push({ t: "cast", from: u.key, skill: sk.id, fx: sk.fx, targets: targets.map((t) => t.key), round });
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
    strike(u, target, 1, undefined, guard);
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

  while (round < BATTLE.maxRounds && alive(a).length && alive(b).length) {
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
        events.push({ t: "dot", to: u.key, dmg: s.burn.dmg, round, hp: u.hp, dead: u.hp <= 0, sh: s.shield });
        void absorbed;
        if (s.burn.n === 0) status(u, "burn", false);
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

      let used = false;
      for (const id of u.skills ?? []) {
        const sk = skillDef(id);
        if (!sk || (s.cd.get(id) ?? 0) > 0 || !useful(u, sk)) continue;
        cast(u, sk);
        s.cd.set(id, sk.cd);
        used = true;
        break;
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
