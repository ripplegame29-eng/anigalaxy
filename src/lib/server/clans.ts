/**
 * Кланы и клановые войны в базе: состав, казна, опыт, войны между
 * настоящими кланами. Визуальное оформление (эмблема, фон, декор, земли)
 * лежит в поле `data` клана одним JSON — так интерфейс может добавлять
 * поля без новых миграций.
 */

import { clanLevelFromXp, memberCap } from "../clan-rules";
import { CLAN_EMBLEMS } from "../emblems.data";
import { PROGRESS_DOC_KEY } from "../sync-keys";
import { closeSeasonRow, openSeasonRow } from "./clan-points";
import { num, str, transaction, type Database } from "./sqlite";

export const WAR_DURATION_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_DATA_BYTES = 64 * 1024;
/** Максимум за один вклад — защита от подделанных запросов */
const MAX_CONTRIBUTION = 20_000;
const MAX_WAR_POINTS = 5_000;

export type ClanResult<T> = { ok: true; value: T } | { ok: false; error: string; code: string };

function fail<T>(error: string, code: string): ClanResult<T> {
  return { ok: false, error, code };
}

export interface ClanSummary {
  id: number;
  name: string;
  tag: string;
  description: string;
  leaderId: number;
  xp: number;
  treasury: number;
  prestige: number;
  members: number;
  createdAt: number;
  league: number;
  trophies: number;
  crystals: number;
  extraSlots: number;
  level: number;
  cap: number;
  /** Эмблема, выбранная главой (id из CLAN_EMBLEMS); пусто — эмблема по номеру клана */
  emblem: string;
  /** Версия своего аватара клана (0 — не загружен) */
  avatarV: number;
  /** Версия своей обложки клана (0 — не загружена) */
  bannerV: number;
  /** Сколько участников заходили сегодня */
  activeToday: number;
}

export interface ClanMember {
  userId: number;
  nickname: string;
  role: string;
  joinedAt: number;
  contributedXp: number;
  contributedAc: number;
}

export interface WarInfo {
  id: number;
  clanA: number;
  clanB: number;
  nameA: string;
  nameB: string;
  status: string;
  stake: number;
  scoreA: number;
  scoreB: number;
  winner: number | null;
  startedAt: number;
  endsAt: number;
}

const SUMMARY_SQL = `
  SELECT c.*, (SELECT COUNT(*) FROM clan_members m WHERE m.clan_id = c.id) AS members,
    (SELECT v FROM clan_media x WHERE x.clan_id = c.id AND x.kind = 'avatar') AS avatar_v,
    (SELECT v FROM clan_media x WHERE x.clan_id = c.id AND x.kind = 'banner') AS banner_v,
    (SELECT COUNT(*) FROM clan_members m2 JOIN activity_days a ON a.user_id = m2.user_id
       WHERE m2.clan_id = c.id AND a.day = (SELECT MAX(day) FROM activity_days)) AS active_today
  FROM clans c`;

function toSummary(row: Record<string, unknown>): ClanSummary {
  return {
    id: num(row.id),
    name: str(row.name),
    tag: str(row.tag),
    description: str(row.description),
    leaderId: num(row.leader_id),
    xp: num(row.xp),
    treasury: num(row.treasury),
    prestige: num(row.prestige),
    members: num(row.members),
    createdAt: num(row.created_at),
    league: num(row.league),
    trophies: num(row.trophies),
    crystals: num(row.crystals),
    extraSlots: num(row.extra_slots),
    level: clanLevelFromXp(num(row.xp)),
    cap: memberCap(clanLevelFromXp(num(row.xp)), num(row.extra_slots)),
    emblem: emblemOfData(row.data),
    avatarV: num(row.avatar_v),
    bannerV: num(row.banner_v),
    activeToday: num(row.active_today),
  };
}

