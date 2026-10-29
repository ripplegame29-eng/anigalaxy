/**
 * Клановая карточная война (в духе Clash of Clans).
 *
 * Клан ищет соперника своего размера (или сражается с отрядом-соперником от сервера).
 * Две стороны выставляют лучших бойцов с собранной колодой; их колоды на начало боя
 * замораживаются как «защита». У каждого бойца по 2 атаки по базам соперника:
 *   • победа = 1–3 звезды (победа, ≤ 8 раундов, без потерь), на базу считается лучший результат;
 *   • поражение атакующего = очко защитнику.
 * Очки клана = звёзды на базах соперника + отбитые нападения. Больше очков — победа.
 */

import { seeded, simulate, type BattleOutcome, type Unit } from "../cards/battle";
import { FAST_ROUNDS } from "../cards/campaign";
import { cardDef } from "../cards/catalog";
import { CW, type CwAttackView, type CwHistoryRow, type CwSideView, type CwSlotView, type CwState, type CwWarView, type WarPhase } from "../cards/clanwar";
import { DECK_SIZE } from "../cards/config";
import type { Reward } from "../cards/progress";
import { fail, getWallet, grantReward, type Res, type Rng } from "./cards";
import { botSquad, deckUnits, prepareSides, saveBattle, type BattleReport } from "./cards-battle";
import { track } from "./cards-extra";
import { clanIdOfUser, clanMembers, getClan, logEvent as clanLog } from "./clans";
import { addNotification } from "./social";
import { num, str, transaction, type Database } from "./sqlite";

const power = (units: Unit[]): number => Math.round(units.reduce((a, u) => a + u.atk + u.def * 0.8 + u.maxHp / 6, 0));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface WarRow {
  id: number;
  a: number;
  b: number;
  bot: string;
  size: number;
  status: string;
  prepUntil: number;
  endsAt: number;
  scoreA: number;
  scoreB: number;
  starsA: number;
  starsB: number;
  winner: number;
  settledAt: number;
}
const toWar = (r: Record<string, unknown>): WarRow => ({
  id: num(r.id),
  a: num(r.clan_a),
  b: num(r.clan_b),
  bot: str(r.bot_name),
  size: num(r.size),
  status: str(r.status),
  prepUntil: num(r.prep_until),
  endsAt: num(r.ends_at),
  scoreA: num(r.score_a),
  scoreB: num(r.score_b),
  starsA: num(r.stars_a),
  starsB: num(r.stars_b),
  winner: num(r.winner),
  settledAt: num(r.settled_at),
});

const phaseOf = (w: WarRow, now: number): WarPhase => (w.status === "done" ? "done" : now < w.prepUntil ? "prep" : "battle");

function currentWar(db: Database, clanId: number): WarRow | null {
  const r = db.prepare("SELECT * FROM clan_cw WHERE (clan_a = ? OR clan_b = ?) AND status != 'done' ORDER BY id DESC LIMIT 1").get(clanId, clanId);
  return r ? toWar(r) : null;
}

/* ------------------------------ Подготовка и поиск ------------------------ */

interface Candidate {
  userId: number;
  nick: string;
  units: Unit[];
  power: number;
}

function roster(db: Database, clanId: number): Candidate[] {
  const out: Candidate[] = [];
  for (const m of clanMembers(db, clanId)) {
    const units = deckUnits(db, m.userId, "b");
    if (units) out.push({ userId: m.userId, nick: m.nickname, units, power: power(units) });
  }
  return out.sort((x, y) => y.power - x.power);
}

function insertSlots(db: Database, warId: number, clanId: number, list: Candidate[]): void {
  list.forEach((c, i) => {
    db.prepare("INSERT INTO clan_cw_slots (war_id, clan_id, pos, user_id, nick, power, units) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      warId,
      clanId,
      i + 1,
      c.userId,
      c.nick,
      c.power,
      JSON.stringify(c.units),
    );
  });
}

