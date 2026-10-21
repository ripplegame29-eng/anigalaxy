"use client";

/**
 * Клан v2 — состояние и механики.
 *
 * Принципы:
 *  - всё локально (localStorage), «живость» даёт симуляция по времени: боты-
 *    соклановцы вносят вклад, пока игрока нет, а соперники осаждают территории;
 *  - AC списывает и начисляет только движок прогрессии (CLAN_CONTRIBUTED и
 *    CLAN_CHEST_REWARD): клан не печатает валюту сам;
 *  - `advance` — чистая функция, вызывается из эффекта по документу
 *    прогрессии и по таймеру, поэтому рендер не зависит от Date.now().
 */

import { createLocalStore, localId } from "../store";
import { emit } from "../progression/service";
import { isPremiumActive, readAccount } from "../auth";
import { PREMIUM_CLAN_MULT } from "../premium-perks";
import { ALL_ITEMS, CHESTS, itemOf, priceOf, type Chest, type LootEntry } from "./shop";
import {
  BOSSES, CHEST_TIERS, NAMES, NOTES, RIVALS, ROLES, TERRITORIES, type Rival, can, hash, levelFromXp, memberCap, rng, territoryOf, weekKey,
  type ChestTier, type Role, type TerritoryId,
} from "./data";

export interface Member {
  id: string;
  name: string;
  role: Role;
  joinedAt: number;
  weekXp: number;
  totalXp: number;
  weekDmg: number;
  bot: boolean;
}
export interface Applicant { id: string; name: string; level: number; note: string; at: number }
export type LogKind = "join" | "leave" | "role" | "boss" | "vault" | "land" | "event" | "system";
export interface LogEntry { id: string; at: number; kind: LogKind; text: string }

export interface Clan2 {
  id: string;
  name: string;
  tag: string;
  emblem: string;
  color: string;
  motto: string;
  createdAt: number;
  xp: number;
  influence: number;
  vault: number;
  /** Престиж: за боссов, победы в войнах и захваты земель */
  prestige: number;
  /** Клан создан игроком (иначе игрок вступил в чужой) */
  mine: boolean;
}
export interface WeekEvent {
  week: string;
  bossId: string;
  max: number;
  damage: number;
  defeated: boolean;
  watch: number;
  vaultWeek: number;
  seenEp: number;
  paid: string[];
}
export type Front = 0 | 1 | 2;
export const FRONT_NAMES = ["Левый фланг", "Центр", "Правый фланг"] as const;
export interface FrontState { pos: number; shieldUntil: number }
export interface WarLogEntry { at: number; text: string; side: "me" | "them" | "sys" }
export interface WarState {
  rivalId: string;
  stake: TerritoryId | null;
  startedAt: number;
  endsAt: number;
  tick: number;
  fronts: [FrontState, FrontState, FrontState];
  focus: Front;
  cd: { volley: number; shield: number; surge: number };
  score: { me: number; them: number };
  log: WarLogEntry[];
  result?: "win" | "loss" | "draw";
  reward?: { prestige: number; vault: number; influence: number; xp: number; captured: TerritoryId | null; lostInfluence: number };
}
export interface WarHistory { at: number; rivalId: string; result: "win" | "loss" | "draw"; stake: TerritoryId | null }

export interface ClanV2State {
  v: 2;
  clan: Clan2 | null;
  selfRole: Role;
  members: Member[];
  applicants: Applicant[];
  log: LogEntry[];
  event: WeekEvent | null;
  land: Partial<Record<TerritoryId, number>>;
  claimed: string[];
  chapters: string[];
  /** Земли, занятые соперниками: территория → id соперника */
  rivalLand: Partial<Record<TerritoryId, string>>;
  owned: string[];
  equipped: { background?: string; emblem?: string; decos: string[] };
  war: WarState | null;
  warLock: number;
  history: WarHistory[];
  tick: number;
  appTick: number;
  incomeTick: number;
}

const EMPTY: ClanV2State = {
  v: 2, clan: null, selfRole: "recruit", members: [], applicants: [], log: [], event: null, land: {},
  claimed: [], chapters: [], rivalLand: {}, owned: [], equipped: { decos: [] }, war: null, warLock: 0, history: [], tick: 0, appTick: 0, incomeTick: 0,
};

const store = createLocalStore<ClanV2State>("anigalaxy.clan.v2", EMPTY, (raw) => {
  const value = JSON.parse(raw) as Partial<ClanV2State>;
  if (!value || value.v !== 2) return null;
  const merged = { ...EMPTY, ...value } as ClanV2State;
  if (merged.clan && merged.clan.prestige === undefined) merged.clan = { ...merged.clan, prestige: 0 };
  if (merged.clan && Object.keys(merged.rivalLand).length === 0 && !merged.war) merged.rivalLand = startingRivalLand();
  return merged;
});

export function startingRivalLand(): Partial<Record<TerritoryId, string>> {
  return { throne: "r3", rift: "r5", sky: "r1" };
}

export const useClan2 = (): ClanV2State => store.useStore();
export const getClan2 = (): ClanV2State => store.get();

/* -------------------------------- Выводы -------------------------------- */

export const isHeld = (s: ClanV2State, id: TerritoryId): boolean => (s.land[id] ?? 0) >= territoryOf(id).cost;
export const heldList = (s: ClanV2State): TerritoryId[] => TERRITORIES.filter((t) => isHeld(s, t.id)).map((t) => t.id);