function emblemOfData(raw: unknown): string {
  try {
    const data = JSON.parse(str(raw) || "{}") as { emblem?: unknown };
    return typeof data.emblem === "string" && CLAN_EMBLEMS.some((e) => e.id === data.emblem) ? data.emblem : "";
  } catch {
    return "";
  }
}

/** Эмблемы кланов, купленные игроком в магазине профиля (по документу прогрессии) */
export function ownedEmblems(db: Database, userId: number): string[] {
  try {
    const row = db.prepare("SELECT value FROM user_docs WHERE user_id = ? AND doc_key = ?").get(userId, PROGRESS_DOC_KEY);
    const doc = JSON.parse(str(row?.value) || "{}") as { purchases?: { itemId?: unknown }[] };
    const ids = new Set((doc.purchases ?? []).map((p) => String(p.itemId ?? "")));
    return CLAN_EMBLEMS.filter((e) => ids.has(e.id)).map((e) => e.id);
  } catch {
    return [];
  }
}

/**
 * Глава ставит клану эмблему из купленных им в магазине профиля.
 * `null` — вернуть эмблему по умолчанию.
 */
export function setClanEmblem(db: Database, leaderId: number, emblemId: string | null): ClanResult<ClanSummary> {
  return transaction(db, (): ClanResult<ClanSummary> => {
    const clanId = clanIdOfUser(db, leaderId);
    const clan = clanId === null ? null : getClan(db, clanId);
    if (!clan || clan.leaderId !== leaderId) return fail("Эмблему меняет только глава клана", "forbidden");
    if (emblemId !== null) {
      if (!CLAN_EMBLEMS.some((e) => e.id === emblemId)) return fail("Нет такой эмблемы", "invalid");
      if (!ownedEmblems(db, leaderId).includes(emblemId)) return fail("Сначала купите эту эмблему в магазине", "forbidden");
    }
    const data = clanData(db, clan.id);
    if (emblemId === null) delete data.emblem;
    else data.emblem = emblemId;
    db.prepare("UPDATE clans SET data = ? WHERE id = ?").run(JSON.stringify(data), clan.id);
    logEvent(db, clan.id, leaderId, "emblem", 0, { emblem: emblemId ?? "" });
    return { ok: true, value: getClan(db, clan.id) ?? clan };
  });
}

/** Глава передаёт власть другому игроку клана и сам становится офицером */
export function transferLeader(db: Database, leaderId: number, targetId: number, now = Date.now()): ClanResult<true> {
  return transaction(db, (): ClanResult<true> => {
    const clanId = clanIdOfUser(db, leaderId);
    const clan = clanId === null ? null : getClan(db, clanId);
    if (!clan || clan.leaderId !== leaderId) return fail("Передать власть может только глава", "forbidden");
    if (targetId === leaderId) return fail("Вы уже глава клана", "invalid");
    if (clanIdOfUser(db, targetId) !== clan.id) return fail("Игрок не состоит в вашем клане", "not_found");
    db.prepare("UPDATE clans SET leader_id = ? WHERE id = ?").run(targetId, clan.id);
    db.prepare("UPDATE clan_members SET role = 'leader' WHERE user_id = ?").run(targetId);
    db.prepare("UPDATE clan_members SET role = 'officer' WHERE user_id = ?").run(leaderId);
    logEvent(db, clan.id, targetId, "leader_changed", 0, {}, now);
    return { ok: true, value: true };
  });
}

export function clanIdOfUser(db: Database, userId: number): number | null {
  const row = db.prepare("SELECT clan_id FROM clan_members WHERE user_id = ?").get(userId);
  return row ? num(row.clan_id) : null;
}

export function getClan(db: Database, id: number): ClanSummary | null {
  const row = db.prepare(`${SUMMARY_SQL} WHERE c.id = ?`).get(id);
  return row ? toSummary(row) : null;
}

