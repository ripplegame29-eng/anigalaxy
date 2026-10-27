/**
 * Мир кланов на сервере: кто владеет какой клеткой, захват, осада, укрепление и итоги недели.
 *
 * Влияние клана = его недельные очки (из реального опыта игроков) минус уже потраченное.
 * Каждый понедельник влияние обнуляется вместе с очками, а клетки остаются: удержать
 * завоёванное труднее, чем взять, потому что прочность без присмотра убывает.
 */

import {
  CAPITAL_HP,
  CAPTURE_START_HP,
  CLAIM_START_HP,
  MIN_ACTION,
  MIN_ATTACK,
  MIN_WORLD_MEMBERS,
  SHIELD_CAPITAL_MS,
  SHIELD_CAPTURE_MS,
  SHIELD_CLAIM_MS,
  TILE_SCORE,
  TILE_TRIBUTE,
  buildWorld,
  claimCost,
  effectiveHp,
  worldRewardForRank,
} from "../clan-world";
import { MIN_MEMBER_GAIN } from "../clan-rules";
import { clanPoints, currentSeason, memberGains, nextSeason, prevSeason, seasonEnd } from "./clan-points";
import { logEvent } from "./clans";
import { queueGrant } from "./grants";
import { num, str, transaction, type Database } from "./sqlite";

export type WorldResult<T = null> = { ok: true; value: T } | { ok: false; error: string };
const fail = <T>(error: string): WorldResult<T> => ({ ok: false, error });

export interface TileState {
  tileId: number;
  clanId: number;
  hp: number;
  shieldUntil: number;
  capital: boolean;
  since: number;
}

/** Убрать клетки кланов, которых больше нет */
function sweepOrphans(db: Database): void {
  db.prepare("DELETE FROM clan_world_tiles WHERE clan_id NOT IN (SELECT id FROM clans)").run();
}

export function worldTiles(db: Database, now = Date.now()): TileState[] {
  sweepOrphans(db);
  const world = buildWorld();
  return db
    .prepare("SELECT tile_id, clan_id, hp, hp_at, shield_until, capital, since FROM clan_world_tiles")
    .all()
    .map((row) => {
      const tileId = num(row.tile_id);
      const max = world.tiles[tileId]?.maxHp ?? 1;
      const maxHp = num(row.capital) ? Math.max(max, CAPITAL_HP) : max;
      return {
        tileId,
        clanId: num(row.clan_id),
        hp: effectiveHp(num(row.hp), num(row.hp_at), maxHp, now),
        shieldUntil: num(row.shield_until),
        capital: !!num(row.capital),
        since: num(row.since),
      };
    });
}

function maxHpOf(tileId: number, capital: boolean): number {
  const base = buildWorld().tiles[tileId]?.maxHp ?? 1;
  return capital ? Math.max(base, CAPITAL_HP) : base;
}

function rowOf(db: Database, tileId: number, now: number): TileState | null {
  const row = db.prepare("SELECT tile_id, clan_id, hp, hp_at, shield_until, capital, since FROM clan_world_tiles WHERE tile_id = ?").get(tileId);
  if (!row) return null;
  const capital = !!num(row.capital);
  return {
    tileId,
    clanId: num(row.clan_id),
    hp: effectiveHp(num(row.hp), num(row.hp_at), maxHpOf(tileId, capital), now),
    shieldUntil: num(row.shield_until),
    capital,
    since: num(row.since),
  };
}

export const ownedCount = (db: Database, clanId: number): number =>
  num(db.prepare("SELECT COUNT(*) AS n FROM clan_world_tiles WHERE clan_id = ?").get(clanId)?.n);

export function spentThisSeason(db: Database, clanId: number, season: string): number {
  return num(db.prepare("SELECT spent FROM clan_world_spend WHERE season = ? AND clan_id = ?").get(season, clanId)?.spent);
}

/** Сколько влияния у клана прямо сейчас */
export function influenceOf(db: Database, clanId: number, now = Date.now()): { points: number; spent: number; available: number } {
  const season = currentSeason(now);
  const points = clanPoints(db, clanId, season);
  const spent = spentThisSeason(db, clanId, season);
  return { points, spent, available: Math.max(0, points - spent) };
}

function spend(db: Database, clanId: number, season: string, amount: number): void {
  db.prepare(
    `INSERT INTO clan_world_spend (season, clan_id, spent) VALUES (?, ?, ?)
     ON CONFLICT(season, clan_id) DO UPDATE SET spent = spent + excluded.spent`,
  ).run(season, clanId, amount);
}

function feed(db: Database, kind: string, tileId: number, clanId: number, otherId: number, amount: number, now: number): void {
  db.prepare("INSERT INTO clan_world_log (kind, tile_id, clan_id, other_id, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    kind,
    tileId,
    clanId,
    otherId,
    amount,
    now,
  );
}