export function bonuses(s: ClanV2State) {
  const b = { damage: 0, xp: 0, chest: 0, income: 0, influence: 0 };
  for (const id of heldList(s)) {
    const t = territoryOf(id);
    b[t.bonus.kind] += t.bonus.value;
  }
  return b;
}
export function reachable(s: ClanV2State, id: TerritoryId): boolean {
  const t = territoryOf(id);
  return !!t.start || t.near.some((n) => isHeld(s, n));
}
export function goalTargets(members: number) {
  return { watch: 25 + members * 3, vault: 1500 + members * 150 };
}
export function goalsDone(s: ClanV2State): number {
  if (!s.clan || !s.event) return 0;
  const g = goalTargets(s.members.length);
  return (s.event.watch >= g.watch ? 1 : 0) + (s.event.vaultWeek >= g.vault ? 1 : 0) + (s.event.defeated ? 1 : 0);
}
export const bossOf = (e: WeekEvent) => BOSSES.find((b) => b.id === e.bossId) ?? BOSSES[0];
export const selfMember = (s: ClanV2State): Member | undefined => s.members.find((m) => m.id === "self");

function pushLog(s: ClanV2State, kind: LogKind, text: string, at: number): LogEntry[] {
  return [{ id: localId("l"), at, kind, text }, ...s.log].slice(0, 60);
}

function newEvent(clanId: string, week: string, members: number): WeekEvent {
  const r = rng(`${clanId}:${week}`);
  const boss = BOSSES[Math.floor(r() * BOSSES.length)];
  return { week, bossId: boss.id, max: 6000 + members * 1500, damage: 0, defeated: false, watch: 0, vaultWeek: 0, seenEp: -1, paid: [] };
}

function makeBots(seed: string, count: number, leaderName?: string): Member[] {
  const r = rng(seed);
  const pool = [...NAMES];
  const out: Member[] = [];
  const roles: Role[] = ["officer", "officer", "elite", "elite", "member", "member", "member", "recruit"];
  for (let i = 0; i < count; i++) {
    const name = i === 0 && leaderName ? leaderName : `${pool.splice(Math.floor(r() * pool.length), 1)[0] ?? "Игрок"}${Math.floor(r() * 90 + 10)}`;
    const role: Role = i === 0 && leaderName ? "leader" : roles[Math.min(roles.length - 1, Math.floor(i / 2))];
    out.push({ id: `b${hash(seed + i).toString(36)}`, name, role, joinedAt: 0, weekXp: Math.floor(r() * 600), totalXp: Math.floor(r() * 9000), weekDmg: Math.floor(r() * 3000), bot: true });
  }
  return out;
}

/* --------------------------- Ход времени (чистый) ----------------------- */

/**
 * Один «тик» мира: смена недели, вклад ботов, осада территорий, заявки,
 * пассивный доход. Возвращает тот же объект, если ничего не изменилось.
 */
