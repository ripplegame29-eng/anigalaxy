"use client";

/**
 * Клиентский слой кланов. Единственный источник правды — сервер:
 * `/api/clans/me` (состав, сезон, лига, цели, казна), `/api/clans/war` (карточная война),
 * `/api/clans/donate` (запросы карт). Здесь — общий кэш, хуки и вызовы действий.
 */

import { useEffect, useSyncExternalStore } from "react";
import type { CwState, DonateState } from "@/lib/cards/clanwar";
import type { ClanItem, ClanRole } from "@/lib/clan-rules";

/* --------------------------------- Типы ----------------------------------- */

export interface ClanInfo {
  id: number;
  name: string;
  tag: string;
  description: string;
  leaderId: number;
  xp: number;
  treasury: number;
  members: number;
  league: number;
  trophies: number;
  crystals: number;
  extraSlots: number;
  level: number;
  cap: number;
  /** Эмблема, выбранная главой; пусто — по номеру клана */
  emblem?: string;
  /** Версии своих аватара и обложки (0 — нет) */
  avatarV?: number;
  bannerV?: number;
}
export interface ClanMemberRow {
  userId: number;
  nickname: string;
  role: ClanRole;
  joinedAt: number;
  contributedAc: number;
  contributedXp: number;
  /** Опыт, принесённый клану за текущую неделю */
  gain: number;
}
export interface LeagueRow {
  rank: number;
  clanId: number;
  name: string;
  tag: string;
  points: number;
  members: number;
  level: number;
  zone: "up" | "down" | "stay";
}
export interface SeasonResult {
  season: string;
  league: number;
  rank: number;
  points: number;
  trophies: number;
  move: number;
}
export interface ClanEventRow {
  id: number;
  kind: string;
  amount: number;
  nickname?: string;
  createdAt: number;
  data?: Record<string, unknown>;
}
export interface MyClan {
  clan: ClanInfo | null;
  uid?: number;
  data?: { equipped?: Record<string, string> };
  members?: ClanMemberRow[];
  season?: { key: string; endsAt: number };
  table?: LeagueRow[];
  goals?: { targets: number[]; claimed: number[]; reached: number[]; eligible: boolean };
  points?: number;
  results?: SeasonResult[];
  owned?: string[];
  catalog?: ClanItem[];
  donorRub?: number;
  events?: ClanEventRow[];
  /** Эмблемы кланов, купленные мной в магазине профиля */
  myEmblems?: string[];
}
export interface ClanListRow {
  id: number;
  name: string;
  tag: string;
  description: string;
  members: number;
  cap: number;
  level: number;
  league: number;
  trophies: number;
  emblem?: string;
  avatarV?: number;
  activeToday?: number;
  createdAt?: number;
}

export type CallResult<T = unknown> = { ok: true; result: T; state?: unknown } | { ok: false; error: string };

/* ------------------------------ Мини-хранилище ---------------------------- */

class Res<T> {
  value: T | null = null;
  ready = false;
  private subs = new Set<() => void>();
  private inflight: Promise<void> | null = null;
  constructor(private url: string, private pick: (raw: Record<string, unknown>) => T | null) {}
  subscribe = (cb: () => void): (() => void) => {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  };
  snapshot = (): T | null => this.value;
  private emit(): void {
    this.subs.forEach((f) => f());
  }
  set(v: T | null): void {
    this.value = v;
    this.ready = true;
    this.emit();
  }
  load(): Promise<void> {
    if (this.inflight) return this.inflight;
    this.inflight = fetch(this.url, { cache: "no-store" })
      .then(async (r) => {
        const raw = (await r.json().catch(() => ({}))) as Record<string, unknown>;
        this.set(r.ok ? this.pick(raw) : null);
      })
      .catch(() => this.set(null))
      .finally(() => {
        this.inflight = null;
      });
    return this.inflight;
  }
}

const meRes = new Res<MyClan>("/api/clans/me", (raw) => raw as unknown as MyClan);
const warRes = new Res<CwState>("/api/clans/war", (raw) => (raw && "canManage" in raw ? (raw as unknown as CwState) : null));
const donateRes = new Res<DonateState>("/api/clans/donate", (raw) => (raw && "requests" in raw ? (raw as unknown as DonateState) : null));

function useRes<T>(res: Res<T>, poll = 0): { data: T | null; ready: boolean; reload: () => Promise<void> } {
  const data = useSyncExternalStore(res.subscribe, res.snapshot, () => null);
  useEffect(() => {
    void res.load();
    if (!poll) return;
    const t = setInterval(() => void res.load(), poll);
    return () => clearInterval(t);
  }, [res, poll]);
  return { data, ready: res.ready, reload: () => res.load() };
}

