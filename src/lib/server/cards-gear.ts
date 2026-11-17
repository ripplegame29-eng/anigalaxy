/** Боевое снаряжение игрока: реликвии, бустеры, выпадения после боёв. */

import { seeded } from "../cards/battle";
import {
  BOOSTERS,
  RARITY,
  RELICS,
  RELIC_MAX,
  RELIC_SLOTS,
  boosterDef,
  perksOfGear,
  relicDef,
  relicUpCost,
  resonanceOf,
  rollRelic,
  type Drops,
  type GearInfo,
  type OwnedRelic,
  type Perks,
} from "../cards/gear";
import { addMoney, fail, getWallet, logEvent, type Res } from "./cards";
import { dayKey } from "./day";
import { getExtra, setExtra } from "./cards-extra";
import { transaction, type Database } from "./sqlite";

export interface GearState {
  relics: OwnedRelic[];
  slots: string[];
  boosters: Record<string, number>;
  freeReady: boolean;
}

const owned = (g: { relics: Record<string, number> }): OwnedRelic[] =>
  Object.entries(g.relics)
    .filter(([id]) => relicDef(id))
    .map(([id, lv]) => ({ id, lv: Math.max(1, Math.min(RELIC_MAX, Math.floor(lv))) }));

export function gearState(db: Database, userId: number, now = Date.now()): GearState {
  const g = getExtra(db, userId).gear;
  const have = owned(g);
  return {
    relics: have,
    slots: g.slots.filter((id) => have.some((r) => r.id === id)).slice(0, RELIC_SLOTS),
    boosters: Object.fromEntries(Object.entries(g.boost).filter(([id, n]) => boosterDef(id) && n > 0)),
    freeReady: g.free !== dayKey(now),
  };
}

/** Экипированные реликвии игрока (для боя и для защиты в дуэлях) */
export function equippedRelics(db: Database, userId: number): OwnedRelic[] {
  const g = gearState(db, userId);
  return g.slots.map((id) => g.relics.find((r) => r.id === id)!).filter(Boolean);
}

export function equipRelics(db: Database, userId: number, ids: string[]): Res<string[]> {
  if (ids.length > RELIC_SLOTS) return fail(`Слотов реликвий — ${RELIC_SLOTS}`);
  if (new Set(ids).size !== ids.length) return fail("Одну реликвию нельзя надеть дважды");
  return transaction(db, (): Res<string[]> => {
    getWallet(db, userId, undefined, false);
    const x = getExtra(db, userId);
    for (const id of ids) if (!x.gear.relics[id]) return fail("Такой реликвии у вас нет");
    x.gear.slots = ids;
    setExtra(db, userId, x);
    return { ok: true, value: ids };
  });
}

export function upgradeRelic(db: Database, userId: number, id: string): Res<{ id: string; lv: number }> {
  const def = relicDef(id);
  if (!def) return fail("Реликвия не найдена");
  return transaction(db, (): Res<{ id: string; lv: number }> => {
    getWallet(db, userId, undefined, false);
    const x = getExtra(db, userId);
    const lv = x.gear.relics[id];
    if (!lv) return fail("Такой реликвии у вас нет");
    if (lv >= RELIC_MAX) return fail("Реликвия уже на максимальном уровне");
    if (!addMoney(db, userId, "dust", -relicUpCost(def.rarity, lv))) return fail(`Не хватает пыли (${relicUpCost(def.rarity, lv)})`);
    x.gear.relics[id] = lv + 1;
    setExtra(db, userId, x);
    return { ok: true, value: { id, lv: lv + 1 } };
  });
}

export function buyBooster(db: Database, userId: number, id: string, n = 1): Res<Record<string, number>> {
  const def = boosterDef(id);
  const count = Math.max(1, Math.min(5, Math.floor(n) || 1));
  if (!def) return fail("Бустер не найден");
  return transaction(db, (): Res<Record<string, number>> => {
    getWallet(db, userId, undefined, false);
    const x = getExtra(db, userId);
    if ((x.gear.boost[id] ?? 0) + count > 9) return fail("Можно хранить не больше 9 одинаковых бустеров");
    if (!addMoney(db, userId, "dust", -def.cost * count)) return fail(`Не хватает пыли (${def.cost * count})`);
    x.gear.boost[id] = (x.gear.boost[id] ?? 0) + count;
    setExtra(db, userId, x);
    return { ok: true, value: x.gear.boost };
  });
}

/** Бесплатный бустер раз в сутки */
export function claimFreeBooster(db: Database, userId: number, now = Date.now()): Res<{ id: string }> {
  return transaction(db, (): Res<{ id: string }> => {
    getWallet(db, userId, now, false);
    const x = getExtra(db, userId);
    const today = dayKey(now);
    if (x.gear.free === today) return fail("Сегодняшний бустер уже получен");
    const r = seeded(Math.floor(now / 86_400_000) * 31 + userId)();
    const b = BOOSTERS[Math.floor(r * BOOSTERS.length) % BOOSTERS.length];
    x.gear.free = today;
    x.gear.boost[b.id] = Math.min(9, (x.gear.boost[b.id] ?? 0) + 1);
    setExtra(db, userId, x);
    logEvent(db, userId, "gear", `Бесплатный бустер дня: «${b.name}»`, "", 0, now);
    return { ok: true, value: { id: b.id } };
  });
}