function put(db: Database, tileId: number, clanId: number, hp: number, shieldUntil: number, capital: boolean, now: number): void {
  db.prepare(
    `INSERT INTO clan_world_tiles (tile_id, clan_id, hp, hp_at, shield_until, capital, since) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tile_id) DO UPDATE SET clan_id = excluded.clan_id, hp = excluded.hp, hp_at = excluded.hp_at,
       shield_until = excluded.shield_until, capital = excluded.capital, since = excluded.since`,
  ).run(tileId, clanId, Math.round(hp), now, shieldUntil, capital ? 1 : 0, now);
}

interface Actor {
  clanId: number;
  clanName: string;
}

/** Действовать на карте могут лидер и офицеры клана с достаточным составом */
function actor(db: Database, userId: number): WorldResult<Actor> {
  const m = db.prepare("SELECT m.clan_id, m.role, c.name FROM clan_members m JOIN clans c ON c.id = m.clan_id WHERE m.user_id = ?").get(userId);
  if (!m) return fail("Вы не состоите в клане");
  if (str(m.role) === "member") return fail("Действовать на карте могут лидер и офицеры");
  const clanId = num(m.clan_id);
  const members = num(db.prepare("SELECT COUNT(*) AS n FROM clan_members WHERE clan_id = ?").get(clanId)?.n);
  if (members < MIN_WORLD_MEMBERS) return fail(`Для борьбы за земли нужно минимум ${MIN_WORLD_MEMBERS} игрока в клане`);
  return { ok: true, value: { clanId, clanName: str(m.name) } };
}

const validTile = (id: unknown): number | null => {
  const n = Number(id);
  return Number.isInteger(n) && n >= 0 && n < buildWorld().tiles.length ? n : null;
};

const touchesOwn = (db: Database, tileId: number, clanId: number): boolean => {
  const ids = buildWorld().tiles[tileId].neighbors;
  if (!ids.length) return false;
  const rows = db.prepare(`SELECT 1 FROM clan_world_tiles WHERE clan_id = ? AND tile_id IN (${ids.map(() => "?").join(",")}) LIMIT 1`).get(clanId, ...ids);
  return !!rows;
};

/** Основать столицу на окраине: первая клетка клана, бесплатно */
export function foundCapital(db: Database, userId: number, tileInput: unknown, now = Date.now()): WorldResult {
  return transaction(db, (): WorldResult => {
    const a = actor(db, userId);
    if (!a.ok) return a;
    const tileId = validTile(tileInput);
    if (tileId === null) return fail("Нет такой клетки");
    if (ownedCount(db, a.value.clanId) > 0) return fail("У клана уже есть земли");
    if (!buildWorld().tiles[tileId].spawn) return fail("Столицу можно основать только на окраинах карты");
    if (rowOf(db, tileId, now)) return fail("Клетка уже занята");
    put(db, tileId, a.value.clanId, CAPITAL_HP, now + SHIELD_CAPITAL_MS, true, now);
    feed(db, "found", tileId, a.value.clanId, 0, 0, now);
    logEvent(db, a.value.clanId, userId, "world_found", 0, { tileId }, now);
    return { ok: true, value: null };
  });
}

/** Занять свободную клетку рядом с уже своей за влияние */
export function claimTile(db: Database, userId: number, tileInput: unknown, now = Date.now()): WorldResult<{ cost: number }> {
  return transaction(db, (): WorldResult<{ cost: number }> => {
    const a = actor(db, userId);
    if (!a.ok) return a;
    const tileId = validTile(tileInput);
    if (tileId === null) return fail("Нет такой клетки");
    const tile = buildWorld().tiles[tileId];
    const { clanId } = a.value;
    const owned = ownedCount(db, clanId);
    if (owned === 0) return fail("Сначала основайте столицу на окраине");
    if (rowOf(db, tileId, now)) return fail("Клетка уже занята");
    if (!touchesOwn(db, tileId, clanId)) return fail("Занимать можно только клетки рядом с вашими землями");
    const cost = claimCost(tile.tier, owned);
    const season = currentSeason(now);
    const inf = influenceOf(db, clanId, now);
    if (inf.available < cost) return fail(`Не хватает влияния: нужно ${cost}, есть ${inf.available}`);
    spend(db, clanId, season, cost);
    put(db, tileId, clanId, tile.maxHp * CLAIM_START_HP, now + SHIELD_CLAIM_MS, false, now);
    feed(db, "claim", tileId, clanId, 0, cost, now);
    logEvent(db, clanId, userId, "world_claim", cost, { tileId }, now);
    return { ok: true, value: { cost } };
  });
}