function startWar(db: Database, a: number, b: number, size: number, bot: string, now: number, rng: Rng): number | null {
  const ra = roster(db, a).slice(0, size);
  if (ra.length < size) return null;
  let rb: Candidate[];
  if (b) {
    rb = roster(db, b).slice(0, size);
    if (rb.length < size) return null;
  } else {
    // отряды-соперники подбираются под силу вашего состава: от слабых баз к сильным
    const avg = ra.reduce((s, c) => s + c.power, 0) / ra.length;
    const rating = clamp(Math.round(850 + avg / 12), 800, 2200);
    rb = ra.map((_, i) => {
      const units = botSquad(clamp(rating - 60 + Math.round((1 - i / Math.max(1, size - 1)) * 160), 700, 2300), rng);
      return { userId: 0, nick: `${bot} · ${i + 1}`, units, power: power(units) };
    });
    rb.sort((x, y) => y.power - x.power);
  }
  const info = db
    .prepare("INSERT INTO clan_cw (clan_a, clan_b, bot_name, size, status, prep_until, ends_at, created_at) VALUES (?, ?, ?, ?, 'prep', ?, ?, ?)")
    .run(a, b, bot, size, now + CW.prepMs, now + CW.prepMs + CW.battleMs, now);
  const id = num(info.lastInsertRowid);
  insertSlots(db, id, a, ra);
  if (b) insertSlots(db, id, b, rb);
  else
    rb.forEach((c, i) =>
      db
        .prepare("INSERT INTO clan_cw_slots (war_id, clan_id, pos, user_id, nick, power, units) VALUES (?, 0, ?, 0, ?, ?, ?)")
        .run(id, i + 1, c.nick, c.power, JSON.stringify(c.units)),
    );
  clanLog(db, a, null, "war_found", size, { war: id, bot: !b }, now);
  if (b) clanLog(db, b, null, "war_found", size, { war: id }, now);
  return id;
}

function manageGuard(db: Database, userId: number): Res<number> {
  const clanId = clanIdOfUser(db, userId);
  if (clanId === null) return fail("Вы не состоите в клане");
  const role = str(db.prepare("SELECT role FROM clan_members WHERE user_id = ?").get(userId)?.role);
  if (role !== "leader" && role !== "officer") return fail("Начинать войну могут глава и офицеры");
  return { ok: true, value: clanId };
}

/** Встать в очередь поиска (если соперник уже ждёт — война начинается сразу) */
export function cwSearch(db: Database, userId: number, sizeIn: number, now = Date.now(), rng: Rng = Math.random): Res<{ started: boolean }> {
  const size = Math.floor(sizeIn);
  if (!(CW.sizes as readonly number[]).includes(size)) return fail("Недоступный размер войны");
  return transaction(db, (): Res<{ started: boolean }> => {
    const g = manageGuard(db, userId);
    if (!g.ok) return g;
    const clanId = g.value;
    cwSettle(db, now);
    if (currentWar(db, clanId)) return fail("Клан уже в войне");
    const eligible = roster(db, clanId).length;
    if (eligible < size) return fail(`Для войны ${size} на ${size} нужно ${size} бойцов с собранным отрядом (сейчас ${eligible})`);
    const clan = getClan(db, clanId)!;
    const rival = db
      .prepare("SELECT clan_id, trophies FROM clan_cw_queue WHERE size = ? AND clan_id != ? ORDER BY ABS(trophies - ?) ASC, created_at ASC")
      .all(size, clanId, clan.trophies)
      .find((q) => roster(db, num(q.clan_id)).length >= size);
    if (rival) {
      db.prepare("DELETE FROM clan_cw_queue WHERE clan_id IN (?, ?)").run(clanId, num(rival.clan_id));
      const id = startWar(db, clanId, num(rival.clan_id), size, "", now, rng);
      return id ? { ok: true, value: { started: true } } : fail("Не удалось начать войну");
    }
    db.prepare("INSERT OR REPLACE INTO clan_cw_queue (clan_id, size, trophies, created_at) VALUES (?, ?, ?, ?)").run(clanId, size, clan.trophies, now);
    return { ok: true, value: { started: false } };
  });
}

export function cwCancelSearch(db: Database, userId: number): Res<true> {
  const g = manageGuard(db, userId);
  if (!g.ok) return g;
  db.prepare("DELETE FROM clan_cw_queue WHERE clan_id = ?").run(g.value);
  return { ok: true, value: true };
}

