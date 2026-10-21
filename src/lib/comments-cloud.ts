"use client";

/**
 * Комментарии тайтла, видимые другим игрокам (`/api/comments`).
 *
 * Стена профиля и правила наград (кулдаун, качество текста, движок XP)
 * остаются целиком локальными — это и есть прежняя система из
 * `lib/comments.ts`. Этот модуль добавляет к ней только то, чего не было:
 * возможность видеть комментарии других реальных игроков под тем же
 * тайтлом и голосовать за них. Свой комментарий публикуется и на сервер,
 * чтобы его увидели остальные; награда за него по-прежнему считается
 * локально и не зависит от сети.
 *
 * Данные живут вне React (как остальные сторы проекта, `lib/store.ts`):
 * запрос уходит из `subscribe`, а не из эффекта с `setState`.
 */

import { useCallback, useSyncExternalStore } from "react";
import type { CommentMsg } from "./comments";

export interface ServerComment {
  id: number;
  userId: number;
  nickname: string;
  parentId: number | null;
  body: string;
  createdAt: number;
  score: number;
  myVote: number;
}

const cache = new Map<string, ServerComment[]>();
const listeners = new Map<string, Set<() => void>>();
const requested = new Set<string>();
const EMPTY: ServerComment[] = [];

function notify(titleId: string): void {
  listeners.get(titleId)?.forEach((fn) => fn());
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

async function reload(titleId: string): Promise<void> {
  const reply = await call<{ comments?: ServerComment[] }>(`/api/comments?title=${encodeURIComponent(titleId)}`);
  if (reply?.comments) {
    cache.set(titleId, reply.comments);
    notify(titleId);
  }
}

/** Префикс, которым помечены серверные id, чтобы не путать их с локальными */
export const SERVER_PREFIX = "srv:";

function fromServer(item: ServerComment): CommentMsg {
  return {
    id: `${SERVER_PREFIX}${item.id}`,
    parentId: item.parentId !== null ? `${SERVER_PREFIX}${item.parentId}` : undefined,
    author: item.nickname,
    text: item.body,
    at: item.createdAt,
    likes: item.score > 0 ? item.score : 0,
    dislikes: item.score < 0 ? -item.score : 0,
    myVote: item.myVote === 1 ? "up" : item.myVote === -1 ? "down" : undefined,
  };
}

/** Серверные комментарии тайтла (другие игроки); обновляются после своих действий */
export function useServerComments(titleId: string, myName: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!titleId) return () => {};
      if (!listeners.has(titleId)) listeners.set(titleId, new Set());
      const set = listeners.get(titleId)!;
      set.add(onChange);
      if (!cache.has(titleId) && !requested.has(titleId)) {
        requested.add(titleId);
        void reload(titleId).finally(() => requested.delete(titleId));
      }
      return () => set.delete(onChange);
    },
    [titleId],
  );
  const getSnapshot = useCallback(() => cache.get(titleId) ?? EMPTY, [titleId]);
  const getServerSnapshot = useCallback(() => EMPTY, []);
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const post = useCallback(
    async (body: string, parentId?: string) => {
      const numericParent = parentId?.startsWith(SERVER_PREFIX) ? Number(parentId.slice(SERVER_PREFIX.length)) : undefined;
      await call("/api/comments", { action: "add", titleId, body, parentId: numericParent });
      await reload(titleId);
    },
    [titleId],
  );

  const vote = useCallback(
    async (serverId: string, dir: "up" | "down") => {
      const id = Number(serverId.slice(SERVER_PREFIX.length));
      const list = cache.get(titleId) ?? EMPTY;
      const current = list.find((item) => item.id === id);
      const value = current?.myVote === (dir === "up" ? 1 : -1) ? 0 : dir === "up" ? 1 : -1;
      // Оптимистичное обновление — сервер за сетевой паузой не должен моргать счётчиком
      cache.set(
        titleId,
        list.map((item) => (item.id === id ? { ...item, score: item.score - (current?.myVote ?? 0) + value, myVote: value } : item)),
      );
      notify(titleId);
      await call("/api/comments", { action: "vote", id, value });
    },
    [titleId],
  );

  const remove = useCallback(
    async (serverId: string) => {
      const id = Number(serverId.slice(SERVER_PREFIX.length));
      await call("/api/comments", { action: "delete", id });
      await reload(titleId);
    },
    [titleId],
  );

  // Чужие комментарии — свой уже виден локально сразу после отправки
  const foreign = items.filter((item) => item.nickname !== myName).map(fromServer);

  return { foreign, post, vote, remove };
}
