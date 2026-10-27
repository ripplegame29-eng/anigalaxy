/**
 * Premium на сервере: пробный период (один раз) и подарок месяца.
 * Оба действия проверяет и выдаёт сервер — браузеру достаточно показать кнопку.
 */

import { PREMIUM_DROP, PREMIUM_TRIAL_DAYS } from "../premium-perks";
import { setPremiumDays } from "./admin";
import { adjustBalance, editProfile, pushNotice } from "./admin-edit";
import { findUserById, type UserRow } from "./users";
import { num, type Database } from "./sqlite";

const SYSTEM = { nickname: "AniGalaxy" } as unknown as UserRow;

const monthOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export function premiumState(db: Database, user: UserRow, now = Date.now()) {
  const fresh = findUserById(db, user.id) ?? user;
  const active = fresh.premiumUntil > now;
  const trialUsed = Boolean(db.prepare("SELECT 1 FROM premium_trials WHERE user_id = ?").get(user.id));
  const dropClaimed = Boolean(db.prepare("SELECT 1 FROM premium_drops WHERE user_id = ? AND month = ?").get(user.id, monthOf(now)));
  return {
    active,
    premiumUntil: fresh.premiumUntil,
    premiumSince: fresh.premiumSince,
    premiumTotalDays: fresh.premiumTotalDays,
    trial: { available: !trialUsed && !active, used: trialUsed, days: PREMIUM_TRIAL_DAYS },
    drop: { available: active && !dropClaimed, claimed: dropClaimed, ...PREMIUM_DROP },
  };
}

export function startTrial(db: Database, user: UserRow, now = Date.now()): { ok: true } | { ok: false; error: string } {
  const state = premiumState(db, user, now);
  if (state.trial.used) return { ok: false, error: "Пробный период уже был использован" };
  if (state.active) return { ok: false, error: "Подписка уже активна" };
  const res = db.prepare("INSERT OR IGNORE INTO premium_trials (user_id, used_at) VALUES (?, ?)").run(user.id, now);
  if (!num((res as { changes?: number }).changes)) return { ok: false, error: "Пробный период уже был использован" };
  setPremiumDays(db, user.id, PREMIUM_TRIAL_DAYS, now);
  editProfile(db, user.id, (profile) => pushNotice(profile, `Пробный Premium на ${PREMIUM_TRIAL_DAYS} дня включён`, now), now);
  return { ok: true };
}

export function claimDrop(db: Database, user: UserRow, now = Date.now()): { ok: true } | { ok: false; error: string } {
  const state = premiumState(db, user, now);
  if (!state.active) return { ok: false, error: "Подарок доступен подписчикам" };
  if (state.drop.claimed) return { ok: false, error: "Подарок этого месяца уже получен" };
  const res = db.prepare("INSERT OR IGNORE INTO premium_drops (user_id, month, claimed_at) VALUES (?, ?, ?)").run(user.id, monthOf(now), now);
  if (!num((res as { changes?: number }).changes)) return { ok: false, error: "Подарок этого месяца уже получен" };
  adjustBalance(db, SYSTEM, user.id, { ac: PREMIUM_DROP.ac, freezes: PREMIUM_DROP.freezes, note: "Подарок месяца Premium" }, now);
  editProfile(db, user.id, (profile) => pushNotice(profile, `Подарок месяца: +${PREMIUM_DROP.ac} монет и заморозка серии`, now), now);
  return { ok: true };
}