export function advance(s: ClanV2State, now: number, episodesWeek: number): ClanV2State {
  if (!s.clan) return s;
  const st: ClanV2State = {
    ...s, clan: { ...s.clan }, members: s.members.map((m) => ({ ...m })), land: { ...s.land }, rivalLand: { ...s.rivalLand },
    history: [...s.history], war: s.war ? cloneWar(s.war) : null,
  };
  const clan = st.clan as Clan2;
  const week = weekKey(now);
  let changed = false;

  /* Смена недели: осада территории и новый босс */
  if (!st.event || st.event.week !== week) {
    const held = heldList(st);
    if (st.event && held.length) {
      const r = rng(`${clan.id}:siege:${week}`);
      const target = held[Math.floor(r() * held.length)];
      const t = territoryOf(target);
      const before = st.land[target] ?? 0;
      const after = Math.max(0, before - Math.round(t.cost * 0.35));
      st.land[target] = after;
      if (after < t.cost) {
        const rivalId = RIVALS[Math.floor(r() * RIVALS.length)].id;
        st.rivalLand[target] = rivalId;
        st.land[target] = 0;
        st.log = pushLog(st, "land", `Клан «${rivalOfId(rivalId).name}» отбил «${t.name}». Верните её штурмом: объявите войну.`, now);
      } else {
        st.log = pushLog(st, "land", `Соперники осадили «${t.name}»: укрепления ослабли.`, now);
      }
    }
    st.members = st.members.map((m) => ({ ...m, weekXp: 0, weekDmg: 0 }));
    st.event = newEvent(clan.id, week, st.members.length);
    st.log = pushLog(st, "event", `Новая неделя: на карте появился босс «${bossOf(st.event).name}».`, now);
    changed = true;
  }
  const ev = { ...(st.event as WeekEvent) };
  st.event = ev;
  const b = bonuses(st);
  const addXp = (n: number) => (clan.xp += Math.round(n * (1 + b.xp / 100)));

  /* Эпизоды игрока: приращение к неделе */
  if (ev.seenEp < 0 || episodesWeek < ev.seenEp) {
    ev.seenEp = episodesWeek;
    changed = true;
  } else if (episodesWeek > ev.seenEp) {
    const n = episodesWeek - ev.seenEp;
    ev.seenEp = episodesWeek;
    ev.watch += n;
    if (!ev.defeated) {
      const dmg = Math.round(n * 120 * (1 + b.damage / 100));
      ev.damage += dmg;
      const me = st.members.find((m) => m.id === "self");
      if (me) me.weekDmg += dmg;
    }
    addXp(n * 15);
    if (st.war && !st.war.result) {
      const gain = n * 6 * (1 + b.damage / 100);
      const fr = st.war.fronts[st.war.focus];
      fr.pos = Math.min(100, fr.pos + gain);
      st.war.score.me += gain;
    }
    changed = true;
  }

  /* Боты работают, пока игрока нет */
  if (st.tick === 0) st.tick = now;
  const hours = Math.min(72, Math.max(0, (now - st.tick) / 3_600_000));
  if (hours >= 0.05) {
    for (const m of st.members) {
      if (!m.bot) continue;
      const h = hash(m.id);
      const xp = hours * (2 + (h % 4));
      m.weekXp += xp;
      m.totalXp += xp;
      addXp(xp);
      const ac = hours * (1 + (h % 3));
      clan.vault += Math.round(ac);
      ev.vaultWeek += Math.round(ac);
      ev.watch += hours * (0.04 + (h % 3) * 0.02);
      if (!ev.defeated) {
        const dmg = Math.round(hours * (12 + (h % 10)) * (1 + b.damage / 100));
        ev.damage += dmg;
        m.weekDmg += dmg;
      }
    }
    st.tick = now;
    changed = true;
  }

  /* Пассивный доход территорий */
  if (st.incomeTick === 0) st.incomeTick = now;
  const days = Math.min(7, (now - st.incomeTick) / 86_400_000);
  if (days >= 0.05) {
    if (b.income) clan.vault += Math.round(b.income * days);
    if (b.influence) clan.influence += Math.round(b.influence * days);
    st.incomeTick = now;
    changed = true;
  }

  /* Цели недели и победа над боссом — награды один раз */
  const g = goalTargets(st.members.length);
  const pay = (key: string, text: string, infl: number, xp: number, ac: number) => {
    if (ev.paid.includes(key)) return;
    ev.paid = [...ev.paid, key];
    clan.influence += infl;
    clan.vault += ac;
    addXp(xp);
    st.log = pushLog(st, "event", text, now);
    changed = true;
  };
  if (!ev.defeated && ev.damage >= ev.max) {
    ev.defeated = true;
    pay("boss", `Босс «${bossOf(ev).name}» повержен! Казна +500 AC, влияние +200, престиж +40.`, 200, 1000, 500);
    clan.prestige += 40;
  }
  if (ev.watch >= g.watch) pay("watch", "Цель недели выполнена: клан посмотрел нужное число серий.", 60, 300, 0);
  if (ev.vaultWeek >= g.vault) pay("vault", "Цель недели выполнена: казна пополнена.", 60, 300, 0);

  /* Война идёт по часам: соперник давит, свои бойцы отвечают */
  if (st.war && !st.war.result) {
    const before = st.war;
    tickWar(st, now, b.damage);
    if (st.war !== before || st.war.tick !== before.tick) changed = true;
  }

  /* Заявки: у офицеров и главы появляются кандидаты */
  if (can.manage(st.selfRole) && clan.mine) {
    if (st.appTick === 0) st.appTick = now;
    if (now - st.appTick > 6 * 3_600_000 && st.applicants.length < 3 && st.members.length < memberCap(levelFromXp(clan.xp))) {
      const r = rng(`${clan.id}:app:${st.appTick}`);
      st.applicants = [
        ...st.applicants,
        { id: localId("a"), name: `${NAMES[Math.floor(r() * NAMES.length)]}${Math.floor(r() * 90 + 10)}`, level: 3 + Math.floor(r() * 40), note: NOTES[Math.floor(r() * NOTES.length)], at: now },
      ];
      st.appTick = now;
      changed = true;
    }
  }

  /* Новобранец становится бойцом через двое суток (в чужом клане) */
  if (!clan.mine && st.selfRole === "recruit") {
    const me = st.members.find((m) => m.id === "self");
    if (me && now - me.joinedAt > 2 * 86_400_000) {
      st.selfRole = "member";
      me.role = "member";
      st.log = pushLog(st, "role", "Вы повышены до «Боец».", now);
      changed = true;
    }
  }

  clan.xp = Math.round(clan.xp);
  return changed ? st : s;
}

/** Вызывается эффектом: синхронизация с активностью сайта и временем */
export function syncClan(episodesWeek: number): void {
  const cur = store.get();
  if (!cur.clan) return;
  const next = advance(cur, Date.now(), episodesWeek);
  if (next !== cur) store.set(next);
}

/* -------------------------------- Действия ------------------------------ */

export interface Result { ok: boolean; reason?: string }
const fail = (reason: string): Result => ({ ok: false, reason });
const OK: Result = { ok: true };

export interface CreateInput { name: string; tag: string; emblem: string; color: string; motto: string; selfName: string }

export function validateCreate(i: CreateInput): string | null {
  if (i.name.trim().length < 3) return "Название — от 3 символов";
  if (i.name.trim().length > 24) return "Название — до 24 символов";
  if (!/^[A-Za-zА-Яа-яЁё0-9]{2,4}$/.test(i.tag.trim())) return "Метка — 2–4 буквы или цифры";
  return null;
}

export function createClan(input: CreateInput): Result {
  const error = validateCreate(input);
  if (error) return fail(error);
  if (store.get().clan) return fail("Вы уже состоите в клане");
  const now = Date.now();
  const id = localId("c");
  const clan: Clan2 = {
    id, name: input.name.trim(), tag: input.tag.trim().toUpperCase(), emblem: input.emblem, color: input.color,
    motto: input.motto.trim(), createdAt: now, xp: 0, influence: 120, vault: 0, prestige: 0, mine: true,
  };
  const members: Member[] = [
    { id: "self", name: input.selfName || "Вы", role: "leader", joinedAt: now, weekXp: 0, totalXp: 0, weekDmg: 0, bot: false },
    ...makeBots(id, 5).map((m, i) => ({ ...m, joinedAt: now - (i + 1) * 3_600_000 })),
  ];
  const wk = weekKey(now);
  store.set({
    ...EMPTY, clan, selfRole: "leader", members, rivalLand: startingRivalLand(), event: newEvent(id, wk, members.length), tick: now, incomeTick: now, appTick: now,
    log: [{ id: localId("l"), at: now, kind: "system", text: `Клан «${clan.name}» основан. Стартовое влияние: 120.` }],
  });
  return OK;
}

