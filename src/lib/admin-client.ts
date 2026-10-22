"use client";

/**
 * Роль текущего пользователя: нужна, чтобы показать кнопку «Админ-панель»
 * только админам. Роль приходит с сервера (`/api/account/me`) и кэшируется
 * по нику; настоящая проверка всё равно на сервере.
 */

import { useCallback, useSyncExternalStore } from "react";
import { useAccount } from "./use-account";

const roles = new Map<string, string>();
const pending = new Set<string>();
const listeners = new Set<() => void>();

async function load(nickname: string): Promise<void> {
  if (pending.has(nickname)) return;
  pending.add(nickname);
  try {
    const response = await fetch("/api/account/me", { credentials: "same-origin", cache: "no-store" });
    const body = (await response.json()) as { account?: { nickname?: string; role?: string } | null };
    roles.set(nickname, body.account?.nickname?.toLowerCase() === nickname ? (body.account.role ?? "user") : "user");
  } catch {
    roles.set(nickname, "user");
  } finally {
    pending.delete(nickname);
    listeners.forEach((fn) => fn());
  }
}

/** true, если вошедший пользователь — админ (определяется после ответа сервера) */
export function useIsAdmin(): boolean {
  const nickname = useAccount()?.nickname.toLowerCase() ?? "";
  const subscribe = useCallback(
    (onChange: () => void) => {
      listeners.add(onChange);
      if (nickname && !roles.has(nickname)) void load(nickname);
      return () => {
        listeners.delete(onChange);
      };
    },
    [nickname],
  );
  return useSyncExternalStore(
    subscribe,
    () => (nickname ? roles.get(nickname) === "admin" : false),
    () => false,
  );
}
