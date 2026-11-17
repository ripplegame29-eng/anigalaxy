/** Несколько колод игрока: слоты с названием, классом и составом. Активная колода зеркалится в card_wallet.deck. */

import { cardDef } from "../cards/catalog";
import { DECK_SIZE, type CardClass } from "../cards/config";
import { cleanSpells, SPELL_DECK } from "../cards/tactics";
import { getSpells } from "./cards-spells";
import { DECK_NAME_MAX, DECK_SLOTS, isHeroClass, type DeckSlot, type DecksState } from "../cards/heroclass";
import { fail, getWallet, listInventory, type Res } from "./cards";
import { getExtra, setExtra } from "./cards-extra";
import type { Database } from "./sqlite";

interface Raw {
  slots?: Partial<DeckSlot>[];
  active?: number;
}

const cleanName = (v: unknown, i: number): string => {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, DECK_NAME_MAX) : "";
  return s || `Колода ${i + 1}`;
};

/** Колоды игрока; состав активной колоды всегда берётся из кошелька (его меняют и другие разделы) */
export function getDecks(db: Database, userId: number): DecksState {
  const w = getWallet(db, userId, undefined, false);
  const raw = getExtra(db, userId).decks as Raw | undefined;
  const inv = new Map(listInventory(db, userId).map((c) => [c.id, c]));
  const active = Math.min(DECK_SLOTS - 1, Math.max(0, Math.floor(Number(raw?.active ?? 0)) || 0));
  const slots: DeckSlot[] = Array.from({ length: DECK_SLOTS }, (_, i) => {
    const s = raw?.slots?.[i];
    const ids = i === active ? w.deck : (s?.ids ?? []).filter((id) => inv.has(id)).slice(0, DECK_SIZE);
    return { name: cleanName(s?.name, i), cls: isHeroClass(s?.cls) ? s.cls : "warrior", ids, tac: cleanSpells(s?.tac) };
  });
  if (!raw) {
    /* первый заход: класс первой колоды — самый частый класс её героев */
    const count: Partial<Record<CardClass, number>> = {};
    for (const id of w.deck) {
      const d = cardDef(inv.get(id)?.cardId ?? "");
      if (d) count[d.cls] = (count[d.cls] ?? 0) + 1;
    }
    const top = (Object.entries(count) as [CardClass, number][]).sort((a, b) => b[1] - a[1])[0];
    if (top) slots[0].cls = top[0];
  }
  return { slots, active };
}

const persist = (db: Database, userId: number, d: DecksState): void => {
  const x = getExtra(db, userId);
  x.decks = { slots: d.slots, active: d.active };
  setExtra(db, userId, x);
};

/** Класс активной колоды (для боя) */
export function activeHeroClass(db: Database, userId: number): CardClass {
  const d = getDecks(db, userId);
  return d.slots[d.active].cls;
}

/** Колода заклинаний активной колоды (пусто — стартовый набор) */
export function activeTactics(db: Database, userId: number): string[] {
  const d = getDecks(db, userId);
  return d.slots[d.active].tac;
}

/** Сохранить название, класс и/или состав слота */
export function saveDeckSlot(db: Database, userId: number, body: { slot: number; name?: unknown; cls?: unknown; ids?: number[]; tac?: unknown }): Res<DecksState> {
  const slot = Math.floor(Number(body.slot));
  if (!(slot >= 0 && slot < DECK_SLOTS)) return fail("Нет такой колоды");
  const d = getDecks(db, userId);
  const cur = d.slots[slot];
  if (body.cls !== undefined && !isHeroClass(body.cls)) return fail("Неизвестный класс");
  let ids = cur.ids;
  if (body.ids) {
    if (body.ids.length > DECK_SIZE) return fail(`В колоде не больше ${DECK_SIZE} карт`);
    const inv = new Map(listInventory(db, userId).map((c) => [c.id, c]));
    const seen = new Set<string>();
    for (const id of body.ids) {
      const c = inv.get(id);
      if (!c) return fail("Карта не найдена");
      if (c.listed) return fail("Карта выставлена на аукцион или в обмен");
      if (seen.has(c.cardId)) return fail("В колоде не может быть двух одинаковых персонажей");
      seen.add(c.cardId);
    }
    ids = body.ids;
  }
  let tac = cur.tac;
  if (body.tac !== undefined) {
    if (!Array.isArray(body.tac)) return fail("Некорректная колода заклинаний");
    tac = cleanSpells(body.tac);
    const own = getSpells(db, userId).own;
    if (tac.some((id) => !own.includes(id))) return fail("Эта карта боя вам ещё не доступна");
    if (tac.length !== new Set(body.tac).size) return fail("В колоде заклинаний не должно быть повторов или неизвестных карт");
    if (body.tac.length > SPELL_DECK.max) return fail(`В колоде заклинаний не больше ${SPELL_DECK.max} карт`);
  }
  d.slots[slot] = { tac, name: body.name === undefined ? cur.name : cleanName(body.name, slot), cls: body.cls === undefined ? cur.cls : (body.cls as CardClass), ids };
  persist(db, userId, d);
  if (slot === d.active && body.ids) db.prepare("UPDATE card_wallet SET deck = ? WHERE user_id = ?").run(JSON.stringify(ids), userId);
  return { ok: true, value: getDecks(db, userId) };
}

/** Сделать колоду активной: её состав становится отрядом для боёв */
export function activateDeckSlot(db: Database, userId: number, slotRaw: number): Res<DecksState> {
  const slot = Math.floor(Number(slotRaw));
  if (!(slot >= 0 && slot < DECK_SLOTS)) return fail("Нет такой колоды");
  const d = getDecks(db, userId);
  d.active = slot;
  persist(db, userId, d);
  db.prepare("UPDATE card_wallet SET deck = ? WHERE user_id = ?").run(JSON.stringify(d.slots[slot].ids), userId);
  return { ok: true, value: getDecks(db, userId) };
}
