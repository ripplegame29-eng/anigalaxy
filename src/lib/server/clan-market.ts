/** Покупки на клановом рынке: списываем алмазы игрока, выдаём паки/свитки/пыль/бустеры. */

import { MARKET, marketItem } from "../clan-market";
import { addMoney, addScroll, getWallet, logEvent } from "./cards";
import { getExtra, setExtra, weekOf } from "./cards-extra";
import { clanIdOfUser, getClan } from "./clans";
import { num, transaction, type Database } from "./sqlite";

type Res<T> = { ok: true; value: T } | { ok: false; error: string; code?: string };
const fail = <T,>(error: string): Res<T> => ({ ok: false, error });

/** Сколько раз игрок купил каждый товар на этой неделе */
export function marketBought(db: Database, userId: number, now = Date.now()): Record<string, number> {
  const rows = db.prepare("SELECT item_id, n FROM clan_market_buys WHERE user_id = ? AND week = ?").all(userId, weekOf(now)) as { item_id: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.item_id, num(r.n)]));
}

export function marketView(db: Database, userId: number, now = Date.now()) {
  const w = getWallet(db, userId, now, false);
  return { diamonds: w.diamonds, bought: marketBought(db, userId, now), weekEndsAt: (weekOf(now) + 1) * 7 * 86_400_000 + 4 * 86_400_000 };
}

export function marketBuy(db: Database, userId: number, itemId: string, now = Date.now()): Res<{ diamonds: number }> {
  const item = marketItem(itemId);
  if (!item) return fail("Нет такого товара");
  return transaction(db, (): Res<{ diamonds: number }> => {
    const clanId = clanIdOfUser(db, userId);
    const clan = clanId === null ? null : getClan(db, clanId);
    if (!clan) return fail("Рынок доступен только участникам клана");
    if (clan.level < item.level) return fail(`Откроется на ${item.level} уровне клана`);
    const week = weekOf(now);
    const n = num(db.prepare("SELECT n FROM clan_market_buys WHERE user_id = ? AND item_id = ? AND week = ?").get(userId, item.id, week)?.n);
    if (n >= item.limit) return fail("Лимит на эту неделю исчерпан");
    getWallet(db, userId, now, false);
    if (!addMoney(db, userId, "diamonds", -item.price)) return fail("Не хватает алмазов");
    const g = item.give;
    if (g.packs) addMoney(db, userId, "packs", g.packs);
    if (g.dust) addMoney(db, userId, "dust", g.dust);
    for (const [rank, k] of g.scrolls ?? []) addScroll(db, userId, rank, k);
    if (g.boosters) {
      const x = getExtra(db, userId);
      for (const [id, k] of Object.entries(g.boosters)) x.gear.boost[id] = (x.gear.boost[id] ?? 0) + k;
      setExtra(db, userId, x);
    }
    db.prepare(
      `INSERT INTO clan_market_buys (user_id, item_id, week, n) VALUES (?, ?, ?, 1)
       ON CONFLICT(user_id, item_id, week) DO UPDATE SET n = n + 1`,
    ).run(userId, item.id, week);
    logEvent(db, userId, "market", `Клановый рынок: ${item.name}`, "", 0, now);
    return { ok: true, value: { diamonds: getWallet(db, userId, now, false).diamonds } };
  });
}

export { MARKET };
