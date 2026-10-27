/**
 * Приветственный квест на три дня. Первая награда доступна сразу, вторая —
 * на следующий календарный день после регистрации, третья — через день.
 * Пропустить можно: награды остаются доступными две недели с регистрации.
 */

import { WELCOME_DAYS, WELCOME_WINDOW_DAYS } from "../welcome-rules";
import { setPremiumDays } from "./admin";
import { adjustBalance, editProfile, pushNotice, setItem } from "./admin-edit";
import { dayStart } from "./day";
import { num, type Database } from "./sqlite";
import type { UserRow } from "./users";

const SYSTEM = { nickname: "AniGalaxy" } as unknown as UserRow;
const DAY = 86_400_000;

export type WelcomeStatus = "claimed" | "ready" | "locked";

export interface WelcomeState {
  /** false — окно квеста закрыто или всё забрано */
  active: boolean;
  days: { day: number; status: WelcomeStatus }[];
  /** Через сколько мс откроется следующий день (0 — уже открыт) */
  nextInMs: number;
}

function calendarDaysSince(createdAt: number, now: number): number {
  return Math.round((dayStart(now) - dayStart(createdAt)) / DAY);
}

export function welcomeState(db: Database, user: UserRow, now = Date.now()): WelcomeState {
  const claimed = new Set(db.prepare("SELECT day FROM welcome_claims WHERE user_id = ?").all(user.id).map((r) => num(r.day)));
  const passed = calendarDaysSince(user.createdAt, now);
  const days = WELCOME_DAYS.map((d) => ({
    day: d.day,
    status: (claimed.has(d.day) ? "claimed" : passed >= d.day - 1 ? "ready" : "locked") as WelcomeStatus,
  }));
  const all = days.every((d) => d.status === "claimed");
  const expired = passed > WELCOME_WINDOW_DAYS;
  const nextLocked = days.find((d) => d.status === "locked");
  const nextInMs = nextLocked ? dayStart(user.createdAt, -(nextLocked.day - 1)) - now : 0;
  return { active: !all && !expired, days, nextInMs: Math.max(0, nextInMs) };
}

export function claimWelcome(db: Database, user: UserRow, dayNum: number, now = Date.now()): { ok: true } | { ok: false; error: string } {
  const rule = WELCOME_DAYS.find((d) => d.day === dayNum);
  if (!rule) return { ok: false, error: "Такого дня нет" };
  const status = welcomeState(db, user, now).days.find((d) => d.day === dayNum)?.status;
  if (status === "claimed") return { ok: false, error: "Награда уже получена" };
  if (status !== "ready") return { ok: false, error: "Этот день ещё не открыт" };
  if (calendarDaysSince(user.createdAt, now) > WELCOME_WINDOW_DAYS) return { ok: false, error: "Квест закончился" };

  const res = db.prepare("INSERT OR IGNORE INTO welcome_claims (user_id, day, claimed_at) VALUES (?, ?, ?)").run(user.id, dayNum, now);
  if (!num((res as { changes?: number }).changes)) return { ok: false, error: "Награда уже получена" };

  adjustBalance(db, SYSTEM, user.id, { ac: rule.ac, xp: rule.xp, note: `Приветственный квест, день ${rule.day}` }, now);
  if (rule.premiumDays) setPremiumDays(db, user.id, rule.premiumDays, now);
  if (rule.frame) setItem(db, SYSTEM, user.id, "frame", rule.frame.id, true, { label: rule.frame.name }, now);
  editProfile(db, user.id, (profile) => pushNotice(profile, `Квест, день ${rule.day}: награда получена`, now), now);
  return { ok: true };
}
