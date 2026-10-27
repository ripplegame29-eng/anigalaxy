/** Казна клана, магазин, кристаллы и заказы. Реальные деньги покупают только косметику и места. */

import {
  CRYSTAL_PACKS,
  CRYSTAL_PRICE,
  DONATE_MAX,
  DONATE_MIN,
  RENAME_PRICE,
  SLOT_PACK,
  TREASURY_PRICE,
  clanItem,
  type ItemSlot,
} from "../clan-rules";
import { PROGRESS_DOC_KEY } from "../sync-keys";
import { adjustBalance } from "./admin-edit";
import { clanData, clanIdOfUser, getClan, logEvent } from "./clans";
import { getDoc } from "./docs";
import { num, str, transaction, type Database } from "./sqlite";
import type { UserRow } from "./users";

const SYSTEM = { nickname: "AniGalaxy" } as unknown as UserRow;
type Res<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

function balanceOf(db: Database, userId: number): number {
  const doc = getDoc(db, userId, PROGRESS_DOC_KEY);
  if (!doc) return 0;
  try {
    return num((JSON.parse(doc.value) as { progress?: { acBalance?: number } }).progress?.acBalance);
  } catch {
    return 0;
  }
}

const roleOf = (db: Database, userId: number): string | null => {
  const r = db.prepare("SELECT role FROM clan_members WHERE user_id = ?").get(userId);
  return r ? str(r.role, "member") : null;
};
const canManage = (role: string | null) => role === "leader" || role === "officer";

/** Взнос монет в казну: списывается с баланса игрока на сервере */
export function donateAc(db: Database, userId: number, amount: number, now = Date.now()): Res<number> {
  const ac = Math.floor(amount);
  if (!(ac >= DONATE_MIN && ac <= DONATE_MAX)) return fail(`Взнос от ${DONATE_MIN} до ${DONATE_MAX} AC`);
  return transaction(db, (): Res<number> => {
    const clanId = clanIdOfUser(db, userId);
    if (clanId === null) return fail("Вы не состоите в клане");
    if (balanceOf(db, userId) < ac) return fail("Не хватает монет");
    adjustBalance(db, SYSTEM, userId, { ac: -ac, note: "Взнос в казну клана" }, now);
    db.prepare("UPDATE clans SET treasury = treasury + ? WHERE id = ?").run(ac, clanId);
    db.prepare("UPDATE clan_members SET contributed_ac = contributed_ac + ? WHERE user_id = ?").run(ac, userId);
    logEvent(db, clanId, userId, "donated", ac, {}, now);
    return { ok: true, value: num(db.prepare("SELECT treasury FROM clans WHERE id = ?").get(clanId)?.treasury) };
  });
}

export function ownedItems(db: Database, clanId: number): string[] {
  return db.prepare("SELECT item_id FROM clan_items WHERE clan_id = ?").all(clanId).map((r) => str(r.item_id));
}

/** Купить предмет клана: за казну (обычные и редкие) или за кристаллы */
export function buyItem(
  db: Database,
  userId: number,
  itemId: string,
  currency: "treasury" | "crystals",
  now = Date.now(),
): Res<true> {
  const item = clanItem(itemId);
  if (!item) return fail("Нет такого предмета");
  return transaction(db, (): Res<true> => {
    const clanId = clanIdOfUser(db, userId);
    if (clanId === null || !canManage(roleOf(db, userId))) return fail("Покупать могут глава и офицеры");
    if (ownedItems(db, clanId).includes(itemId)) return fail("Предмет уже куплен");
    if (currency === "treasury") {
      if (item.rarity !== "common" && item.rarity !== "rare") return fail("Этот предмет продаётся только за кристаллы");
      const price = TREASURY_PRICE[item.rarity];
      const done = db.prepare("UPDATE clans SET treasury = treasury - ? WHERE id = ? AND treasury >= ?").run(price, clanId, price);
      if (!num((done as { changes?: number }).changes)) return fail("В казне не хватает монет");
    } else {
      const price = CRYSTAL_PRICE[item.rarity];
      const done = db.prepare("UPDATE clans SET crystals = crystals - ? WHERE id = ? AND crystals >= ?").run(price, clanId, price);
      if (!num((done as { changes?: number }).changes)) return fail("Не хватает кристаллов");
    }
    db.prepare("INSERT INTO clan_items (clan_id, item_id, source, created_at) VALUES (?, ?, ?, ?)").run(clanId, itemId, currency, now);
    logEvent(db, clanId, userId, "bought", 1, { item: itemId, currency }, now);
    return { ok: true, value: true };
  });
}

