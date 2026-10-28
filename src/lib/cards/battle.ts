/** Детерминированная симуляция боя 4×4. Чистая функция: общий код сервера и тестов. */

import { BATTLE, ELEMENTS, type CardClass, type Element } from "./config";

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
}

export type BattleEvent =
  | { t: "hit"; from: string; to: string; dmg: number; crit: boolean; adv: number; round: number; hp: number; dead: boolean; guard?: string }
  | { t: "heal"; from: string; to: string; amount: number; round: number; hp: number };

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

export function simulate(aIn: Unit[], bIn: Unit[], rng: () => number): BattleOutcome {
  const a = aIn.map((u) => ({ ...u }));
  const b = bIn.map((u) => ({ ...u }));
  const all = [...a, ...b];
  const events: BattleEvent[] = [];
  let round = 0;
  const foes = (u: Unit) => alive(u.side === "a" ? b : a);
  const friends = (u: Unit) => alive(u.side === "a" ? a : b);

  while (round < BATTLE.maxRounds && alive(a).length && alive(b).length) {
    round += 1;
    const order = alive(all).sort((x, y) => {
      const sx = x.spd + (x.cls === "assassin" ? 20 : 0) + rng();
      const sy = y.spd + (y.cls === "assassin" ? 20 : 0) + rng();
      return sy - sx;
    });
    for (const u of order) {
      if (u.hp <= 0) continue;
      const enemies = foes(u);
      if (!enemies.length) break;

      if (u.cls === "support") {
        const hurt = friends(u)
          .filter((f) => f.hp < f.maxHp)
          .sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
        if (hurt) {
          const amount = Math.min(hurt.maxHp - hurt.hp, Math.round(u.atk * 1.1));
          hurt.hp += amount;
          events.push({ t: "heal", from: u.key, to: hurt.key, amount, round, hp: hurt.hp });
          continue;
        }
      }

      let target: Unit;
      if (u.cls === "mage") target = [...enemies].sort((x, y) => x.hp - y.hp)[0];
      else {
        target = enemies[Math.floor(rng() * enemies.length)];
      }
      let guard: string | undefined;
      const tank = enemies.find((e) => e.cls === "tank" && e.key !== target.key);
      if (tank && target.cls !== "tank" && rng() < 0.35) {
        guard = target.key;
        target = tank;
      }
      const adv = advantage(u.element, target.element);
      const critChance = u.cls === "assassin" ? 0.25 : 0.08;
      const crit = rng() < critChance;
      const raw = u.atk * (u.cls === "warrior" ? 1.1 : 1) * (crit ? 1.6 : 1) * adv * (0.9 + rng() * 0.2);
      const dmg = Math.max(1, Math.round((raw * 100) / (100 + target.def * 0.8)));
      target.hp = Math.max(0, target.hp - dmg);
      events.push({ t: "hit", from: u.key, to: target.key, dmg, crit, adv, round, hp: target.hp, dead: target.hp <= 0, guard });
    }
  }

  const left = (xs: Unit[]) => xs.reduce((s, u) => s + Math.max(0, u.hp), 0) / xs.reduce((s, u) => s + u.maxHp, 0);
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
