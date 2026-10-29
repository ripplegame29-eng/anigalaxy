/** Рейд-босс недели: общий запас здоровья, удары игроков, таблица урона и награды. */

import { simulate, type Unit } from "../cards/battle";
import { cardDef } from "../cards/catalog";
import { BATTLE, DECK_SIZE } from "../cards/config";
import { RAID, RAID_DEFEAT_REWARD, RAID_TIERS, raidBossId, type RaidView } from "../cards/raid";
import type { Reward } from "../cards/progress";
import { dayKey } from "./day";
import { fail, getWallet, grantReward, listInventory, logEvent, type Res, type Rng } from "./cards";
import { getExtra, rollWeek, setExtra, track, weekOf } from "./cards-extra";
import { prepareSides, saveBattle, unitOf, type BattleReport } from "./cards-battle";
import { num, str, transaction, type Database } from "./sqlite";

interface RaidRow {
  week: number;
  boss: string;
  maxHp: number;
  hp: number;
  defeatedAt: number;
}

/** Создаёт запись рейда недели при первом обращении: запас растёт с числом игроков */
function ensureRaid(db: Database, now: number): RaidRow {
  const week = weekOf(now);
  let row = db.prepare("SELECT * FROM card_raid WHERE week = ?").get(week);
  if (!row) {
    const players = num(db.prepare("SELECT COUNT(*) AS n FROM card_wallet WHERE deck != '[]'").get()?.n);
    const max = RAID.baseHp + RAID.perPlayerHp * players;
    db.prepare("INSERT OR IGNORE INTO card_raid (week, boss, max_hp, hp) VALUES (?, ?, ?, ?)").run(week, raidBossId(week), max, max);
    row = db.prepare("SELECT * FROM card_raid WHERE week = ?").get(week);
  }
  return { week, boss: str(row?.boss), maxHp: num(row?.max_hp), hp: num(row?.hp), defeatedAt: num(row?.defeated_at) };
}

export const raidEndsAt = (now: number): number => (weekOf(now) + 1) * 7 * 86_400_000 + 4 * 86_400_000;

export function raidView(db: Database, userId: number, now = Date.now()): RaidView {
  const r = ensureRaid(db, now);
  const x = rollWeek(getExtra(db, userId), now);
  const mine = db.prepare("SELECT damage, hits FROM card_raid_dmg WHERE week = ? AND user_id = ?").get(r.week, userId);
  const top = db
    .prepare("SELECT d.damage, d.hits, u.nickname FROM card_raid_dmg d JOIN users u ON u.id = d.user_id WHERE d.week = ? ORDER BY d.damage DESC LIMIT 10")
    .all(r.week)
    .map((t) => ({ nick: str(t.nickname), damage: num(t.damage), hits: num(t.hits) }));
  const today = dayKey(now);
  const used = x.raid.day === today ? x.raid.dayHits : 0;
  return {
    week: r.week,
    boss: r.boss,
    maxHp: r.maxHp,
    hp: r.hp,
    defeated: r.defeatedAt > 0,
    endsAt: raidEndsAt(now),
    hitsLeft: Math.max(0, RAID.dailyHits - used),
    fightHp: RAID.fightHp,
    mine: { damage: num(mine?.damage), hits: num(mine?.hits), claimed: x.raid.claimed },
    top,
    tiers: RAID_TIERS,
    defeatReward: RAID_DEFEAT_REWARD,
    defeatClaimed: x.raid.defeat,
  };
}

/**
 * Босс этой недели в виде бойца: сильнее героя, здоровье — запас на один бой.
 * Берём босса, записанного в рейд при его создании: список мифических героев мог
 * пополниться, и расчёт по неделе дал бы другого (на странице один, в бою — другой).
 */
export function raidBossUnit(week: number, bossId?: string): Unit | null {
  const u = unitOf({ cardId: bossId || raidBossId(week), level: 12, foil: true }, "b", 0);
  if (!u) return null;
  return { ...u, hp: RAID.fightHp, maxHp: RAID.fightHp, atk: Math.round(u.atk * RAID.atkMul), def: Math.round(u.def * RAID.defMul), passive: "p-flow" };
}