/** Укрепить свою клетку: влияние превращается в прочность */
export function fortifyTile(db: Database, userId: number, tileInput: unknown, amountInput: unknown, now = Date.now()): WorldResult<{ spent: number }> {
  return transaction(db, (): WorldResult<{ spent: number }> => {
    const a = actor(db, userId);
    if (!a.ok) return a;
    const tileId = validTile(tileInput);
    if (tileId === null) return fail("Нет такой клетки");
    const row = rowOf(db, tileId, now);
    if (!row || row.clanId !== a.value.clanId) return fail("Это не ваша клетка");
    const max = maxHpOf(tileId, row.capital);
    const missing = max - row.hp;
    if (missing <= 0) return fail("Клетка уже на полной прочности");
    const want = Math.floor(Number(amountInput));
    if (!Number.isFinite(want) || want < MIN_ACTION) return fail(`Минимум ${MIN_ACTION} влияния`);
    const inf = influenceOf(db, a.value.clanId, now);
    const spent = Math.min(want, missing, inf.available);
    if (spent < MIN_ACTION && spent < missing) return fail("Не хватает влияния");
    if (spent <= 0) return fail("Не хватает влияния");
    spend(db, a.value.clanId, currentSeason(now), spent);
    db.prepare("UPDATE clan_world_tiles SET hp = ?, hp_at = ? WHERE tile_id = ?").run(row.hp + spent, now, tileId);
    feed(db, "fortify", tileId, a.value.clanId, 0, spent, now);
    return { ok: true, value: { spent } };
  });
}

/** Осада чужой клетки соседнего владения. Если прочность падает до нуля — клетка переходит атакующему */
export function attackTile(
  db: Database,
  userId: number,
  tileInput: unknown,
  amountInput: unknown,
  now = Date.now(),
): WorldResult<{ spent: number; captured: boolean; hpLeft: number }> {
  return transaction(db, (): WorldResult<{ spent: number; captured: boolean; hpLeft: number }> => {
    const a = actor(db, userId);
    if (!a.ok) return a;
    const tileId = validTile(tileInput);
    if (tileId === null) return fail("Нет такой клетки");
    const { clanId } = a.value;
    const row = rowOf(db, tileId, now);
    if (!row) return fail("Клетка свободна: её можно занять");
    if (row.clanId === clanId) return fail("Это ваша клетка");
    if (row.shieldUntil > now) return fail("Клетка под щитом");
    if (!touchesOwn(db, tileId, clanId)) return fail("Атаковать можно только клетки рядом с вашими землями");
    const want = Math.floor(Number(amountInput));
    if (!Number.isFinite(want) || want < MIN_ATTACK) return fail(`Минимум ${MIN_ATTACK} влияния на осаду`);
    const inf = influenceOf(db, clanId, now);
    if (inf.available < MIN_ATTACK) return fail("Не хватает влияния");
    const spent = Math.min(want, inf.available, Math.ceil(row.hp));
    spend(db, clanId, currentSeason(now), spent);
    const left = row.hp - spent;
    if (left > 0) {
      db.prepare("UPDATE clan_world_tiles SET hp = ?, hp_at = ? WHERE tile_id = ?").run(Math.round(left), now, tileId);
      feed(db, "siege", tileId, clanId, row.clanId, spent, now);
      return { ok: true, value: { spent, captured: false, hpLeft: Math.round(left) } };
    }
    const tile = buildWorld().tiles[tileId];
    const shield = row.capital ? SHIELD_CAPITAL_MS : SHIELD_CAPTURE_MS;
    put(db, tileId, clanId, tile.maxHp * CAPTURE_START_HP, now + shield, false, now);
    feed(db, row.capital ? "fall" : "capture", tileId, clanId, row.clanId, spent, now);
    logEvent(db, clanId, userId, "world_capture", spent, { tileId, from: row.clanId }, now);
    logEvent(db, row.clanId, null, "world_lost", spent, { tileId, by: clanId }, now);
    return { ok: true, value: { spent, captured: true, hpLeft: Math.round(tile.maxHp * CAPTURE_START_HP) } };
  });
}

/* ------------------------------ Итоги недели --------------------------- */

export interface WorldRow {
  rank: number;
  clanId: number;
  name: string;
  tag: string;
  tiles: number;
  score: number;
  tribute: number;
}

