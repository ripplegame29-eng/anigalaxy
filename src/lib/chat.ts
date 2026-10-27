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
  /** числовой id на сервере */
  rawId: number;
  replyTo: number;
  reply?: ChatReply | null;
  kind: "text" | "voice";
  audioMs: number;
  wave: string;
  editedAt: number;
  deleted: boolean;
  reactions: ChatReaction[];
}

export interface ChatReaction {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface ChatReply {
  id: number;
  nickname: string;
  text: string;
  kind: "text" | "voice";
  deleted: boolean;
}

export const CHAT_TEXT_LIMIT = 300;
export const CHAT_EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "🎉", "😍", "💀", "🙏", "👀"] as const;
export const CHAT_VOICE_MAX_MS = 60_000;
export const CHAT_EDIT_WINDOW_MS = 15 * 60_000;

interface ServerChatMessage {
  id: number;
  userId: number;
  nickname: string;
  tagId: string;
  body: string;
  createdAt: number;
  avatar?: string;
  frameId?: string;
  replyTo?: number;
  reply?: ChatReply | null;
  kind?: "text" | "voice";
  audioMs?: number;
  wave?: string;
  editedAt?: number;
  deleted?: boolean;
  reactions?: ChatReaction[];
}

interface ChatPatch {
  id: number;
  r: ChatReaction[];
  e: number;
  d: boolean;
  b?: string;
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
  const reply = await call<{ messages?: ServerChatMessage[]; patches?: ChatPatch[] }>(`/api/chat?after=${lastId}`);
  const fresh = reply?.messages ?? [];
  let changed = false;
  if (fresh.length) {
    items = [...items, ...fresh].slice(-200);
    lastId = fresh[fresh.length - 1].id;
    changed = true;
  }
  const patches = Array.isArray(reply?.patches) ? reply.patches : [];
  if (patches.length) {
    const byId = new Map(patches.map((patch) => [patch.id, patch]));
    const next = items.map((item) => {
      const patch = byId.get(item.id);
      if (!patch) return item;
      const reactions = patch.r ?? [];
      const same =
        (item.editedAt ?? 0) === patch.e &&
        !!item.deleted === patch.d &&
        JSON.stringify(item.reactions ?? []) === JSON.stringify(reactions);
      if (same) return item;
      changed = true;
      return {
        ...item,
        reactions,
        editedAt: patch.e,
        deleted: patch.d,
        body: patch.d ? "" : patch.b !== undefined ? patch.b : item.body,
      };
    });
    if (changed) items = next;
  }
  if (changed) notify();
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

/** Один и тот же пустой массив: React требует стабильный серверный снимок */
const EMPTY_SERVER_ITEMS: ServerChatMessage[] = [];

/** Лента сообщений (общий кэш, вне React) */
export function useChatMessages(): ChatMessage[] {
  const subscribe = useCallback((onChange: () => void) => {
    listeners.add(onChange);
    ensurePolling();
    return () => listeners.delete(onChange);
  }, []);
  const getSnapshot = useCallback(() => items, []);
  const getServerSnapshot = useCallback(() => EMPTY_SERVER_ITEMS, []);
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return raw.map((item) => ({
    id: `chat:${item.id}`,
    author: item.nickname,
    text: item.body,
    at: item.createdAt,
    tagId: item.tagId || undefined,
    avatar: item.avatar || undefined,
    frameId: item.frameId || undefined,
    rawId: item.id,
    replyTo: item.replyTo ?? 0,
    reply: item.reply,
    kind: item.kind ?? "text",
    audioMs: item.audioMs ?? 0,
    wave: item.wave ?? "",
    editedAt: item.editedAt ?? 0,
    deleted: !!item.deleted,
    reactions: item.reactions ?? [],
  }));
}

/** Отправить сообщение; сразу подтягивает ленту, не дожидаясь очередного опроса */
export async function sendChatMessage(text: string, tagId?: string, replyTo?: number): Promise<string | null> {
  const clean = text.trim().slice(0, CHAT_TEXT_LIMIT);
  if (!clean) return null;
  const reply = await call<{ error?: string }>("/api/chat", { body: clean, tagId, replyTo });
  await poll();
  return reply?.error ?? null;
}

/** Поставить/снять реакцию. Сразу обновляет ленту, не дожидаясь опроса. */
export async function reactChatMessage(id: number, emoji: string): Promise<string | null> {
  const reply = await call<{ error?: string }>("/api/chat", { action: "react", id, emoji });
  await poll();
  return reply?.error ?? null;
}

export async function editChatMessage(id: number, text: string): Promise<string | null> {
  const reply = await call<{ error?: string }>("/api/chat", { action: "edit", id, body: text.trim().slice(0, CHAT_TEXT_LIMIT) });
  await poll();
  return reply?.error ?? null;
}

export async function deleteChatMessage(id: number): Promise<string | null> {
  const reply = await call<{ error?: string }>("/api/chat", { action: "delete", id });
  await poll();
  return reply?.error ?? null;
}

/** Отправить голосовое: blob из MediaRecorder, длительность и пики (строка цифр 0–9) */
export async function sendChatVoice(
  blob: Blob,
  ms: number,
  wave: string,
  tagId?: string,
  replyTo?: number,
): Promise<string | null> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": blob.type || "audio/webm",
      "x-audio-ms": String(Math.round(ms)),
      "x-audio-wave": wave,
    };
    if (tagId) headers["x-tag-id"] = tagId;
    if (replyTo) headers["x-reply-to"] = String(replyTo);
    const response = await fetch("/api/chat/voice", { method: "POST", headers, body: blob, credentials: "same-origin" });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    await poll();
    return response.ok ? null : (data?.error ?? "Не удалось отправить");
  } catch {
    return "Нет связи — попробуйте ещё раз";
  }
}

/** Сколько сообщений новее отметки «прочитано», среди чужих — для бейджа и «вниз» */

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