/** Начать сразу против отряда-соперника от сервера (если не хочется ждать) */
export function cwVsBot(db: Database, userId: number, sizeIn: number, now = Date.now(), rng: Rng = Math.random): Res<true> {
  const size = Math.floor(sizeIn);
  if (!(CW.sizes as readonly number[]).includes(size)) return fail("Недоступный размер войны");
  return transaction(db, (): Res<true> => {
    const g = manageGuard(db, userId);
    if (!g.ok) return g;
    cwSettle(db, now);
    if (currentWar(db, g.value)) return fail("Клан уже в войне");
    const eligible = roster(db, g.value).length;
    if (eligible < size) return fail(`Нужно ${size} бойцов с собранным отрядом (сейчас ${eligible})`);
    db.prepare("DELETE FROM clan_cw_queue WHERE clan_id = ?").run(g.value);
    const name = CW.botNames[Math.floor(rng() * CW.botNames.length)];
    return startWar(db, g.value, 0, size, name, now, rng) ? { ok: true, value: true } : fail("Не удалось начать войну");
  });
}

/* ------------------------------ Ход войны ---------------------------------- */

/** Перейти от подготовки к бою: защита обновляется текущими колодами участников */
function activate(db: Database, w: WarRow, now: number): void {
  if (w.status !== "prep" || now < w.prepUntil) return;
  db.prepare("UPDATE clan_cw SET status = 'battle' WHERE id = ?").run(w.id);
  const slots = db.prepare("SELECT clan_id, pos, user_id FROM clan_cw_slots WHERE war_id = ? AND user_id != 0").all(w.id);
  for (const s of slots) {
    const units = deckUnits(db, num(s.user_id), "b");
    if (units) db.prepare("UPDATE clan_cw_slots SET units = ?, power = ? WHERE war_id = ? AND clan_id = ? AND pos = ?").run(JSON.stringify(units), power(units), w.id, num(s.clan_id), num(s.pos));
  }
}

function scoresOf(db: Database, w: WarRow): { a: { score: number; stars: number; def: number }; b: { score: number; stars: number; def: number } } {
  const side = (clan: number, foe: number) => {
    const stars = num(
      db
        .prepare("SELECT COALESCE(SUM(best), 0) AS n FROM (SELECT MAX(stars) AS best FROM clan_cw_attacks WHERE war_id = ? AND clan_id = ? AND win = 1 GROUP BY target_pos)")
        .get(w.id, clan)?.n,
    );
    const def = num(db.prepare("SELECT COUNT(*) AS n FROM clan_cw_attacks WHERE war_id = ? AND clan_id = ? AND win = 0").get(w.id, foe)?.n);
    return { score: stars + def * CW.defensePoint, stars, def };
  };
  return { a: side(w.a, w.b), b: side(w.b, w.a) };
}

function refreshScores(db: Database, w: WarRow): void {
  const s = scoresOf(db, w);
  db.prepare("UPDATE clan_cw SET score_a = ?, score_b = ?, stars_a = ?, stars_b = ? WHERE id = ?").run(s.a.score, s.b.score, s.a.stars, s.b.stars, w.id);
}

const sideKey = (w: WarRow, clanId: number): number => (clanId === w.a ? w.a : w.b);

