"use client";

/**
 * Публичный профиль игрока по нику (`/api/users`). Тот же приём, что и у
 * остальных облачных модулей: кэш вне React + useSyncExternalStore, а для
 * «ещё грузится» отдаётся один и тот же объект (иначе React уйдёт в цикл).
 */

import { useCallback, useSyncExternalStore } from "react";

export interface PublicProfile {
  nickname: string;
  level: number;
  xpTotal: number;
  premium: boolean;
  joinedAt: number;
  rank: number | null;
  clan: { name: string; tag: string } | null;
}

export type ProfileState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; profile: PublicProfile };

const LOADING: ProfileState = { status: "loading" };
const MISSING: ProfileState = { status: "missing" };
const cache = new Map<string, ProfileState>();
const listeners = new Map<string, Set<() => void>>();
const requested = new Set<string>();

async function load(key: string, nickname: string): Promise<void> {
  try {
    const response = await fetch(`/api/users?nickname=${encodeURIComponent(nickname)}`, { credentials: "same-origin" });
    const data = (await response.json()) as { ok?: boolean; profile?: PublicProfile };
    cache.set(key, data.ok && data.profile ? { status: "ready", profile: data.profile } : MISSING);
  } catch {
    cache.set(key, MISSING);
  }
  listeners.get(key)?.forEach((fn) => fn());
}

export function usePublicProfile(nickname: string): ProfileState {
  const key = nickname.trim().toLowerCase();
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!listeners.has(key)) listeners.set(key, new Set());
      const set = listeners.get(key)!;
      set.add(onChange);
      if (!cache.has(key) && !requested.has(key)) {
        requested.add(key);
        void load(key, nickname).finally(() => requested.delete(key));
      }
      return () => set.delete(onChange);
    },
    [key, nickname],
  );
  const getSnapshot = useCallback(() => cache.get(key) ?? LOADING, [key]);
  const getServerSnapshot = useCallback(() => LOADING, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