export interface ResolvedGear {
  info: GearInfo;
  perks: Perks;
  booster?: string;
}

/** Снаряжение к бою (только чтение): реликвии + выбранный бустер. В тренировке бустер бесплатный. */
export function resolveGear(db: Database, userId: number, booster: string | undefined, training: boolean): Res<ResolvedGear> {
  const g = gearState(db, userId);
  const relics = g.slots.map((id) => g.relics.find((r) => r.id === id)!).filter(Boolean);
  let b: string | undefined;
  if (booster) {
    if (!boosterDef(booster)) return fail("Бустер не найден");
    if (!training && !(g.boosters[booster] > 0)) return fail("Этого бустера нет в запасе");
    b = booster;
  }
  return { ok: true, value: { info: gearInfo(relics, b), perks: perksOfGear(relics, b), booster: b } };
}

export function gearInfo(relics: OwnedRelic[], booster?: string): GearInfo {
  return { relics, booster, resonance: resonanceOf(relics)?.id };
}

/** Снаряжение бота: с золотой лиги у него появляются реликвии */
export function botGear(rating: number, leagueIdx: number): GearInfo {
  if (leagueIdx < 2) return { relics: [] };
  const lv = Math.min(RELIC_MAX, leagueIdx - 1);
  const pick = (rarity: "rare" | "epic" | "legend", salt: number) => {
    const pool = RELICS.filter((r) => r.rarity === rarity);
    return { id: pool[(Math.floor(rating / 10) + salt) % pool.length].id, lv };
  };
  const relics: OwnedRelic[] = [pick("rare", 0)];
  if (leagueIdx >= 3) relics.push(pick("epic", 1));
  if (leagueIdx >= 5) relics.push(pick("legend", 2));
  return { relics, resonance: resonanceOf(relics)?.id };
}

export interface DropCtx {
  kind: "ladder" | "duel" | "campaign" | "raid";
  win: boolean;
  /** Индекс лиги 0–5 */
  tier: number;
  now: number;
  /** Гарантированная реликвия (первое прохождение босса кампании) */
  sure?: boolean;
  /** Шанс реликвии, если не задан — по умолчанию для режима */
  chance?: number;
}

const BASE_CHANCE: Record<DropCtx["kind"], { win: number; lose: number }> = {
  ladder: { win: 0.3, lose: 0.08 },
  duel: { win: 0.25, lose: 0.06 },
  campaign: { win: 0.12, lose: 0 },
  raid: { win: 0.2, lose: 0.2 },
};

/**
 * После боя: списывает использованный бустер и выдаёт добычу.
 * Дубликат реликвии превращается в пыль. Вызывается после остальных записей extra.
 */
export function commitGear(db: Database, userId: number, ctx: DropCtx, booster: string | undefined, training: boolean): Drops {
  if (training) return {};
  const x = getExtra(db, userId);
  const drops: Drops = {};
  if (booster && (x.gear.boost[booster] ?? 0) > 0) {
    x.gear.boost[booster] -= 1;
    if (x.gear.boost[booster] <= 0) delete x.gear.boost[booster];
  }
  x.gear.n += 1;
  const rnd = seeded(ctx.now ^ (userId * 7919) ^ (x.gear.n * 104729));
  const ch = ctx.chance ?? (ctx.win ? BASE_CHANCE[ctx.kind].win : BASE_CHANCE[ctx.kind].lose);
  if (ctx.sure || rnd() < ch) {
    const rel = rollRelic(ctx.tier, rnd(), rnd(), Math.min(1, x.gear.pity / 12));
    const have = x.gear.relics[rel.id];
    if (have) {
      const dust = RARITY[rel.rarity].dust;
      addMoney(db, userId, "dust", dust);
      drops.relic = { id: rel.id, lv: have, dup: true, dust };
    } else {
      x.gear.relics[rel.id] = 1;
      drops.relic = { id: rel.id, lv: 1, dup: false, dust: 0 };
      if (x.gear.slots.length < RELIC_SLOTS) x.gear.slots.push(rel.id);
    }
    x.gear.pity = rel.rarity === "legend" ? 0 : x.gear.pity + 1;
    logEvent(db, userId, "gear", `${have ? "Повтор" : "Новая реликвия"}: «${rel.name}»${have ? ` (+${RARITY[rel.rarity].dust} пыли)` : ""}`, "", 0, ctx.now);
  }
  if (ctx.win && rnd() < (ctx.kind === "ladder" ? 0.22 : 0.12)) {
    const b = BOOSTERS[Math.floor(rnd() * BOOSTERS.length) % BOOSTERS.length];
    x.gear.boost[b.id] = Math.min(9, (x.gear.boost[b.id] ?? 0) + 1);
    drops.booster = b.id;
  }
  setExtra(db, userId, x);
  return drops;
}