/** Надеть купленный предмет (или снять, если itemId пуст) */
export function equipItem(db: Database, userId: number, slot: ItemSlot, itemId: string | null): Res<Record<string, string>> {
  return transaction(db, (): Res<Record<string, string>> => {
    const clanId = clanIdOfUser(db, userId);
    if (clanId === null || !canManage(roleOf(db, userId))) return fail("Менять оформление могут глава и офицеры");
    if (itemId) {
      const item = clanItem(itemId);
      if (!item || item.slot !== slot) return fail("Предмет не подходит к ячейке");
      if (!ownedItems(db, clanId).includes(itemId)) return fail("Сначала купите предмет");
    }
    const data = clanData(db, clanId);
    const equipped = { ...((data.equipped as Record<string, string>) ?? {}) };
    if (itemId) equipped[slot] = itemId;
    else delete equipped[slot];
    data.equipped = equipped;
    db.prepare("UPDATE clans SET data = ? WHERE id = ?").run(JSON.stringify(data), clanId);
    return { ok: true, value: equipped };
  });
}

export function buySlots(db: Database, userId: number, now = Date.now()): Res<number> {
  return transaction(db, (): Res<number> => {
    const clanId = clanIdOfUser(db, userId);
    if (clanId === null || roleOf(db, userId) !== "leader") return fail("Места покупает глава");
    const clan = getClan(db, clanId);
    if (!clan) return fail("Клан не найден");
    if (clan.extraSlots + SLOT_PACK.slots > SLOT_PACK.max) return fail("Достигнут максимум дополнительных мест");
    const done = db
      .prepare("UPDATE clans SET crystals = crystals - ?, extra_slots = extra_slots + ? WHERE id = ? AND crystals >= ?")
      .run(SLOT_PACK.crystals, SLOT_PACK.slots, clanId, SLOT_PACK.crystals);
    if (!num((done as { changes?: number }).changes)) return fail("Не хватает кристаллов");
    logEvent(db, clanId, userId, "slots", SLOT_PACK.slots, {}, now);
    return { ok: true, value: clan.extraSlots + SLOT_PACK.slots };
  });
}

/* -------------------------------- Заказы ------------------------------- */

export function createOrder(db: Database, userId: number, packId: string, now = Date.now()): Res<{ id: string; rub: number; crystals: number }> {
  const pack = CRYSTAL_PACKS.find((p) => p.id === packId);
  if (!pack) return fail("Нет такого набора");
  const clanId = clanIdOfUser(db, userId);
  if (clanId === null) return fail("Вы не состоите в клане");
  const id = `co_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(
    "INSERT INTO clan_orders (id, user_id, clan_id, pack, rub, crystals, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)",
  ).run(id, userId, clanId, pack.id, pack.rub, pack.crystals, now);
  return { ok: true, value: { id, rub: pack.rub, crystals: pack.crystals } };
}

/** Заказ оплачен (вебхук провайдера). Повторный вызов ничего не меняет. */
export function markOrderPaid(db: Database, orderId: string, providerRef: string, now = Date.now()): Res<{ clanId: number; crystals: number }> {
  return transaction(db, (): Res<{ clanId: number; crystals: number }> => {
    const o = db.prepare("SELECT * FROM clan_orders WHERE id = ?").get(orderId);
    if (!o) return fail("Заказ не найден");
    const clanId = num(o.clan_id);
    if (str(o.status) === "paid") return { ok: true, value: { clanId, crystals: 0 } };
    const done = db
      .prepare("UPDATE clan_orders SET status = 'paid', provider_ref = ?, paid_at = ? WHERE id = ? AND status = 'pending'")
      .run(providerRef, now, orderId);
    if (!num((done as { changes?: number }).changes)) return fail("Заказ уже обработан");
    const exists = db.prepare("SELECT 1 FROM clans WHERE id = ?").get(clanId);
    if (exists) {
      db.prepare("UPDATE clans SET crystals = crystals + ? WHERE id = ?").run(num(o.crystals), clanId);
      logEvent(db, clanId, num(o.user_id), "crystals", num(o.crystals), { order: orderId }, now);
    }
    return { ok: true, value: { clanId, crystals: num(o.crystals) } };
  });
}

/** Сколько рублей игрок вложил в клан — для титулов спонсоров */
export function donorRub(db: Database, userId: number): number {
  return num(db.prepare("SELECT COALESCE(SUM(rub),0) AS s FROM clan_orders WHERE user_id = ? AND status = 'paid'").get(userId)?.s);
}

export { RENAME_PRICE };