export function listClans(db: Database, opts: { query?: string; limit?: number } = {}): ClanSummary[] {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  const q = (opts.query ?? "").trim();
  const rows = q
    ? db
        .prepare(`${SUMMARY_SQL} WHERE c.name LIKE ? OR c.tag LIKE ? ORDER BY c.xp DESC LIMIT ?`)
        .all(`%${q}%`, `%${q}%`, limit)
    : db.prepare(`${SUMMARY_SQL} ORDER BY c.xp DESC, c.id LIMIT ?`).all(limit);
  return rows.map(toSummary);
}

export function clanMembers(db: Database, clanId: number): ClanMember[] {
  return db
    .prepare(
      `SELECT m.*, u.nickname AS nickname FROM clan_members m JOIN users u ON u.id = m.user_id
       WHERE m.clan_id = ? ORDER BY (m.role = 'leader') DESC, m.contributed_xp DESC, m.joined_at`,
    )
    .all(clanId)
    .map((row) => ({
      userId: num(row.user_id),
      nickname: str(row.nickname),
      role: str(row.role, "member"),
      joinedAt: num(row.joined_at),
      contributedXp: num(row.contributed_xp),
      contributedAc: num(row.contributed_ac),
    }));
}

export function clanData(db: Database, clanId: number): Record<string, unknown> {
  const row = db.prepare("SELECT data FROM clans WHERE id = ?").get(clanId);
  try {
    const parsed = JSON.parse(str(row?.data, "{}")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function logEvent(
  db: Database,
  clanId: number,
  userId: number | null,
  kind: string,
  amount = 0,
  payload: Record<string, unknown> = {},
  now = Date.now(),
): void {
  db.prepare(
    "INSERT INTO clan_events (clan_id, user_id, kind, amount, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(clanId, userId, kind, amount, JSON.stringify(payload), now);
}

export function clanEvents(db: Database, clanId: number, limit = 30) {
  return db
    .prepare(
      `SELECT e.*, u.nickname AS nickname FROM clan_events e LEFT JOIN users u ON u.id = e.user_id
       WHERE e.clan_id = ? ORDER BY e.id DESC LIMIT ?`,
    )
    .all(clanId, Math.min(Math.max(limit, 1), 100))
    .map((row) => ({
      id: num(row.id),
      kind: str(row.kind),
      amount: num(row.amount),
      nickname: str(row.nickname),
      createdAt: num(row.created_at),
    }));
}

export function createClan(
  db: Database,
  leaderId: number,
  input: { name: string; tag: string; description?: string },
  now = Date.now(),
): ClanResult<ClanSummary> {
  const name = input.name.trim();
  const tag = input.tag.trim();
  if (name.length < 3 || name.length > 24) return fail("Название клана — от 3 до 24 символов", "invalid");
  if (!/^[A-Za-z0-9А-Яа-яЁё]{2,5}$/.test(tag)) return fail("Тег клана — 2–5 букв или цифр", "invalid");
  const description = (input.description ?? "").trim().slice(0, 280);

  return transaction(db, (): ClanResult<ClanSummary> => {
    if (clanIdOfUser(db, leaderId) !== null) return fail("Вы уже состоите в клане", "in_clan");
    if (db.prepare("SELECT 1 FROM clans WHERE name = ?").get(name)) return fail("Клан с таким названием уже есть", "name_taken");
    if (db.prepare("SELECT 1 FROM clans WHERE tag = ?").get(tag)) return fail("Такой тег уже занят", "tag_taken");
    const info = db
      .prepare("INSERT INTO clans (name, tag, description, leader_id, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(name, tag, description, leaderId, now);
    const id = num(info.lastInsertRowid);
    db.prepare("INSERT INTO clan_members (user_id, clan_id, role, joined_at) VALUES (?, ?, 'leader', ?)").run(
      leaderId,
      id,
      now,
    );
    openSeasonRow(db, leaderId, id, now);
    logEvent(db, id, leaderId, "created", 0, {}, now);
    const clan = getClan(db, id);
    return clan ? { ok: true, value: clan } : fail("Не удалось создать клан", "internal");
  });
}

export function joinClan(db: Database, userId: number, clanId: number, now = Date.now()): ClanResult<ClanSummary> {
  return transaction(db, (): ClanResult<ClanSummary> => {
    if (clanIdOfUser(db, userId) !== null) return fail("Вы уже состоите в клане", "in_clan");
    const clan = getClan(db, clanId);
    if (!clan) return fail("Клан не найден", "not_found");
    if (clan.members >= clan.cap) return fail("В клане нет свободных мест", "full");
    db.prepare("INSERT INTO clan_members (user_id, clan_id, role, joined_at) VALUES (?, ?, 'member', ?)").run(
      userId,
      clanId,
      now,
    );
    openSeasonRow(db, userId, clanId, now);
    logEvent(db, clanId, userId, "joined", 0, {}, now);
    return { ok: true, value: getClan(db, clanId) ?? clan };
  });
}

/** Выйти из клана: лидер передаёт власть старейшему участнику, последний участник закрывает клан */
export function leaveClan(db: Database, userId: number, now = Date.now()): ClanResult<{ disbanded: boolean }> {
  return transaction(db, (): ClanResult<{ disbanded: boolean }> => {
    const clanId = clanIdOfUser(db, userId);
    if (clanId === null) return fail("Вы не состоите в клане", "no_clan");
    const clan = getClan(db, clanId);
    if (!clan) return fail("Клан не найден", "not_found");

    if (clan.leaderId === userId) {
      const heir = db
        .prepare("SELECT user_id FROM clan_members WHERE clan_id = ? AND user_id <> ? ORDER BY joined_at LIMIT 1")
        .get(clanId, userId);
      if (!heir) {
        db.prepare("DELETE FROM clans WHERE id = ?").run(clanId);
        return { ok: true, value: { disbanded: true } };
      }
      db.prepare("UPDATE clans SET leader_id = ? WHERE id = ?").run(num(heir.user_id), clanId);
      db.prepare("UPDATE clan_members SET role = 'leader' WHERE user_id = ?").run(num(heir.user_id));
      logEvent(db, clanId, num(heir.user_id), "leader_changed", 0, {}, now);
    }
    closeSeasonRow(db, userId, clanId, now);
    db.prepare("DELETE FROM clan_members WHERE user_id = ?").run(userId);
    logEvent(db, clanId, userId, "left", 0, {}, now);
    return { ok: true, value: { disbanded: false } };
  });
}

export function kickMember(db: Database, leaderId: number, targetId: number, now = Date.now()): ClanResult<true> {
  return transaction(db, (): ClanResult<true> => {
    const clanId = clanIdOfUser(db, leaderId);
    const clan = clanId === null ? null : getClan(db, clanId);
    const myRole = str(db.prepare("SELECT role FROM clan_members WHERE user_id = ?").get(leaderId)?.role);
    if (!clan || (myRole !== "leader" && myRole !== "officer")) return fail("Исключать участников могут глава и офицеры", "forbidden");
    if (targetId === leaderId) return fail("Нельзя исключить себя", "invalid");
    const targetRole = str(db.prepare("SELECT role FROM clan_members WHERE user_id = ?").get(targetId)?.role);
    if (targetRole === "leader" || (targetRole === "officer" && myRole !== "leader")) return fail("Этого игрока исключить нельзя", "forbidden");
    if (clanIdOfUser(db, targetId) !== clan.id) return fail("Игрок не состоит в вашем клане", "not_found");
    closeSeasonRow(db, targetId, clan.id, now);
    db.prepare("DELETE FROM clan_members WHERE user_id = ?").run(targetId);
    logEvent(db, clan.id, targetId, "kicked", 0, {}, now);
    return { ok: true, value: true };
  });
}

/** Вклад в клан: опыт идёт в рост клана, АС — в казну */
export function contribute(
  db: Database,
  userId: number,
  input: { xp?: number; ac?: number },
  now = Date.now(),
): ClanResult<ClanSummary> {
  const xp = Math.floor(input.xp ?? 0);
  const ac = Math.floor(input.ac ?? 0);
  if (xp < 0 || ac < 0 || xp + ac <= 0) return fail("Вклад должен быть положительным", "invalid");
  if (xp > MAX_CONTRIBUTION || ac > MAX_CONTRIBUTION) return fail("Слишком большой вклад", "invalid");

  return transaction(db, (): ClanResult<ClanSummary> => {
    const clanId = clanIdOfUser(db, userId);
    if (clanId === null) return fail("Вы не состоите в клане", "no_clan");
    db.prepare("UPDATE clans SET xp = xp + ?, treasury = treasury + ? WHERE id = ?").run(xp, ac, clanId);
    db.prepare(
      "UPDATE clan_members SET contributed_xp = contributed_xp + ?, contributed_ac = contributed_ac + ? WHERE user_id = ?",
    ).run(xp, ac, userId);
    logEvent(db, clanId, userId, "contributed", xp + ac, { xp, ac }, now);
    const clan = getClan(db, clanId);
    return clan ? { ok: true, value: clan } : fail("Клан не найден", "not_found");
  });
}

/** Лидер меняет оформление и описание клана */
export function updateClan(
  db: Database,
  leaderId: number,
  input: { description?: string; data?: Record<string, unknown> },
): ClanResult<ClanSummary> {
  return transaction(db, (): ClanResult<ClanSummary> => {
    const clanId = clanIdOfUser(db, leaderId);
    const clan = clanId === null ? null : getClan(db, clanId);
    if (!clan || clan.leaderId !== leaderId) return fail("Менять клан может только лидер", "forbidden");
    if (input.description !== undefined) {
      db.prepare("UPDATE clans SET description = ? WHERE id = ?").run(input.description.trim().slice(0, 280), clan.id);
    }
    if (input.data !== undefined) {
      // Надетую косметику меняет только сервер после покупки
      const prev = clanData(db, clan.id);
      const next = { ...input.data };
      delete next.equipped;
      if (prev.equipped) next.equipped = prev.equipped;
      const json = JSON.stringify(next);
      if (Buffer.byteLength(json, "utf8") > MAX_DATA_BYTES) return fail("Слишком много данных", "too_large");
      db.prepare("UPDATE clans SET data = ? WHERE id = ?").run(json, clan.id);
    }
    const updated = getClan(db, clan.id);
    return updated ? { ok: true, value: updated } : fail("Клан не найден", "not_found");
  });
}

/* ------------------------------- Войны --------------------------------- */

function toWar(row: Record<string, unknown>): WarInfo {
  return {
    id: num(row.id),
    clanA: num(row.clan_a),
    clanB: num(row.clan_b),
    nameA: str(row.name_a),
    nameB: str(row.name_b),
    status: str(row.status),
    stake: num(row.stake),
    scoreA: num(row.score_a),
    scoreB: num(row.score_b),
    winner: row.winner === null || row.winner === undefined ? null : num(row.winner),
    startedAt: num(row.started_at),
    endsAt: num(row.ends_at),
  };
}

const WAR_SQL = `
  SELECT w.*, a.name AS name_a, b.name AS name_b FROM clan_wars w
  JOIN clans a ON a.id = w.clan_a JOIN clans b ON b.id = w.clan_b`;

export function activeWar(db: Database, clanId: number): WarInfo | null {
  const row = db
    .prepare(`${WAR_SQL} WHERE w.status = 'active' AND (w.clan_a = ? OR w.clan_b = ?) LIMIT 1`)
    .get(clanId, clanId);
  return row ? toWar(row) : null;
}

export function warHistory(db: Database, clanId: number, limit = 10): WarInfo[] {
  return db
    .prepare(`${WAR_SQL} WHERE w.status = 'finished' AND (w.clan_a = ? OR w.clan_b = ?) ORDER BY w.id DESC LIMIT ?`)
    .all(clanId, clanId, Math.min(Math.max(limit, 1), 50))
    .map(toWar);
}

export function declareWar(
  db: Database,
  leaderId: number,
  targetClanId: number,
  stake: number,
  now = Date.now(),
): ClanResult<WarInfo> {
  const bet = Math.floor(stake);
  if (!Number.isFinite(bet) || bet < 0 || bet > 1_000_000) return fail("Некорректная ставка", "invalid");

  return transaction(db, (): ClanResult<WarInfo> => {
    const clanId = clanIdOfUser(db, leaderId);
    const own = clanId === null ? null : getClan(db, clanId);
    if (!own || own.leaderId !== leaderId) return fail("Объявлять войну может только лидер", "forbidden");
    if (own.id === targetClanId) return fail("Нельзя воевать с самим собой", "invalid");
    const target = getClan(db, targetClanId);
    if (!target) return fail("Клан-соперник не найден", "not_found");
    if (activeWar(db, own.id)) return fail("Ваш клан уже воюет", "busy");
    if (activeWar(db, target.id)) return fail("Соперник уже воюет", "busy");
    if (bet > own.treasury || bet > target.treasury) return fail("В казне не хватает АС для такой ставки", "stake");

    db
      .prepare("INSERT INTO clan_wars (clan_a, clan_b, stake, started_at, ends_at) VALUES (?, ?, ?, ?, ?)")
      .run(own.id, target.id, bet, now, now + WAR_DURATION_MS);
    logEvent(db, own.id, leaderId, "war_declared", bet, { against: target.id }, now);
    logEvent(db, target.id, null, "war_received", bet, { from: own.id }, now);
    const war = activeWar(db, own.id);
    return war ? { ok: true, value: war } : fail("Не удалось объявить войну", "internal");
  });
}

/** Очки в войне за клан игрока (с потолком за один запрос) */
export function addWarScore(db: Database, userId: number, points: number, now = Date.now()): ClanResult<WarInfo> {
  const add = Math.floor(points);
  if (!Number.isFinite(add) || add <= 0 || add > MAX_WAR_POINTS) return fail("Некорректные очки", "invalid");
  return transaction(db, (): ClanResult<WarInfo> => {
    const clanId = clanIdOfUser(db, userId);
    if (clanId === null) return fail("Вы не состоите в клане", "no_clan");
    const war = activeWar(db, clanId);
    if (!war || war.endsAt <= now) return fail("Активной войны нет", "no_war");
    db.prepare(
      war.clanA === clanId
        ? "UPDATE clan_wars SET score_a = score_a + ? WHERE id = ?"
        : "UPDATE clan_wars SET score_b = score_b + ? WHERE id = ?",
    ).run(add, war.id);
    logEvent(db, clanId, userId, "war_points", add, { war: war.id }, now);
    const updated = activeWar(db, clanId);
    return updated ? { ok: true, value: updated } : fail("Активной войны нет", "no_war");
  });
}

/** Завершить просроченные войны: победитель забирает ставку из казны проигравшего */
export function settleWars(db: Database, now = Date.now()): WarInfo[] {
  const due = db
    .prepare(`${WAR_SQL} WHERE w.status = 'active' AND w.ends_at <= ?`)
    .all(now)
    .map(toWar);
  const finished: WarInfo[] = [];
  for (const war of due) {
    transaction(db, () => {
      const winner = war.scoreA === war.scoreB ? null : war.scoreA > war.scoreB ? war.clanA : war.clanB;
      if (winner !== null) {
        const loser = winner === war.clanA ? war.clanB : war.clanA;
        const loserClan = getClan(db, loser);
        const transfer = Math.min(war.stake, loserClan?.treasury ?? 0);
        if (transfer > 0) {
          db.prepare("UPDATE clans SET treasury = treasury - ? WHERE id = ?").run(transfer, loser);
          db.prepare("UPDATE clans SET treasury = treasury + ? WHERE id = ?").run(transfer, winner);
        }
        db.prepare("UPDATE clans SET prestige = prestige + 1 WHERE id = ?").run(winner);
        logEvent(db, winner, null, "war_won", transfer, { war: war.id }, now);
        logEvent(db, loser, null, "war_lost", transfer, { war: war.id }, now);
      }
      db.prepare("UPDATE clan_wars SET status = 'finished', winner = ?, settled_at = ? WHERE id = ?").run(
        winner,
        now,
        war.id,
      );
    });
    finished.push({ ...war, status: "finished", winner: war.scoreA === war.scoreB ? null : war.scoreA > war.scoreB ? war.clanA : war.clanB });
  }
  return finished;
}

/** Глава назначает офицера или снимает с должности */
export function setRole(db: Database, leaderId: number, targetId: number, role: "officer" | "member"): ClanResult<true> {
  return transaction(db, (): ClanResult<true> => {
    const clanId = clanIdOfUser(db, leaderId);
    const clan = clanId === null ? null : getClan(db, clanId);
    if (!clan || clan.leaderId !== leaderId) return fail("Назначать офицеров может только глава", "forbidden");
    if (targetId === leaderId || clanIdOfUser(db, targetId) !== clan.id) return fail("Игрок не состоит в вашем клане", "not_found");
    db.prepare("UPDATE clan_members SET role = ? WHERE user_id = ?").run(role, targetId);
    return { ok: true, value: true };
  });
}

/* ------------------------- Свои аватар и обложка ------------------------- */

export type ClanMediaKind = "avatar" | "banner";
const MEDIA_LIMIT: Record<ClanMediaKind, number> = { avatar: 2_000_000, banner: 4_000_000 };

/** Глава (или офицер) загружает аватар/обложку клана data-URL-ом; `null` — убрать */
export function setClanMedia(db: Database, userId: number, kind: ClanMediaKind, dataUrl: string | null): ClanResult<ClanSummary> {
  const clanId = clanIdOfUser(db, userId);
  const clan = clanId === null ? null : getClan(db, clanId);
  if (!clan) return fail("Вы не состоите в клане", "invalid");
  const role = str(db.prepare("SELECT role FROM clan_members WHERE clan_id = ? AND user_id = ?").get(clan.id, userId)?.role);
  if (clan.leaderId !== userId && role !== "officer") return fail("Оформление меняют глава и офицеры", "forbidden");
  if (dataUrl === null) {
    db.prepare("DELETE FROM clan_media WHERE clan_id = ? AND kind = ?").run(clan.id, kind);
  } else {
    const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!m) return fail("Нужна картинка PNG, JPEG, WebP или GIF", "invalid");
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.length > MEDIA_LIMIT[kind]) return fail("Файл слишком большой", "invalid");
    db.prepare(
      `INSERT INTO clan_media (clan_id, kind, mime, bytes, v) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(clan_id, kind) DO UPDATE SET mime = excluded.mime, bytes = excluded.bytes, v = excluded.v`,
    ).run(clan.id, kind, m[1], bytes, Date.now());
  }
  logEvent(db, clan.id, userId, "emblem", 0, { media: kind });
  return { ok: true, value: getClan(db, clan.id) ?? clan };
}

export function getClanMedia(db: Database, clanId: number, kind: ClanMediaKind): { mime: string; bytes: Buffer } | null {
  const row = db.prepare("SELECT mime, bytes FROM clan_media WHERE clan_id = ? AND kind = ?").get(clanId, kind) as { mime?: string; bytes?: Buffer } | undefined;
  return row?.bytes ? { mime: String(row.mime), bytes: Buffer.from(row.bytes) } : null;
}
