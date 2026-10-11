"use client";

import { useCallback, useSyncExternalStore } from "react";
import { ACCOUNT_EVENT, ACCOUNT_KEY, parseAccount, type Account } from "./auth";

/**
 * Текущий аккаунт через `useSyncExternalStore`.
 *
 * Снимок кэшируется по строке из localStorage, иначе `getSnapshot` вернул бы
 * новый объект на каждом вызове и React ушёл бы в бесконечный ререндер.
 * Изменения внутри вкладки сообщает `ACCOUNT_EVENT`, между вкладками —
 * штатное событие `storage`.
 */
let cachedRaw: string | null | undefined;
let cachedAccount: Account | null = null;

function getSnapshot(): Account | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(ACCOUNT_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedAccount = parseAccount(raw);
  }
  return cachedAccount;
}

function getServerSnapshot(): Account | null {
  return null;
}

export function useAccount(): Account | null {
  const subscribe = useCallback((onChange: () => void) => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === ACCOUNT_KEY) onChange();
    };
    window.addEventListener(ACCOUNT_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ACCOUNT_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