/** Атаковать базу соперника: нападает текущий отряд бойца, защищается замороженный */
export function cwAttack(db: Database, userId: number, targetPos: number, now = Date.now(), rng: Rng = Math.random): Res<BattleReport> {
  return transaction(db, (): Res<BattleReport> => {
    const clanId = clanIdOfUser(db, userId);
    if (clanId === null) return fail("Вы не состоите в клане");
    const w = currentWar(db, clanId);
    if (!w) return fail("Клан сейчас не воюет");
    activate(db, w, now);
    const fresh = toWar(db.prepare("SELECT * FROM clan_cw WHERE id = ?").get(w.id)!);
    const phase = phaseOf(fresh, now);
    if (phase === "prep") return fail("Идёт подготовка — бой начнётся позже");
    if (now >= fresh.endsAt) {
      cwSettle(db, now);
      return fail("Война завершена");
    }
    const mine = db.prepare("SELECT * FROM clan_cw_slots WHERE war_id = ? AND clan_id = ? AND user_id = ?").get(w.id, clanId, userId);
    if (!mine) return fail("Вы не участвуете в этой войне");
    if (num(mine.attacks) >= CW.attacksEach) return fail("Атаки закончились");
    const foeClan = clanId === fresh.a ? fresh.b : fresh.a;
    const target = db.prepare("SELECT * FROM clan_cw_slots WHERE war_id = ? AND clan_id = ? AND pos = ?").get(w.id, foeClan, Math.floor(targetPos));
    if (!target) return fail("База не найдена");
    if (db.prepare("SELECT 1 FROM clan_cw_attacks WHERE war_id = ? AND user_id = ? AND target_pos = ? AND clan_id = ?").get(w.id, userId, num(target.pos), clanId))
      return fail("Эту базу вы уже атаковали");
    const myUnits = deckUnits(db, userId, "a");
    if (!myUnits) return fail(`Соберите колоду из ${DECK_SIZE} карт`);
    let foeUnits: Unit[];
    try {
      foeUnits = (JSON.parse(str(target.units)) as Unit[]).map((u, i) => ({ ...u, side: "b" as const, slot: i, key: `b${i}`, hp: u.maxHp }));
    } catch {
      return fail("База повреждена");
    }
    const sides = prepareSides(myUnits, foeUnits, now);
    const outcome: BattleOutcome = simulate(sides.you, sides.foe, rng);
    const win = outcome.winner === "a";
    const lost = outcome.a.filter((u) => u.hp <= 0).length;
    const stars = win ? 1 + (outcome.rounds <= FAST_ROUNDS ? 1 : 0) + (lost === 0 ? 1 : 0) : 0;
    const nick = str(db.prepare("SELECT nickname FROM users WHERE id = ?").get(userId)?.nickname, "Игрок");

    db.prepare("INSERT INTO clan_cw_attacks (war_id, clan_id, user_id, nick, target_pos, stars, win, rounds, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      w.id,
      clanId,
      userId,
      nick,
      num(target.pos),
      stars,
      win ? 1 : 0,
      outcome.rounds,
      now,
    );
    db.prepare("UPDATE clan_cw_slots SET attacks = attacks + 1 WHERE war_id = ? AND clan_id = ? AND pos = ?").run(w.id, clanId, num(mine.pos));
    refreshScores(db, fresh);

    getWallet(db, userId, now);
    const reward: Reward = { dust: (CW.perStar.dust ?? 0) * stars, diamonds: (CW.perStar.diamonds ?? 0) * stars };
    if (stars > 0) grantReward(db, userId, reward);
    track(db, userId, "cwAttacks", 1, now);
    if (stars > 0) track(db, userId, "cwStars", stars, now);

    const foeName = str(target.nick);
    const report: BattleReport = {
      outcome,
      you: sides.you,
      foe: sides.foe,
      youSyn: sides.youSyn,
      foeSyn: sides.foeSyn,
      foeName,
      foeRating: 0,
      pvp: num(target.user_id) !== 0,
      win,
      reward: { diamonds: reward.diamonds ?? 0, dust: reward.dust ?? 0, rating: 0, scroll: 0 },
      rating: 0,
      energy: 0,
      training: false,
      title: `Война кланов · база №${num(target.pos)}`,
      campaign: { chapter: -1, stage: num(target.pos), stars, best: stars, newStars: stars, firstClear: false, reward },
    };
    saveBattle(db, userId, { kind: "clanwar", opp: foeName, win, delta: 0, title: report.title ?? "", report }, now);
    const defenderId = num(target.user_id);
    if (defenderId) {
      saveBattle(db, defenderId, { kind: "defense", opp: nick, win: !win, delta: 0, title: `Война кланов: ${nick} напал(а) на вашу базу`, report: { ...report, win: !win, foeName: nick, title: `Война кланов: ${nick} напал(а) на вашу базу` } }, now);
    }
    clanLog(db, clanId, userId, win ? "war_hit" : "war_miss", stars, { war: w.id, target: num(target.pos) }, now);

    // все атаки израсходованы — война заканчивается досрочно
    const open = num(db.prepare("SELECT COUNT(*) AS n FROM clan_cw_slots WHERE war_id = ? AND user_id != 0 AND attacks < ?").get(w.id, CW.attacksEach)?.n);
    if (open === 0) settleOne(db, toWar(db.prepare("SELECT * FROM clan_cw WHERE id = ?").get(w.id)!), now, rng);
    return { ok: true, value: report };
  });
}

