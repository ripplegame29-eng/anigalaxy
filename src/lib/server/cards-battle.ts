/** Карточные бои: колода, лига, соперник (игрок или бот), награды. */

import { applyMods, seeded, simulate, type BattleOutcome, type Unit } from "../cards/battle";
import { CATALOG, cardDef, cardsOfRank } from "../cards/catalog";
import { defaultLoadout } from "../cards/skills";
import { BATTLE, DECK_SIZE, leagueOf, weeklyMods, type Rank } from "../cards/config";
import {
  addMoney,
  addScroll,
  bumpMission,
  fail,
  getWallet,
  isPremium,
  listInventory,
  logEvent,
  statMul,
  type InvCard,
  type Res,
  type Rng,
} from "./cards";
import { num, str, transaction, type Database } from "./sqlite";

export const weekIndexOf = (ms: number): number => Math.floor((ms - 4 * 86_400_000) / (7 * 86_400_000));

export function unitOf(card: { id?: number; cardId: string; level: number; foil: boolean; skills?: string[] }, side: "a" | "b", slot: number): Unit | null {
  const def = cardDef(card.cardId);
  if (!def) return null;
  const m = statMul(card);
  return {
    key: `${side}${slot}`,
    side,
    slot,
    cardId: def.id,
    name: def.name,
    rank: def.rank,
    element: def.element,
    cls: def.cls,
    atk: Math.round(def.atk * m),
    def: Math.round(def.def * m),
    hp: Math.round(def.hp * m),
    maxHp: Math.round(def.hp * m),
    spd: def.spd,
    foil: card.foil,
    level: card.level,
    skills: card.skills?.length ? card.skills : defaultLoadout(def.cls, def.element, def.rank),
  };
}

export function setDeck(db: Database, userId: number, ids: number[]): Res<number[]> {
  if (ids.length > DECK_SIZE) return fail(`В колоде не больше ${DECK_SIZE} карт`);
  const inv = new Map(listInventory(db, userId).map((c) => [c.id, c]));
  const seenCards = new Set<string>();
  for (const id of ids) {
    const c = inv.get(id);
    if (!c) return fail("Карта не найдена");
    if (c.listed) return fail("Карта выставлена на аукцион или в обмен");
    if (seenCards.has(c.cardId)) return fail("В колоде не может быть двух одинаковых персонажей");
    seenCards.add(c.cardId);
  }
  getWallet(db, userId, undefined, false);
  db.prepare("UPDATE card_wallet SET deck = ? WHERE user_id = ?").run(JSON.stringify(ids), userId);
  return { ok: true, value: ids };
}

/** Бот под рейтинг игрока */
export function botSquad(rating: number, rng: Rng): Unit[] {
  const li = Math.max(0, ["bronze", "silver", "gold", "platinum", "diamond", "legend"].indexOf(leagueOf(rating).id));
  const weights = [
    [70, 25, 5, 0, 0],
    [40, 40, 17, 3, 0],
    [15, 40, 35, 9, 1],
    [5, 25, 45, 22, 3],
    [0, 10, 40, 40, 10],
    [0, 0, 30, 50, 20],
  ][li];
  const level = Math.max(1, Math.min(12, 1 + Math.floor((rating - 900) / 150)));
  const used = new Set<string>();
  const out: Unit[] = [];
  for (let i = 0; i < DECK_SIZE; i += 1) {
    let t = rng() * weights.reduce((a, b) => a + b, 0);
    let rank = 0;
    for (let r = 0; r < weights.length; r += 1) {
      t -= weights[r];
      if (t < 0) {
        rank = r;
        break;
      }
    }
    const pool = cardsOfRank(rank as Rank).filter((c) => !used.has(c.id));
    const def = (pool.length ? pool : CATALOG)[Math.floor(rng() * (pool.length || CATALOG.length))];
    used.add(def.id);
    const u = unitOf({ cardId: def.id, level, foil: false }, "b", i);
    if (u) out.push(u);
  }
  return out;
}

function deckUnits(db: Database, userId: number, side: "a" | "b"): Unit[] | null {
  const w = getWallet(db, userId, undefined, false);
  const inv = new Map(listInventory(db, userId).map((c) => [c.id, c]));
  const units: Unit[] = [];
  w.deck.forEach((id, slot) => {
    const c = inv.get(id);
    const u = c ? unitOf(c, side, slot) : null;
    if (u) units.push(u);
  });
  return units.length === DECK_SIZE ? units : null;
}

export interface BattleReport {
  outcome: BattleOutcome;
  you: Unit[];
  foe: Unit[];
  foeName: string;
  foeRating: number;
  pvp: boolean;
  win: boolean;
  reward: { diamonds: number; dust: number; rating: number; scroll: number };
  rating: number;
  energy: number;
  training: boolean;
}