export function raidFight(db: Database, userId: number, now = Date.now(), rng: Rng = Math.random): Res<BattleReport> {
  return transaction(db, (): Res<BattleReport> => {
    const r = ensureRaid(db, now);
    const w = getWallet(db, userId, now);
    const x = rollWeek(getExtra(db, userId), now);
    const today = dayKey(now);
    if (x.raid.day !== today) {
      x.raid.day = today;
      x.raid.dayHits = 0;
    }
    if (x.raid.dayHits >= RAID.dailyHits) return fail("Попытки на сегодня закончились: завтра будут новые");
    if (r.hp <= 0) return fail("Босс уже повержен — заберите награду");
    if (w.energy < BATTLE.energyCost) return fail("Нет энергии — подождите или восстановите её");
    const inv = new Map(listInventory(db, userId).map((c) => [c.id, c]));
    const mine: Unit[] = [];
    w.deck.forEach((id, slot) => {
      const c = inv.get(id);
      const u = c ? unitOf(c, "a", slot) : null;
      if (u) mine.push(u);
    });
    if (mine.length < DECK_SIZE) return fail(`Соберите колоду из ${DECK_SIZE} карт`);
    const boss = raidBossUnit(r.week, r.boss);
    if (!boss) return fail("Босс недоступен");

    const side = prepareSides(mine, [boss], now);
    const outcome = simulate(side.you, side.foe, rng, { maxRounds: RAID.rounds });
    const left = Math.max(0, outcome.b[0]?.hp ?? boss.maxHp);
    const dealt = Math.min(r.hp, RAID.fightHp - left);
    const hp = Math.max(0, r.hp - dealt);
    db.prepare("UPDATE card_raid SET hp = ?, defeated_at = CASE WHEN ? <= 0 AND defeated_at = 0 THEN ? ELSE defeated_at END WHERE week = ?").run(hp, hp, now, r.week);
    db.prepare("INSERT INTO card_raid_dmg (week, user_id, damage, hits) VALUES (?, ?, ?, 1) ON CONFLICT(week, user_id) DO UPDATE SET damage = damage + excluded.damage, hits = hits + 1").run(r.week, userId, dealt);
    const energy = w.energy - BATTLE.energyCost;
    db.prepare("UPDATE card_wallet SET energy = ?, energy_at = CASE WHEN energy >= ? THEN ? ELSE energy_at END WHERE user_id = ?").run(energy, 10, now, userId);
    x.raid.dayHits += 1;
    x.raid.damage += dealt;
    x.raid.hits += 1;
    setExtra(db, userId, x);
    track(db, userId, "raid", dealt, now);
    track(db, userId, "raidHits", 1, now);
    const name = cardDef(boss.cardId)?.name ?? "Босс";
    const report: BattleReport = {
      outcome,
      you: side.you,
      foe: side.foe,
      youSyn: side.youSyn,
      foeSyn: side.foeSyn,
      foeName: `Рейд-босс: ${name}`,
      foeRating: 0,
      pvp: false,
      win: dealt >= RAID.fightHp * 0.5,
      reward: { diamonds: 0, dust: 0, rating: 0, scroll: 0 },
      rating: w.rating,
      energy,
      training: false,
      title: `Рейд-босс: ${name}`,
      raid: { damage: dealt, maxPerFight: RAID.fightHp, poolHp: hp, poolMax: r.maxHp, hitsLeft: RAID.dailyHits - x.raid.dayHits, defeated: hp <= 0 },
    };
    saveBattle(db, userId, { kind: "raid", opp: name, win: report.win, delta: dealt, title: `Рейд: ${dealt} урона по «${name}»`, report }, now);
    logEvent(db, userId, "raid", `Рейд-босс «${name}»: нанесено ${dealt} урона`, boss.cardId, 4, now);
    return { ok: true, value: report };
  });
}

/** Забрать награды за личный урон (все выполненные ступени) */
export function raidClaim(db: Database, userId: number, now = Date.now()): Res<{ reward: Reward; tiers: number }> {
  return transaction(db, (): Res<{ reward: Reward; tiers: number }> => {
    const r = ensureRaid(db, now);
    getWallet(db, userId, now, false);
    const x = rollWeek(getExtra(db, userId), now);
    const mine = db.prepare("SELECT damage FROM card_raid_dmg WHERE week = ? AND user_id = ?").get(r.week, userId);
    const dmg = num(mine?.damage);
    const sum: Reward = {};
    let tiers = 0;
    const add = (rw: Reward) => {
      grantReward(db, userId, rw);
      sum.diamonds = (sum.diamonds ?? 0) + (rw.diamonds ?? 0);
      sum.dust = (sum.dust ?? 0) + (rw.dust ?? 0);
      sum.packs = (sum.packs ?? 0) + (rw.packs ?? 0);
      if (rw.scroll) sum.scroll = (sum.scroll ?? 0) + rw.scroll;
    };
    RAID_TIERS.forEach((t, i) => {
      if (i >= x.raid.claimed && dmg >= t.damage) {
        add(t.reward);
        x.raid.claimed = i + 1;
        tiers += 1;
      }
    });
    if (r.defeatedAt > 0 && dmg > 0 && !x.raid.defeat) {
      add(RAID_DEFEAT_REWARD);
      x.raid.defeat = true;
      tiers += 1;
    }
    if (!tiers) return fail("Нет наград для получения");
    setExtra(db, userId, x);
    logEvent(db, userId, "raid", `Награды рейда получены (${tiers})`, "", 0, now);
    return { ok: true, value: { reward: sum, tiers } };
  });
}