export function joinRival(rivalId: string, selfName: string): Result {
  const rival = RIVALS.find((r) => r.id === rivalId);
  if (!rival) return fail("Клан не найден");
  if (store.get().clan) return fail("Сначала покиньте текущий клан");
  const now = Date.now();
  const id = `rv_${rival.id}`;
  const bots = makeBots(id, Math.min(rival.members, 40), `${rival.name.split(" ")[0]}-сан`);
  const members: Member[] = [...bots.map((m) => ({ ...m, joinedAt: now - 30 * 86_400_000 })), { id: "self", name: selfName || "Вы", role: "recruit", joinedAt: now, weekXp: 0, totalXp: 0, weekDmg: 0, bot: false }];
  const clan: Clan2 = {
    id, name: rival.name, tag: rival.tag, emblem: rival.emblem, color: rival.color, motto: rival.motto, createdAt: now - 60 * 86_400_000,
    xp: Math.round(600 * Math.pow(rival.level - 1, 1.7)) + 120, influence: 400, vault: 600, prestige: 40, mine: false,
  };
  const land: ClanV2State["land"] = {};
  const r = rng(id);
  for (const t of TERRITORIES.slice(0, Math.min(3, Math.floor(rival.level / 5)))) land[t.id] = Math.round(t.cost * (1 + r() * 0.3));
  store.set({
    ...EMPTY, clan, selfRole: "recruit", members, land, rivalLand: startingRivalLand(), event: newEvent(id, weekKey(now), members.length), tick: now, incomeTick: now,
    log: [{ id: localId("l"), at: now, kind: "join", text: `Вы вступили в клан «${clan.name}» новобранцем.` }],
  });
  return OK;
}

export function leaveClan(): Result {
  const s = store.get();
  if (!s.clan) return fail("Вы не в клане");
  if (s.selfRole === "leader" && s.members.length > 1) {
    return fail("Передайте главенство другому участнику или распустите клан");
  }
  store.set({ ...EMPTY, claimed: s.claimed });
  return OK;
}
export function disbandClan(): Result {
  const s = store.get();
  if (!s.clan) return fail("Вы не в клане");
  if (s.selfRole !== "leader") return fail("Распустить клан может только глава");
  store.set({ ...EMPTY, claimed: s.claimed });
  return OK;
}

/** Списывает AC через движок; true — деньги реально ушли */
function spendAc(amount: number): boolean {
  const res = emit({ type: "CLAN_CONTRIBUTED", amount });
  return res.effects.some((e) => e.type === "AC_SPENT");
}

/** Premium даёт ×1,5 к очкам клана (обещано на странице Premium) */
const clanMult = (): number => (isPremiumActive(readAccount()) ? PREMIUM_CLAN_MULT : 1);

export function contribute(amount: number): Result {
  const s = store.get();
  if (!s.clan || !s.event) return fail("Вы не в клане");
  const n = Math.floor(amount);
  if (!Number.isFinite(n) || n < 10) return fail("Минимальный вклад — 10 AC");
  if (!spendAc(n)) return fail("Не хватает AC");
  const now = Date.now();
  store.update((cur) => {
    if (!cur.clan || !cur.event) return cur;
    const b = bonuses(cur);
    const xp = Math.round(n * (1 + b.xp / 100) * clanMult());
    return {
      ...cur,
      clan: { ...cur.clan, vault: cur.clan.vault + n, xp: cur.clan.xp + xp, influence: cur.clan.influence + Math.floor(n / 2) },
      event: { ...cur.event, vaultWeek: cur.event.vaultWeek + n },
      members: cur.members.map((m) => (m.id === "self" ? { ...m, weekXp: m.weekXp + xp, totalXp: m.totalXp + xp } : m)),
      log: pushLog(cur, "vault", `Вы внесли ${n} AC в казну (+${Math.floor(n / 2)} влияния).`, now),
    };
  });
  return OK;
}

export const SMITES = [
  { id: "strike", name: "Удар", cost: 30, dmg: 600 },
  { id: "power", name: "Мощный удар", cost: 100, dmg: 2200 },
  { id: "ultimate", name: "Ультимейт", cost: 300, dmg: 7500 },
] as const;

export function smite(id: (typeof SMITES)[number]["id"]): Result {
  const s = store.get();
  const sm = SMITES.find((x) => x.id === id);
  if (!s.clan || !s.event || !sm) return fail("Вы не в клане");
  if (s.event.defeated) return fail("Босс уже повержен — ждите следующей недели");
  if (!spendAc(sm.cost)) return fail("Не хватает AC");
  const now = Date.now();
  store.update((cur) => {
    if (!cur.clan || !cur.event) return cur;
    const b = bonuses(cur);
    const dmg = Math.round(sm.dmg * (1 + b.damage / 100));
    const xpGain = Math.round(sm.cost * (1 + b.xp / 100) * clanMult());
    const half = Math.floor(sm.cost / 2);
    return {
      ...cur,
      clan: { ...cur.clan, vault: cur.clan.vault + half, xp: cur.clan.xp + xpGain },
      event: { ...cur.event, damage: cur.event.damage + dmg, vaultWeek: cur.event.vaultWeek + half },
      members: cur.members.map((m) => (m.id === "self" ? { ...m, weekDmg: m.weekDmg + dmg, weekXp: m.weekXp + xpGain, totalXp: m.totalXp + xpGain } : m)),
      log: pushLog(cur, "boss", `${sm.name}: ${dmg} урона по боссу.`, now),
    };
  });
  syncClan(store.get().event?.seenEp ?? 0);
  return OK;
}

