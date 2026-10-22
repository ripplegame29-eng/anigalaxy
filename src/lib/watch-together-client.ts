"use client";

import { useSyncExternalStore } from "react";

/**
 * Клиент комнат совместного просмотра.
 *
 * Всё состояние комнат теперь на сервере (`/api/watch-together/*`), а здесь —
 * тонкая обёртка над запросами и пара ключей в localStorage: постоянный
 * идентификатор клиента (чтобы сервер отличал участников) и ник.
 *
 * Идентичность отдаётся через `useSyncExternalStore`: серверный снимок пуст,
 * поэтому гидратация совпадает, а после неё подхватываются значения из
 * localStorage без `setState` в эффекте.
 */

export interface WtRoomInfo {
  code: string;
  title: string;
  anime: string;
  alias: string;
  poster: string;
  dub: string;
  access: "open" | "link";
  episode: number;
  position: number;
  playing: boolean;
  /** clientId того, кто последним поменял состояние */
  by: string;
  /** Время изменения состояния (мс, часы сервера) */
  at: number;
  createdAt: number;
  viewers: number;
  limit: number;
}

export interface WtMemberInfo {
  clientId: string;
  nickname: string;
  seenAt: number;
}

export interface WtMessageInfo {
  id: number;
  clientId: string;
  nickname: string;
  body: string;
  createdAt: number;
}

export interface WtSnapshot {
  room: WtRoomInfo;
  members: WtMemberInfo[];
  messages: WtMessageInfo[];
  serverTime: number;
}

export interface RoomState {
  episode: number;
  position: number;
  playing: boolean;
}

const CLIENT_KEY = "ag:wt:client";
const NICK_KEY = "ag:wt:nick";

/** Постоянный id этого браузера в комнатах */
export function getClientId(): string {
  try {
    const saved = window.localStorage.getItem(CLIENT_KEY);
    if (saved && /^[A-Za-z0-9_-]{8,64}$/.test(saved)) return saved;
  } catch {
    /* приватный режим — выдадим временный id */
  }
  const fresh =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  try {
    window.localStorage.setItem(CLIENT_KEY, fresh);
  } catch {
    /* не смогли сохранить — id проживёт до перезагрузки */
  }
  return fresh;
}

export function getNickname(): string {
  try {
    return window.localStorage.getItem(NICK_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveNickname(value: string): void {
  try {
    window.localStorage.setItem(NICK_KEY, value.slice(0, 24));
  } catch {
    /* приватный режим — ник просто не запомнится */
  }
}

/* ------------------------- Идентичность клиента --------------------- */

export interface Identity {
  clientId: string;
  nickname: string;
}

/** Пустой снимок для сервера: гидратация не должна зависеть от localStorage */
const SERVER_IDENTITY: Identity = { clientId: "", nickname: "" };

/**
 * Текущие значения читаются один раз при загрузке модуля в браузере.
 * Дальше объект меняется только через `rememberNickname`, поэтому
 * `useSyncExternalStore` не уходит в бесконечный ререндер.
 */
let identity: Identity =
  typeof window === "undefined"
    ? SERVER_IDENTITY
    : { clientId: getClientId(), nickname: getNickname() };

const listeners = new Set<() => void>();

function subscribeIdentity(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getIdentity(): Identity {
  return identity;
}

function getServerIdentity(): Identity {
  return SERVER_IDENTITY;
}

/** Id клиента и запомненный ник — реактивно */
export function useIdentity(): Identity {
  return useSyncExternalStore(subscribeIdentity, getIdentity, getServerIdentity);
}

/** Запомнить ник и обновить всех подписчиков */
export function rememberNickname(value: string): void {
  const next = value.trim().slice(0, 24);
  if (!next || next === identity.nickname) return;
  saveNickname(next);
  identity = { ...identity, nickname: next };
  for (const listener of listeners) listener();
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) {
    throw new Error(data?.error || `Ошибка запроса (${response.status})`);
  }
  return data as T;
}

export async function listRooms(): Promise<WtRoomInfo[]> {
  const data = await request<{ rooms: WtRoomInfo[] }>("/api/watch-together/rooms");
  return Array.isArray(data.rooms) ? data.rooms : [];
}

export async function getRoom(code: string, opts: { clientId?: string; after?: number } = {}): Promise<WtSnapshot> {
  const url = new URL(`/api/watch-together/rooms/${encodeURIComponent(code)}`, window.location.origin);
  if (opts.clientId) url.searchParams.set("client", opts.clientId);
  if (opts.after) url.searchParams.set("after", String(opts.after));
  return request<WtSnapshot>(url.pathname + url.search);
}

export async function createRoom(input: {
  clientId: string;
  nickname: string;
  title: string;
  anime: string;
  alias?: string;
  poster?: string;
  dub?: string;
  access: "open" | "link";
}): Promise<WtSnapshot> {
  return request<WtSnapshot>("/api/watch-together/rooms", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function joinRoom(code: string, clientId: string, nickname: string): Promise<WtSnapshot> {
  return request<WtSnapshot>(`/api/watch-together/rooms/${encodeURIComponent(code)}/join`, {
    method: "POST",
    body: JSON.stringify({ clientId, nickname }),
  });
}

export async function leaveRoom(code: string, clientId: string): Promise<void> {
  await request<{ ok: true }>(
    `/api/watch-together/rooms/${encodeURIComponent(code)}?client=${encodeURIComponent(clientId)}`,
    { method: "DELETE" },
  ).catch(() => undefined);
}

export async function patchRoomState(code: string, clientId: string, state: RoomState): Promise<void> {
  await request<WtSnapshot>(`/api/watch-together/rooms/${encodeURIComponent(code)}`, {
    method: "PATCH",
    body: JSON.stringify({ clientId, ...state }),
  });
}

export async function sendRoomMessage(code: string, clientId: string, body: string): Promise<WtMessageInfo> {
  const data = await request<{ ok: true; message: WtMessageInfo }>(
    `/api/watch-together/rooms/${encodeURIComponent(code)}/messages`,
    { method: "POST", body: JSON.stringify({ clientId, body }) },
  );
  return data.message;
}
