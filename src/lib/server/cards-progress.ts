/** Достижения, награды за сеты, недельные задания, витрина профиля. */

import { cardDef, visibleCatalog } from "../cards/catalog";
import { ACHIEVEMENTS, SET_MIN_SIZE, SET_REWARDS, SHOWCASE_MAX, STREAK, WEEKLY, type ProgressState, type Reward, type SetView } from "../cards/progress";
export type { ProgressState } from "../cards/progress";
import { fail, getWallet, grantReward, listInventory, logEvent, type Res } from "./cards";
import { dayKey } from "./day";
import { getExtra, rollWeek, setExtra, weekOf } from "./cards-extra";
import { num, str, transaction, type Database } from "./sqlite";

/** Серии с достаточным числом доступных героев */
function seriesSizes(): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const c of visibleCatalog(new Set<string>())) m.set(c.series, [...(m.get(c.series) ?? []), c.id]);
  for (const [k, v] of m) if (v.length < SET_MIN_SIZE) m.delete(k);
  return m;
}

const setNeed = (size: number): number[] => [Math.ceil(size / 2), size];

function statValue(stat: string, inv: ReturnType<typeof listInventory>, ext: ReturnType<typeof getExtra>, wins: number): number {
  const owned = new Set(inv.map((c) => c.cardId));
  const ranks = (min: number) => [...owned].filter((id) => (cardDef(id)?.rank ?? 0) >= min).length;
  switch (stat) {
    case "distinct":
      return owned.size;
    case "legend":
      return ranks(3);
    case "mythic":
      return ranks(4);
    case "foil":
      return inv.filter((c) => c.foil).length;
    case "wins":
      return wins;
    case "maxLevel":
      return inv.reduce((m, c) => Math.max(m, c.level), 0);
    case "login":
      return ext.streak.best;
    default:
      return ext.stats[stat] ?? 0;
  }
}

export function progressState(db: Database, userId: number, now = Date.now()): ProgressState {
  const w = getWallet(db, userId, now, false);
  const inv = listInventory(db, userId);
  const x = rollWeek(getExtra(db, userId), now);
  const owned = new Set(inv.map((c) => c.cardId));
  const achievements = ACHIEVEMENTS.map((a) => {
    const value = statValue(a.stat, inv, x, w.wins);
    return { id: a.id, value, claimed: x.ach[a.id] ?? 0, done: a.tiers.filter((t) => value >= t.goal).length };
  });
  const sets: SetView[] = [];
  for (const [series, ids] of seriesSizes()) {
    const n = ids.filter((id) => owned.has(id)).length;
    const need = setNeed(ids.length);
    sets.push({ series, size: ids.length, owned: n, claimed: need.map((_, i) => !!x.sets[`${series}:${i}`]), need });
  }
  sets.sort((a, b) => b.owned / b.size - a.owned / a.size || a.series.localeCompare(b.series, "ru"));
  const claimedToday = x.streak.last === dayKey(now);
  const bonus = Math.min(STREAK.maxBonus, STREAK.bonusPerDay * Math.max(0, x.streak.n - (claimedToday ? 1 : 0)));
  return {
    achievements,
    sets,
    streak: {
      n: x.streak.n,
      best: x.streak.best,
      claimedToday,
      milestones: STREAK.milestones.map((m) => ({ day: m.day, reward: m.reward, claimed: x.streak.claimed.includes(m.day) })),
      bonusPct: Math.round(bonus * 100),
    },
    weekly: WEEKLY.map((d) => ({ id: d.id, text: d.text, goal: d.goal, progress: Math.min(d.goal, x.weekly.progress[d.stat] ?? 0), claimed: !!x.weekly.claimed[d.id], reward: d.reward })),
    weekEndsAt: (weekOf(now) + 1) * 7 * 86_400_000 + 4 * 86_400_000,
    showcase: x.fav.filter((id) => inv.some((c) => c.id === id)),
    stats: x.stats,
  };
}

/** Забрать все выполненные ступени достижения */
export function claimAchievement(db: Database, userId: number, id: string, now = Date.now()): Res<{ tiers: number; reward: Reward }> {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return fail("Нет такого достижения");
  return transaction(db, (): Res<{ tiers: number; reward: Reward }> => {
    const w = getWallet(db, userId, now, false);
    const inv = listInventory(db, userId);
    const x = rollWeek(getExtra(db, userId), now);
    const value = statValue(a.stat, inv, x, w.wins);
    const from = x.ach[id] ?? 0;
    const ready = a.tiers.filter((t, i) => i >= from && value >= t.goal);
    if (!ready.length) return fail("Нет выполненных ступеней");
    const sum: Reward = {};
    const scrolls = new Map<number, number>();
    for (const t of ready) {
      sum.diamonds = (sum.diamonds ?? 0) + (t.reward.diamonds ?? 0);
      sum.dust = (sum.dust ?? 0) + (t.reward.dust ?? 0);
      sum.packs = (sum.packs ?? 0) + (t.reward.packs ?? 0);
      if (t.reward.scroll) scrolls.set(t.reward.scrollRank ?? 1, (scrolls.get(t.reward.scrollRank ?? 1) ?? 0) + t.reward.scroll);
    }
    grantReward(db, userId, { diamonds: sum.diamonds, dust: sum.dust, packs: sum.packs });
    for (const [rank, n] of scrolls) grantReward(db, userId, { scroll: n, scrollRank: rank });
    if (scrolls.size) {
      const [rank, n] = [...scrolls][0];
      sum.scroll = n;
      sum.scrollRank = rank;
    }
    x.ach[id] = from + ready.length;
    setExtra(db, userId, x);
    logEvent(db, userId, "ach", `Достижение «${a.name}»: ступеней ${ready.length}`, "", 0, now);
    return { ok: true, value: { tiers: ready.length, reward: sum } };
  });
}

