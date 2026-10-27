"use client";

/**
 * Мягкая регистрационная стена для гостей.
 *
 * Гость свободно смотрит; когда он открыл две разные серии, ему один раз
 * предлагают сохранить прогресс и получить 100 монет. Это не блокировка:
 * карточку можно закрыть, повторно она появляется не чаще раза в сутки и
 * не больше трёх раз за всё время.
 */

import { createLocalStore } from "./store";
import { SIGNUP_BONUS_AC } from "./welcome-rules";

export { SIGNUP_BONUS_AC };

export const GUEST_WALL_KEY = "animehub:guest-wall:v1";

/** Сколько разных серий должен открыть гость до первого предложения */
export const GUEST_WALL_EPISODES = 2;
/** Минимальная пауза между показами */
export const GUEST_WALL_GAP_MS = 24 * 60 * 60 * 1000;
export const GUEST_WALL_MAX_SHOWS = 3;

export interface GuestWallState {
  /** Ключи открытых серий (тайтл:серия) */
  episodes: string[];
  shown: number;
  lastShownAt: number;
}

const EMPTY: GuestWallState = { episodes: [], shown: 0, lastShownAt: 0 };
export const guestWallStore = createLocalStore<GuestWallState>(GUEST_WALL_KEY, EMPTY);

export function noteGuestEpisode(key: string): void {
  const state = guestWallStore.get();
  if (state.episodes.includes(key) || state.episodes.length >= 20) return;
  guestWallStore.set({ ...state, episodes: [...state.episodes, key] });
}

/** Пора ли показывать предложение (чистая функция — удобно тестировать) */
export function shouldShowGuestWall(state: GuestWallState, now: number): boolean {
  if (state.episodes.length < GUEST_WALL_EPISODES) return false;
  if (state.shown >= GUEST_WALL_MAX_SHOWS) return false;
  return now - state.lastShownAt >= GUEST_WALL_GAP_MS;
}

export function markGuestWallShown(now = Date.now()): void {
  const state = guestWallStore.get();
  guestWallStore.set({ ...state, shown: state.shown + 1, lastShownAt: now });
}
