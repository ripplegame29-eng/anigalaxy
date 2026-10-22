"use client";

/**
 * Подписки и друзья на чужом профиле — тонкий клиент над
 * `/api/profile-social` (чтение) и `/api/friends` (действия).
 *
 * Данные лежат в модульном кэше с устойчивой заглушкой: нестабильный
 * `getSnapshot` дал бы бесконечный ререндер (React #185).
 */

import { useCallback, useSyncExternalStore } from "react";

export type Relation = "self" | "none" | "outgoing" | "incoming" | "friends";

export interface SocialEntry {
  nickname: string;
  since: number;
}

export interface SocialData {
  userId: number;
  nickname: string;
  /** null — зритель не вошёл */
  relation: Relation | null;
  followers: SocialEntry[];
  following: SocialEntry[];
  friends: SocialEntry[];
}

export interface SocialState {
  loaded: boolean;
  data: SocialData | null;
}

const EMPTY: SocialState = { loaded: false, data: null };
const cache = new Map<string, SocialState>();
const pending = new Set<string>();
const listeners = new Set<() => void>();
const keyOf = (nickname: string) => nickname.trim().toLowerCase();
const emit = () => listeners.forEach((fn) => fn());

async function load(nickname: string): Promise<void> {
  const key = keyOf(nickname);
  if (pending.has(key)) return;
  pending.add(key);
  try {
    const response = await fetch(`/api/profile-social?nickname=${encodeURIComponent(nickname)}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    const body = (await response.json()) as { social?: SocialData };
    cache.set(key, { loaded: true, data: body.social ?? null });
  } catch {
    cache.set(key, { loaded: true, data: cache.get(key)?.data ?? null });
  } finally {
    pending.delete(key);
    emit();
  }
}

async function post(body: unknown): Promise<{ ok: boolean; error?: string; status: number }> {
  try {
    const response = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return { ok: Boolean(data.ok), error: data.error, status: response.status };
  } catch {
    return { ok: false, error: "Нет связи с сервером", status: 0 };
  }
}

/** Подписаться / принять заявку. Возвращает текст ошибки или null */
export async function followPlayer(nickname: string): Promise<string | null> {
  const reply = await post({ action: "request", nickname });
  await load(nickname);
  if (reply.ok) return null;
  return reply.status === 401 ? "auth" : (reply.error ?? "Не удалось отправить заявку");
}

/** Отписаться, отменить заявку или удалить из друзей */
export async function unfollowPlayer(nickname: string, userId: number): Promise<string | null> {
  const reply = await post({ action: "remove", userId });
  await load(nickname);
  return reply.ok ? null : reply.status === 401 ? "auth" : (reply.error ?? "Не удалось выполнить действие");
}

export function useProfileSocial(nickname: string): SocialState {
  const key = keyOf(nickname);
  const subscribe = useCallback(
    (onChange: () => void) => {
      listeners.add(onChange);
      if (!cache.has(key)) void load(nickname);
      return () => {
        listeners.delete(onChange);
      };
    },
    [key, nickname],
  );
  const getSnapshot = useCallback(() => cache.get(key) ?? EMPTY, [key]);
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}
