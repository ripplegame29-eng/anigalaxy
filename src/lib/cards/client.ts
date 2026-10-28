"use client";

/** Клиентское хранилище карточек: состояние сервера + вызов действий. */

import { useSyncExternalStore } from "react";
import { getProgressStore } from "../progression/store";
import { cardDef, setHidden } from "./catalog";
import type { Rank } from "./config";

export interface InvCard {
  id: number;
  cardId: string;
  foil: boolean;
  level: number;
  pity: number;
  locked: boolean;
  listed: boolean;
  /** Экипированные умения в порядке приоритета */
  skills: string[];
}

export interface CardsState {
  wallet: {
    diamonds: number;
    dust: number;
    packs: number;
    energy: number;
    energyMax: number;
    nextEnergyAt: number;
    scrolls: number[];
    pityEpic: number;
    pityLegend: number;
    rating: number;
    wins: number;
    losses: number;
    deck: number[];
  };
  dailyReady: boolean;
  league: { id: string; name: string; from: number; color: string };
  premium: boolean;
  inventory: InvCard[];
  pending: string[] | null;
  missions: { id: string; text: string; goal: number; progress: number; claimed: boolean; reward: { diamonds?: number; dust?: number; scroll?: number } }[];
  split: { used: number; free: number; max: number; extraCost: number };
  mods: { ban: string; buff: string };
  ac: number;
  art: string[];
  /** Герои без фото на AniList: не выпадают, в альбоме скрыты, если их нет у игрока */
  hidden: string[];
  pulls: { today: Pull[]; yesterday: Pull[] };
  now: number;
}
export interface Pull {
  nick: string;
  cardId: string;
  rank: number;
  at: number;
}

type Snapshot = { state: CardsState | null; loading: boolean; error: string };

let snap: Snapshot = { state: null, loading: false, error: "" };
const listeners = new Set<() => void>();
let artSet = new Set<string>();
let fetched = false;

function emit(next: Partial<Snapshot>): void {
  snap = { ...snap, ...next };
  if (snap.state) {
    artSet = new Set(snap.state.art);
    setHidden(snap.state.hidden ?? []);
  }
  listeners.forEach((l) => l());
}

export const hasArt = (id: string): boolean => artSet.has(id);

async function call<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  try {
    const res = await fetch(url, { credentials: "same-origin", ...init });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Нет связи с сервером" } as T & { error?: string } };
  }
}

export async function refresh(): Promise<void> {
  emit({ loading: true });
  const r = await call<CardsState>("/api/cards");
  if (r.ok) emit({ state: r.data, loading: false, error: "" });
  else emit({ loading: false, error: r.status === 401 ? "auth" : r.data.error ?? "Ошибка загрузки" });
  fetched = true;
}

export function ensureLoaded(): void {
  if (!fetched && !snap.loading) void refresh();
}

export type ActResult<T> = { ok: true; result: T } | { ok: false; error: string };

/** Выполнить действие; состояние обновляется из ответа */
export async function act<T = unknown>(op: string, body: Record<string, unknown> = {}): Promise<ActResult<T>> {
  const r = await call<{ result: T; state: CardsState }>(`/api/cards/${op}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) return { ok: false, error: r.data.error ?? "Не удалось выполнить действие" };
  emit({ state: r.data.state });
  if (op === "exchange") mirrorAc(r.data.state.ac);
  return { ok: true, result: r.data.result };
}

/** Серверный баланс AC → локальный документ прогресса (чтобы синхронизация не откатила трату) */
function mirrorAc(balance: number): void {
  try {
    getProgressStore().update((doc) => ({ ...doc, progress: { ...doc.progress, acBalance: balance } }));
  } catch {
    /* не критично */
  }
}

export async function view<T>(name: string, query = ""): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const r = await call<T>(`/api/cards?view=${name}${query}`);
  return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.data.error ?? "Ошибка" };
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const EMPTY: Snapshot = { state: null, loading: false, error: "" };

export function useCards(): Snapshot {
  return useSyncExternalStore(subscribe, () => snap, () => EMPTY);
}

export const rankOfCard = (cardId: string): Rank => (cardDef(cardId)?.rank ?? 0) as Rank;
