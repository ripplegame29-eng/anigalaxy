/**
 * Реферальная программа на сервере.
 *
 * Приглашение фиксируется при регистрации по ссылке `/?ref=КОД`. Друг
 * «засчитывается», когда дорос до 10 уровня и посмотрел 30 минут — это
 * защита от ботов. В этот момент пригласившему идут дни Premium, а
 * достигнутые рубежи (XP, Premium, предмет) выдаются один раз и навсегда.
 */

import { PROGRESS_DOC_KEY } from "../sync-keys";
import {
  REFERRAL_DAYS_PER_FRIEND,
  REFERRAL_MIN_LEVEL,
  REFERRAL_MIN_MINUTES,
  REFERRAL_RULES,
  REFERRAL_WELCOME,
} from "../referral-rules";
import { setPremiumDays } from "./admin";
import { adjustBalance, editProfile, pushNotice, setItem } from "./admin-edit";
import { getDoc } from "./docs";
import { queueGrant } from "./grants";
import { looksOf, NO_LOOK } from "./looks";
import { num, str, type Database } from "./sqlite";
import type { UserRow } from "./users";

const SYSTEM = { nickname: "Реферальная программа" } as unknown as UserRow;

const CYRILLIC: Record<string, string> = {
  а: "A", б: "B", в: "V", г: "G", д: "D", е: "E", ё: "E", ж: "ZH", з: "Z", и: "I", й: "I", к: "K", л: "L", м: "M",
  н: "N", о: "O", п: "P", р: "R", с: "S", т: "T", у: "U", ф: "F", х: "H", ц: "TS", ч: "CH", ш: "SH", щ: "SCH",
  ъ: "", ы: "Y", ь: "", э: "E", ю: "YU", я: "YA",
};

