"use client";

/**
 * Клиент серверных функций Premium: пробный период и подарок месяца.
 * Срок подписки приходит с сервера и сразу записывается в локальный аккаунт,
 * чтобы интерфейс не ждал следующей синхронизации.
 */

import { readAccount, saveAccount } from "./auth";

export interface PremiumServerState {
  active: boolean;
  premiumUntil: number;
  premiumSince: number;
  premiumTotalDays: number;
  trial: { available: boolean; used: boolean; days: number };
  drop: { available: boolean; claimed: boolean; ac: number; freezes: number };
}

function apply(state: PremiumServerState): void {
  const account = readAccount();
  if (!account) return;
  saveAccount({
    ...account,
    premiumUntil: Math.max(account.premiumUntil ?? 0, state.premiumUntil),
    premiumSince: state.premiumSince || account.premiumSince || 0,
    premiumTotalDays: Math.max(account.premiumTotalDays ?? 0, state.premiumTotalDays),
  });
}

export async function fetchPremiumState(): Promise<PremiumServerState | null> {
  try {
    const response = await fetch("/api/premium", { credentials: "same-origin", cache: "no-store" });
    return response.ok ? ((await response.json()) as PremiumServerState) : null;
  } catch {
    return null;
  }
}

export async function premiumAction(
  action: "trial" | "drop",
): Promise<{ ok: true; state: PremiumServerState } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/premium", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = (await response.json()) as { ok?: boolean; state?: PremiumServerState; error?: string };
    if (data.ok && data.state) {
      apply(data.state);
      return { ok: true, state: data.state };
    }
    return { ok: false, error: data.error ?? "Не получилось, попробуйте позже" };
  } catch {
    return { ok: false, error: "Нет связи с сервером" };
  }
}