/* ---------------------------------- Итоги ---------------------------------- */

function settleOne(db: Database, w: WarRow, now: number, rng: Rng = Math.random): void {
  if (w.status === "done") return;
  refreshScores(db, w);
  const fresh = toWar(db.prepare("SELECT * FROM clan_cw WHERE id = ?").get(w.id)!);
  let winner = 0;
  if (fresh.scoreA !== fresh.scoreB) winner = fresh.scoreA > fresh.scoreB ? fresh.a : fresh.b;
  else if (fresh.starsA !== fresh.starsB) winner = fresh.starsA > fresh.starsB ? fresh.a : fresh.b;
  void rng;
  db.prepare("UPDATE clan_cw SET status = 'done', winner = ?, settled_at = ? WHERE id = ?").run(winner, now, w.id);
  for (const clanId of [fresh.a, fresh.b]) {
    if (!clanId) continue;
    const res = winner === 0 ? "draw" : winner === clanId ? "win" : "lose";
    const tr = CW.trophies[res];
    const xp = CW.clanXp[res];
    db.prepare("UPDATE clans SET trophies = MAX(0, trophies + ?), xp = xp + ?, prestige = prestige + ? WHERE id = ?").run(tr, xp, res === "win" ? 1 : 0, clanId);
    clanLog(db, clanId, null, res === "win" ? "war_won" : res === "lose" ? "war_lost" : "war_draw", tr, { war: w.id }, now);
    const reward = res === "win" ? CW.memberWin : res === "lose" ? CW.memberLose : CW.memberDraw;
    // лучший боец: больше звёзд, затем меньше потраченных атак
    const best = db
      .prepare(
        "SELECT user_id, SUM(stars) AS st, COUNT(*) AS n FROM clan_cw_attacks WHERE war_id = ? AND clan_id = ? GROUP BY user_id ORDER BY st DESC, n ASC LIMIT 1",
      )
      .get(w.id, clanId);
    const mvp = best && num(best.st) > 0 ? num(best.user_id) : 0;
    for (const s of db.prepare("SELECT user_id, attacks FROM clan_cw_slots WHERE war_id = ? AND clan_id = ? AND user_id != 0").all(w.id, clanId)) {
      const uid = num(s.user_id);
      if (num(s.attacks) === 0 && res !== "win") continue; // не воевал — без утешительных наград
      getWallet(db, uid, now);
      grantReward(db, uid, reward);
      if (uid === mvp) grantReward(db, uid, CW.mvp);
      if (res === "win") track(db, uid, "cwWins", 1, now);
      addNotification(db, uid, "clan_war_end", { war: w.id, result: res, mvp: uid === mvp }, now);
    }
  }
}

/** Завершить просроченные войны и убрать устаревшие очереди */
export function cwSettle(db: Database, now = Date.now()): number {
  const due = db.prepare("SELECT * FROM clan_cw WHERE status != 'done' AND ends_at <= ?").all(now).map(toWar);
  for (const w of due) transaction(db, () => settleOne(db, w, now));
  db.prepare("DELETE FROM clan_cw_queue WHERE created_at < ?").run(now - 24 * 3_600_000);
  return due.length;
}

/* ---------------------------------- Состояние ------------------------------ */