function findOpponent(db: Database, userId: number, rating: number, rng: Rng): { id: number; nick: string; rating: number } | null {
  const rows = db
    .prepare(
      `SELECT w.user_id, w.rating, u.nickname FROM card_wallet w JOIN users u ON u.id = w.user_id
       WHERE w.user_id != ? AND w.deck != '[]' AND ABS(w.rating - ?) <= 300 ORDER BY ABS(w.rating - ?) LIMIT 12`,
    )
    .all(userId, rating, rating);
  const pool = rows.filter((r) => deckUnits(db, num(r.user_id), "b"));
  if (!pool.length) return null;
  const r = pool[Math.floor(rng() * pool.length)];
  return { id: num(r.user_id), nick: str(r.nickname), rating: num(r.rating) };
}

export function fight(
  db: Database,
  userId: number,
  opts: { training?: boolean } = {},
  now = Date.now(),
  rng: Rng = Math.random,
): Res<BattleReport> {
  return transaction(db, (): Res<BattleReport> => {
    const w = getWallet(db, userId, now);
    const mine = deckUnits(db, userId, "a");
    if (!mine) return fail(`Соберите колоду из ${DECK_SIZE} карт`);
    const training = !!opts.training;
    if (!training && w.energy < BATTLE.energyCost) return fail("Нет энергии — подождите или восстановите её");

    const opp = training ? null : findOpponent(db, userId, w.rating, rng);
    const foe = opp ? deckUnits(db, opp.id, "b")! : botSquad(w.rating, rng);
    const mods = weeklyMods(weekIndexOf(now));
    const outcome = simulate(applyMods(mine, mods), applyMods(foe, mods), rng);
    const win = outcome.winner === "a";

    const reward = { diamonds: 0, dust: 0, rating: 0, scroll: 0 };
    let rating = w.rating;
    let energy = w.energy;
    if (!training) {
      const base = win ? BATTLE.win : BATTLE.lose;
      const mul = isPremium(db, userId, now) ? 1.25 : 1;
      reward.diamonds = Math.round(base.diamonds * mul);
      reward.dust = Math.round(base.dust * mul);
      reward.rating = base.rating;
      if (win && rng() < 0.2) {
        reward.scroll = 1;
        addScroll(db, userId, Math.min(4, Math.max(0, ["bronze", "silver", "gold", "platinum", "diamond", "legend"].indexOf(leagueOf(w.rating).id) - 1)), 1);
      }
      addMoney(db, userId, "diamonds", reward.diamonds);
      addMoney(db, userId, "dust", reward.dust);
      rating = Math.max(0, w.rating + reward.rating);
      energy = w.energy - BATTLE.energyCost;
      db.prepare(
        "UPDATE card_wallet SET rating = ?, energy = ?, energy_at = CASE WHEN energy >= ? THEN ? ELSE energy_at END, wins = wins + ?, losses = losses + ? WHERE user_id = ?",
      ).run(rating, energy, 10, now, win ? 1 : 0, win ? 0 : 1, userId);
      if (win) bumpMission(db, userId, "win3", 1, now);
      if (opp) {
        // соперник в защите: победа даёт немного очков, поражение отнимает меньше
        const delta = win ? -8 : 8;
        db.prepare("UPDATE card_wallet SET rating = MAX(0, rating + ?) WHERE user_id = ?").run(delta, opp.id);
        logEvent(db, opp.id, "battle", win ? "Вас победили в бою (−8 рейтинга)" : "Вы отбили нападение (+8 рейтинга)", "", 0, now);
      }
      logEvent(db, userId, "battle", `${win ? "Победа" : "Поражение"} над ${opp ? opp.nick : "ботом"} (${reward.rating > 0 ? "+" : ""}${reward.rating})`, "", 0, now);
    }
    return {
      ok: true,
      value: {
        outcome,
        you: applyMods(mine, mods),
        foe: applyMods(foe, mods),
        foeName: opp ? opp.nick : "Тренировочный бот",
        foeRating: opp ? opp.rating : w.rating,
        pvp: !!opp,
        win,
        reward,
        rating,
        energy,
        training,
      },
    };
  });
}

export function buyEnergy(db: Database, userId: number, now = Date.now()): Res<number> {
  return transaction(db, (): Res<number> => {
    const w = getWallet(db, userId, now);
    if (w.energy >= 10) return fail("Энергия уже полная");
    if (!addMoney(db, userId, "diamonds", -15)) return fail("Не хватает алмазов (15 💎)");
    db.prepare("UPDATE card_wallet SET energy = 10, energy_at = ? WHERE user_id = ?").run(now, userId);
    return { ok: true, value: 10 };
  });
}

export function ratingTop(db: Database, limit = 20) {
  return db
    .prepare(
      `SELECT w.user_id, w.rating, w.wins, w.losses, u.nickname FROM card_wallet w JOIN users u ON u.id = w.user_id
       WHERE w.wins + w.losses > 0 ORDER BY w.rating DESC, w.wins DESC LIMIT ?`,
    )
    .all(limit)
    .map((r, i) => ({ place: i + 1, userId: num(r.user_id), nick: str(r.nickname), rating: num(r.rating), wins: num(r.wins), losses: num(r.losses) }));
}

export { seeded };
export type { InvCard };