export function claimSet(db: Database, userId: number, series: string, tier: number, now = Date.now()): Res<{ reward: Reward }> {
  const ids = seriesSizes().get(series);
  if (!ids) return fail("Такого набора нет");
  const t = Math.floor(tier);
  if (t !== 0 && t !== 1) return fail("Нет такой награды");
  return transaction(db, (): Res<{ reward: Reward }> => {
    getWallet(db, userId, now, false);
    const x = getExtra(db, userId);
    const key = `${series}:${t}`;
    if (x.sets[key]) return fail("Награда уже получена");
    if (t === 1 && !x.sets[`${series}:0`]) return fail("Сначала заберите награду за половину набора");
    const owned = new Set(listInventory(db, userId).map((c) => c.cardId));
    const n = ids.filter((id) => owned.has(id)).length;
    if (n < setNeed(ids.length)[t]) return fail("Набор ещё не собран");
    x.sets[key] = true;
    setExtra(db, userId, x);
    grantReward(db, userId, SET_REWARDS[t]);
    logEvent(db, userId, "set", `Набор «${series}»: ${t === 0 ? "половина" : "полный"}`, "", 0, now);
    return { ok: true, value: { reward: SET_REWARDS[t] } };
  });
}

export function claimWeekly(db: Database, userId: number, id: string, now = Date.now()): Res<{ reward: Reward }> {
  const d = WEEKLY.find((x) => x.id === id);
  if (!d) return fail("Нет такого задания");
  return transaction(db, (): Res<{ reward: Reward }> => {
    getWallet(db, userId, now, false);
    const x = rollWeek(getExtra(db, userId), now);
    if (x.weekly.claimed[id]) return fail("Награда уже получена");
    if ((x.weekly.progress[d.stat] ?? 0) < d.goal) return fail("Задание ещё не выполнено");
    x.weekly.claimed[id] = true;
    setExtra(db, userId, x);
    grantReward(db, userId, d.reward);
    logEvent(db, userId, "weekly", `Недельное задание «${d.text}» выполнено`, "", 0, now);
    return { ok: true, value: { reward: d.reward } };
  });
}

/** Витрина профиля: до 5 своих карт */
export function setShowcase(db: Database, userId: number, ids: number[]): Res<number[]> {
  const uniq = [...new Set(ids)];
  if (uniq.length > SHOWCASE_MAX) return fail(`В витрине не больше ${SHOWCASE_MAX} карт`);
  const inv = new Set(listInventory(db, userId).map((c) => c.id));
  if (uniq.some((id) => !inv.has(id))) return fail("Карта не найдена");
  getWallet(db, userId, undefined, false);
  const x = getExtra(db, userId);
  x.fav = uniq;
  setExtra(db, userId, x);
  return { ok: true, value: uniq };
}

/** Профиль коллекционера для других игроков */
export function collectorProfile(db: Database, nickname: string) {
  const u = db.prepare("SELECT id, nickname FROM users WHERE lower(nickname) = lower(?)").get(nickname.trim());
  if (!u) return fail("Игрок не найден");
  const id = num(u.id);
  const w = getWallet(db, id, undefined, false);
  const inv = listInventory(db, id);
  const x = getExtra(db, id);
  const owned = new Set(inv.map((c) => c.cardId));
  const best = [...inv].sort((a, b) => (cardDef(b.cardId)?.rank ?? 0) - (cardDef(a.cardId)?.rank ?? 0) || b.level - a.level)[0];
  return {
    ok: true as const,
    value: {
      nickname: str(u.nickname),
      rating: w.rating,
      wins: w.wins,
      losses: w.losses,
      distinct: owned.size,
      total: inv.length,
      streak: x.streak.best,
      showcase: x.fav
        .map((fid) => inv.find((c) => c.id === fid))
        .filter((c): c is NonNullable<typeof c> => !!c)
        .map((c) => ({ cardId: c.cardId, foil: c.foil, level: c.level })),
      best: best ? { cardId: best.cardId, foil: best.foil, level: best.level } : null,
    },
  };
}
