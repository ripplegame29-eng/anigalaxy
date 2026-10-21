"use client";

/**
 * Недельный итог лидерборда: настоящие призы.
 *
 * Сервера с реальными игроками у проекта нет, поэтому соперники — те же
 * сгенерированные строки, что и на странице лидерборда (`botPoints`). Очки
 * игрока за неделю — это XP, набранный с понедельника (UTC). Когда неделя
 * сменилась, итог считается один раз: место среди соперников → приз.
 * XP и AC платит движок прогрессии (событие LEADERBOARD_REWARD,
 * идемпотентно по неделе), титулы и рамки кладутся в купленное.
 */

import { createLocalStore } from "./store";
import { emit, getProgress } from "./progression/service";
import { addNotice, purchaseItem } from "./profile";
import { prizeFor, weekKey, weeklyRank } from "./leaderboard-prizes";

export { PERIOD_SCALE, PRIZES, PRIZE_DEPTH, TOP_POINTS, botPoints, noise, prizeFor, weekKey, weeklyRank, type Prize } from "./leaderboard-prizes";

export interface WeekResult {
  week: string;
  points: number;
  rank: number | null;
  xp: number;
  ac: number;
  titleId?: string;
  frameId?: string;
}

interface LbState {
  /** Неделя (дата понедельника UTC), которую сейчас считаем */
  week: string;
  /** XP на начало недели */
  baseXp: number;
  /** XP на последней синхронизации */
  lastXp: number;
  history: WeekResult[];
}

const EMPTY: LbState = { week: "", baseXp: 0, lastXp: 0, history: [] };

const store = createLocalStore<LbState>("anigalaxy.leaderboard.v1", EMPTY, (raw) => {
  const v = JSON.parse(raw) as Partial<LbState>;
  if (!v || typeof v.week !== "string") return null;
  return { ...EMPTY, ...v, history: Array.isArray(v.history) ? v.history : [] };
});

export const useLeaderboardState = (): LbState => store.useStore();

/** Очки текущей недели (для строки «Ты» на странице) */
export const weekPoints = (s: LbState, xpTotal: number): number => (s.week ? Math.max(0, xpTotal - s.baseXp) : 0);

function settle(prev: LbState): WeekResult {
  const points = Math.max(0, prev.lastXp - prev.baseXp);
  const rank = weeklyRank(points);
  const prize = prizeFor(rank);
  const result: WeekResult = { week: prev.week, points: Math.round(points), rank, xp: prize?.xp ?? 0, ac: prize?.ac ?? 0, titleId: prize?.titleId, frameId: prize?.frameId };
  if (prize) {
    emit({ type: "LEADERBOARD_REWARD", key: prev.week, xp: prize.xp, ac: prize.ac });
    if (prize.titleId) purchaseItem(prize.titleId, 0);
    if (prize.frameId) purchaseItem(prize.frameId, 0);
    addNotice(`Итог недели: ${rank} место в лидерборде — ${prize.text}.`);
  }
  return result;
}

/**
 * Вызывается при каждом изменении XP. Первая синхронизация запоминает
 * точку отсчёта; смена недели закрывает прошлую и платит приз.
 */
export function trackLeaderboardWeek(xpTotal: number, now: number = Date.now()): void {
  const cur = weekKey(now);
  const s = store.get();
  if (!s.week) {
    store.set({ ...s, week: cur, baseXp: xpTotal, lastXp: xpTotal });
    return;
  }
  if (s.week === cur) {
    if (s.lastXp !== xpTotal) store.set({ ...s, lastXp: xpTotal });
    return;
  }
  const result = settle(s);
  // Награда сама прибавила XP: новая неделя считается уже после неё
  const after = getProgress().progress.xpTotal;
  store.set({ week: cur, baseXp: after, lastXp: after, history: [result, ...s.history].slice(0, 12) });
}