function slug(nickname: string): string {
  return nickname
    .toLowerCase()
    .split("")
    .map((ch) => CYRILLIC[ch] ?? ch)
    .join("")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

/** Код игрока: создаётся один раз и больше не меняется (в том числе при смене ника) */
export function ensureRefCode(db: Database, userId: number): string {
  const row = db.prepare("SELECT nickname, created_at, ref_code FROM users WHERE id = ?").get(userId);
  if (!row) return "";
  const existing = str(row.ref_code);
  if (existing) return existing;
  const base = slug(str(row.nickname)) || "ANI";
  const tail = num(row.created_at).toString(36).toUpperCase().slice(-4);
  let code = `${base}${tail}`;
  for (let i = 0; i < 20 && db.prepare("SELECT 1 FROM users WHERE ref_code = ?").get(code); i += 1) {
    code = `${base}${tail}${Math.floor(Math.random() * 36 ** 2).toString(36).toUpperCase()}`;
  }
  db.prepare("UPDATE users SET ref_code = ? WHERE id = ?").run(code, userId);
  return code;
}

const normalize = (code: unknown) => String(code ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24);

/**
 * Привязать нового игрока к пригласившему и выдать другу стартовый подарок.
 * Вызывается один раз при регистрации; повторно и на себя — не сработает.
 */
export function attachReferral(db: Database, invitedId: number, rawCode: unknown, now = Date.now()): boolean {
  const code = normalize(rawCode);
  if (!code) return false;
  let inviter = db.prepare("SELECT id FROM users WHERE ref_code = ?").get(code);
  if (!inviter) {
    // Код мог быть показан до первого запроса к серверу: ищем среди «ещё без кода»
    const candidates = db.prepare("SELECT id FROM users WHERE ref_code IS NULL AND id != ?").all(invitedId);
    for (const c of candidates) {
      if (ensureRefCode(db, num(c.id)) === code) {
        inviter = c;
        break;
      }
    }
  }
  if (!inviter) return false;
  const inviterId = num(inviter.id);
  if (inviterId === invitedId) return false;
  if (db.prepare("SELECT 1 FROM referrals WHERE invited_id = ?").get(invitedId)) return false;

  db.prepare("INSERT INTO referrals (invited_id, inviter_id, created_at) VALUES (?, ?, ?)").run(invitedId, inviterId, now);

  setPremiumDays(db, invitedId, REFERRAL_WELCOME.days, now);
  queueGrant(
    db,
    invitedId,
    {
      xp: REFERRAL_WELCOME.xp,
      note: "Приглашение друга",
      notice: `Подарок за приглашение: +${REFERRAL_WELCOME.days} дн. Premium и +${REFERRAL_WELCOME.xp} XP`,
    },
    now,
  );
  return true;
}

interface Progress {
  level: number;
  minutes: number;
}

function progressOf(db: Database, userId: number): Progress {
  const stats = db.prepare("SELECT level FROM player_stats WHERE user_id = ?").get(userId);
  let minutes = 0;
  const doc = getDoc(db, userId, PROGRESS_DOC_KEY);
  if (doc) {
    try {
      const parsed = JSON.parse(doc.value) as { counters?: Record<string, unknown> };
      minutes = Math.floor(num(parsed.counters?.SECONDS_WATCHED) / 60);
    } catch {
      /* битый документ — считаем нулём */
    }
  }
  return { level: num(stats?.level, 1), minutes };
}

const qualifies = (p: Progress) => p.level >= REFERRAL_MIN_LEVEL && p.minutes >= REFERRAL_MIN_MINUTES;

/** Выдать подарок рубежа (предмет). Опыт и Premium выдаются отдельно */
function grantItem(db: Database, userId: number, rule: (typeof REFERRAL_RULES)[number], now: number): void {
  setItem(db, SYSTEM, userId, rule.grant.kind, rule.grant.id, true, { label: rule.item }, now);
}

/**
 * Проверить приглашённых этого игрока и выдать всё, что положено.
 * Безопасно вызывать сколько угодно раз: засчитывание и рубежи одноразовые.
 */
export function settleReferrals(db: Database, inviterId: number, now = Date.now()): void {
  const pending = db.prepare("SELECT invited_id FROM referrals WHERE inviter_id = ? AND qualified_at = 0").all(inviterId);
  for (const row of pending) {
    const invitedId = num(row.invited_id);
    if (!qualifies(progressOf(db, invitedId))) continue;
    const res = db.prepare("UPDATE referrals SET qualified_at = ? WHERE invited_id = ? AND qualified_at = 0").run(now, invitedId);
    if (!num((res as { changes?: number }).changes)) continue;
    const nick = str(db.prepare("SELECT nickname FROM users WHERE id = ?").get(invitedId)?.nickname, "друг");
    setPremiumDays(db, inviterId, REFERRAL_DAYS_PER_FRIEND, now);
    editProfile(db, inviterId, (profile) => pushNotice(profile, `Друг ${nick} засчитан: +${REFERRAL_DAYS_PER_FRIEND} дн. Premium`, now), now);
  }

  const count = num(db.prepare("SELECT COUNT(*) AS c FROM referrals WHERE inviter_id = ? AND qualified_at > 0").get(inviterId)?.c);
  for (const rule of REFERRAL_RULES) {
    if (count < rule.n) break;
    const claimed = db.prepare("INSERT OR IGNORE INTO referral_claims (inviter_id, milestone, claimed_at) VALUES (?, ?, ?)").run(inviterId, rule.n, now);
    if (!num((claimed as { changes?: number }).changes)) continue;
    adjustBalance(db, SYSTEM, inviterId, { xp: rule.xp, note: `Рубеж «${rule.title}»` }, now);
    if (rule.days > 0) setPremiumDays(db, inviterId, rule.days, now);
    grantItem(db, inviterId, rule, now);
    editProfile(
      db,
      inviterId,
      (profile) =>
        pushNotice(profile, `Рубеж «${rule.title}»: +${rule.xp} XP, ${rule.item}${rule.days ? `, +${rule.days} дн. Premium` : ""}`, now),
      now,
    );
  }
}

/** После сохранения прогресса игрока: возможно, он только что дорос до условий */
export function onProgressSaved(db: Database, userId: number, now = Date.now()): void {
  try {
    const row = db.prepare("SELECT inviter_id FROM referrals WHERE invited_id = ? AND qualified_at = 0").get(userId);
    if (row) settleReferrals(db, num(row.inviter_id), now);
  } catch {
    /* рефералка не должна ломать синхронизацию */
  }
}

export interface ReferralTopRow {
  rank: number;
  nickname: string;
  count: number;
  avatar: string;
  frameId: string;
}

const monthStart = (now: number) => {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
};

export function referralState(db: Database, user: UserRow, now = Date.now()) {
  const code = ensureRefCode(db, user.id);
  settleReferrals(db, user.id, now);

  const friends = db
    .prepare(
      `SELECT r.invited_id, r.created_at, r.qualified_at, u.nickname
       FROM referrals r JOIN users u ON u.id = r.invited_id
       WHERE r.inviter_id = ? ORDER BY r.created_at DESC LIMIT 200`,
    )
    .all(user.id)
    .map((row) => {
      const p = progressOf(db, num(row.invited_id));
      return {
        nick: str(row.nickname),
        at: num(row.created_at),
        qualified: num(row.qualified_at) > 0,
        level: p.level,
        minutes: p.minutes,
      };
    });
  const qualified = friends.filter((f) => f.qualified).length;
  const claimed = db.prepare("SELECT milestone FROM referral_claims WHERE inviter_id = ?").all(user.id).map((r) => num(r.milestone));

  const since = monthStart(now);
  const rows = db
    .prepare(
      `SELECT r.inviter_id AS id, u.nickname AS nickname, COUNT(*) AS c
       FROM referrals r JOIN users u ON u.id = r.inviter_id
       WHERE r.qualified_at >= ? GROUP BY r.inviter_id ORDER BY c DESC, MIN(r.qualified_at) ASC LIMIT 10`,
    )
    .all(since);
  const looks = looksOf(db, rows.map((r) => num(r.id)));
  const top: ReferralTopRow[] = rows.map((r, i) => {
    const look = looks.get(num(r.id)) ?? NO_LOOK;
    return { rank: i + 1, nickname: str(r.nickname), count: num(r.c), avatar: look.avatar, frameId: look.frameId };
  });
  const mine = num(
    db.prepare("SELECT COUNT(*) AS c FROM referrals WHERE inviter_id = ? AND qualified_at >= ?").get(user.id, since)?.c,
  );
  const better = mine
    ? num(
        db
          .prepare(
            `SELECT COUNT(*) AS c FROM (SELECT inviter_id FROM referrals WHERE qualified_at >= ? GROUP BY inviter_id HAVING COUNT(*) > ?)`,
          )
          .get(since, mine)?.c,
      )
    : 0;

  return {
    code,
    qualified,
    total: friends.length,
    friends,
    claimed,
    top,
    me: { month: mine, rank: mine ? better + 1 : 0 },
    rules: { minLevel: REFERRAL_MIN_LEVEL, minMinutes: REFERRAL_MIN_MINUTES },
  };
}
