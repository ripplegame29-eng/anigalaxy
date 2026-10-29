/**
 * Донат карт в клане: соклановец просит копии героя (C–A), остальные отдают свои дубликаты.
 * Карта по-настоящему переходит к просящему; донор получает пыль и опыт клану.
 */

import { cardDef } from "../cards/catalog";
import { DONATE, type DonateRequestView, type DonateState } from "../cards/clanwar";
import { addMoney, fail, getWallet, listInventory, logEvent as cardLog, type Res } from "./cards";
import { track } from "./cards-extra";
import { clanIdOfUser, logEvent as clanLog } from "./clans";
import { addNotification } from "./social";
import { num, str, transaction, type Database } from "./sqlite";

const HOUR = 3_600_000;
const REQUEST_COOLDOWN_MS = HOUR;

function member(db: Database, userId: number): { clanId: number; joinedAt: number } | null {
  const r = db.prepare("SELECT clan_id, joined_at FROM clan_members WHERE user_id = ?").get(userId);
  return r ? { clanId: num(r.clan_id), joinedAt: num(r.joined_at) } : null;
}

const expire = (db: Database, clanId: number, now: number): void => {
  db.prepare("UPDATE clan_requests SET status = 'expired' WHERE clan_id = ? AND status = 'open' AND expires_at <= ?").run(clanId, now);
};

/** Свободные для передачи копии героя у игрока: без замка, аукциона, пробуждения, фольги и вне колоды */
function givable(db: Database, userId: number, cardId: string): number[] {
  const deck = getWallet(db, userId, undefined, false).deck;
  return listInventory(db, userId)
    .filter((c) => c.cardId === cardId && !c.locked && !c.listed && c.evo === 0 && !c.foil && !deck.includes(c.id))
    .sort((a, b) => a.level - b.level || a.id - b.id)
    .map((c) => c.id);
}

export function requestCards(db: Database, userId: number, cardId: string, wantIn: number, now = Date.now()): Res<number> {
  const want = Math.floor(wantIn);
  const def = cardDef(cardId);
  if (!def) return fail("Такого героя нет");
  if (def.rank > DONATE.maxRank) return fail("Карты S и SS передавать нельзя — просите C, B или A");
  if (!(want >= 1 && want <= DONATE.maxWant)) return fail(`Можно просить от 1 до ${DONATE.maxWant} копий`);
  return transaction(db, (): Res<number> => {
    const m = member(db, userId);
    if (!m) return fail("Вы не состоите в клане");
    if (now - m.joinedAt < DONATE.minMemberMs) return fail("Просить карты можно через сутки после вступления в клан");
    expire(db, m.clanId, now);
    if (db.prepare("SELECT 1 FROM clan_requests WHERE user_id = ? AND status = 'open'").get(userId)) return fail("У вас уже есть открытый запрос");
    const last = num(db.prepare("SELECT MAX(created_at) AS t FROM clan_requests WHERE user_id = ?").get(userId)?.t);
    if (last && now - last < REQUEST_COOLDOWN_MS) return fail("Новый запрос можно создать раз в час");
    const info = db.prepare("INSERT INTO clan_requests (clan_id, user_id, card_id, want, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)").run(m.clanId, userId, cardId, want, now, now + DONATE.requestMs);
    clanLog(db, m.clanId, userId, "donate_request", want, { card: cardId }, now);
    return { ok: true, value: num(info.lastInsertRowid) };
  });
}

export function cancelRequest(db: Database, userId: number): Res<true> {
  db.prepare("UPDATE clan_requests SET status = 'cancelled' WHERE user_id = ? AND status = 'open'").run(userId);
  return { ok: true, value: true };
}

