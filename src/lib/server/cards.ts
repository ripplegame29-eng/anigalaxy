/**
 * Карточная система: кошелёк, коллекция, паки, переплавка, раскол, улучшение,
 * заточка, обмен и аукцион. Всё считает сервер — браузер только показывает.
 *
 * Валюты карточек живут в `card_wallet` (алмазы, пыль, свитки, энергия) и не
 * зависят от клиентского документа прогресса, поэтому гонок с синхронизацией
 * нет. Единственный мост к AC — `exchangeAc` (с суточным лимитом).
 */

import {
  AUCTION,
  DAILY_LOGIN,
  DUST_VALUE,
  ENERGY_REGEN_MS,
  EXCHANGE,
  FOIL_BONUS,
  LEVEL_BONUS,
  MAX_ENERGY,
  MAX_LEVEL,
  MAX_RANK,
  MELT,
  MISSIONS,
  PACK,
  SCROLL_DUST,
  SHARPEN_PITY_STEP,
  SPLIT,
  STARTER,
  UPGRADE,
  sharpenChance,
  type Rank,
} from "../cards/config";
import { cardDef, cardsOfRank } from "../cards/catalog";
import { PROGRESS_DOC_KEY } from "../sync-keys";
import { adjustBalance } from "./admin-edit";
import { dayKey } from "./day";
import { getDoc } from "./docs";
import { num, str, transaction, type Database } from "./sqlite";
import { findUserById, type UserRow } from "./users";

const SYSTEM = { nickname: "AniGalaxy" } as unknown as UserRow;

export type Res<T> = { ok: true; value: T } | { ok: false; error: string };
export const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
export type Rng = () => number;

/* --------------------------------- Кошелёк -------------------------------- */

export interface Wallet {
  diamonds: number;
  dust: number;
  packs: number;
  energy: number;
  energyAt: number;
  scrolls: number[];
  pityEpic: number;
  pityLegend: number;
  deck: number[];
  rating: number;
  wins: number;
  losses: number;
  loginDay: string;
}

function parseArr(raw: unknown, fallback: number[]): number[] {
  try {
    const v = JSON.parse(str(raw)) as unknown;
    return Array.isArray(v) ? v.map((x) => num(x)) : fallback;
  } catch {
    return fallback;
  }
}

export function isPremium(db: Database, userId: number, now = Date.now()): boolean {
  const u = findUserById(db, userId);
  return !!u && u.premiumUntil > now;
}

