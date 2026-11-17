/** Сборка состояния карточек для браузера и разбор действий. */

import { bpGachaSync } from "./cards-bp";
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
  evolve,
  exchangeAc,
  getWallet,
  grantStarter,
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
  setSkills,
  settleAuctions,
  sharpen,
  split,
  splitUsage,
  toggleLock,
  upgrade,
  upgradeSkill,
  viewCollection,
  type Res,
} from "./cards";
import { battleLog, battleReplay, buyEnergy, challenge, fight, ratingTop, setDeck, weekIndexOf } from "./cards-battle";
import { cardOwners, cardTiers } from "./cards-shop";
import { campaignClaim, campaignFight, campaignState } from "./cards-campaign";
import { raidClaim, raidFight, raidView } from "./cards-raid";
import { buyBooster, claimFreeBooster, equipRelics, gearState, upgradeRelic } from "./cards-gear";
import { arenaOfDay, dayIndex } from "../cards/gear";
import { eventsState, noticesSeen, passBuy, passClaim } from "./cards-season";
import { claimAchievement, claimSet, claimWeekly, collectorProfile, progressState, setShowcase } from "./cards-progress";
import { artIds, missingIds, startArtSync } from "./cards-art";
import { dry, type Database } from "./sqlite";
import { seeded, withCtl, type Choice, type SimCtl } from "../cards/battle";
import type { BattleReport } from "./cards-battle";
import { getSpells, openSpellScroll, craftSpell, spellsSeen } from "./cards-spells";
import { activeTactics, getDecks, saveDeckSlot, activateDeckSlot } from "./cards-decks";

export function cardsState(db: Database, userId: number, now = Date.now()) {
  settleAuctions(db, now);
  startArtSync();
  grantStarter(db, userId, now);
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
    progress: progressState(db, userId, now),
    events: eventsState(db, userId, now),
    split: splitUsage(db, userId, now),
    mods,
    gear: gearState(db, userId, now),
    decks: getDecks(db, userId),
    spells: getSpells(db, userId),
    arena: { id: arenaOfDay(dayIndex(now)).id, until: new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate() + 1).getTime() },
    ac: acBalance(db, userId),
    art: artIds(),
    hidden: missingIds(),
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
    case "campaign":
      return { ok: true, value: campaignState(db, userId) };
    case "raid":
      return { ok: true, value: raidView(db, userId, now) };
    case "battlelog":
      return { ok: true, value: battleLog(db, userId) };
    case "replay":
      return battleReplay(db, userId, Math.floor(Number(params.get("id"))) || 0);
    case "profile":
      return collectorProfile(db, params.get("nick") ?? "");
    case "tiers":
      return { ok: true, value: cardTiers(db) };
    case "owners":
      return cardOwners(db, params.get("id") ?? "");
    case "shop":
      return { ok: true, value: shopState(db, userId) };
    default:
      return { ok: true, value: cardsState(db, userId, now) };
  }
}

const ints = (v: unknown): number[] => (Array.isArray(v) ? v.map((x) => Math.floor(Number(x))).filter((x) => Number.isFinite(x)) : []);

/** Выполнить действие `op`; результат уходит браузеру как есть */
/* ------------------------------ Управляемый бой ------------------------------ */
/* Старт: бой считается «вчерную» (без записи в базу) до первого хода игрока и запоминается.
   Финиш: тот же бой пересчитывается по зерну с решениями игрока и уже записывается.
   Брошенный бой доигрывается автоматически при следующем входе в бой. */

interface LiveBattle {
  id: string;
  op: string;
  body: Record<string, unknown>;
  seed: number;
  pre: number;
  at: number;
  /** Колода заклинаний игрока на момент старта боя */
  spells: string[];
}
const liveStore = globalThis as unknown as { __agLive?: Map<number, LiveBattle> };
const LIVE: Map<number, LiveBattle> = (liveStore.__agLive ??= new Map());
const LIVE_OPS = new Set(["fight", "challenge", "camp-fight", "raid-fight"]);
const rnd32 = (): number => Math.floor(Math.random() * 0xffffffff) >>> 0;

function runFight(db: Database, userId: number, op: string, body: Record<string, unknown>, now: number, rng: () => number): Res<BattleReport> {
  const booster = body.booster ? String(body.booster) : undefined;
  switch (op) {
    case "fight":
      return fight(db, userId, { training: !!body.training, booster }, now, rng);
    case "challenge":
      return challenge(db, userId, String(body.nick ?? ""), now, rng, booster);
    case "camp-fight":
      return campaignFight(db, userId, Number(body.chapter), Number(body.stage), { training: !!body.training, booster }, now, rng);
    default:
      return raidFight(db, userId, now, rng, booster);
  }
}

function cleanChoices(raw: unknown): Choice[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 600).map((c): Choice => {
    const o = (c ?? {}) as Record<string, unknown>;
    return {
      a: String(o.a ?? "auto").slice(0, 40),
      t: typeof o.t === "string" ? o.t.slice(0, 40) : undefined,
      c: Array.isArray(o.c) ? o.c.slice(0, 3).map((x) => String(x).slice(0, 20)) : undefined,
    };
  });
}

function liveSettle(db: Database, userId: number, lb: LiveBattle, choices: Choice[], now: number): Res<BattleReport> {
  LIVE.delete(userId);
  return withCtl({ seed: lb.seed, choices, stop: false, spells: lb.spells }, () => runFight(db, userId, lb.op, lb.body, now, seeded(lb.pre)));
}

