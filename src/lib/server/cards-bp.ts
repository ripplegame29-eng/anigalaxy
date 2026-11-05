/**
 * Награды карточной игры на уровнях основного боевого пропуска.
 *
 * Награду уровня забирают на странице пропуска сайта — это фиксируется в синхронизированном
 * документе прогресса (`battlepass.claimed`). Отсюда сервер карточек сверяет забранные ключи
 * и выдаёт часть гачи ровно один раз (ключ запоминается в данных игрока).
 */

import { BATTLEPASS } from "../battlepass/config";
import { gachaClaimKey, gachaRewardAt } from "../battlepass/gacha";
import type { Reward } from "../cards/progress";
import { PROGRESS_DOC_KEY } from "../sync-keys";
import { grantReward, type Res } from "./cards";
import { getExtra, setExtra } from "./cards-extra";
import { getDoc } from "./docs";
import { transaction, type Database } from "./sqlite";

/** Забранные ключи пропуска из документа прогресса игрока */
function claimedKeys(db: Database, userId: number): string[] {
  const rec = getDoc(db, userId, PROGRESS_DOC_KEY);
  if (!rec) return [];
  try {
    const doc = JSON.parse(rec.value) as { battlepass?: { season?: string; claimed?: unknown } };
    if (doc.battlepass?.season !== BATTLEPASS.seasonId || !Array.isArray(doc.battlepass.claimed)) return [];
    return doc.battlepass.claimed.filter((k): k is string => typeof k === "string");
  } catch {
    return [];
  }
}

export function bpGachaSync(db: Database, userId: number): Res<{ reward: Reward; count: number; cards: string[] }> {
  return transaction(db, (): Res<{ reward: Reward; count: number; cards: string[] }> => {
    const x = getExtra(db, userId);
    const done = new Set<string>(Array.isArray(x.bpGacha) ? (x.bpGacha as string[]) : []);
    const total: Reward = {};
    let count = 0;
    const cards: string[] = [];
    for (const key of claimedKeys(db, userId)) {
      if (done.has(key)) continue;
      const [season, line, lv] = key.split(":");
      if (season !== BATTLEPASS.seasonId || (line !== "free" && line !== "premium")) continue;
      const level = Number(lv);
      const r = gachaRewardAt(level, line);
      if (!r || key !== gachaClaimKey(season, line, level)) continue;
      grantReward(db, userId, r);
      done.add(key);
      count += 1;
      total.diamonds = (total.diamonds ?? 0) + (r.diamonds ?? 0);
      total.dust = (total.dust ?? 0) + (r.dust ?? 0);
      total.packs = (total.packs ?? 0) + (r.packs ?? 0);
      total.scroll = (total.scroll ?? 0) + (r.scroll ?? 0);
      if (r.card) cards.push(r.card);
    }
    if (count) {
      x.bpGacha = [...done];
      setExtra(db, userId, x);
    }
    return { ok: true, value: { reward: total, count, cards } };
  });
}

/** Ключи уже выданных наград гачи (для подсказок в интерфейсе) */
export function bpGachaDone(db: Database, userId: number): string[] {
  const x = getExtra(db, userId);
  return Array.isArray(x.bpGacha) ? (x.bpGacha as string[]) : [];
}