/** Мой клан (null — клана нет или гость). Обновляется раз в минуту. */
export function useMyClan(): { me: MyClan | null; ready: boolean; reload: () => Promise<void> } {
  const r = useRes(meRes, 60_000);
  return { me: r.data, ready: r.ready, reload: r.reload };
}
/** Карточная война клана. Опрос раз в 20 секунд, пока вкладка открыта. */
export function useClanWar(): { war: CwState | null; ready: boolean; reload: () => Promise<void> } {
  const r = useRes(warRes, 20_000);
  return { war: r.data, ready: r.ready, reload: r.reload };
}
/** Запросы карт (донат) */
export function useClanDonate(): { donate: DonateState | null; ready: boolean; reload: () => Promise<void> } {
  const r = useRes(donateRes, 15_000);
  return { donate: r.data, ready: r.ready, reload: r.reload };
}

/* -------------------------------- Действия -------------------------------- */

async function post<T>(url: string, body: unknown): Promise<CallResult<T>> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: typeof data.error === "string" ? data.error : "Не получилось, попробуйте ещё раз" };
    return { ok: true, result: (data.result ?? null) as T, state: data.state };
  } catch {
    return { ok: false, error: "Нет связи с сервером" };
  }
}

/** Действия клана: join · leave · kick · role · donate · claim_goal · buy · equip · slots · update */
export async function clanAct<T = unknown>(action: string, body: Record<string, unknown> = {}): Promise<CallResult<T>> {
  const r = await post<T>("/api/clans/action", { action, ...body });
  if (r.ok) await meRes.load();
  return r;
}
/** Создать клан */
export async function clanCreate(input: { name: string; tag: string; description?: string }): Promise<CallResult> {
  const r = await post("/api/clans", input);
  await meRes.load();
  return r;
}
/** Поиск кланов */
export async function clanSearch(q: string): Promise<ClanListRow[]> {
  try {
    const res = await fetch(`/api/clans?q=${encodeURIComponent(q)}`, { cache: "no-store" });
    const data = (await res.json()) as { clans?: ClanListRow[] };
    return data.clans ?? [];
  } catch {
    return [];
  }
}
/** Война: search {size} · vs_bot {size} · cancel · attack {pos}. Для attack result — отчёт боя (см. BattleReport). */
export async function warAct<T = unknown>(action: "search" | "vs_bot" | "cancel" | "attack", body: Record<string, unknown> = {}): Promise<CallResult<T>> {
  const r = await post<T>("/api/clans/war", { action, ...body });
  await Promise.all([warRes.load(), meRes.load()]);
  return r;
}
/** Донат: request {cardId, want} · give {id} · cancel */
export async function donateAct<T = unknown>(action: "request" | "give" | "cancel", body: Record<string, unknown> = {}): Promise<CallResult<T>> {
  const r = await post<T>("/api/clans/donate", { action, ...body });
  await donateRes.load();
  return r;
}
/** Сбросить кэш (например, после входа/выхода из аккаунта) */
export function resetClans(): void {
  meRes.set(null);
  warRes.set(null);
  donateRes.set(null);
}

/** Ссылка на свою картинку клана */
export const clanMediaUrl = (clanId: number, kind: "avatar" | "banner", v: number): string => `/api/clans/media?id=${clanId}&kind=${kind}&v=${v}`;

/** Ужать выбранный файл до WebP: аватар — квадрат 512, обложка — 1600×640 (обрезка по центру) */
export async function prepareClanImage(file: File, kind: "avatar" | "banner"): Promise<string> {
  if (file.type === "image/gif") {
    if (file.size > (kind === "avatar" ? 2_000_000 : 4_000_000)) throw new Error(kind === "avatar" ? "GIF до 2 МБ" : "GIF до 4 МБ");
    return await new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => bad(new Error("read")); r.readAsDataURL(file); });
  }
  const bmp = await createImageBitmap(file);
  const [W, H] = kind === "avatar" ? [512, 512] : [1600, 640];
  const scale = Math.max(W / bmp.width, H / bmp.height);
  const sw = W / scale, sh = H / scale;
  const sx = (bmp.width - sw) / 2, sy = (bmp.height - sh) / 2;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  g.drawImage(bmp, sx, sy, sw, sh, 0, 0, W, H);
  bmp.close();
  for (const q of [0.88, 0.8, 0.7, 0.6]) {
    const url = cv.toDataURL("image/webp", q);
    if (url.length * 0.75 < (kind === "avatar" ? 380_000 : 1_150_000)) return url;
  }
  return cv.toDataURL("image/jpeg", 0.7);
}