function liveStart(db: Database, userId: number, op: string, body: Record<string, unknown>, now: number): Res<unknown> {
  const lb: LiveBattle = { id: `${now.toString(36)}-${rnd32().toString(36)}`, op, body, seed: rnd32(), pre: rnd32(), at: now, spells: activeTactics(db, userId) };
  const ctl: SimCtl = { seed: lb.seed, choices: [], stop: true, spells: lb.spells };
  const res = dry(() => withCtl(ctl, () => runFight(db, userId, op, body, now, seeded(lb.pre))));
  if (!res.ok) return res;
  /* бой решился без единого хода игрока — записываем сразу */
  if (!res.value.outcome.pending || !ctl.seen) return liveSettle(db, userId, lb, [], now);
  LIVE.set(userId, lb);
  const r = res.value;
  return {
    ok: true,
    value: {
      ...r,
      win: false,
      reward: { diamonds: 0, dust: 0, rating: 0, scroll: 0 },
      drops: undefined,
      campaign: undefined,
      raid: undefined,
      live: { id: lb.id, seed: lb.seed, perks: ctl.seen.perks, maxRounds: ctl.seen.maxRounds, spells: lb.spells },
    },
  };
}

export function cardsAction(db: Database, userId: number, op: string, body: Record<string, unknown>, now = Date.now()): Res<unknown> {
  missingIds();
  if (op === "live-finish") {
    const lb = LIVE.get(userId);
    if (!lb || lb.id !== String(body.id ?? "")) return { ok: false, error: "Этот бой уже завершён" };
    return liveSettle(db, userId, lb, cleanChoices(body.choices), now);
  }
  if (LIVE_OPS.has(op)) {
    const old = LIVE.get(userId);
    if (old) liveSettle(db, userId, old, [], now);
    if (body.live) return liveStart(db, userId, op, body, now);
  }
  switch (op) {
    case "daily":
      return claimDaily(db, userId, now);
    case "open":
      return openPacks(db, userId, { count: Number(body.count) || 1, pay: String(body.pay ?? "token") as "token", quick: !!body.quick, banner: !!body.banner }, now);
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
    case "decks-save":
      return saveDeckSlot(db, userId, { slot: Number(body.slot), name: body.name, cls: body.cls, ids: Array.isArray(body.ids) ? ints(body.ids) : undefined, tac: body.tac });
    case "spell-scroll":
      return openSpellScroll(db, userId);
    case "spell-craft":
      return craftSpell(db, userId, String(body.id ?? ""));
    case "spell-seen":
      return spellsSeen(db, userId);
    case "decks-use":
      return activateDeckSlot(db, userId, Number(body.slot));
    case "skills":
      return setSkills(db, userId, Math.floor(Number(body.id)) || 0, Array.isArray(body.skills) ? body.skills.map(String) : [], body.passive === undefined ? undefined : String(body.passive));
    case "skill-up":
      return upgradeSkill(db, userId, Math.floor(Number(body.id)) || 0, String(body.skill ?? ""), now);
    case "fight":
      return fight(db, userId, { training: !!body.training, booster: body.booster ? String(body.booster) : undefined }, now);
    case "challenge":
      return challenge(db, userId, String(body.nick ?? ""), now, Math.random, body.booster ? String(body.booster) : undefined);
    case "camp-fight":
      return campaignFight(db, userId, Number(body.chapter), Number(body.stage), { training: !!body.training, booster: body.booster ? String(body.booster) : undefined }, now);
    case "camp-claim":
      return campaignClaim(db, userId, Number(body.chapter), Number(body.tier), now);
    case "raid-fight":
      return raidFight(db, userId, now, Math.random, body.booster ? String(body.booster) : undefined);
    case "raid-claim":
      return raidClaim(db, userId, now);
    case "evolve":
      return evolve(db, userId, Math.floor(Number(body.id)), ints(body.ids), now);
    case "bp-sync":
      return bpGachaSync(db, userId);
    case "pass-buy":
      return passBuy(db, userId, now);
    case "pass-claim":
      return passClaim(db, userId, String(body.track ?? "free") as "free", Math.floor(Number(body.level)) || 0, now);
    case "notices-seen":
      return noticesSeen(db, userId, String(body.kind ?? "all"));
    case "energy":
      return buyEnergy(db, userId, now);
    case "gear-equip":
      return equipRelics(db, userId, Array.isArray(body.ids) ? body.ids.map(String) : []);
    case "relic-up":
      return upgradeRelic(db, userId, String(body.id ?? ""));
    case "booster-buy":
      return buyBooster(db, userId, String(body.id ?? ""), Number(body.n) || 1);
    case "booster-free":
      return claimFreeBooster(db, userId, now);
    case "ach-claim":
      return claimAchievement(db, userId, String(body.id ?? ""), now);
    case "set-claim":
      return claimSet(db, userId, String(body.series ?? ""), Number(body.tier), now);
    case "weekly-claim":
      return claimWeekly(db, userId, String(body.id ?? ""), now);
    case "showcase":
      return setShowcase(db, userId, ints(body.ids));
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

/** Какие разовые наборы магазина уже куплены */
function shopState(db: Database, userId: number) {
  const rows = db.prepare("SELECT DISTINCT product_id FROM payment_orders WHERE user_id = ? AND status = 'CONFIRMED' AND product_id LIKE 'cards-%'").all(userId);
  return { bought: rows.map((r) => String(r.product_id)) };
}
