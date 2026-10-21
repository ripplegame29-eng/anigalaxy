"use client";

/**
 * Друзья — тонкий клиент над `/api/friends`.
 *
 * Без входа или без сервера список пуст (как и было честно показано
 * раньше): раздел не придумывает данные, а просто ничего не находит.
 *
 * Данные живут вне React (как и другие сторы проекта, `lib/store.ts`):
 * запрос уходит из `subscribe`, а не из эффекта с `setState`.
 */

import { useCallback, useSyncExternalStore } from "react";

export interface FriendRow {
  userId: number;
  nickname: string;
  status: "accepted" | "incoming" | "outgoing";
  since: number;
}

interface State {
  loading: boolean;
  friends: FriendRow[];
  error: "auth" | null;
}

const EMPTY: State = { loading: false, friends: [], error: null };
let state: State = EMPTY;
const listeners = new Set<() => void>();
let loadingNow = false;

function set(next: State): void {
  state = next;
  listeners.forEach((fn) => fn());
}

async function call<T>(path: string, body?: unknown): Promise<{ data: T | null; status: number }> {
  try {
    const response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
    let data: T | null = null;
    try {
      data = (await response.json()) as T;
    } catch {
      data = null;
    }
    return { data, status: response.status };
  } catch {
    return { data: null, status: 0 };
  }
}

async function reload(): Promise<void> {
  if (loadingNow) return;
  loadingNow = true;
  set({ ...state, loading: true });
  const reply = await call<{ friends?: FriendRow[] }>("/api/friends");
  loadingNow = false;
  set({ loading: false, friends: reply.data?.friends ?? [], error: reply.status === 401 ? "auth" : null });
}

async function requestFriend(nickname: string): Promise<string | null> {
  const reply = await call<{ ok?: boolean; status?: string; error?: string }>("/api/friends", {
    action: "request",
    nickname,
  });
  if (reply.data?.ok) {
    await reload();
    return null;
  }
  return reply.data?.error ?? (reply.status === 401 ? "Войдите в аккаунт" : "Не удалось отправить заявку");
}

async function removeFriend(userId: number): Promise<void> {
  await call("/api/friends", { action: "remove", userId });
  await reload();
}

/** Список друзей/заявок + действия. Подтягивается заново при каждом открытии окна. */
export function useFriends(active: boolean) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      listeners.add(onChange);
      if (active) void reload();
      return () => listeners.delete(onChange);
    },
    [active],
  );
  const getSnapshot = useCallback(() => state, []);
  const getServerSnapshot = useCallback(() => EMPTY, []);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return { ...snapshot, request: requestFriend, remove: removeFriend, reload };
}