export function claimChest(tier: ChestTier): Result {
  const s = store.get();
  if (!s.clan || !s.event) return fail("Вы не в клане");
  const t = CHEST_TIERS.find((x) => x.id === tier);
  if (!t) return fail("Неизвестный сундук");
  if (goalsDone(s) < t.need) return fail("Цели недели ещё не выполнены");
  const key = `c2:${s.clan.id}:${s.event.week}:${tier}`;
  if (s.claimed.includes(key)) return fail("Уже получено");
  const amount = Math.round(t.ac * (1 + bonuses(s).chest / 100));
  const res = emit({ type: "CLAN_CHEST_REWARD", key, amount });
  if (!res.effects.some((e) => e.type === "AC_GAINED")) return fail("Награда уже была выдана");
  store.update((cur) => ({ ...cur, claimed: [...cur.claimed, key].slice(-60), log: pushLog(cur, "vault", `Сундук «${t.name}»: +${amount} AC.`, Date.now()) }));
  return OK;
}
export const isClaimed = (s: ClanV2State, tier: ChestTier): boolean =>
  !!s.clan && !!s.event && s.claimed.includes(`c2:${s.clan.id}:${s.event.week}:${tier}`);

export function invest(id: TerritoryId, amount: number): Result {
  const s = store.get();
  if (!s.clan) return fail("Вы не в клане");
  if (!can.invest(s.selfRole)) return fail("Укреплять территории может элита и выше");
  if (s.rivalLand[id]) return fail(`Занята кланом «${rivalOfId(s.rivalLand[id] as string).name}» — объявите войну и возьмите штурмом`);
  if (!reachable(s, id)) return fail("Сначала захватите соседнюю территорию");
  const t = territoryOf(id);
  const cap = Math.round(t.cost * 1.5);
  const cur = s.land[id] ?? 0;
  const n = Math.min(Math.floor(amount), cap - cur, s.clan.influence);
  if (n <= 0) return fail(cur >= cap ? "Территория укреплена полностью" : "Не хватает влияния");
  const now = Date.now();
  const captured = cur < t.cost && cur + n >= t.cost;
  store.update((x) => x.clan ? {
    ...x,
    clan: { ...x.clan, influence: x.clan.influence - n },
    land: { ...x.land, [id]: cur + n },
    log: pushLog(x, "land", captured ? `«${t.name}» захвачена! ${t.bonus.text}.` : `Вложено ${n} влияния в «${t.name}».`, now),
  } : x);
  return OK;
}

/** Казна → влияние (офицер и выше): 10 AC → 6 влияния */
export function exchange(ac: number): Result {
  const s = store.get();
  if (!s.clan) return fail("Вы не в клане");
  if (!can.manage(s.selfRole)) return fail("Только офицер или глава");
  const n = Math.floor(ac);
  if (n < 10) return fail("Минимум 10 AC");
  if (n > s.clan.vault) return fail("В казне не хватает AC");
  const gain = Math.floor(n * 0.6);
  store.update((x) => x.clan ? { ...x, clan: { ...x.clan, vault: x.clan.vault - n, influence: x.clan.influence + gain }, log: pushLog(x, "vault", `Мобилизация: ${n} AC казны → ${gain} влияния.`, Date.now()) } : x);
  return OK;
}

function mutateMember(id: string, fn: (s: ClanV2State, m: Member) => ClanV2State | Result): Result {
  const s = store.get();
  const m = s.members.find((x) => x.id === id);
  if (!s.clan || !m) return fail("Участник не найден");
  const out = fn(s, m);
  if ("ok" in out) return out;
  store.set(out);
  return OK;
}

export function setRole(id: string, role: Role): Result {
  return mutateMember(id, (s, m) => {
    const me = ROLES[s.selfRole].rank;
    if (m.id === "self") return fail("Нельзя менять свою роль");
    if (!can.manage(s.selfRole)) return fail("Недостаточно прав");
    if (role === "leader") return fail("Для передачи главенства есть отдельная кнопка");
    if (ROLES[m.role].rank >= me) return fail("Нельзя менять равного или старшего");
    if (ROLES[role].rank >= me) return fail("Повысить можно только до роли ниже вашей");
    return { ...s, members: s.members.map((x) => (x.id === id ? { ...x, role } : x)), log: pushLog(s, "role", `${m.name}: роль «${ROLES[role].name}».`, Date.now()) };
  });
}
export function kick(id: string): Result {
  return mutateMember(id, (s, m) => {
    if (m.id === "self") return fail("Себя исключить нельзя");
    if (!can.manage(s.selfRole)) return fail("Недостаточно прав");
    if (ROLES[m.role].rank >= ROLES[s.selfRole].rank) return fail("Нельзя исключить равного или старшего");
    return { ...s, members: s.members.filter((x) => x.id !== id), log: pushLog(s, "leave", `${m.name} исключён из клана.`, Date.now()) };
  });
}
export function transferLead(id: string): Result {
  return mutateMember(id, (s, m) => {
    if (s.selfRole !== "leader") return fail("Только глава");
    if (m.id === "self") return fail("Вы уже глава");
    return {
      ...s, selfRole: "officer",
      members: s.members.map((x) => (x.id === id ? { ...x, role: "leader" as Role } : x.id === "self" ? { ...x, role: "officer" as Role } : x)),
      log: pushLog(s, "role", `${m.name} назначен главой клана.`, Date.now()),
    };
  });
}
export function acceptApplicant(id: string): Result {
  const s = store.get();
  const a = s.applicants.find((x) => x.id === id);
  if (!s.clan || !a) return fail("Заявка не найдена");
  if (!can.manage(s.selfRole)) return fail("Недостаточно прав");
  if (s.members.length >= memberCap(levelFromXp(s.clan.xp))) return fail("Клан заполнен — повышайте уровень");
  const now = Date.now();
  store.set({
    ...s,
    applicants: s.applicants.filter((x) => x.id !== id),
    members: [...s.members, { id: `b${hash(a.id).toString(36)}`, name: a.name, role: "recruit", joinedAt: now, weekXp: 0, totalXp: 0, weekDmg: 0, bot: true }],
    log: pushLog(s, "join", `${a.name} принят в клан.`, now),
  });
  return OK;
}
export function declineApplicant(id: string): Result {
  const s = store.get();
  if (!can.manage(s.selfRole)) return fail("Недостаточно прав");
  store.set({ ...s, applicants: s.applicants.filter((x) => x.id !== id) });
  return OK;
}

