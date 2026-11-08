/**
 * Магазин карт за рубли, тир-лист и владельцы карт.
 *
 * Состав покупок описан в общем каталоге (`lib/payments/catalog`, тип `cards`):
 * сервер выдаёт его здесь после подтверждения оплаты. Карту гарантированного
 * ранга выбирает сервер — клиент её не присылает.
 */

import { cardDef, cardsOfRank, CATALOG, isHidden } from "../cards/catalog";
import type { PaymentProduct } from "../payments/catalog";
import { addCard, getWallet, grantReward, logEvent } from "./cards";
import { looksOf } from "./looks";
import { num, str, type Database } from "./sqlite";

/** Выдать набор из магазина карт (вызывается из выдачи оплаченного заказа) */
export function grantCardBundle(db: Database, userId: number, product: PaymentProduct, now = Date.now()): string[] {
  const b = product.cards;
  if (!b) return [];
  getWallet(db, userId, now);
  grantReward(db, userId, { diamonds: b.diamonds, packs: b.packs, dust: b.dust, scroll: b.scroll, scrollRank: b.scrollRank });
  const got: string[] = [];
  for (let i = 0; i < (b.cardCount ?? (b.cardRank ? 1 : 0)); i += 1) {
    const pool = cardsOfRank(b.cardRank as 0 | 1 | 2 | 3 | 4);
    if (!pool.length) break;
    const def = pool[Math.floor(Math.random() * pool.length)];
    addCard(db, userId, def.id, now);
    logEvent(db, userId, "shop", `Из магазина получена «${def.name}»`, def.id, def.rank, now);
    got.push(def.id);
  }
  return got;
}

/** Тир-лист: сколько копий и владельцев у каждой карты */
export function cardTiers(db: Database) {
  const rows = db.prepare("SELECT card_id, COUNT(*) AS c, COUNT(DISTINCT user_id) AS o FROM card_inv GROUP BY card_id").all();
  const by = new Map(rows.map((r) => [str(r.card_id), { copies: num(r.c), owners: num(r.o) }]));
  const players = num(db.prepare("SELECT COUNT(DISTINCT user_id) AS n FROM card_inv").get()?.n);
  return {
    players,
    cards: CATALOG.filter((c) => !isHidden(c.id)).map((c) => ({ id: c.id, rank: c.rank, copies: by.get(c.id)?.copies ?? 0, owners: by.get(c.id)?.owners ?? 0 })),
  };
}

/** Владельцы карты: по числу копий, затем по уровню и времени находки */
export function cardOwners(db: Database, cardId: string) {
  const def = cardDef(cardId);
  if (!def) return { ok: false as const, error: "Карта не найдена" };
  const rows = db
    .prepare(
      `SELECT i.user_id, u.nickname, COUNT(*) AS c, MAX(i.level) AS lv, MAX(i.foil) AS foil, MIN(i.created_at) AS first
       FROM card_inv i JOIN users u ON u.id = i.user_id
       WHERE i.card_id = ? GROUP BY i.user_id ORDER BY c DESC, lv DESC, first ASC LIMIT 60`,
    )
    .all(cardId);
  const tot = db.prepare("SELECT COUNT(*) AS c, COUNT(DISTINCT user_id) AS o, MIN(created_at) AS first FROM card_inv WHERE card_id = ?").get(cardId);
  const looks = looksOf(db, rows.map((r) => num(r.user_id)));
  const firstRow = rows.length ? [...rows].sort((a, b) => num(a.first) - num(b.first))[0] : null;
  return {
    ok: true as const,
    value: {
      cardId,
      copies: num(tot?.c),
      owners: num(tot?.o),
      firstFound: num(tot?.first),
      firstNick: firstRow ? str(firstRow.nickname) : "",
      list: rows.map((r, i) => {
        const look = looks.get(num(r.user_id));
        return {
          place: i + 1,
          nick: str(r.nickname),
          copies: num(r.c),
          level: num(r.lv),
          foil: num(r.foil) > 0,
          avatar: look?.avatar ?? "",
          frameId: look?.frameId ?? "",
        };
      }),
    },
  };
}
