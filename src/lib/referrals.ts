/**
 * Реферальные ссылки и учёт приглашений.
 *
 * Всё считает сервер (`/api/referrals`): код игрока постоянный, приглашение
 * фиксируется при регистрации по ссылке `/?ref=КОД`, друг засчитывается на
 * 10 уровне после 30 минут просмотра, а награды выдаются на сервере и
 * приходят игроку вместе с обычной синхронизацией.
 *
 * Здесь — клиентская часть: запомнить код с ссылки до регистрации, получить
 * состояние с сервера и отдать его компонентам. Без сервера (локальный режим)
 * рефералка не работает: приглашение с другого устройства иначе не увидеть.
 */

import { useSyncExternalStore } from "react";
import { REFERRAL_DAYS_PER_FRIEND } from "./referral-rules";
import { createLocalStore } from "./store";
import { readAccount } from "./auth";

/** Код с ссылки приглашения, который ждёт регистрации */
export const REFERRAL_LANDING_KEY = "animehub:ref-landing:v1";
/** Последнее состояние рефералки, полученное с сервера */
export const REFERRAL_STATE_KEY = "animehub:ref-state:v1";

/** Сколько дней Premium даёт один засчитанный друг */
export const REFERRAL_PREMIUM_DAYS = REFERRAL_DAYS_PER_FRIEND;

export interface ReferralEntry {
  /** Ник приглашённого */
  nick: string;
  /** Когда зарегистрировался, мс */
  at: number;
  /** Дорос ли до условий (10 уровень и 30 минут) */
  qualified: boolean;
  level: number;
  minutes: number;
}

export interface ReferralTopRow {
  rank: number;
  nickname: string;
  count: number;
  avatar: string;
  frameId: string;
}

export interface ReferralState {
  code: string;
  qualified: number;
  total: number;
  friends: ReferralEntry[];
  /** Номера рубежей, которые уже выданы */
  claimed: number[];
  top: ReferralTopRow[];
  me: { month: number; rank: number };
  rules: { minLevel: number; minMinutes: number };
}

interface Landing {
  code: string;
  at: number;
}

const landingStore = createLocalStore<Landing | null>(REFERRAL_LANDING_KEY, null);
const stateStore = createLocalStore<ReferralState | null>(REFERRAL_STATE_KEY, null);

/**
 * Кириллица → латиница для локального кода (пока сервер не ответил).
 * Сервер строит код тем же способом и закрепляет его навсегда.
 */
const CYRILLIC: Record<string, string> = {
  а: "A", б: "B", в: "V", г: "G", д: "D", е: "E", ё: "E", ж: "ZH", з: "Z",
  и: "I", й: "I", к: "K", л: "L", м: "M", н: "N", о: "O", п: "P", р: "R",
  с: "S", т: "T", у: "U", ф: "F", х: "H", ц: "TS", ч: "CH", ш: "SH", щ: "SCH",
  ъ: "", ы: "Y", ь: "", э: "E", ю: "YU", я: "YA",
};

function transliterate(value: string): string {
  return value
    .toLowerCase()
    .split("")
    .map((ch) => CYRILLIC[ch] ?? ch)
    .join("");
}

/** Код игрока: с сервера, а до ответа — тот же, что сервер построит сам */
export function refCodeFor(account: { nickname?: string; createdAt?: number } | null): string {
  const fromServer = stateStore.get()?.code;
  if (fromServer) return fromServer;
  const base = transliterate(account?.nickname ?? "guest")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  const tail = (account?.createdAt ?? 0).toString(36).toUpperCase().slice(-4);
  return `${base}${tail}` || "ANIGALAXY";
}

/** Относительная ссылка (на сервере window нет — иначе разойдётся гидрация) */
export function refLink(code: string): string {
  return `/?ref=${encodeURIComponent(code)}`;
}

/** Полный адрес для буфера обмена — только по клику, в браузере */
export function absoluteRefLink(code: string): string {
  if (typeof window === "undefined") return refLink(code);
  return `${window.location.origin}${refLink(code)}`;
}

/* ------------------------------ Хуки ------------------------------------- */

export function useReferralState(): ReferralState | null {
  return useSyncExternalStore(stateStore.subscribe, stateStore.get, stateStore.getServer);
}

/** Все приглашённые, свежие первыми (и засчитанные, и ещё растущие) */
export function useMyReferrals(): ReferralEntry[] {
  return useReferralState()?.friends ?? EMPTY;
}
const EMPTY: ReferralEntry[] = [];

/** Код, по которому пришёл этот посетитель (если ещё не зарегистрировался) */
export function useReferrer(): Landing | null {
  return useSyncExternalStore(landingStore.subscribe, landingStore.get, landingStore.getServer);
}

/* ------------------------------ Действия --------------------------------- */

/** Запомнить `?ref=` из адреса: человек может походить по сайту до регистрации */
export function captureReferralLanding(): void {
  if (typeof window === "undefined") return;
  const code = (new URLSearchParams(window.location.search).get("ref") ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 24);
  if (!code) return;
  const me = readAccount();
  if (me && refCodeFor(me) === code) return;
  const current = landingStore.get();
  if (current?.code !== code) landingStore.set({ code, at: Date.now() });
}

/** Код для отправки при регистрации (или пусто) */
export function pendingLandingCode(): string {
  return landingStore.get()?.code ?? "";
}

/** После регистрации код израсходован */
export function clearReferralLanding(): void {
  if (landingStore.get()) landingStore.remove();
}

/** Локальная регистрация без сервера рефералку не засчитывает */
export function captureReferralOnRegister(): void {
  clearReferralLanding();
}

/** Запросить у сервера актуальное состояние (заодно сервер засчитает созревших друзей) */
export async function refreshReferrals(): Promise<ReferralState | null> {
  try {
    const response = await fetch("/api/referrals", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as ReferralState;
    stateStore.set(data);
    return data;
  } catch {
    return null;
  }
}

/** Сколько друзей засчитано (для открытия предметов за рубежи) */
export function referralCount(): number {
  return stateStore.get()?.qualified ?? 0;
}

/** Сколько приглашённых ещё не дошли до условий */
export function pendingReferralCount(): number {
  const state = stateStore.get();
  return state ? state.total - state.qualified : 0;
}

/** Засчитанные друзья этого месяца (по месяцу регистрации — оценка для подписей) */
export function referralsThisMonth(now = Date.now()): ReferralEntry[] {
  const d = new Date(now);
  return (stateStore.get()?.friends ?? []).filter((item) => {
    if (!item.qualified) return false;
    const t = new Date(item.at);
    return t.getMonth() === d.getMonth() && t.getFullYear() === d.getFullYear();
  });
}
