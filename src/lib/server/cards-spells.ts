/** Коллекция карт боя: получение (свитки, создание, награды за победы), распыление, просмотр новых */

import { SPELL_CRAFT, SPELL_DROP, SPELL_DROP_WEIGHTS, SPELL_DUST, SPELL_SCROLL, STARTER_SPELLS, TACTICS, tacticDef } from "../cards/tactics";
import { fail, addMoney, type Res } from "./cards";
import { getExtra, setExtra } from "./cards-extra";
import { transaction, type Database } from "./sqlite";

export interface SpellsState {
  /** id собранных карт боя */
  own: string[];
  /** новые, ещё не просмотренные */
  fresh: string[];
}

export function getSpells(db: Database, userId: number): SpellsState {
  const raw = getExtra(db, userId).spells;
  const own = Array.from(new Set([...STARTER_SPELLS, ...(raw?.own ?? [])])).filter((id) => tacticDef(id));
  return { own, fresh: (raw?.fresh ?? []).filter((id) => own.includes(id)) };
}

const save = (db: Database, userId: number, s: SpellsState): void => {
  const x = getExtra(db, userId);
  x.spells = { own: s.own, fresh: s.fresh };
  setExtra(db, userId, x);
};

const pickRank = (rng: () => number, weights: readonly number[]): number => {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return 0;
};
const pickCard = (rng: () => number, weights: readonly number[]): string => {
  const rank = pickRank(rng, weights);
  const fresh = TACTICS.filter((t) => t.rank === rank && !t.starter);
  const pool = fresh.length ? fresh : TACTICS.filter((t) => t.rank === rank);
  return pool[Math.floor(rng() * pool.length)].id;
};

/** Выдать карту: новая попадает в коллекцию, повтор превращается в пыль */
function grant(db: Database, userId: number, s: SpellsState, id: string): { id: string; dup: boolean; dust: number } {
  const d = tacticDef(id)!;
  if (s.own.includes(id)) {
    const dust = SPELL_DUST[d.rank];
    addMoney(db, userId, "dust", dust);
    return { id, dup: true, dust };
  }
  s.own.push(id);
  s.fresh.push(id);
  return { id, dup: false, dust: 0 };
}

/** Свиток карт боя за пыль */
export function openSpellScroll(db: Database, userId: number, rng: () => number = Math.random): Res<{ cards: { id: string; dup: boolean; dust: number }[] }> {
  return transaction(db, (): Res<{ cards: { id: string; dup: boolean; dust: number }[] }> => {
    if (!addMoney(db, userId, "dust", -SPELL_SCROLL.cost)) return fail(`Нужно ${SPELL_SCROLL.cost} пыли`);
    const s = getSpells(db, userId);
    const cards = Array.from({ length: SPELL_SCROLL.count }, () => grant(db, userId, s, pickCard(rng, SPELL_SCROLL.weights)));
    save(db, userId, s);
    return { ok: true, value: { cards } };
  });
}

/** Создать нужную карту за пыль */
export function craftSpell(db: Database, userId: number, id: string): Res<{ id: string }> {
  const d = tacticDef(id);
  if (!d) return fail("Нет такой карты");
  return transaction(db, (): Res<{ id: string }> => {
    const s = getSpells(db, userId);
    if (s.own.includes(id)) return fail("Эта карта уже в коллекции");
    if (!addMoney(db, userId, "dust", -SPELL_CRAFT[d.rank])) return fail(`Нужно ${SPELL_CRAFT[d.rank]} пыли`);
    s.own.push(id);
    s.fresh.push(id);
    save(db, userId, s);
    return { ok: true, value: { id } };
  });
}

/** Карты уже просмотрены */
export function spellsSeen(db: Database, userId: number): Res<SpellsState> {
  const s = getSpells(db, userId);
  s.fresh = [];
  save(db, userId, s);
  return { ok: true, value: s };
}

/** Победа в бою: шанс получить карту боя */
export function spellDropOnWin(db: Database, userId: number, kind: string, rng: () => number = Math.random): void {
  const chance = SPELL_DROP[kind];
  if (!chance || rng() >= chance) return;
  const s = getSpells(db, userId);
  grant(db, userId, s, pickCard(rng, SPELL_DROP_WEIGHTS));
  save(db, userId, s);
}