/** Кошелёк игрока; при первом обращении выдаёт стартовый набор */
export function getWallet(db: Database, userId: number, now = Date.now(), regen = true): Wallet {
  let row = db.prepare("SELECT * FROM card_wallet WHERE user_id = ?").get(userId);
  if (!row) {
    db.prepare(
      "INSERT OR IGNORE INTO card_wallet (user_id, diamonds, dust, packs, energy, energy_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(userId, STARTER.diamonds, STARTER.dust, STARTER.packs, STARTER.energy, now, now);
    row = db.prepare("SELECT * FROM card_wallet WHERE user_id = ?").get(userId);
  }
  if (!row) throw new Error("wallet");
  let energy = num(row.energy);
  let energyAt = num(row.energy_at);
  if (!regen) {
    /* внутренние обращения не двигают таймер энергии */
  } else if (energy < MAX_ENERGY) {
    const gain = Math.floor((now - energyAt) / ENERGY_REGEN_MS);
    if (gain > 0) {
      energy = Math.min(MAX_ENERGY, energy + gain);
      energyAt = energy >= MAX_ENERGY ? now : energyAt + gain * ENERGY_REGEN_MS;
      db.prepare("UPDATE card_wallet SET energy = ?, energy_at = ? WHERE user_id = ?").run(energy, energyAt, userId);
    }
  } else if (energyAt !== now && now - energyAt > 0) {
    energyAt = now;
    db.prepare("UPDATE card_wallet SET energy_at = ? WHERE user_id = ?").run(now, userId);
  }
  const scrolls = parseArr(row.scrolls, [0, 0, 0, 0, 0]);
  while (scrolls.length < 5) scrolls.push(0);
  return {
    diamonds: num(row.diamonds),
    dust: num(row.dust),
    packs: num(row.packs),
    energy,
    energyAt,
    scrolls,
    pityEpic: num(row.pity_epic),
    pityLegend: num(row.pity_legend),
    deck: parseArr(row.deck, []),
    rating: num(row.rating),
    wins: num(row.wins),
    losses: num(row.losses),
    loginDay: str(row.login_day),
  };
}

type Money = "diamonds" | "dust" | "packs";

/** Изменить валюту; при списании вернёт false, если не хватает */
export function addMoney(db: Database, userId: number, field: Money, delta: number): boolean {
  const done = db
    .prepare(`UPDATE card_wallet SET ${field} = ${field} + ? WHERE user_id = ? AND ${field} + ? >= 0`)
    .run(delta, userId, delta);
  return num((done as { changes?: number }).changes) > 0;
}

export function addScroll(db: Database, userId: number, rank: number, delta: number): boolean {
  const w = getWallet(db, userId, undefined, false);
  if (w.scrolls[rank] + delta < 0) return false;
  w.scrolls[rank] += delta;
  db.prepare("UPDATE card_wallet SET scrolls = ? WHERE user_id = ?").run(JSON.stringify(w.scrolls), userId);
  return true;
}

export function logEvent(db: Database, userId: number, kind: string, text: string, cardId = "", rank = 0, now = Date.now()): void {
  db.prepare("INSERT INTO card_log (user_id, kind, text, card_id, rank, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    userId,
    kind,
    text,
    cardId,
    rank,
    now,
  );
}

/* ------------------------------- Коллекция -------------------------------- */

export interface InvCard {
  id: number;
  cardId: string;
  foil: boolean;
  level: number;
  pity: number;
  locked: boolean;
  listed: boolean;
}

const rowToInv = (r: Record<string, unknown>): InvCard => ({
  id: num(r.id),
  cardId: str(r.card_id),
  foil: num(r.foil) === 1,
  level: num(r.level),
  pity: num(r.pity),
  locked: num(r.locked) === 1,
  listed: num(r.listed) === 1,
});

export function listInventory(db: Database, userId: number): InvCard[] {
  return db.prepare("SELECT * FROM card_inv WHERE user_id = ? ORDER BY id DESC").all(userId).map(rowToInv);
}

export function addCard(db: Database, userId: number, cardId: string, now = Date.now(), foil = false, level = 1, pity = 0): number {
  const info = db
    .prepare("INSERT INTO card_inv (user_id, card_id, foil, level, pity, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(userId, cardId, foil ? 1 : 0, level, pity, now);
  return num(info.lastInsertRowid);
}

function loadOwned(db: Database, userId: number, ids: number[]): InvCard[] | null {
  const uniq = [...new Set(ids.map((x) => Math.floor(num(x))))];
  if (uniq.length !== ids.length) return null;
  const out: InvCard[] = [];
  for (const id of uniq) {
    const r = db.prepare("SELECT * FROM card_inv WHERE id = ? AND user_id = ?").get(id, userId);
    if (!r) return null;
    out.push(rowToInv(r));
  }
  return out;
}

function checkFree(cards: InvCard[]): string | null {
  if (cards.some((c) => c.locked)) return "Среди карт есть заблокированные";
  if (cards.some((c) => c.listed)) return "Среди карт есть выставленные на аукцион или в обмен";
  return null;
}

const rankOf = (cardId: string): Rank => (cardDef(cardId)?.rank ?? 0) as Rank;

const pickRandom = <T,>(arr: T[], rng: Rng): T => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];

function removeCards(db: Database, userId: number, ids: number[]): void {
  for (const id of ids) db.prepare("DELETE FROM card_inv WHERE id = ? AND user_id = ?").run(id, userId);
  // колода не должна ссылаться на удалённое
  const w = getWallet(db, userId, undefined, false);
  const deck = w.deck.filter((d) => !ids.includes(d));
  if (deck.length !== w.deck.length) db.prepare("UPDATE card_wallet SET deck = ? WHERE user_id = ?").run(JSON.stringify(deck), userId);
}

/** Сила карты с учётом уровня и фольги */
export function statMul(c: { level: number; foil: boolean }): number {
  return 1 + LEVEL_BONUS * (c.level - 1) + (c.foil ? FOIL_BONUS : 0);
}

export function toggleLock(db: Database, userId: number, invId: number): Res<boolean> {
  const r = db.prepare("SELECT locked, listed FROM card_inv WHERE id = ? AND user_id = ?").get(invId, userId);
  if (!r) return fail("Карта не найдена");
  const next = num(r.locked) === 1 ? 0 : 1;
  db.prepare("UPDATE card_inv SET locked = ? WHERE id = ?").run(next, invId);
  return { ok: true, value: next === 1 };
}

/* --------------------------------- Миссии --------------------------------- */

interface MissionState {
  progress: Record<string, number>;
  claimed: Record<string, boolean>;
}

function missionState(db: Database, userId: number, now: number): MissionState {
  const row = db.prepare("SELECT mission_day, missions FROM card_wallet WHERE user_id = ?").get(userId);
  const today = dayKey(now);
  if (!row || str(row.mission_day) !== today) {
    db.prepare("UPDATE card_wallet SET mission_day = ?, missions = '{}' WHERE user_id = ?").run(today, userId);
    return { progress: {}, claimed: {} };
  }
  try {
    const v = JSON.parse(str(row.missions)) as Partial<MissionState>;
    return { progress: v.progress ?? {}, claimed: v.claimed ?? {} };
  } catch {
    return { progress: {}, claimed: {} };
  }
}

export function bumpMission(db: Database, userId: number, id: string, n = 1, now = Date.now()): void {
  getWallet(db, userId, now);
  const st = missionState(db, userId, now);
  st.progress[id] = (st.progress[id] ?? 0) + n;
  db.prepare("UPDATE card_wallet SET missions = ? WHERE user_id = ?").run(JSON.stringify(st), userId);
}

export function missionList(db: Database, userId: number, now = Date.now()) {
  const st = missionState(db, userId, now);
  return MISSIONS.map((m) => ({
    ...m,
    progress: Math.min(m.goal, st.progress[m.id] ?? 0),
    claimed: !!st.claimed[m.id],
  }));
}

export function claimMission(db: Database, userId: number, id: string, now = Date.now()): Res<{ diamonds: number; dust: number; scroll: number }> {
  const m = MISSIONS.find((x) => x.id === id);
  if (!m) return fail("Нет такого задания");
  return transaction(db, (): Res<{ diamonds: number; dust: number; scroll: number }> => {
    getWallet(db, userId, now);
    const st = missionState(db, userId, now);
    if (st.claimed[id]) return fail("Награда уже получена");
    if ((st.progress[id] ?? 0) < m.goal) return fail("Задание ещё не выполнено");
    st.claimed[id] = true;
    db.prepare("UPDATE card_wallet SET missions = ? WHERE user_id = ?").run(JSON.stringify(st), userId);
    const r = m.reward as { diamonds?: number; dust?: number; scroll?: number };
    if (r.diamonds) addMoney(db, userId, "diamonds", r.diamonds);
    if (r.dust) addMoney(db, userId, "dust", r.dust);
    if (r.scroll) addScroll(db, userId, 1, r.scroll);
    logEvent(db, userId, "mission", `Задание «${m.text}» выполнено`, "", 0, now);
    return { ok: true, value: { diamonds: r.diamonds ?? 0, dust: r.dust ?? 0, scroll: r.scroll ?? 0 } };
  });
}

/* ------------------------------ Ежедневный вход --------------------------- */

export function claimDaily(db: Database, userId: number, now = Date.now()): Res<{ diamonds: number; dust: number; packs: number }> {
  return transaction(db, (): Res<{ diamonds: number; dust: number; packs: number }> => {
    const w = getWallet(db, userId, now);
    const today = dayKey(now);
    if (w.loginDay === today) return fail("Сегодняшний подарок уже забран");
    const pro = isPremium(db, userId, now);
    const mul = pro ? 2 : 1;
    const gift = { diamonds: DAILY_LOGIN.diamonds * mul, dust: DAILY_LOGIN.dust * mul, packs: 1 + (pro ? 1 : 0) };
    db.prepare("UPDATE card_wallet SET login_day = ? WHERE user_id = ?").run(today, userId);
    addMoney(db, userId, "diamonds", gift.diamonds);
    addMoney(db, userId, "dust", gift.dust);
    addMoney(db, userId, "packs", gift.packs);
    logEvent(db, userId, "daily", `Ежедневный подарок: ${gift.diamonds} 💎, ${gift.dust} пыли, ${gift.packs} пак(а)`, "", 0, now);
    return { ok: true, value: gift };
  });
}

/* ---------------------------------- Паки ---------------------------------- */

function rollRank(rng: Rng, luck: number): Rank {
  const w = PACK.weights.map((x, i) => (i === 0 ? x : x * luck));
  const total = w.reduce((a, b) => a + b, 0);
  let t = rng() * total;
  for (let i = 0; i < w.length; i += 1) {
    t -= w[i];
    if (t < 0) return i as Rank;
  }
  return 0;
}

export interface PackResult {
  offers: string[];
  picked: number | null;
  chosen: { invId: number; cardId: string } | null;
  dustBack: number;
}

/** Три предложения пака с учётом гарантии */
function drawOffers(w: Wallet, rng: Rng, luck: number): { offers: string[]; best: Rank } {
  const ranks: Rank[] = [];
  for (let i = 0; i < PACK.choices; i += 1) ranks.push(rollRank(rng, luck));
  let best = Math.max(...ranks) as Rank;
  const needLegend = w.pityLegend + 1 >= PACK.pityLegend;
  const needEpic = w.pityEpic + 1 >= PACK.pityEpic;
  if (needLegend && best < 3) {
    ranks[0] = 3;
    best = Math.max(...ranks) as Rank;
  } else if (needEpic && best < 2) {
    ranks[0] = 2;
    best = Math.max(...ranks) as Rank;
  }
  const used = new Set<string>();
  const offers = ranks.map((r) => {
    const pool = cardsOfRank(r).filter((c) => !used.has(c.id));
    const card = pickRandom(pool.length ? pool : cardsOfRank(r), rng);
    used.add(card.id);
    return card.id;
  });
  return { offers, best };
}

function finishPick(db: Database, userId: number, offers: string[], index: number, now: number): PackResult {
  const cardId = offers[index];
  const invId = addCard(db, userId, cardId, now);
  let dustBack = 0;
  offers.forEach((id, i) => {
    if (i !== index) dustBack += Math.floor(DUST_VALUE[rankOf(id)] / 4);
  });
  if (dustBack) addMoney(db, userId, "dust", dustBack);
  const def = cardDef(cardId);
  if (def) {
    logEvent(db, userId, "pull", `Из пака выпала «${def.name}»`, cardId, def.rank, now);
  }
  return { offers, picked: index, chosen: { invId, cardId }, dustBack };
}

const bestIndex = (offers: string[], rng: Rng): number => {
  const max = Math.max(...offers.map(rankOf));
  const idx = offers.map((id, i) => (rankOf(id) === max ? i : -1)).filter((i) => i >= 0);
  return pickRandom(idx, rng);
};

export function openPacks(
  db: Database,
  userId: number,
  opts: { count: number; pay: "token" | "diamonds" | "dust"; quick?: boolean },
  now = Date.now(),
  rng: Rng = Math.random,
): Res<{ results: PackResult[]; pending: string[] | null }> {
  const bundle = PACK.bundles.find((b) => b.n === opts.count);
  if (!bundle) return fail("Недоступное количество паков");
  if (!["token", "diamonds", "dust"].includes(opts.pay)) return fail("Недоступный способ оплаты");
  return transaction(db, (): Res<{ results: PackResult[]; pending: string[] | null }> => {
    const w = getWallet(db, userId, now);
    if (db.prepare("SELECT 1 FROM card_pending WHERE user_id = ?").get(userId)) return fail("Сначала выберите карту из открытого пака");
    if (opts.pay === "token") {
      if (!addMoney(db, userId, "packs", -bundle.n)) return fail("Не хватает паков");
    } else if (opts.pay === "diamonds") {
      if (!addMoney(db, userId, "diamonds", -PACK.diamonds * bundle.pay)) return fail("Не хватает алмазов");
    } else if (!addMoney(db, userId, "dust", -PACK.dust * bundle.pay)) return fail("Не хватает пыли");

    const luck = isPremium(db, userId, now) ? PACK.premiumBonusLuck : 1;
    const results: PackResult[] = [];
    let pityEpic = w.pityEpic;
    let pityLegend = w.pityLegend;
    for (let i = 0; i < bundle.n; i += 1) {
      const { offers, best } = drawOffers({ ...w, pityEpic, pityLegend }, rng, luck);
      pityEpic = best >= 2 ? 0 : pityEpic + 1;
      pityLegend = best >= 3 ? 0 : pityLegend + 1;
      if (bundle.n === 1 && !opts.quick) {
        db.prepare("INSERT INTO card_pending (user_id, offers, created_at) VALUES (?, ?, ?)").run(userId, JSON.stringify(offers), now);
        db.prepare("UPDATE card_wallet SET pity_epic = ?, pity_legend = ? WHERE user_id = ?").run(pityEpic, pityLegend, userId);
        bumpMission(db, userId, "pack1", 1, now);
        return { ok: true, value: { results: [], pending: offers } };
      }
      results.push(finishPick(db, userId, offers, bestIndex(offers, rng), now));
    }
    db.prepare("UPDATE card_wallet SET pity_epic = ?, pity_legend = ? WHERE user_id = ?").run(pityEpic, pityLegend, userId);
    bumpMission(db, userId, "pack1", bundle.n, now);
    return { ok: true, value: { results, pending: null } };
  });
}

export function pendingPack(db: Database, userId: number): string[] | null {
  const r = db.prepare("SELECT offers FROM card_pending WHERE user_id = ?").get(userId);
  if (!r) return null;
  try {
    return JSON.parse(str(r.offers)) as string[];
  } catch {
    return null;
  }
}

export function pickFromPack(db: Database, userId: number, index: number, now = Date.now()): Res<PackResult> {
  return transaction(db, (): Res<PackResult> => {
    const offers = pendingPack(db, userId);
    if (!offers) return fail("Нет открытого пака");
    if (!Number.isInteger(index) || index < 0 || index >= offers.length) return fail("Выберите одну из карт");
    db.prepare("DELETE FROM card_pending WHERE user_id = ?").run(userId);
    return { ok: true, value: finishPick(db, userId, offers, index, now) };
  });
}

/* ------------------- Переплавка, раскол, улучшение, пыль ------------------ */

export function melt(db: Database, userId: number, ids: number[], now = Date.now(), rng: Rng = Math.random): Res<{ cardId: string; invId: number }> {
  if (ids.length !== MELT.need) return fail(`Нужно ровно ${MELT.need} карты`);
  return transaction(db, (): Res<{ cardId: string; invId: number }> => {
    const cards = loadOwned(db, userId, ids);
    if (!cards) return fail("Карты не найдены");
    const busy = checkFree(cards);
    if (busy) return fail(busy);
    const rank = rankOf(cards[0].cardId);
    if (cards.some((c) => rankOf(c.cardId) !== rank)) return fail("Все карты должны быть одного ранга");
    if (rank >= MAX_RANK) return fail("Мифические карты переплавить нельзя");
    removeCards(db, userId, ids);
    const def = pickRandom(cardsOfRank((rank + 1) as Rank), rng);
    const invId = addCard(db, userId, def.id, now);
    logEvent(db, userId, "melt", `Переплавка 3 карт → «${def.name}»`, def.id, def.rank, now);
    return { ok: true, value: { cardId: def.id, invId } };
  });
}

export function splitUsage(db: Database, userId: number, now = Date.now()) {
  const row = db.prepare("SELECT split_day, split_count FROM card_wallet WHERE user_id = ?").get(userId);
  const today = dayKey(now);
  const used = row && str(row.split_day) === today ? num(row.split_count) : 0;
  const free = isPremium(db, userId, now) ? SPLIT.premiumFreeDaily : SPLIT.freeDaily;
  return { used, free, max: SPLIT.maxDaily, extraCost: SPLIT.extraDiamonds };
}

export function split(db: Database, userId: number, invId: number, now = Date.now(), rng: Rng = Math.random): Res<{ cards: { cardId: string; invId: number }[]; paid: number }> {
  return transaction(db, (): Res<{ cards: { cardId: string; invId: number }[]; paid: number }> => {
    getWallet(db, userId, now);
    const cards = loadOwned(db, userId, [invId]);
    if (!cards) return fail("Карта не найдена");
    const busy = checkFree(cards);
    if (busy) return fail(busy);
    const rank = rankOf(cards[0].cardId);
    if (rank <= 0) return fail("Обычную карту расколоть нельзя");
    const u = splitUsage(db, userId, now);
    if (u.used >= u.max) return fail("Суточный лимит раскола исчерпан");
    let paid = 0;
    if (u.used >= u.free) {
      if (!addMoney(db, userId, "diamonds", -SPLIT.extraDiamonds)) return fail(`Не хватает алмазов (${SPLIT.extraDiamonds} 💎 за раскол сверх нормы)`);
      paid = SPLIT.extraDiamonds;
    }
    removeCards(db, userId, [invId]);
    const out: { cardId: string; invId: number }[] = [];
    for (let i = 0; i < 2; i += 1) {
      const def = pickRandom(cardsOfRank((rank - 1) as Rank), rng);
      out.push({ cardId: def.id, invId: addCard(db, userId, def.id, now) });
    }
    db.prepare("UPDATE card_wallet SET split_day = ?, split_count = ? WHERE user_id = ?").run(dayKey(now), u.used + 1, userId);
    const first = cardDef(cards[0].cardId);
    logEvent(db, userId, "split", `Раскол «${first?.name ?? "карты"}» → 2 карты`, cards[0].cardId, rank, now);
    return { ok: true, value: { cards: out, paid } };
  });
}

export function upgradePreview(cards: InvCard[]): { level: number; pity: number } {
  return { level: Math.max(...cards.map((c) => c.level)), pity: Math.max(...cards.map((c) => c.pity)) };
}

export function upgrade(db: Database, userId: number, ids: number[], now = Date.now()): Res<{ invId: number; cardId: string; level: number }> {
  if (ids.length !== UPGRADE.need) return fail(`Нужно ровно ${UPGRADE.need} одинаковые карты`);
  return transaction(db, (): Res<{ invId: number; cardId: string; level: number }> => {
    const cards = loadOwned(db, userId, ids);
    if (!cards) return fail("Карты не найдены");
    const busy = checkFree(cards);
    if (busy) return fail(busy);
    if (cards.some((c) => c.cardId !== cards[0].cardId)) return fail("Нужны три одинаковые карты");
    if (cards.some((c) => c.foil)) return fail("Анимированные карты улучшить нельзя");
    const keep = upgradePreview(cards);
    removeCards(db, userId, ids);
    const invId = addCard(db, userId, cards[0].cardId, now, true, keep.level, keep.pity);
    const def = cardDef(cards[0].cardId);
    logEvent(db, userId, "upgrade", `Улучшение «${def?.name}» → анимированная версия (ур. ${keep.level})`, cards[0].cardId, def?.rank ?? 0, now);
    return { ok: true, value: { invId, cardId: cards[0].cardId, level: keep.level } };
  });
}

export function disenchant(db: Database, userId: number, ids: number[], now = Date.now()): Res<{ dust: number }> {
  if (!ids.length || ids.length > 100) return fail("Выберите от 1 до 100 карт");
  return transaction(db, (): Res<{ dust: number }> => {
    getWallet(db, userId, now);
    const cards = loadOwned(db, userId, ids);
    if (!cards) return fail("Карты не найдены");
    const busy = checkFree(cards);
    if (busy) return fail(busy);
    let dust = 0;
    for (const c of cards) dust += Math.round(DUST_VALUE[rankOf(c.cardId)] * (c.foil ? 2.5 : 1) * (1 + (c.level - 1) * 0.15));
    removeCards(db, userId, ids);
    addMoney(db, userId, "dust", dust);
    logEvent(db, userId, "dust", `Расщеплено карт: ${cards.length} → ${dust} пыли`, "", 0, now);
    return { ok: true, value: { dust } };
  });
}

/* --------------------------------- Заточка -------------------------------- */

export interface SharpenStep {
  success: boolean;
  level: number;
  pity: number;
  chance: number;
}

function sharpenOnce(db: Database, userId: number, card: InvCard, useDust: boolean, rng: Rng): Res<SharpenStep & { spent: "scroll" | "dust" }> {
  const rank = rankOf(card.cardId);
  let spent: "scroll" | "dust" = "scroll";
  if (!addScroll(db, userId, rank, -1)) {
    if (!useDust) return fail("Нет свитка заточки этого ранга");
    if (!addMoney(db, userId, "dust", -SCROLL_DUST[rank])) return fail("Не хватает пыли на свиток");
    spent = "dust";
  }
  const chance = card.pity >= 100 ? 1 : sharpenChance(card.level);
  const success = rng() < chance;
  const level = success ? card.level + 1 : card.level;
  const pity = success ? 0 : Math.min(100, card.pity + SHARPEN_PITY_STEP);
  db.prepare("UPDATE card_inv SET level = ?, pity = ? WHERE id = ?").run(level, pity, card.id);
  return { ok: true, value: { success, level, pity, chance, spent } };
}

export function sharpen(
  db: Database,
  userId: number,
  invId: number,
  opts: { useDust?: boolean; target?: number; maxSpend?: number } = {},
  now = Date.now(),
  rng: Rng = Math.random,
): Res<{ steps: SharpenStep[]; level: number; pity: number; scrolls: number; dust: number }> {
  return transaction(db, (): Res<{ steps: SharpenStep[]; level: number; pity: number; scrolls: number; dust: number }> => {
    getWallet(db, userId, now);
    const cards = loadOwned(db, userId, [invId]);
    if (!cards) return fail("Карта не найдена");
    let card = cards[0];
    if (card.listed) return fail("Карта выставлена на аукцион или в обмен");
    const target = Math.min(MAX_LEVEL, Math.floor(opts.target ?? card.level + 1));
    if (card.level >= MAX_LEVEL) return fail("Карта уже на максимальном уровне");
    if (target <= card.level) return fail("Цель должна быть выше текущего уровня");
    const budget = Math.max(1, Math.min(200, Math.floor(opts.maxSpend ?? 1)));
    const steps: SharpenStep[] = [];
    let scrolls = 0;
    let dust = 0;
    for (let i = 0; i < budget && card.level < target; i += 1) {
      const r = sharpenOnce(db, userId, card, !!opts.useDust, rng);
      if (!r.ok) {
        if (!steps.length) return r;
        break;
      }
      if (r.value.spent === "scroll") scrolls += 1;
      else dust += SCROLL_DUST[rankOf(card.cardId)];
      steps.push({ success: r.value.success, level: r.value.level, pity: r.value.pity, chance: r.value.chance });
      card = { ...card, level: r.value.level, pity: r.value.pity };
    }
    bumpMission(db, userId, "sharp3", steps.length, now);
    const def = cardDef(card.cardId);
    logEvent(db, userId, "sharpen", `Заточка «${def?.name}»: ур. ${card.level} (${steps.length} поп.)`, card.cardId, def?.rank ?? 0, now);
    return { ok: true, value: { steps, level: card.level, pity: card.pity, scrolls, dust } };
  });
}

export function buyScrolls(db: Database, userId: number, rank: number, n: number): Res<number> {
  if (!Number.isInteger(rank) || rank < 0 || rank > MAX_RANK) return fail("Неверный ранг");
  const count = Math.floor(n);
  if (!(count >= 1 && count <= 100)) return fail("От 1 до 100 свитков");
  return transaction(db, (): Res<number> => {
    getWallet(db, userId, undefined, false);
    if (!addMoney(db, userId, "dust", -SCROLL_DUST[rank] * count)) return fail("Не хватает пыли");
    addScroll(db, userId, rank, count);
    return { ok: true, value: getWallet(db, userId, undefined, false).scrolls[rank] };
  });
}

/* ---------------------------------- Обмен --------------------------------- */

export interface TradeView {
  id: number;
  fromId: number;
  fromNick: string;
  toId: number;
  toNick: string;
  give: InvCard[];
  want: InvCard[];
  note: string;
  status: string;
  createdAt: number;
  resolvedAt: number;
}

function cardsByIds(db: Database, ids: number[]): InvCard[] {
  return ids
    .map((id) => db.prepare("SELECT * FROM card_inv WHERE id = ?").get(id))
    .filter((r): r is Record<string, unknown> => !!r)
    .map(rowToInv);
}

function tradeView(db: Database, r: Record<string, unknown>): TradeView {
  const ids = (raw: unknown): number[] => {
    try {
      return (JSON.parse(str(raw)) as unknown[]).map((x) => num(x));
    } catch {
      return [];
    }
  };
  const nick = (id: number) => str(db.prepare("SELECT nickname FROM users WHERE id = ?").get(id)?.nickname, "—");
  const status = str(r.status);
  const give = cardsByIds(db, ids(r.give));
  const want = cardsByIds(db, ids(r.want));
  return {
    id: num(r.id),
    fromId: num(r.from_id),
    fromNick: nick(num(r.from_id)),
    toId: num(r.to_id),
    toNick: nick(num(r.to_id)),
    give,
    want,
    note: str(r.note),
    status,
    createdAt: num(r.created_at),
    resolvedAt: num(r.resolved_at),
  };
}

const releaseGive = (db: Database, trade: Record<string, unknown>) => {
  try {
    for (const id of JSON.parse(str(trade.give)) as number[]) db.prepare("UPDATE card_inv SET listed = 0 WHERE id = ?").run(num(id));
  } catch {
    /* ignore */
  }
};

export function sendTrade(
  db: Database,
  userId: number,
  toNick: string,
  giveIds: number[],
  wantIds: number[],
  note: string,
  now = Date.now(),
): Res<number> {
  if (!giveIds.length && !wantIds.length) return fail("Выберите карты для обмена");
  if (giveIds.length > 6 || wantIds.length > 6) return fail("Не больше 6 карт с каждой стороны");
  return transaction(db, (): Res<number> => {
    const target = db.prepare("SELECT id FROM users WHERE lower(nickname) = lower(?)").get(toNick.trim());
    if (!target) return fail("Игрок не найден");
    const toId = num(target.id);
    if (toId === userId) return fail("Нельзя обмениваться с самим собой");
    const give = loadOwned(db, userId, giveIds);
    if (!give) return fail("Ваши карты не найдены");
    const busy = checkFree(give);
    if (busy) return fail(busy);
    const want = loadOwned(db, toId, wantIds);
    if (!want) return fail("Нужные карты не найдены у игрока");
    if (want.some((c) => c.locked || c.listed)) return fail("Часть нужных карт недоступна для обмена");
    const pending = num(db.prepare("SELECT COUNT(*) AS n FROM card_trades WHERE from_id = ? AND status = 'pending'").get(userId)?.n);
    if (pending >= 10) return fail("Не больше 10 активных предложений");
    const info = db
      .prepare("INSERT INTO card_trades (from_id, to_id, give, want, note, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(userId, toId, JSON.stringify(giveIds), JSON.stringify(wantIds), note.trim().slice(0, 140), now);
    for (const id of giveIds) db.prepare("UPDATE card_inv SET listed = 1 WHERE id = ?").run(id);
    return { ok: true, value: num(info.lastInsertRowid) };
  });
}

export function respondTrade(db: Database, userId: number, tradeId: number, accept: boolean, now = Date.now()): Res<string> {
  return transaction(db, (): Res<string> => {
    const t = db.prepare("SELECT * FROM card_trades WHERE id = ? AND status = 'pending'").get(tradeId);
    if (!t) return fail("Предложение не найдено или уже закрыто");
    if (num(t.to_id) !== userId) return fail("Это предложение адресовано не вам");
    const fromId = num(t.from_id);
    if (!accept) {
      releaseGive(db, t);
      db.prepare("UPDATE card_trades SET status = 'declined', resolved_at = ? WHERE id = ?").run(now, tradeId);
      return { ok: true, value: "declined" };
    }
    const giveIds = (JSON.parse(str(t.give)) as number[]).map((x) => num(x));
    const wantIds = (JSON.parse(str(t.want)) as number[]).map((x) => num(x));
    const want = loadOwned(db, userId, wantIds);
    if (!want || want.some((c) => c.locked || c.listed)) return fail("Ваши запрошенные карты изменились — обмен невозможен");
    const give = loadOwned(db, fromId, giveIds);
    if (!give) return fail("У отправителя больше нет этих карт");
    for (const id of giveIds) db.prepare("UPDATE card_inv SET user_id = ?, listed = 0 WHERE id = ?").run(userId, id);
    for (const id of wantIds) db.prepare("UPDATE card_inv SET user_id = ? WHERE id = ?").run(fromId, id);
    // отданные карты не должны оставаться в колоде прежнего владельца
    for (const [owner, ids] of [
      [fromId, giveIds],
      [userId, wantIds],
    ] as const) {
      const w = getWallet(db, owner, now);
      const deck = w.deck.filter((d) => !ids.includes(d));
      if (deck.length !== w.deck.length) db.prepare("UPDATE card_wallet SET deck = ? WHERE user_id = ?").run(JSON.stringify(deck), owner);
    }
    db.prepare("UPDATE card_trades SET status = 'accepted', resolved_at = ? WHERE id = ?").run(now, tradeId);
    const text = giveIds.length && wantIds.length ? `Обмен ${giveIds.length}⇄${wantIds.length}` : giveIds.length ? `Подарок: ${giveIds.length} карт` : `Получено: ${wantIds.length} карт`;
    logEvent(db, userId, "trade", text, "", 0, now);
    logEvent(db, fromId, "trade", text, "", 0, now);
    return { ok: true, value: "accepted" };
  });
}

export function cancelTrade(db: Database, userId: number, tradeId: number, now = Date.now()): Res<true> {
  return transaction(db, (): Res<true> => {
    const t = db.prepare("SELECT * FROM card_trades WHERE id = ? AND status = 'pending'").get(tradeId);
    if (!t || num(t.from_id) !== userId) return fail("Предложение не найдено");
    releaseGive(db, t);
    db.prepare("UPDATE card_trades SET status = 'cancelled', resolved_at = ? WHERE id = ?").run(now, tradeId);
    return { ok: true, value: true };
  });
}

export function listTrades(db: Database, userId: number): { incoming: TradeView[]; outgoing: TradeView[]; history: TradeView[] } {
  const rows = (sql: string) => db.prepare(sql).all(userId, userId).map((r) => tradeView(db, r));
  return {
    incoming: db.prepare("SELECT * FROM card_trades WHERE to_id = ? AND status = 'pending' ORDER BY id DESC").all(userId).map((r) => tradeView(db, r)),
    outgoing: db.prepare("SELECT * FROM card_trades WHERE from_id = ? AND status = 'pending' ORDER BY id DESC").all(userId).map((r) => tradeView(db, r)),
    history: rows("SELECT * FROM card_trades WHERE (from_id = ? OR to_id = ?) AND status != 'pending' ORDER BY resolved_at DESC LIMIT 40"),
  };
}

/** Карты другого игрока, доступные для запроса в обмене */
export function viewCollection(db: Database, nickname: string): Res<{ nickname: string; cards: InvCard[] }> {
  const u = db.prepare("SELECT id, nickname FROM users WHERE lower(nickname) = lower(?)").get(nickname.trim());
  if (!u) return fail("Игрок не найден");
  const cards = listInventory(db, num(u.id)).filter((c) => !c.locked && !c.listed);
  return { ok: true, value: { nickname: str(u.nickname), cards } };
}

/* --------------------------------- Аукцион -------------------------------- */

export interface AuctionView {
  id: number;
  sellerId: number;
  sellerNick: string;
  cardId: string;
  foil: boolean;
  level: number;
  rank: number;
  startPrice: number;
  bid: number;
  bidderId: number;
  bidderNick: string;
  bids: number;
  endsAt: number;
  status: string;
  minNext: number;
}

export const minNextBid = (start: number, bid: number): number => (bid > 0 ? bid + Math.max(1, Math.ceil(bid * 0.05)) : start);

/** Закрыть завершившиеся лоты: карта к победителю, алмазы продавцу */
export function settleAuctions(db: Database, now = Date.now()): number {
  const due = db.prepare("SELECT * FROM card_auctions WHERE status = 'active' AND ends_at <= ?").all(now);
  let n = 0;
  for (const a of due) {
    transaction(db, () => {
      const id = num(a.id);
      const done = db.prepare("UPDATE card_auctions SET status = 'closing' WHERE id = ? AND status = 'active'").run(id);
      if (!num((done as { changes?: number }).changes)) return;
      const winner = num(a.bidder_id);
      const seller = num(a.seller_id);
      const inv = num(a.inv_id);
      const def = cardDef(str(a.card_id));
      if (winner) {
        const fee = Math.floor((num(a.bid) * AUCTION.feePct) / 100);
        db.prepare("UPDATE card_inv SET user_id = ?, listed = 0, locked = 0 WHERE id = ?").run(winner, inv);
        getWallet(db, seller, now);
        addMoney(db, seller, "diamonds", num(a.bid) - fee);
        db.prepare("UPDATE card_auctions SET status = 'sold' WHERE id = ?").run(id);
        logEvent(db, seller, "auction", `Продано «${def?.name}» за ${num(a.bid)} 💎 (комиссия ${fee})`, str(a.card_id), num(a.rank), now);
        logEvent(db, winner, "auction", `Выиграно «${def?.name}» за ${num(a.bid)} 💎`, str(a.card_id), num(a.rank), now);
      } else {
        db.prepare("UPDATE card_inv SET listed = 0 WHERE id = ?").run(inv);
        db.prepare("UPDATE card_auctions SET status = 'expired' WHERE id = ?").run(id);
        logEvent(db, seller, "auction", `Лот «${def?.name}» не нашёл покупателя`, str(a.card_id), num(a.rank), now);
      }
      n += 1;
    });
  }
  return n;
}

function auctionView(db: Database, r: Record<string, unknown>): AuctionView {
  const nick = (id: number) => (id ? str(db.prepare("SELECT nickname FROM users WHERE id = ?").get(id)?.nickname, "—") : "");
  return {
    id: num(r.id),
    sellerId: num(r.seller_id),
    sellerNick: nick(num(r.seller_id)),
    cardId: str(r.card_id),
    foil: num(r.foil) === 1,
    level: num(r.level),
    rank: num(r.rank),
    startPrice: num(r.start_price),
    bid: num(r.bid),
    bidderId: num(r.bidder_id),
    bidderNick: nick(num(r.bidder_id)),
    bids: num(r.bids),
    endsAt: num(r.ends_at),
    status: str(r.status),
    minNext: minNextBid(num(r.start_price), num(r.bid)),
  };
}

export function listAuctions(db: Database, opts: { rank?: number; q?: string; sort?: string } = {}, now = Date.now()): AuctionView[] {
  settleAuctions(db, now);
  const rows = db.prepare("SELECT * FROM card_auctions WHERE status = 'active' ORDER BY ends_at ASC LIMIT 200").all();
  let list = rows.map((r) => auctionView(db, r));
  if (opts.rank !== undefined && opts.rank >= 0) list = list.filter((a) => a.rank === opts.rank);
  if (opts.q) {
    const q = opts.q.toLowerCase();
    list = list.filter((a) => {
      const d = cardDef(a.cardId);
      return !!d && (d.name.toLowerCase().includes(q) || d.series.toLowerCase().includes(q) || d.search.toLowerCase().includes(q));
    });
  }
  if (opts.sort === "price") list.sort((a, b) => Math.max(a.bid, a.startPrice) - Math.max(b.bid, b.startPrice));
  if (opts.sort === "rank") list.sort((a, b) => b.rank - a.rank);
  return list;
}

export function myAuctions(db: Database, userId: number, now = Date.now()): { selling: AuctionView[]; bidding: AuctionView[]; closed: AuctionView[] } {
  settleAuctions(db, now);
  const selling = db.prepare("SELECT * FROM card_auctions WHERE seller_id = ? AND status = 'active' ORDER BY ends_at").all(userId);
  const bidding = db
    .prepare("SELECT DISTINCT a.* FROM card_auctions a JOIN card_bids b ON b.auction_id = a.id WHERE b.user_id = ? AND a.status = 'active' ORDER BY a.ends_at")
    .all(userId);
  const closed = db
    .prepare("SELECT * FROM card_auctions WHERE (seller_id = ? OR bidder_id = ?) AND status IN ('sold','expired') ORDER BY id DESC LIMIT 20")
    .all(userId, userId);
  return { selling: selling.map((r) => auctionView(db, r)), bidding: bidding.map((r) => auctionView(db, r)), closed: closed.map((r) => auctionView(db, r)) };
}

export function createAuction(db: Database, userId: number, invId: number, price: number, hours: number, now = Date.now()): Res<number> {
  const start = Math.floor(price);
  if (!(start >= AUCTION.minPrice && start <= AUCTION.maxPrice)) return fail(`Стартовая цена от ${AUCTION.minPrice} до ${AUCTION.maxPrice} 💎`);
  const h = Math.floor(hours);
  if (!(h >= AUCTION.minHours && h <= AUCTION.maxHours)) return fail(`Срок от ${AUCTION.minHours} до ${AUCTION.maxHours} ч`);
  return transaction(db, (): Res<number> => {
    const cards = loadOwned(db, userId, [invId]);
    if (!cards) return fail("Карта не найдена");
    const busy = checkFree(cards);
    if (busy) return fail(busy);
    const active = num(db.prepare("SELECT COUNT(*) AS n FROM card_auctions WHERE seller_id = ? AND status = 'active'").get(userId)?.n);
    if (active >= AUCTION.maxActive) return fail(`Не больше ${AUCTION.maxActive} активных лотов`);
    const c = cards[0];
    const info = db
      .prepare(
        "INSERT INTO card_auctions (seller_id, inv_id, card_id, foil, level, rank, start_price, ends_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(userId, c.id, c.cardId, c.foil ? 1 : 0, c.level, rankOf(c.cardId), start, now + h * 3_600_000, now);
    db.prepare("UPDATE card_inv SET listed = 1 WHERE id = ?").run(c.id);
    const w = getWallet(db, userId, now);
    if (w.deck.includes(c.id)) db.prepare("UPDATE card_wallet SET deck = ? WHERE user_id = ?").run(JSON.stringify(w.deck.filter((d) => d !== c.id)), userId);
    return { ok: true, value: num(info.lastInsertRowid) };
  });
}

export function bid(db: Database, userId: number, auctionId: number, amount: number, now = Date.now()): Res<AuctionView> {
  const sum = Math.floor(amount);
  if (!Number.isFinite(sum) || sum < 1) return fail("Укажите ставку");
  settleAuctions(db, now);
  return transaction(db, (): Res<AuctionView> => {
    const a = db.prepare("SELECT * FROM card_auctions WHERE id = ? AND status = 'active'").get(auctionId);
    if (!a || num(a.ends_at) <= now) return fail("Аукцион завершён");
    if (num(a.seller_id) === userId) return fail("Нельзя ставить на свой лот");
    if (num(a.bidder_id) === userId) return fail("Ваша ставка уже лидирует");
    const min = minNextBid(num(a.start_price), num(a.bid));
    if (sum < min) return fail(`Минимальная ставка — ${min} 💎`);
    getWallet(db, userId, now);
    if (!addMoney(db, userId, "diamonds", -sum)) return fail("Не хватает алмазов");
    const prev = num(a.bidder_id);
    if (prev) {
      getWallet(db, prev, now);
      addMoney(db, prev, "diamonds", num(a.bid));
      logEvent(db, prev, "auction", `Вашу ставку перебили, ${num(a.bid)} 💎 возвращены`, str(a.card_id), num(a.rank), now);
    }
    let endsAt = num(a.ends_at);
    if (endsAt - now < AUCTION.snipeExtendMs) endsAt = now + AUCTION.snipeExtendMs;
    db.prepare("UPDATE card_auctions SET bid = ?, bidder_id = ?, bids = bids + 1, ends_at = ? WHERE id = ?").run(sum, userId, endsAt, auctionId);
    db.prepare("INSERT INTO card_bids (auction_id, user_id, amount, created_at) VALUES (?, ?, ?, ?)").run(auctionId, userId, sum, now);
    return { ok: true, value: auctionView(db, db.prepare("SELECT * FROM card_auctions WHERE id = ?").get(auctionId) as Record<string, unknown>) };
  });
}

export function cancelAuction(db: Database, userId: number, auctionId: number): Res<true> {
  return transaction(db, (): Res<true> => {
    const a = db.prepare("SELECT * FROM card_auctions WHERE id = ? AND status = 'active'").get(auctionId);
    if (!a || num(a.seller_id) !== userId) return fail("Лот не найден");
    if (num(a.bids) > 0) return fail("Нельзя снять лот со ставками");
    db.prepare("UPDATE card_auctions SET status = 'expired' WHERE id = ?").run(auctionId);
    db.prepare("UPDATE card_inv SET listed = 0 WHERE id = ?").run(num(a.inv_id));
    return { ok: true, value: true };
  });
}

/* ------------------------------ AC → алмазы ------------------------------ */

export function acBalance(db: Database, userId: number): number {
  const doc = getDoc(db, userId, PROGRESS_DOC_KEY);
  if (!doc) return 0;
  try {
    return num((JSON.parse(doc.value) as { progress?: { acBalance?: number } }).progress?.acBalance);
  } catch {
    return 0;
  }
}

export function exchangeAc(db: Database, userId: number, diamonds: number, now = Date.now()): Res<{ diamonds: number; acBalance: number }> {
  const d = Math.floor(diamonds);
  if (!(d >= 1 && d <= EXCHANGE.dailyDiamonds)) return fail(`От 1 до ${EXCHANGE.dailyDiamonds} 💎 за раз`);
  const price = d * EXCHANGE.acPerDiamond;
  // 1) резервируем лимит и выдаём алмазы; 2) списываем AC; при отказе откатываем алмазы
  const reserved = transaction(db, (): Res<number> => {
    getWallet(db, userId, now);
    const row = db.prepare("SELECT exch_day, exch_count FROM card_wallet WHERE user_id = ?").get(userId);
    const today = dayKey(now);
    const used = row && str(row.exch_day) === today ? num(row.exch_count) : 0;
    if (used + d > EXCHANGE.dailyDiamonds) return fail(`Лимит обмена на сегодня: ещё ${EXCHANGE.dailyDiamonds - used} 💎`);
    if (acBalance(db, userId) < price) return fail("Не хватает монет AC");
    addMoney(db, userId, "diamonds", d);
    db.prepare("UPDATE card_wallet SET exch_day = ?, exch_count = ? WHERE user_id = ?").run(today, used + d, userId);
    return { ok: true, value: used };
  });
  if (!reserved.ok) return reserved;
  const res = adjustBalance(db, SYSTEM, userId, { ac: -price, note: "Обмен на алмазы карточек" }, now);
  if (!res.ok) {
    transaction(db, () => {
      addMoney(db, userId, "diamonds", -d);
      db.prepare("UPDATE card_wallet SET exch_count = exch_count - ? WHERE user_id = ?").run(d, userId);
    });
    return fail(res.error);
  }
  logEvent(db, userId, "exchange", `Обмен ${price} AC → ${d} 💎`, "", 0, now);
  return { ok: true, value: { diamonds: d, acBalance: acBalance(db, userId) } };
}

/* ---------------------------- Состояние для UI ---------------------------- */

export function recentPulls(db: Database, now = Date.now()) {
  const row = (r: Record<string, unknown>) => ({
    nick: str(r.nickname, "—"),
    cardId: str(r.card_id),
    rank: num(r.rank),
    at: num(r.created_at),
  });
  const sql =
    "SELECT l.card_id, l.rank, l.created_at, u.nickname FROM card_log l JOIN users u ON u.id = l.user_id WHERE l.kind = 'pull' AND l.rank >= 3 AND l.created_at >= ? AND l.created_at < ? ORDER BY l.created_at DESC LIMIT 12";
  const startToday = new Date(now).setHours(0, 0, 0, 0);
  const startYesterday = startToday - 86_400_000;
  return {
    today: db.prepare(sql).all(startToday, startToday + 86_400_000).map(row),
    yesterday: db.prepare(sql).all(startYesterday, startToday).map(row),
  };
}

export function historyOf(db: Database, userId: number, limit = 60) {
  return db
    .prepare("SELECT id, kind, text, card_id, rank, created_at FROM card_log WHERE user_id = ? ORDER BY id DESC LIMIT ?")
    .all(userId, limit)
    .map((r) => ({ id: num(r.id), kind: str(r.kind), text: str(r.text), cardId: str(r.card_id), rank: num(r.rank), at: num(r.created_at) }));
}
