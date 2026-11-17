/**
 * Бонус «Разбуди лисёнка»: +7 дней Premium за привязанный Telegram и подписку
 * на канал. Обе проверки делает сервер — привязку берёт из базы, подписку
 * спрашивает у Telegram (`getChatMember`), поэтому браузер ничего не решает.
 * Выдаётся один раз на аккаунт и один раз на Telegram-аккаунт.
 */

import { setPremiumDays } from "./admin";
import { editProfile, pushNotice } from "./admin-edit";
import { tg } from "./telegram-login";
import { str, type Database } from "./sqlite";
import type { UserRow } from "./users";

export const BONUS_DAYS = 7;
const CHANNEL = process.env.TELEGRAM_CHANNEL || "@anigalaxyspace";

function ensure(db: Database) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS tg_bonus_claims (user_id INTEGER PRIMARY KEY, telegram_id TEXT NOT NULL UNIQUE, claimed_at INTEGER NOT NULL)",
  );
}

export interface BonusStatus {
  linked: boolean;
  subscribed: boolean | null;
  claimed: boolean;
}

/** Подписан ли человек на канал; null — Telegram не смог ответить */
async function isSubscribed(telegramId: string): Promise<boolean | null> {
  const r = (await tg("getChatMember", { chat_id: CHANNEL, user_id: Number(telegramId) }, 10_000)) as {
    ok: boolean;
    result?: { status?: string };
  };
  if (!r.ok) return null;
  const status = r.result?.status;
  return status === "member" || status === "administrator" || status === "creator" || status === "restricted";
}

export function bonusStatus(db: Database, user: UserRow): { linked: boolean; claimed: boolean; telegramId: string | null } {
  ensure(db);
  const row = db.prepare("SELECT telegram_id FROM users WHERE id = ?").get(user.id);
  const telegramId = row?.telegram_id ? str(row.telegram_id) : null;
  const claimed = Boolean(db.prepare("SELECT 1 FROM tg_bonus_claims WHERE user_id = ?").get(user.id));
  return { linked: Boolean(telegramId), claimed, telegramId };
}

export async function claimTelegramBonus(
  db: Database,
  user: UserRow,
  now = Date.now(),
): Promise<{ ok: true; days: number } | { ok: false; error: string; linked: boolean; subscribed: boolean | null }> {
  const s = bonusStatus(db, user);
  if (s.claimed) return { ok: false, error: "Бонус уже получен", linked: s.linked, subscribed: true };
  if (!s.telegramId) {
    return { ok: false, error: "Telegram не привязан к аккаунту. Привяжите его в настройках", linked: false, subscribed: null };
  }
  const sub = await isSubscribed(s.telegramId);
  if (sub === null) {
    return {
      ok: false,
      error: "Не удалось проверить подписку — попробуйте через минуту",
      linked: true,
      subscribed: null,
    };
  }
  if (!sub) return { ok: false, error: "Подписка на канал не найдена. Подпишитесь и нажмите «Проверить» ещё раз", linked: true, subscribed: false };

  const res = db
    .prepare("INSERT OR IGNORE INTO tg_bonus_claims (user_id, telegram_id, claimed_at) VALUES (?, ?, ?)")
    .run(user.id, s.telegramId, now) as { changes?: number | bigint };
  if (!Number(res.changes ?? 0)) return { ok: false, error: "Бонус уже получен", linked: true, subscribed: true };
  setPremiumDays(db, user.id, BONUS_DAYS, now);
  editProfile(db, user.id, (profile) => pushNotice(profile, `Бонус за Telegram: +${BONUS_DAYS} дней Premium и титул «Звёздный странник»`, now), now);
  return { ok: true, days: BONUS_DAYS };
}
