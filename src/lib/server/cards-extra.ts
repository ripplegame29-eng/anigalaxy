/**
 * Расширяемое хранилище прогресса коллекционера (`card_wallet.extra`, JSON):
 * достижения, серия входа, недельные задания, витрина, кампания, рейд, пасс.
 * Зависит только от БД, чтобы им могли пользоваться и cards.ts, и модули выше.
 */

import { dayKey } from "./day";
import { num, str, type Database } from "./sqlite";

export interface Extra {
  /** Забрано ступеней достижений */
  ach: Record<string, number>;
  /** Награды за сеты: `аниме:ступень` */
  sets: Record<string, boolean>;
  /** Витрина профиля: id карт коллекции */
  fav: number[];
  streak: { n: number; best: number; last: string; claimed: number[] };
  /** Накопительная статистика за всё время */
  stats: Record<string, number>;
  weekly: { week: number; progress: Record<string, number>; claimed: Record<string, boolean> };
  /** Кампания: звёзды по этапам, забранные награды глав */
  camp: { stars: Record<string, number>; chapters: Record<string, boolean> };
  /** Рейд: неделя, нанесённый урон, награды */
  raid: { week: number; damage: number; hits: number; claimed: number; defeat: boolean; day: string; dayHits: number };
  /** Сезонный пасс */
  pass: { season: number; xp: number; free: number[]; premium: number[] };
  /** Гарантии баннеров: id баннера → паки без главного приза */
  banners: Record<string, number>;
  [k: string]: unknown;
}

/** Номер недели боёв (смена по четвергам) — как `weekIndexOf` у боёв */
export const weekOf = (ms: number): number => Math.floor((ms - 4 * 86_400_000) / (7 * 86_400_000));

const blank = (): Extra => ({
  ach: {},
  sets: {},
  fav: [],
  streak: { n: 0, best: 0, last: "", claimed: [] },
  stats: {},
  weekly: { week: 0, progress: {}, claimed: {} },
  camp: { stars: {}, chapters: {} },
  raid: { week: 0, damage: 0, hits: 0, claimed: 0, defeat: false, day: "", dayHits: 0 },
  pass: { season: 0, xp: 0, free: [], premium: [] },
  banners: {},
});

export function getExtra(db: Database, userId: number): Extra {
  const row = db.prepare("SELECT extra FROM card_wallet WHERE user_id = ?").get(userId);
  const base = blank();
  if (!row) return base;
  try {
    const v = JSON.parse(str(row.extra, "{}")) as Partial<Extra>;
    return {
      ...base,
      ...v,
      streak: { ...base.streak, ...(v.streak ?? {}) },
      weekly: { ...base.weekly, ...(v.weekly ?? {}) },
      camp: { ...base.camp, ...(v.camp ?? {}) },
      raid: { ...base.raid, ...(v.raid ?? {}) },
      pass: { ...base.pass, ...(v.pass ?? {}) },
    };
  } catch {
    return base;
  }
}

export function setExtra(db: Database, userId: number, x: Extra): void {
  db.prepare("UPDATE card_wallet SET extra = ? WHERE user_id = ?").run(JSON.stringify(x), userId);
}

/** Привести недельные счётчики к текущей неделе */
export function rollWeek(x: Extra, now: number): Extra {
  const w = weekOf(now);
  if (x.weekly.week !== w) x.weekly = { week: w, progress: {}, claimed: {} };
  if (x.raid.week !== w) x.raid = { week: w, damage: 0, hits: 0, claimed: 0, defeat: false, day: "", dayHits: 0 };
  return x;
}

/** Прибавить к статистике (за всё время) и к недельному счётчику */
export function track(db: Database, userId: number, stat: string, n = 1, now = Date.now()): void {
  if (!(n > 0)) return;
  const x = rollWeek(getExtra(db, userId), now);
  x.stats[stat] = (x.stats[stat] ?? 0) + n;
  x.weekly.progress[stat] = (x.weekly.progress[stat] ?? 0) + n;
  setExtra(db, userId, x);
}

/** Победная серия */
export function trackFight(db: Database, userId: number, win: boolean): void {
  const x = getExtra(db, userId);
  const cur = win ? (x.stats.curStreak ?? 0) + 1 : 0;
  x.stats.curStreak = cur;
  x.stats.streak = Math.max(x.stats.streak ?? 0, cur);
  setExtra(db, userId, x);
}

/** Серия ежедневных входов: вызывается при получении подарка дня, возвращает её длину и новые вехи */
export function touchStreak(db: Database, userId: number, now: number): { n: number; best: number } {
  const x = getExtra(db, userId);
  const today = dayKey(now);
  if (x.streak.last !== today) {
    const keep = x.streak.last === dayKey(now - 86_400_000);
    x.streak.n = keep ? x.streak.n + 1 : 1;
    if (!keep) x.streak.claimed = [];
    x.streak.best = Math.max(x.streak.best, x.streak.n);
    x.streak.last = today;
    x.stats.login = x.streak.best;
    setExtra(db, userId, x);
  }
  return { n: x.streak.n, best: x.streak.best };
}

export const numOf = (v: unknown): number => num(v);