function sideView(db: Database, w: WarRow, clanId: number, foeClanId: number, userId: number, reveal: boolean): CwSideView {
  const clan = clanId ? getClan(db, clanId) : null;
  const sc = scoresOf(db, w);
  const mine = clanId === w.a ? sc.a : sc.b;
  const slots: CwSlotView[] = db
    .prepare("SELECT * FROM clan_cw_slots WHERE war_id = ? AND clan_id = ? ORDER BY pos")
    .all(w.id, clanId)
    .map((s) => {
      const pos = num(s.pos);
      // звёзды на этой базе добывает соперник
      const stars = num(db.prepare("SELECT COALESCE(MAX(stars), 0) AS n FROM clan_cw_attacks WHERE war_id = ? AND clan_id = ? AND target_pos = ? AND win = 1").get(w.id, foeClanId, pos)?.n);
      const held = num(db.prepare("SELECT COUNT(*) AS n FROM clan_cw_attacks WHERE war_id = ? AND clan_id = ? AND target_pos = ? AND win = 0").get(w.id, foeClanId, pos)?.n);
      let units: { cardId: string; level: number; rank: number }[] = [];
      if (reveal) {
        try {
          units = (JSON.parse(str(s.units)) as Unit[]).map((u) => ({ cardId: u.cardId, level: u.level, rank: cardDef(u.cardId)?.rank ?? u.rank }));
        } catch {
          units = [];
        }
      }
      return { pos, userId: num(s.user_id), nick: str(s.nick), power: num(s.power), attacks: num(s.attacks), stars, held, units, isMe: num(s.user_id) === userId };
    });
  return {
    clanId,
    name: clan ? clan.name : w.bot || "Соперник",
    tag: clan ? clan.tag : "BOT",
    score: mine.score,
    stars: mine.stars,
    defense: mine.def,
    slots,
  };
}

export function cwState(db: Database, userId: number, now = Date.now()): CwState | null {
  cwSettle(db, now);
  const clanId = clanIdOfUser(db, userId);
  if (clanId === null) return null;
  const clan = getClan(db, clanId)!;
  const role = str(db.prepare("SELECT role FROM clan_members WHERE user_id = ?").get(userId)?.role, "member");
  const q = db.prepare("SELECT size, created_at FROM clan_cw_queue WHERE clan_id = ?").get(clanId);
  let war: CwWarView | null = null;
  let row = currentWar(db, clanId);
  if (row) {
    activate(db, row, now);
    row = toWar(db.prepare("SELECT * FROM clan_cw WHERE id = ?").get(row.id)!);
    const foeId = clanId === row.a ? row.b : row.a;
    const log: CwAttackView[] = db
      .prepare("SELECT * FROM clan_cw_attacks WHERE war_id = ? ORDER BY id DESC LIMIT 30")
      .all(row.id)
      .map((a) => ({ id: num(a.id), clanId: num(a.clan_id), nick: str(a.nick), targetPos: num(a.target_pos), stars: num(a.stars), win: num(a.win) === 1, at: num(a.created_at) }));
    const mineSlot = db.prepare("SELECT pos, attacks FROM clan_cw_slots WHERE war_id = ? AND clan_id = ? AND user_id = ?").get(row.id, clanId, userId);
    const attacked = db
      .prepare("SELECT target_pos FROM clan_cw_attacks WHERE war_id = ? AND clan_id = ? AND user_id = ?")
      .all(row.id, clanId, userId)
      .map((a) => num(a.target_pos));
    war = {
      id: row.id,
      size: row.size,
      phase: phaseOf(row, now),
      bot: row.b === 0,
      prepUntil: row.prepUntil,
      endsAt: row.endsAt,
      mine: sideView(db, row, clanId, foeId, userId, true),
      foe: sideView(db, row, foeId, clanId, userId, true),
      me: mineSlot ? { pos: num(mineSlot.pos), attacksLeft: CW.attacksEach - num(mineSlot.attacks), attacked } : null,
      log,
    };
  }
  const history: CwHistoryRow[] = db
    .prepare("SELECT * FROM clan_cw WHERE status = 'done' AND (clan_a = ? OR clan_b = ?) ORDER BY id DESC LIMIT 8")
    .all(clanId, clanId)
    .map(toWar)
    .map((w) => {
      const meA = w.a === clanId;
      const foeId = meA ? w.b : w.a;
      return {
        id: w.id,
        vsName: foeId ? (getClan(db, foeId)?.name ?? "Клан") : w.bot,
        bot: foeId === 0,
        size: w.size,
        scoreMine: meA ? w.scoreA : w.scoreB,
        scoreFoe: meA ? w.scoreB : w.scoreA,
        result: w.winner === 0 ? "draw" : w.winner === clanId ? "win" : "lose",
        at: w.settledAt,
      };
    });
  return {
    role,
    canManage: role === "leader" || role === "officer",
    trophies: clan.trophies,
    eligible: roster(db, clanId).length,
    sizes: [...CW.sizes],
    search: q ? { size: num(q.size), since: num(q.created_at) } : null,
    war,
    history,
  };
}

export { seeded as cwSeeded, sideKey };