/** Рейтинг владений: очки за клетки, потом число клеток, потом возраст владений */
export function worldStandings(db: Database): WorldRow[] {
  sweepOrphans(db);
  const world = buildWorld();
  const rows = db
    .prepare("SELECT t.tile_id, t.clan_id, t.since, c.name, c.tag FROM clan_world_tiles t JOIN clans c ON c.id = t.clan_id")
    .all();
  const by = new Map<number, WorldRow & { oldest: number }>();
  for (const r of rows) {
    const id = num(r.clan_id);
    const tier = world.tiles[num(r.tile_id)]?.tier ?? 1;
    const cur = by.get(id) ?? { rank: 0, clanId: id, name: str(r.name), tag: str(r.tag), tiles: 0, score: 0, tribute: 0, oldest: Infinity };
    cur.tiles += 1;
    cur.score += TILE_SCORE[tier];
    cur.tribute += TILE_TRIBUTE[tier];
    cur.oldest = Math.min(cur.oldest, num(r.since));
    by.set(id, cur);
  }
  return [...by.values()]
    .sort((x, y) => y.score - x.score || y.tiles - x.tiles || x.oldest - y.oldest || x.clanId - y.clanId)
    .map(({ oldest, ...rest }, i) => {
      void oldest;
      return { ...rest, rank: i + 1 };
    });
}

function settleWorldWeek(db: Database, season: string, now: number): void {
  const done = db.prepare("INSERT OR IGNORE INTO clan_world_seasons (season, settled_at) VALUES (?, ?)").run(season, now);
  if (!num((done as { changes?: number }).changes)) return;
  for (const row of worldStandings(db)) {
    const reward = worldRewardForRank(row.rank);
    if (!reward) continue;
    const treasury = reward.treasuryAc + row.tribute;
    db.prepare("INSERT OR REPLACE INTO clan_world_results (season, clan_id, rank, tiles, score, treasury_ac, trophies) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      season,
      row.clanId,
      row.rank,
      row.tiles,
      row.score,
      treasury,
      reward.trophies,
    );
    db.prepare("UPDATE clans SET treasury = treasury + ?, trophies = trophies + ? WHERE id = ?").run(treasury, reward.trophies, row.clanId);
    for (const m of memberGains(db, row.clanId, season)) {
      if (!m.active || m.gain < MIN_MEMBER_GAIN) continue;
      queueGrant(
        db,
        m.userId,
        {
          ac: reward.memberAc,
          note: `Награда карты мира (${reward.label})`,
          notice: `Карта мира: ${row.rank} место, ${row.tiles} земель — +${reward.memberAc} AC`,
        },
        now,
      );
      if (reward.titleId) {
        db.prepare("INSERT OR IGNORE INTO clan_world_prizes (season, user_id, title_id, claimed_at) VALUES (?, ?, ?, 0)").run(season, m.userId, reward.titleId);
      }
    }
    logEvent(db, row.clanId, null, "world_season", row.rank, { season, tiles: row.tiles, score: row.score, treasury }, now);
  }
}

/** Подвести итоги прошедших недель карты; безопасно вызывать многократно */
export function settleWorld(db: Database, now = Date.now()): number {
  return transaction(db, () => {
    const current = currentSeason(now);
    const last = db.prepare("SELECT MAX(season) AS s FROM clan_world_seasons").get();
    // Карта стартует с текущей недели: прошлые недели без владений итогов не дают
    let season = str(last?.s) ? nextSeason(str(last?.s)) : prevSeason(current);
    let count = 0;
    while (seasonEnd(season) <= now && count < 4) {
      settleWorldWeek(db, season, now);
      season = nextSeason(season);
      count += 1;
    }
    return count;
  });
}

/** Титулы за итоги недели, которые игрок ещё не забрал; клиент выдаёт их себе в профиль */
export function claimWorldPrizes(db: Database, userId: number, now = Date.now()): string[] {
  return transaction(db, () => {
    const rows = db.prepare("SELECT season, title_id FROM clan_world_prizes WHERE user_id = ? AND claimed_at = 0").all(userId);
    for (const r of rows) {
      db.prepare("UPDATE clan_world_prizes SET claimed_at = ? WHERE season = ? AND user_id = ? AND title_id = ?").run(now, str(r.season), userId, str(r.title_id));
    }
    return [...new Set(rows.map((r) => str(r.title_id)))];
  });
}

export function worldFeed(db: Database, limit = 30): { id: number; kind: string; tileId: number; clanId: number; otherId: number; amount: number; at: number; clan: string; other: string }[] {
  return db
    .prepare(
      `SELECT l.id, l.kind, l.tile_id, l.clan_id, l.other_id, l.amount, l.created_at,
              COALESCE(a.name, '—') AS clan, COALESCE(b.name, '') AS other
       FROM clan_world_log l LEFT JOIN clans a ON a.id = l.clan_id LEFT JOIN clans b ON b.id = l.other_id
       ORDER BY l.id DESC LIMIT ?`,
    )
    .all(limit)
    .map((r) => ({
      id: num(r.id),
      kind: str(r.kind),
      tileId: num(r.tile_id),
      clanId: num(r.clan_id),
      otherId: num(r.other_id),
      amount: num(r.amount),
      at: num(r.created_at),
      clan: str(r.clan),
      other: str(r.other),
    }));
}
