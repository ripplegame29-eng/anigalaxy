/** Кампания: противники этапов, бой, звёзды и награды. */

import { seeded, simulate, type Unit } from "../cards/battle";
import { CATALOG, cardDef, visibleCatalog } from "../cards/catalog";
import { BATTLE, DECK_SIZE } from "../cards/config";
import {
  CHAPTERS,
  EXTRA_STAR_REWARD,
  FAST_ROUNDS,
  STAGES,
  chapterReward,
  isBoss,
  stageReward,
  type ChapterView,
  type StageView,
} from "../cards/campaign";
import type { Reward } from "../cards/progress";
import { fail, getWallet, grantReward, listInventory, logEvent, addMoney, type Res, type Rng } from "./cards";
import { getExtra, setExtra, track } from "./cards-extra";
import { prepareSides, saveBattle, unitOf, type BattleReport } from "./cards-battle";
import { transaction, type Database } from "./sqlite";

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

interface Spec {
  cardId: string;
  level: number;
  boss: boolean;
}

/** Состав противника этапа: детерминированный, герои выбранного аниме */
export function stageSpec(ch: number, st: number): Spec[] {
  const chapter = CHAPTERS[ch];
  if (!chapter) return [];
  const rng = seeded(hash(`${chapter.series}:${st}`));
  const visible = visibleCatalog(new Set<string>());
  let pool = visible.filter((c) => c.series === chapter.series);
  if (pool.length < DECK_SIZE) pool = [...pool, ...visible.filter((c) => c.series !== chapter.series)];
  const target = Math.min(4, Math.floor((ch * STAGES + st) / 14));
  const level = Math.min(15, 1 + Math.floor(ch * 0.8) + Math.floor(st * 0.8));
  const used = new Set<string>();
  const pick = (want: number): string => {
    const ranked = pool
      .filter((c) => !used.has(c.id))
      .map((c) => ({ c, k: Math.abs(c.rank - want) + rng() * 0.9 }))
      .sort((a, b) => a.k - b.k);
    const h = ranked[0]?.c ?? CATALOG[0];
    used.add(h.id);
    return h.id;
  };
  const out: Spec[] = [];
  if (isBoss(st)) {
    const cap = Math.min(4, target + 2);
    const top = [...pool].filter((c) => c.rank <= cap).sort((a, b) => b.rank - a.rank || hash(a.id + st) - hash(b.id + st))[0] ?? pool[0];
    used.add(top.id);
    out.push({ cardId: top.id, level: Math.min(15, level + 1), boss: true });
    for (let i = 1; i < DECK_SIZE; i += 1) out.push({ cardId: pick(target), level, boss: false });
  } else {
    for (let i = 0; i < DECK_SIZE; i += 1) out.push({ cardId: pick(target + (i === 0 ? 1 : 0)), level, boss: false });
  }
  return out;
}

export function stageUnits(ch: number, st: number): Unit[] {
  const chapter = CHAPTERS[ch];
  return stageSpec(ch, st).flatMap((s, i) => {
    const u = unitOf({ cardId: s.cardId, level: s.level, foil: false }, "b", i);
    if (!u) return [];
    if (s.boss) {
      const k = 1.7 + 0.08 * (chapter?.id ?? 0);
      const hp = Math.round(u.maxHp * k);
      return [{ ...u, hp, maxHp: hp, atk: Math.round(u.atk * 1.1), def: Math.round(u.def * 1.1), passive: (cardDef(s.cardId)?.rank ?? 0) >= 3 ? "p-revive" : "p-flow" }];
    }
    return [u];
  });
}

const power = (u: { atk: number; def: number; maxHp: number; spd: number }) => u.atk + u.def * 0.8 + u.maxHp * 0.15 + u.spd * 2;

type Stars = Record<string, number>;
const key = (ch: number, st: number) => `${ch}:${st}`;
const starsOf = (m: Stars, ch: number, st: number) => m[key(ch, st)] ?? 0;
const cleared = (m: Stars, ch: number) => Array.from({ length: STAGES }).every((_, st) => starsOf(m, ch, st) >= 1);

export function campaignState(db: Database, userId: number): ChapterView[] {
  const x = getExtra(db, userId);
  return CHAPTERS.map((c) => {
    const unlocked = c.id === 0 || cleared(x.camp.stars, c.id - 1);
    const stages: StageView[] = Array.from({ length: STAGES }).map((_, st) => {
      const spec = stageSpec(c.id, st);
      const units = stageUnits(c.id, st);
      return {
        stage: st,
        boss: isBoss(st),
        stars: starsOf(x.camp.stars, c.id, st),
        unlocked: unlocked && (st === 0 || starsOf(x.camp.stars, c.id, st - 1) >= 1),
        enemy: spec.map((s) => ({ cardId: s.cardId, level: s.level })),
        power: Math.round(units.reduce((a, u) => a + power(u), 0)),
      };
    });
    const stars = stages.reduce((a, s) => a + s.stars, 0);
    return {
      id: c.id,
      series: c.series,
      unlocked,
      stars,
      maxStars: STAGES * 3,
      cleared: cleared(x.camp.stars, c.id),
      claimed: [!!x.camp.chapters[`${c.id}:0`], !!x.camp.chapters[`${c.id}:1`]],
      stages,
    };
  });
}

