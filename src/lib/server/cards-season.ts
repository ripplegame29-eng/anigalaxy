/** Сезонный пасс, баннер недели и уведомления об игровых событиях. */

import { BANNER, PASS, bannerFeatured, passReward, seasonEnd, seasonOf, type EventsState, type PassTrack, type PassView } from "../cards/season";
import type { Reward } from "../cards/progress";
import { addMoney, fail, getWallet, grantReward, logEvent, type Res } from "./cards";
import { getExtra, rollWeek, setExtra, weekOf } from "./cards-extra";
import { num, transaction, type Database } from "./sqlite";

export function passView(db: Database, userId: number, now = Date.now()): PassView {
  const x = rollWeek(getExtra(db, userId), now);
  const level = Math.min(PASS.levels, Math.floor(x.pass.xp / PASS.xpPerLevel));
  return {
    season: x.pass.season,
    endsAt: seasonEnd(seasonOf(now)),
    xp: x.pass.xp,
    level,
    into: level >= PASS.levels ? PASS.xpPerLevel : x.pass.xp % PASS.xpPerLevel,
    bought: x.pass.bought,
    price: PASS.price,
    free: x.pass.free,
    premium: x.pass.premium,
  };
}

export function passBuy(db: Database, userId: number, now = Date.now()): Res<true> {
  return transaction(db, (): Res<true> => {
    getWallet(db, userId, now);
    const x = rollWeek(getExtra(db, userId), now);
    if (x.pass.bought) return fail("Премиум-ветка уже открыта");
    if (!addMoney(db, userId, "diamonds", -PASS.price)) return fail("Не хватает алмазов");
    x.pass.bought = true;
    setExtra(db, userId, x);
    logEvent(db, userId, "pass", "Открыта премиум-ветка сезонного пасса", "", 0, now);
    return { ok: true, value: true };
  });
}

/** Забрать награду уровня; `level` = 0 — все доступные награды выбранной ветки */
export function passClaim(db: Database, userId: number, track: PassTrack, level: number, now = Date.now()): Res<{ reward: Reward; count: number }> {
  if (track !== "free" && track !== "premium") return fail("Неизвестная ветка");
  return transaction(db, (): Res<{ reward: Reward; count: number }> => {
    getWallet(db, userId, now);
    const x = rollWeek(getExtra(db, userId), now);
    if (track === "premium" && !x.pass.bought) return fail("Сначала откройте премиум-ветку");
    const reached = Math.min(PASS.levels, Math.floor(x.pass.xp / PASS.xpPerLevel));
    const done = track === "free" ? x.pass.free : x.pass.premium;
    const levels = level === 0 ? Array.from({ length: reached }, (_, i) => i + 1) : [Math.floor(level)];
    const total: Reward = {};
    let count = 0;
    for (const l of levels) {
      if (l < 1 || l > reached) {
        if (level !== 0) return fail("Этот уровень ещё не достигнут");
        continue;
      }
      if (done.includes(l)) {
        if (level !== 0) return fail("Награда уже получена");
        continue;
      }
      const r = passReward(l, track);
      grantReward(db, userId, r);
      done.push(l);
      count += 1;
      total.diamonds = (total.diamonds ?? 0) + (r.diamonds ?? 0);
      total.dust = (total.dust ?? 0) + (r.dust ?? 0);
      total.packs = (total.packs ?? 0) + (r.packs ?? 0);
      total.scroll = (total.scroll ?? 0) + (r.scroll ?? 0);
    }
    if (!count) return fail("Нет доступных наград");
    setExtra(db, userId, x);
    return { ok: true, value: { reward: total, count } };
  });
}

export function noticesOf(db: Database, userId: number): EventsState["notices"] {
  const x = getExtra(db, userId);
  const seenDef = x.stats.seenDef ?? 0;
  const seenLog = x.stats.seenLog ?? 0;
  const cnt = (sql: string, ...a: number[]) => num(db.prepare(sql).get(...a)?.n);
  return {
    defenses: cnt("SELECT COUNT(*) AS n FROM card_battles WHERE user_id = ? AND kind = 'defense' AND id > ?", userId, seenDef),
    auctions: cnt("SELECT COUNT(*) AS n FROM card_log WHERE user_id = ? AND kind = 'auction' AND id > ?", userId, seenLog),
    trades: cnt("SELECT COUNT(*) AS n FROM card_trades WHERE to_id = ? AND status = 'pending'", userId),
  };
}

/** Отметить уведомления прочитанными: защита, аукцион или всё */
export function noticesSeen(db: Database, userId: number, kind = "all"): Res<true> {
  const x = getExtra(db, userId);
  if (kind === "all" || kind === "defense") x.stats.seenDef = num(db.prepare("SELECT MAX(id) AS m FROM card_battles WHERE user_id = ? AND kind = 'defense'").get(userId)?.m);
  if (kind === "all" || kind === "auction") x.stats.seenLog = num(db.prepare("SELECT MAX(id) AS m FROM card_log WHERE user_id = ? AND kind = 'auction'").get(userId)?.m);
  setExtra(db, userId, x);
  return { ok: true, value: true };
}

export function eventsState(db: Database, userId: number, now = Date.now()): EventsState {
  const week = weekOf(now);
  const x = rollWeek(getExtra(db, userId), now);
  return {
    banner: { week, featured: bannerFeatured(week), endsAt: (week + 1) * 7 * 86_400_000 + 4 * 86_400_000, counter: x.banners[`b${week}`] ?? 0, guarantee: BANNER.guarantee, boost: BANNER.boost },
    pass: passView(db, userId, now),
    notices: noticesOf(db, userId),
  };
}