export function donateCard(db: Database, userId: number, requestId: number, now = Date.now()): Res<{ dust: number; cardId: string }> {
  return transaction(db, (): Res<{ dust: number; cardId: string }> => {
    const m = member(db, userId);
    if (!m) return fail("Вы не состоите в клане");
    if (now - m.joinedAt < DONATE.minMemberMs) return fail("Отдавать карты можно через сутки после вступления в клан");
    expire(db, m.clanId, now);
    const r = db.prepare("SELECT * FROM clan_requests WHERE id = ? AND clan_id = ?").get(Math.floor(requestId), m.clanId);
    if (!r || str(r.status) !== "open") return fail("Запрос закрыт или не найден");
    const takerId = num(r.user_id);
    if (takerId === userId) return fail("Своему запросу донатить нельзя");
    const day = num(db.prepare("SELECT COUNT(*) AS n FROM clan_donations WHERE donor_id = ? AND created_at > ?").get(userId, now - 24 * HOUR)?.n);
    if (day >= DONATE.dailyLimit) return fail(`Лимит доната на сутки: ${DONATE.dailyLimit} карт`);
    const cardId = str(r.card_id);
    const free = givable(db, userId, cardId);
    if (!free.length) return fail("Нет свободной копии этого героя (нужна без замка, не в колоде, не анимированная и не пробуждённая)");
    const inv = free[0];
    db.prepare("UPDATE card_inv SET user_id = ?, locked = 0, listed = 0 WHERE id = ? AND user_id = ?").run(takerId, inv, userId);
    const got = num(r.got) + 1;
    db.prepare("UPDATE clan_requests SET got = ?, status = ? WHERE id = ?").run(got, got >= num(r.want) ? "done" : "open", num(r.id));
    const rank = cardDef(cardId)?.rank ?? 0;
    const dust = DONATE.dustPerRank[Math.min(2, rank)];
    getWallet(db, userId, now);
    addMoney(db, userId, "dust", dust);
    db.prepare("UPDATE clans SET xp = xp + ? WHERE id = ?").run(DONATE.clanXp, m.clanId);
    db.prepare("INSERT INTO clan_donations (clan_id, request_id, donor_id, taker_id, card_id, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(m.clanId, num(r.id), userId, takerId, cardId, now);
    track(db, userId, "donated", 1, now);
    const name = cardDef(cardId)?.name ?? "карта";
    const donor = str(db.prepare("SELECT nickname FROM users WHERE id = ?").get(userId)?.nickname, "Соклановец");
    cardLog(db, takerId, "donate", `${donor} передал(а) вам «${name}»`, cardId, rank, now);
    cardLog(db, userId, "donate", `Вы передали «${name}» соклановцу (+${dust} пыли)`, cardId, rank, now);
    addNotification(db, takerId, "clan_donation", { card: cardId, from: donor }, now);
    clanLog(db, m.clanId, userId, "donate_card", 1, { card: cardId, to: takerId }, now);
    return { ok: true, value: { dust, cardId } };
  });
}

export function donateState(db: Database, userId: number, now = Date.now()): DonateState | null {
  const m = member(db, userId);
  if (!m) return null;
  expire(db, m.clanId, now);
  const requests: DonateRequestView[] = db
    .prepare("SELECT r.*, u.nickname FROM clan_requests r JOIN users u ON u.id = r.user_id WHERE r.clan_id = ? AND r.status = 'open' ORDER BY r.id DESC LIMIT 30")
    .all(m.clanId)
    .map((r) => ({
      id: num(r.id),
      userId: num(r.user_id),
      nick: str(r.nickname),
      cardId: str(r.card_id),
      want: num(r.want),
      got: num(r.got),
      expiresAt: num(r.expires_at),
      mine: num(r.user_id) === userId,
      canGive: num(r.user_id) === userId ? 0 : givable(db, userId, str(r.card_id)).length,
    }));
  const last = num(db.prepare("SELECT MAX(created_at) AS t FROM clan_requests WHERE user_id = ?").get(userId)?.t);
  const open = !!db.prepare("SELECT 1 FROM clan_requests WHERE user_id = ? AND status = 'open'").get(userId);
  const top = db
    .prepare("SELECT u.nickname AS nick, COUNT(*) AS n FROM clan_donations d JOIN users u ON u.id = d.donor_id WHERE d.clan_id = ? AND d.created_at > ? GROUP BY d.donor_id ORDER BY n DESC LIMIT 5")
    .all(m.clanId, now - 7 * 24 * HOUR)
    .map((t) => ({ nick: str(t.nick), count: num(t.n) }));
  return {
    requests,
    givenToday: num(db.prepare("SELECT COUNT(*) AS n FROM clan_donations WHERE donor_id = ? AND created_at > ?").get(userId, now - 24 * HOUR)?.n),
    dailyLimit: DONATE.dailyLimit,
    nextRequestAt: open ? now + 1 : last && now - last < REQUEST_COOLDOWN_MS ? last + REQUEST_COOLDOWN_MS : 0,
    eligible: now - m.joinedAt >= DONATE.minMemberMs,
    top,
  };
}

export { clanIdOfUser };