export function campaignFight(
  db: Database,
  userId: number,
  chapter: number,
  stage: number,
  opts: { training?: boolean } = {},
  now = Date.now(),
  rng: Rng = Math.random,
): Res<BattleReport> {
  const ch = Math.floor(chapter);
  const st = Math.floor(stage);
  if (!CHAPTERS[ch] || st < 0 || st >= STAGES) return fail("Такого этапа нет");
  return transaction(db, (): Res<BattleReport> => {
    const w = getWallet(db, userId, now);
    const x = getExtra(db, userId);
    const unlocked = (ch === 0 || cleared(x.camp.stars, ch - 1)) && (st === 0 || starsOf(x.camp.stars, ch, st - 1) >= 1);
    if (!unlocked) return fail("Этап ещё закрыт: пройдите предыдущий");
    const inv = new Map(listInventory(db, userId).map((c) => [c.id, c]));
    const mine: Unit[] = [];
    w.deck.forEach((id, slot) => {
      const c = inv.get(id);
      const u = c ? unitOf(c, "a", slot) : null;
      if (u) mine.push(u);
    });
    if (mine.length < DECK_SIZE) return fail(`Соберите колоду из ${DECK_SIZE} карт`);
    const training = !!opts.training;
    if (!training && w.energy < BATTLE.energyCost) return fail("Нет энергии — подождите или восстановите её");

    const side = prepareSides(mine, stageUnits(ch, st), now, { foeSynergy: false });
    const outcome = simulate(side.you, side.foe, rng);
    const win = outcome.winner === "a" && !outcome.timeout;
    const lost = outcome.a.filter((u) => u.hp <= 0).length;
    const stars = win ? 1 + (outcome.rounds <= FAST_ROUNDS ? 1 : 0) + (lost === 0 ? 1 : 0) : 0;
    const best = starsOf(x.camp.stars, ch, st);
    const newStars = Math.max(0, stars - best);
    const firstClear = win && best === 0;

    const reward: Reward = {};
    let energy = w.energy;
    if (!training) {
      energy = w.energy - BATTLE.energyCost;
      db.prepare("UPDATE card_wallet SET energy = ?, energy_at = CASE WHEN energy >= ? THEN ? ELSE energy_at END WHERE user_id = ?").run(energy, 10, now, userId);
      if (firstClear) {
        const r = stageReward(ch, st);
        reward.diamonds = (reward.diamonds ?? 0) + (r.diamonds ?? 0);
        reward.dust = (reward.dust ?? 0) + (r.dust ?? 0);
      }
      const extra = Math.max(0, newStars - (firstClear ? 1 : 0));
      if (extra > 0) reward.diamonds = (reward.diamonds ?? 0) + extra * (EXTRA_STAR_REWARD.diamonds ?? 0);
      if (reward.diamonds) addMoney(db, userId, "diamonds", reward.diamonds);
      if (reward.dust) addMoney(db, userId, "dust", reward.dust);
      if (newStars > 0) {
        x.camp.stars[key(ch, st)] = stars;
        setExtra(db, userId, x);
        track(db, userId, "stars", newStars, now);
      }
    }
    const title = `${CHAPTERS[ch].series} · ${isBoss(st) ? "Босс" : `Этап ${st + 1}`}`;
    const report: BattleReport = {
      outcome,
      you: side.you,
      foe: side.foe,
      youSyn: side.youSyn,
      foeSyn: side.foeSyn,
      foeName: title,
      foeRating: 0,
      pvp: false,
      win,
      reward: { diamonds: reward.diamonds ?? 0, dust: reward.dust ?? 0, rating: 0, scroll: 0 },
      rating: w.rating,
      energy,
      training,
      title: `Кампания: ${title}`,
      campaign: { chapter: ch, stage: st, stars, best: Math.max(best, training ? best : stars), newStars: training ? 0 : newStars, firstClear: training ? false : firstClear, reward },
    };
    if (!training) {
      saveBattle(db, userId, { kind: "campaign", opp: title, win, delta: 0, title: `Кампания: ${title} (${stars}★)`, report }, now);
      logEvent(db, userId, "battle", `Кампания «${title}»: ${win ? `победа, ${stars}★` : "поражение"}`, "", 0, now);
    }
    return { ok: true, value: report };
  });
}

/** Награда главы: 0 — глава пройдена, 1 — собрано 15 звёзд */
export function campaignClaim(db: Database, userId: number, chapter: number, tier: number, now = Date.now()): Res<{ reward: Reward }> {
  const ch = Math.floor(chapter);
  const t = Math.floor(tier);
  if (!CHAPTERS[ch] || (t !== 0 && t !== 1)) return fail("Нет такой награды");
  return transaction(db, (): Res<{ reward: Reward }> => {
    getWallet(db, userId, now, false);
    const x = getExtra(db, userId);
    const k = `${ch}:${t}`;
    if (x.camp.chapters[k]) return fail("Награда уже получена");
    const total = Array.from({ length: STAGES }).reduce<number>((a, _, st) => a + starsOf(x.camp.stars, ch, st), 0);
    if (t === 0 && !cleared(x.camp.stars, ch)) return fail("Глава ещё не пройдена");
    if (t === 1 && total < STAGES * 3) return fail("Нужны все звёзды главы");
    x.camp.chapters[k] = true;
    setExtra(db, userId, x);
    const r = chapterReward(ch, t as 0 | 1);
    grantReward(db, userId, r);
    logEvent(db, userId, "campaign", `Глава «${CHAPTERS[ch].series}»: награда ${t === 0 ? "за прохождение" : "за все звёзды"}`, "", 0, now);
    return { ok: true, value: { reward: r } };
  });
}