/** Глава видит новое сообщение клана: короткая запись в журнал */
export function setMotto(motto: string): Result {
  const s = store.get();
  if (!s.clan) return fail("Вы не в клане");
  if (!can.manage(s.selfRole)) return fail("Недостаточно прав");
  store.set({ ...s, clan: { ...s.clan, motto: motto.slice(0, 80) } });
  return OK;
}

/** Прочитанная глава манги даёт боссу немного урона (один раз на главу) */
export function noteChapter(mangaId: string, chapter: string): boolean {
  const s = store.get();
  if (!s.clan || !s.event || !mangaId || !chapter) return false;
  const key = `${mangaId}:${chapter}`;
  if (s.chapters.includes(key)) return false;
  store.update((cur) => {
    if (!cur.event) return cur;
    const dmg = cur.event.defeated ? 0 : 80;
    return {
      ...cur,
      chapters: [...cur.chapters, key].slice(-200),
      event: { ...cur.event, damage: cur.event.damage + dmg },
      members: cur.members.map((m) => (m.id === "self" ? { ...m, weekDmg: m.weekDmg + dmg } : m)),
    };
  });
  return true;
}

/* ================================ ВОЙНА ================================= */

export const WAR_HOURS = 48;
export const WAR_FEE = 100;
export const rivalOfId = (id: string): Rival => RIVALS.find((r) => r.id === id) ?? RIVALS[0];
const clampPos = (n: number) => Math.max(-100, Math.min(100, n));

function cloneWar(w: WarState): WarState {
  return {
    ...w, fronts: w.fronts.map((f) => ({ ...f })) as WarState["fronts"], score: { ...w.score }, cd: { ...w.cd }, log: [...w.log],
  };
}
function warLog(w: WarState, at: number, side: WarLogEntry["side"], text: string): void {
  w.log = [{ at, side, text }, ...w.log].slice(0, 30);
}

/** Исход по состоянию фронтов */
export function warOutcome(w: Pick<WarState, "fronts">): "win" | "loss" | "draw" {
  const up = w.fronts.filter((f) => f.pos > 0).length;
  const down = w.fronts.filter((f) => f.pos < 0).length;
  if (up !== down) return up > down ? "win" : "loss";
  const sum = w.fronts.reduce((n, f) => n + f.pos, 0);
  return sum > 0 ? "win" : sum < 0 ? "loss" : "draw";
}

/** Один «ход мира» войны: почасовое давление соперника и ботов. Мутирует st.war */
function tickWar(st: ClanV2State, now: number, dmgBonus: number): void {
  const w = st.war as WarState;
  const rival = rivalOfId(w.rivalId);
  const upTo = Math.min(now, w.endsAt);
  const hours = Math.max(0, Math.floor((upTo - w.tick) / 3_600_000));
  const botPush = ((st.members.length * 0.5) / 3) * (1 + dmgBonus / 100);
  for (let i = 0; i < hours; i++) {
    const t = w.tick + i * 3_600_000;
    for (let f = 0; f < 3; f++) {
      const fr = w.fronts[f];
      fr.pos = clampPos(fr.pos + botPush);
      w.score.me += botPush;
      if (fr.shieldUntil <= t) {
        const push = (0.9 + rival.level * 0.12) * (0.6 + rng(`${w.startedAt}:${f}:${t}`)() * 0.8);
        fr.pos = clampPos(fr.pos - push);
        w.score.them += push;
      }
    }
    if (Math.floor(t / 3_600_000) % 6 === 0) {
      const f = Math.floor(rng(`${w.startedAt}:s:${t}`)() * 3);
      if (w.fronts[f].shieldUntil <= t) {
        w.fronts[f].pos = clampPos(w.fronts[f].pos - 14);
        w.score.them += 14;
        warLog(w, t, "them", `«${rival.name}» бросает резерв: ${FRONT_NAMES[f]} теряет позиции.`);
      } else {
        warLog(w, t, "sys", `Щит выдержал удар резерва на участке «${FRONT_NAMES[f]}».`);
      }
    }
  }
  w.tick += hours * 3_600_000;
  const full = w.fronts.every((f) => f.pos >= 100) || w.fronts.every((f) => f.pos <= -100);
  if (now >= w.endsAt || full) settleWar(st, w, Math.min(now, w.endsAt));
}

