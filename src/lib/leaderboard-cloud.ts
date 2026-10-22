"use client";

/**
 * Призы лидерборда — настоящее место среди реальных игроков.
 *
 * Сервер знает настоящих соперников (`weekly_points`/`player_stats` со
 * всех устройств), поэтому именно он решает, какое место занял игрок на
 * прошедшей неделе, и платит приз один раз («забрать» нельзя дважды —
 * `claimed_at` в базе). Выдача XP/AC идёт тем же путём, что и раньше
 * (`emit(LEADERBOARD_REWARD)`), с тем же ключом недели — движок и так не
 * начислит дважды за одну неделю (см. `hasKey` в движке), так что здесь
 * можно не беспокоиться о пересечении со старым локальным подсчётом.
 *
 * Этот же модуль отдаёт саму таблицу лидеров (`useLeaderboardBoard`) —
 * только настоящие игроки, без сгенерированных соперников.
 */

import { useCallback, useSyncExternalStore } from "react";
import { emit } from "./progression/service";
import { addNotice, purchaseItem } from "./profile";
import { prizeFor } from "./leaderboard-prizes";

interface PendingReward {
  weekKey: string;
  rank: number;
  points: number;
}

export interface BoardRow {
  rank: number;
  nickname: string;
  level: number;
  points: number;
  premium: boolean;
  avatar?: string;
  frameId?: string;
}

export type BoardMetric = "xp" | "hours" | "series";

export interface BoardReply {
  period: "week" | "all";
  rows: BoardRow[];
  me: { points: number; rank: number | null; nickname: string } | null;
  ready: boolean;
}

async function call<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/* ------------------------------ Таблица лидеров -------------------------- */

const EMPTY: BoardReply = { period: "week", rows: [], me: null, ready: false };
/** Стабильные заглушки на каждый ключ — важно отдавать один и тот же
    объект, пока не пришёл ответ, иначе useSyncExternalStore решит, что
    снапшот меняется на каждом рендере, и уйдёт в бесконечный цикл
    (Maximum update depth exceeded). */
const fallbacks = new Map<string, BoardReply>();
function fallbackFor(key: string, period: "week" | "all"): BoardReply {
  let value = fallbacks.get(key);
  if (!value) {
    value = { ...EMPTY, period };
    fallbacks.set(key, value);
  }
  return value;
}
const cache = new Map<string, BoardReply>();
const listeners = new Map<string, Set<() => void>>();
const requested = new Set<string>();

function notify(key: string): void {
  listeners.get(key)?.forEach((fn) => fn());
}

async function fetchBoard(period: "week" | "all", metric: BoardMetric): Promise<void> {
  const key = `${period}:${metric}`;
  const reply = await call<Omit<BoardReply, "ready">>(`/api/leaderboard?period=${period}&metric=${metric}`);
  if (reply) {
    cache.set(key, { ...reply, ready: true });
    notify(key);
  }
}

/** Таблица реальных игроков: опыт за неделю/всё время, часы или серии */
export function useLeaderboardBoard(period: "week" | "all", metric: BoardMetric = "xp"): BoardReply {
  const key = `${period}:${metric}`;
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!listeners.has(key)) listeners.set(key, new Set());
      const set = listeners.get(key)!;
      set.add(onChange);
      if (!requested.has(key)) {
        requested.add(key);
        void fetchBoard(period, metric).finally(() => requested.delete(key));
      }
      return () => set.delete(onChange);
    },
    [key, period, metric],
  );
  const getSnapshot = useCallback(() => cache.get(key) ?? fallbackFor(key, period), [key, period]);
  const getServerSnapshot = useCallback(() => fallbackFor(key, period), [key, period]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/* ------------------------------- Призы недели ----------------------------- */

let claiming = false;

/** Проверяет и забирает невыплаченные призы прошлых недель. Безопасно вызывать часто. */
export async function claimServerLeaderboardRewards(): Promise<void> {
  if (claiming) return;
  claiming = true;
  try {
    const list = await call<{ rewards?: PendingReward[] }>("/api/leaderboard/rewards");
    for (const pending of list?.rewards ?? []) {
      const claimed = await call<{ ok?: boolean; reward?: PendingReward }>("/api/leaderboard/rewards", {
        weekKey: pending.weekKey,
      });
      if (!claimed?.ok || !claimed.reward) continue;
      const prize = prizeFor(claimed.reward.rank);
      if (!prize) continue;
      emit({ type: "LEADERBOARD_REWARD", key: claimed.reward.weekKey, xp: prize.xp, ac: prize.ac });
      if (prize.titleId) purchaseItem(prize.titleId, 0);
      if (prize.frameId) purchaseItem(prize.frameId, 0);
      addNotice(`Итог недели: ${claimed.reward.rank} место в лидерборде — ${prize.text}.`);
    }
  } finally {
    claiming = false;
  }
}
