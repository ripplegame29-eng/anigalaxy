/** Сборка состояния карточек для браузера и разбор действий. */

import { MAX_ENERGY, ENERGY_REGEN_MS, leagueOf, weeklyMods } from "../cards/config";
import {
  acBalance,
  bid,
  buyScrolls,
  cancelAuction,
  cancelTrade,
  claimDaily,
  claimMission,
  createAuction,
  disenchant,
  exchangeAc,
  getWallet,
  historyOf,
  isPremium,
  listAuctions,
  listInventory,
  listTrades,
  melt,
  missionList,
  myAuctions,
  openPacks,
  pendingPack,
  pickFromPack,
  recentPulls,
  respondTrade,
  sendTrade,
  settleAuctions,
  sharpen,
  split,
  splitUsage,
  toggleLock,
  upgrade,
  viewCollection,
  type Res,
} from "./cards";
import { buyEnergy, fight, ratingTop, setDeck, weekIndexOf } from "./cards-battle";
import { artIds } from "./cards-art";
import type { Database } from "./sqlite";

export function cardsState(db: Database, userId: number, now = Date.now()) {
  settleAuctions(db, now);
  const w = getWallet(db, userId, now);
  const mods = weeklyMods(weekIndexOf(now));
  return {
    wallet: {
      diamonds: w.diamonds,
      dust: w.dust,
      packs: w.packs,
      energy: w.energy,
      energyMax: MAX_ENERGY,
      nextEnergyAt: w.energy >= MAX_ENERGY ? 0 : w.energyAt + ENERGY_REGEN_MS,
      scrolls: w.scrolls,
      pityEpic: w.pityEpic,
      pityLegend: w.pityLegend,
      rating: w.rating,
      wins: w.wins,
      losses: w.losses,
      deck: w.deck,
    },
    dailyReady: !dailyDone(db, userId, now),
    league: leagueOf(w.rating),
    premium: isPremium(db, userId, now),
    inventory: listInventory(db, userId),
    pending: pendingPack(db, userId),
    missions: missionList(db, userId, now),
    split: splitUsage(db, userId, now),
    mods,
    ac: acBalance(db, userId),
    art: artIds(),
    pulls: recentPulls(db, now),
    now,
  };
}

function dailyDone(db: Database, userId: number, now: number): boolean {
  const w = getWallet(db, userId, now);
  const d = new Date(now);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return w.loginDay === key;
}

export function cardsView(db: Database, userId: number, view: string, params: URLSearchParams, now = Date.now()): Res<unknown> {
  switch (view) {
    case "auction": {
      const rank = params.get("rank");
      return {
        ok: true,
        value: {
          lots: listAuctions(db, { rank: rank === null || rank === "" ? undefined : Number(rank), q: params.get("q") ?? undefined, sort: params.get("sort") ?? undefined }, now),
          mine: myAuctions(db, userId, now),
        },
      };
    }
    case "trades":
      return { ok: true, value: listTrades(db, userId) };
    case "history":
      return { ok: true, value: historyOf(db, userId) };
    case "top":
      return { ok: true, value: ratingTop(db) };
    case "user":
      return viewCollection(db, params.get("nick") ?? "");
    default:
      return { ok: true, value: cardsState(db, userId, now) };
  }
}

const ints = (v: unknown): number[] => (Array.isArray(v) ? v.map((x) => Math.floor(Number(x))).filter((x) => Number.isFinite(x)) : []);

/** Выполнить действие `op`; результат уходит браузеру как есть */
export function cardsAction(db: Database, userId: number, op: string, body: Record<string, unknown>, now = Date.now()): Res<unknown> {
  switch (op) {
    case "daily":
      return claimDaily(db, userId, now);
    case "open":
      return openPacks(db, userId, { count: Number(body.count) || 1, pay: String(body.pay ?? "token") as "token", quick: !!body.quick }, now);
    case "pick":
      return pickFromPack(db, userId, Number(body.index), now);
    case "melt":
      return melt(db, userId, ints(body.ids), now);
    case "split":
      return split(db, userId, Math.floor(Number(body.id)), now);
    case "upgrade":
      return upgrade(db, userId, ints(body.ids), now);
    case "dust":
      return disenchant(db, userId, ints(body.ids), now);
    case "sharpen":
      return sharpen(
        db,
        userId,
        Math.floor(Number(body.id)),
        { useDust: !!body.useDust, target: body.target === undefined ? undefined : Number(body.target), maxSpend: body.maxSpend === undefined ? 1 : Number(body.maxSpend) },
        now,
      );
    case "scrolls":
      return buyScrolls(db, userId, Number(body.rank), Number(body.n));
    case "lock":
      return toggleLock(db, userId, Math.floor(Number(body.id)));
    case "deck":
      return setDeck(db, userId, ints(body.ids));
    case "fight":
      return fight(db, userId, { training: !!body.training }, now);
    case "energy":
      return buyEnergy(db, userId, now);
    case "mission":
      return claimMission(db, userId, String(body.id ?? ""), now);
    case "exchange":
      return exchangeAc(db, userId, Number(body.diamonds), now);
    case "trade":
      return sendTrade(db, userId, String(body.to ?? ""), ints(body.give), ints(body.want), String(body.note ?? ""), now);
    case "trade-respond":
      return respondTrade(db, userId, Math.floor(Number(body.id)), !!body.accept, now);
    case "trade-cancel":
      return cancelTrade(db, userId, Math.floor(Number(body.id)), now);
    case "auction-create":
      return createAuction(db, userId, Math.floor(Number(body.id)), Number(body.price), Number(body.hours), now);
    case "auction-bid":
      return bid(db, userId, Math.floor(Number(body.id)), Number(body.amount), now);
    case "auction-cancel":
      return cancelAuction(db, userId, Math.floor(Number(body.id)));
    default:
      return { ok: false, error: "Неизвестное действие" };
  }
}