function settleWar(st: ClanV2State, w: WarState, at: number): void {
  const result = warOutcome(w);
  const clan = st.clan as Clan2;
  const rival = rivalOfId(w.rivalId);
  const reward = { prestige: 0, vault: 0, influence: 0, xp: 0, captured: null as TerritoryId | null, lostInfluence: 0 };
  if (result === "win") {
    Object.assign(reward, { prestige: 80, vault: 300, influence: 200, xp: 800 });
    if (w.stake && st.rivalLand[w.stake] === w.rivalId) {
      delete st.rivalLand[w.stake];
      st.land[w.stake] = territoryOf(w.stake).cost;
      reward.captured = w.stake;
    }
  } else if (result === "draw") {
    Object.assign(reward, { prestige: 30, vault: 100, influence: 0, xp: 300 });
  } else {
    reward.prestige = 10;
    reward.xp = 150;
    reward.lostInfluence = Math.min(clan.influence, 150);
  }
  clan.prestige += reward.prestige;
  clan.vault += reward.vault;
  clan.influence += reward.influence - reward.lostInfluence;
  clan.xp += reward.xp;
  w.result = result;
  w.reward = reward;
  warLog(w, at, "sys", result === "win" ? "Победа! Соперник отступает." : result === "loss" ? "Поражение. Войско отходит." : "Ничья: стороны расходятся.");
  const land = reward.captured ? ` Территория «${territoryOf(reward.captured).name}» теперь ваша.` : "";
  st.log = pushLog(st, "boss", result === "win" ? `Война с «${rival.name}» выиграна.${land}` : result === "loss" ? `Война с «${rival.name}» проиграна.` : `Война с «${rival.name}» — ничья.`, at);
  st.history = [{ at, rivalId: w.rivalId, result, stake: w.stake }, ...st.history].slice(0, 8);
}

export function declareWar(rivalId: string, stake: TerritoryId | null): Result {
  const s = store.get();
  if (!s.clan) return fail("Вы не в клане");
  if (!can.manage(s.selfRole)) return fail("Объявить войну может офицер или глава");
  if (s.war) return fail("Война уже идёт");
  const now = Date.now();
  if (now < s.warLock) return fail("Войско ещё отдыхает после прошлой войны");
  if (s.clan.vault < WAR_FEE) return fail(`В казне нужно ${WAR_FEE} AC на снаряжение`);
  if (stake) {
    if (s.rivalLand[stake] !== rivalId) return fail("Эта территория не принадлежит выбранному клану");
    if (!reachable(s, stake)) return fail("Сначала захватите соседнюю территорию");
  }
  const rival = rivalOfId(rivalId);
  const war: WarState = {
    rivalId, stake, startedAt: now, endsAt: now + WAR_HOURS * 3_600_000, tick: now,
    fronts: [{ pos: 0, shieldUntil: 0 }, { pos: 0, shieldUntil: 0 }, { pos: 0, shieldUntil: 0 }],
    focus: 1, cd: { volley: 0, shield: 0, surge: 0 }, score: { me: 0, them: 0 },
    log: [{ at: now, side: "sys", text: `Война с «${rival.name}» объявлена. У вас ${WAR_HOURS} часов.` }],
  };
  store.set({
    ...s, war, clan: { ...s.clan, vault: s.clan.vault - WAR_FEE },
    log: pushLog(s, "boss", `Война с «${rival.name}» объявлена${stake ? `: ставка — «${territoryOf(stake).name}»` : ""}.`, now),
  });
  return OK;
}

function withWar(fn: (w: WarState, s: ClanV2State) => Result | void, spend?: number): Result {
  const s = store.get();
  const war = s.war;
  if (!s.clan || !war) return fail("Войны нет");
  if (war.result) return fail("Война уже закончилась");
  const w = cloneWar(war);
  const pre = fn(w, s);
  if (pre && !pre.ok) return pre;
  if (spend && !spendAc(spend)) return fail("Не хватает AC");
  store.update((cur) => ({ ...cur, war: w, clan: cur.clan && spend ? { ...cur.clan, vault: cur.clan.vault + Math.floor(spend / 2) } : cur.clan }));
  syncClan(store.get().event?.seenEp ?? 0);
  return OK;
}

export function setFocus(front: Front): Result {
  return withWar((w) => {
    w.focus = front;
  });
}

/** Отправить отряд на участок: 50 AC ≈ +12 к позиции */
export function deploy(front: Front, ac: number): Result {
  const n = Math.floor(ac);
  if (n < 10) return fail("Минимум 10 AC");
  const now = Date.now();
  return withWar((w, s) => {
    const gain = n * 0.24 * (1 + bonuses(s).damage / 100);
    w.fronts[front].pos = clampPos(w.fronts[front].pos + gain);
    w.score.me += gain;
    warLog(w, now, "me", `Отряд (${n} AC) усиливает «${FRONT_NAMES[front]}»: +${Math.round(gain)}.`);
  }, n);
}

export const ABILITY = {
  volley: { cost: 60, cd: 3 * 3_600_000, name: "Залп" },
  shield: { cost: 80, cd: 6 * 3_600_000, name: "Щит" },
  surge: { cost: 120, cd: 8 * 3_600_000, name: "Рывок" },
} as const;

export function castAbility(kind: keyof typeof ABILITY, front: Front = 1): Result {
  const a = ABILITY[kind];
  const now = Date.now();
  return withWar((w, s) => {
    if (w.cd[kind] > now) return fail("Способность перезаряжается");
    const b = 1 + bonuses(s).damage / 100;
    if (kind === "volley") {
      const g = 25 * b;
      w.fronts[front].pos = clampPos(w.fronts[front].pos + g);
      w.score.me += g;
      warLog(w, now, "me", `Залп по участку «${FRONT_NAMES[front]}»: +${Math.round(g)}.`);
    } else if (kind === "shield") {
      w.fronts[front].shieldUntil = now + 4 * 3_600_000;
      warLog(w, now, "me", `Щит на участке «${FRONT_NAMES[front]}»: соперник не давит 4 часа.`);
    } else {
      for (const f of w.fronts) f.pos = clampPos(f.pos + 8 * b);
      w.score.me += 24 * b;
      warLog(w, now, "me", "Рывок: все участки вперёд.");
    }
    w.cd[kind] = now + a.cd;
  }, a.cost);
}

