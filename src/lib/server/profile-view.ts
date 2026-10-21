/**
 * Данные для просмотра чужого профиля.
 *
 * Страница `/u/<ник>` рисует тот же `ProfileView`, что и владелец, поэтому
 * ей нужны сами документы игрока (оформление, виджеты, прогресс). Наружу
 * отдаётся только белый список ключей, и из документов вырезается всё
 * личное: баланс, подарки, чёрный список, уведомления, история аватаров.
 * Кому открыт профиль, решает настройка приватности самого игрока.
 */

import { PROGRESS_DOC_KEY } from "../sync-keys";
import { num, str, type Database } from "./sqlite";

const PROFILE_KEY = "animehub:profile:v1";
const HISTORY_KEY = "animehub:history:v1";
export const ACCOUNT_KEY = "animehub:account:v1";

/** Какие документы вообще можно показывать другим */
const PUBLIC_KEYS = new Set<string>([
  PROFILE_KEY,
  PROGRESS_DOC_KEY,
  HISTORY_KEY,
  "animehub:widgets:v1",
  "animehub:widgets:opts:v1",
  "animehub:showcases:v1",
  "animehub:tierlist:v1",
  "animehub:ptheme:v1",
  "animehub:ptext:v1",
  "animehub:titles:v1",
  "animehub:statuses:v1",
  "animehub:collections:v1",
  "animehub:favorites:v1",
  "animehub:links:v1",
  "animehub:artwork:v1",
  "animehub:ratings:v1",
]);

export type ProfileViewResult =
  | { ok: true; nickname: string; data: Record<string, string> }
  | { ok: false; reason: "missing" | "closed"; nickname: string };

function parseObject(raw: string | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function scopeOf(profile: Record<string, unknown> | null): "public" | "friends" | "private" {
  const privacy = (profile?.privacy ?? {}) as Record<string, unknown>;
  if (privacy.scope === "friends" || privacy.scope === "private") return privacy.scope;
  return privacy.profilePublic === false ? "private" : "public";
}

function areFriends(db: Database, a: number, b: number): boolean {
  const row = db
    .prepare(
      `SELECT 1 AS ok FROM friendships
       WHERE status = 'accepted' AND ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))`,
    )
    .get(a, b, b, a);
  return Boolean(row);
}

/** Из документа профиля убирается всё личное */
function cleanProfile(profile: Record<string, unknown>): Record<string, unknown> {
  const privacy = (profile.privacy ?? {}) as Record<string, unknown>;
  return {
    ...profile,
    gifts: [],
    blacklist: [],
    notices: [],
    avatarHistory: [],
    coins: 0,
    comments: privacy.showComments === false ? [] : profile.comments,
  };
}

/** Из документа прогресса — баланс и служебные сессии */
function cleanProgress(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...doc };
  const progress = out.progress;
  if (progress && typeof progress === "object") out.progress = { ...(progress as object), acBalance: 0 };
  delete out.sessions;
  delete out.deals;
  return out;
}

export function buildProfileView(
  db: Database,
  nickname: string,
  viewerId: number | null,
  now = Date.now(),
): ProfileViewResult {
  const name = nickname.trim();
  if (!name || name.length > 40) return { ok: false, reason: "missing", nickname: name };
  const user = db.prepare("SELECT * FROM users WHERE nickname = ?").get(name);
  if (!user) return { ok: false, reason: "missing", nickname: name };

  const userId = num(user.id);
  const docs = new Map<string, string>();
  for (const row of db.prepare("SELECT doc_key, value FROM user_docs WHERE user_id = ?").all(userId)) {
    const key = str(row.doc_key);
    if (PUBLIC_KEYS.has(key)) docs.set(key, str(row.value));
  }

  const profile = parseObject(docs.get(PROFILE_KEY));
  const scope = scopeOf(profile);
  const isOwner = viewerId === userId;
  if (!isOwner && scope === "private") return { ok: false, reason: "closed", nickname: str(user.nickname) };
  if (!isOwner && scope === "friends" && (viewerId === null || !areFriends(db, userId, viewerId))) {
    return { ok: false, reason: "closed", nickname: str(user.nickname) };
  }

  const data: Record<string, string> = {};
  for (const [key, value] of docs) data[key] = value;
  if (profile) data[PROFILE_KEY] = JSON.stringify(cleanProfile(profile));
  const progress = parseObject(docs.get(PROGRESS_DOC_KEY));
  if (progress) data[PROGRESS_DOC_KEY] = JSON.stringify(cleanProgress(progress));
  const privacy = (profile?.privacy ?? {}) as Record<string, unknown>;
  if (privacy.showStats === false && privacy.showHistory === false) delete data[HISTORY_KEY];

  data[ACCOUNT_KEY] = JSON.stringify({
    nickname: str(user.nickname),
    displayName: str(user.display_name),
    email: "hidden@invalid.example",
    passHash: "-",
    createdAt: num(user.created_at),
    premiumUntil: num(user.premium_until) > now ? num(user.premium_until) : 0,
    premiumSince: num(user.premium_since),
    premiumTotalDays: num(user.premium_total_days),
  });
  return { ok: true, nickname: str(user.nickname), data };
}
