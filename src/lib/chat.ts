"use client";

/**
 * Общий чат AniGalaxy — одна настоящая лента на всех игроков (`/api/chat`).
 *
 * Без сокетов: лента обновляется поллингом (раз в 4 секунды, пока панель
 * открыта). Боты и локальная симуляция убраны — сообщения только от
 * реальных вошедших игроков, видны всем, включая гостей (читать можно
 * без входа, писать — после входа).
 *
 * Как и другие сторы проекта, данные живут вне React: поллинг и отправка
 * управляют общим кэшем и уведомляют подписчиков напрямую, без `setState`
 * в эффекте.
 */

import { useCallback, useSyncExternalStore } from "react";
import { createLocalStore } from "./store";

export interface ChatMessage {
  id: string;
  author: string;
  text: string;
  at: number;
  tagId?: string;
  avatar?: string;
  frameId?: string;
  /** сообщение самого пользователя (вычисляется на клиенте по нику) */
  self?: boolean;
}

export const CHAT_TEXT_LIMIT = 300;

interface ServerChatMessage {
  id: number;
  userId: number;
  nickname: string;
  tagId: string;
  body: string;
  createdAt: number;
  avatar?: string;
  frameId?: string;
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

let items: ServerChatMessage[] = [];
let lastId = 0;
const listeners = new Set<() => void>();
let polling = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

function notify(): void {
  listeners.forEach((fn) => fn());
}

async function poll(): Promise<void> {
  const reply = await call<{ messages?: ServerChatMessage[] }>(`/api/chat?after=${lastId}`);
  const fresh = reply?.messages ?? [];
  if (fresh.length) {
    items = [...items, ...fresh].slice(-200);
    lastId = fresh[fresh.length - 1].id;
    notify();
  }
}

function loop(): void {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = setTimeout(() => {
    void poll().finally(loop);
  }, 4000);
}

function ensurePolling(): () => void {
  if (!polling) {
    polling = true;
    void poll().then(loop);
  }
  return () => {};
}

/** Лента сообщений (общий кэш, вне React) */
export function useChatMessages(): ChatMessage[] {
  const subscribe = useCallback((onChange: () => void) => {
    listeners.add(onChange);
    ensurePolling();
    return () => listeners.delete(onChange);
  }, []);
  const getSnapshot = useCallback(() => items, []);
  const getServerSnapshot = useCallback(() => [] as ServerChatMessage[], []);
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return raw.map((item) => ({
    id: `chat:${item.id}`,
    author: item.nickname,
    text: item.body,
    at: item.createdAt,
    tagId: item.tagId || undefined,
    avatar: item.avatar || undefined,
    frameId: item.frameId || undefined,
  }));
}

/** Отправить сообщение; сразу подтягивает ленту, не дожидаясь очередного опроса */
export async function sendChatMessage(text: string, tagId?: string): Promise<void> {
  const clean = text.trim().slice(0, CHAT_TEXT_LIMIT);
  if (!clean) return;
  await call("/api/chat", { body: clean, tagId });
  await poll();
}

/* --------------------------- Отметка «прочитано» ------------------------- */

interface ReadState {
  lastRead: number;
}

const readStore = createLocalStore<ReadState>("animehub:chat-read:v1", { lastRead: 0 }, (raw) => {
  const v = JSON.parse(raw) as Partial<ReadState>;
  return typeof v?.lastRead === "number" ? { lastRead: v.lastRead } : null;
});

export const useChatRead = (): ReadState => readStore.useStore();

export function markChatRead(): void {
  readStore.set({ lastRead: Date.now() });
}

export function unreadChatCount(messages: ChatMessage[], read: ReadState, myName: string): number {
  return messages.filter((m) => m.author !== myName && m.at > read.lastRead).length;
}