export function closeWar(): Result {
  const s = store.get();
  if (!s.war || !s.war.result) return fail("Война ещё идёт");
  store.set({ ...s, war: null, warLock: Date.now() + 3 * 3_600_000 });
  return OK;
}

/* ============================ ЛАВКА И СУНДУКИ =========================== */

const FREE_ITEMS = new Set(["clan-bg-standard"]);
export const isOwned = (s: ClanV2State, id: string): boolean => FREE_ITEMS.has(id) || s.owned.includes(id);

export function buyItem(id: string): Result {
  const s = store.get();
  const item = itemOf(id);
  if (!s.clan || !item) return fail("Предмет не найден");
  if (!can.manage(s.selfRole)) return fail("Покупает офицер или глава: платит общая казна");
  if (isOwned(s, id)) return fail("Уже куплено");
  const { currency, price } = priceOf(item);
  const have = currency === "vault" ? s.clan.vault : s.clan.prestige;
  if (have < price) return fail(currency === "vault" ? "В казне не хватает AC" : "Не хватает престижа");
  store.update((x) => x.clan ? {
    ...x,
    clan: { ...x.clan, vault: x.clan.vault - (currency === "vault" ? price : 0), prestige: x.clan.prestige - (currency === "prestige" ? price : 0) },
    owned: [...x.owned, id],
    log: pushLog(x, "vault", `Куплено: «${item.name}».`, Date.now()),
  } : x);
  return OK;
}

export function equip(id: string, on = true): Result {
  const s = store.get();
  const item = itemOf(id);
  if (!s.clan || !item) return fail("Предмет не найден");
  if (!can.manage(s.selfRole)) return fail("Оформление меняет офицер или глава");
  if (!isOwned(s, id)) return fail("Сначала купите предмет");
  store.update((x) => {
    const eq = { ...x.equipped, decos: [...x.equipped.decos] };
    if (item.category === "background") eq.background = on ? id : undefined;
    else if (item.category === "emblem") eq.emblem = on ? id : undefined;
    else eq.decos = on ? [...new Set([...eq.decos, id])] : eq.decos.filter((d) => d !== id);
    return { ...x, equipped: eq };
  });
  return OK;
}

export interface LootDrop {
  entry: LootEntry;
  text: string;
  duplicate: boolean;
}
export interface OpenResult extends Result { loot?: LootDrop }

export function chestLocked(s: ClanV2State, c: Chest): string | null {
  if (!s.clan) return "Вы не в клане";
  if (levelFromXp(s.clan.xp) < c.needLevel) return `С ${c.needLevel} уровня клана`;
  return null;
}

export function openChest(tier: Chest["tier"]): OpenResult {
  const s = store.get();
  const c = CHESTS.find((x) => x.tier === tier);
  if (!s.clan || !c) return fail("Сундук не найден");
  if (!can.manage(s.selfRole)) return fail("Открывает офицер или глава: тратится общая казна");
  const lock = chestLocked(s, c);
  if (lock) return fail(lock);
  const have = c.currency === "vault" ? s.clan.vault : s.clan.prestige;
  if (have < c.price) return fail(c.currency === "vault" ? "В казне не хватает AC" : "Не хватает престижа");

  let roll = Math.random() * 100;
  let entry = c.loot[c.loot.length - 1];
  for (const e of c.loot) {
    if (roll < e.chance) {
      entry = e;
      break;
    }
    roll -= e.chance;
  }
  const now = Date.now();
  let duplicate = false;
  let text = entry.label;
  if (entry.to === "self") {
    const key = `c2chest:${s.clan.id}:${now}:${entry.id}`;
    const res = emit({ type: "CLAN_CHEST_REWARD", key, amount: entry.amount ?? 0 });
    if (!res.effects.some((e) => e.type === "AC_GAINED")) return fail("Награда не выдана, попробуйте ещё раз");
    text = `+${entry.amount} AC вам лично`;
  }
  if (entry.to === "unlock") duplicate = !!entry.itemId && isOwned(s, entry.itemId);
  const item = entry.itemId ? itemOf(entry.itemId) : undefined;
  store.update((x) => {
    if (!x.clan) return x;
    const clan = { ...x.clan };
    if (c.currency === "vault") clan.vault -= c.price;
    else clan.prestige -= c.price;
    let owned = x.owned;
    if (entry.to === "vault") clan.vault += entry.amount ?? 0;
    if (entry.to === "influence") clan.influence += entry.amount ?? 0;
    if (entry.to === "prestige") clan.prestige += entry.amount ?? 0;
    if (entry.to === "xp") clan.xp += entry.amount ?? 0;
    if (entry.to === "unlock") {
      if (duplicate) clan.prestige += 20;
      else if (entry.itemId) owned = [...owned, entry.itemId];
    }
    if (entry.to !== "unlock" && entry.to !== "self") text = `+${entry.amount} ${entry.to === "vault" ? "AC в казну" : entry.to === "influence" ? "влияния" : entry.to === "prestige" ? "престижа" : "опыта клана"}`;
    if (entry.to === "unlock") text = duplicate ? `«${item?.name ?? entry.label}» уже есть: +20 престижа` : `Новый предмет: «${item?.name ?? entry.label}»`;
    return { ...x, clan, owned, log: pushLog(x, "vault", `${c.name}: ${text}.`, now) };
  });
  return { ok: true, loot: { entry, text, duplicate } };
}

/** Для лавки: все предметы с признаком «куплено/надето» */
export const shopItems = ALL_ITEMS;
