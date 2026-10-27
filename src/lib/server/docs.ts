/**
 * Серверная копия локальных хранилищ игрока и срез прогресса для рейтингов.
 *
 * Правила записи: у каждого документа свой счётчик версий. Клиент присылает
 * версию, от которой отталкивался; если на сервере уже новее — запись не
 * проходит и клиент получает серверный документ (конфликт решает клиент).
 * Прогресс дополнительно проверяется на правдоподобность роста опыта.
 */

import { MAX_DOCS_PER_USER, PROGRESS_DOC_KEY, isSyncKey, maxDocBytes } from "../sync-keys";
import { weekKey } from "../leaderboard-prizes";
import { num, str, transaction, type Database } from "./sqlite";

export interface DocRecord {
  key: string;
  value: string;
  version: number;
  updatedAt: number;
}

export type PutResult =
  | { ok: true; version: number }
  | { ok: false; reason: "conflict" | "implausible"; server: DocRecord }
  | { ok: false; reason: "invalid" | "too_large" | "too_many"; server?: undefined };

/** Первая загрузка прогресса: потолок опыта, выше которого документ считается подделкой */
const MAX_FIRST_XP = 5_000_000;
/** Допустимый рост опыта между двумя сохранениями: базовый запас + за каждую минуту */
const XP_SLACK = 4000;
const XP_PER_MINUTE = 400;

function toDoc(row: Record<string, unknown>): DocRecord {
  return {
    key: str(row.doc_key),
    value: str(row.value),
    version: num(row.version),
    updatedAt: num(row.updated_at),
  };
}

export function getDoc(db: Database, userId: number, key: string): DocRecord | null {
  const row = db.prepare("SELECT * FROM user_docs WHERE user_id = ? AND doc_key = ?").get(userId, key);
  return row ? toDoc(row) : null;
}

export function listDocs(db: Database, userId: number): DocRecord[] {
  return db
    .prepare("SELECT * FROM user_docs WHERE user_id = ? ORDER BY doc_key")
    .all(userId)
    .map(toDoc);
}

export function deleteAllDocs(db: Database, userId: number): void {
  db.prepare("DELETE FROM user_docs WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM player_stats WHERE user_id = ?").run(userId);
}

interface ProgressSummary {
  xpTotal: number;
  level: number;
  acBalance: number;
}

/** Достать из документа прогресса числа для рейтингов (или null, если формат не тот) */
export function summarizeProgress(value: string): ProgressSummary | null {
  try {
    const doc = JSON.parse(value) as { progress?: Record<string, unknown> };
    const p = doc.progress;
    if (!p || typeof p !== "object") return null;
    const xpTotal = p.xpTotal;
    if (typeof xpTotal !== "number" || !Number.isFinite(xpTotal) || xpTotal < 0) return null;
    const level = typeof p.level === "number" && Number.isFinite(p.level) ? Math.max(1, Math.floor(p.level)) : 1;
    const ac = typeof p.acBalance === "number" && Number.isFinite(p.acBalance) ? Math.max(0, Math.floor(p.acBalance)) : 0;
    return { xpTotal: Math.floor(xpTotal), level, acBalance: ac };
  } catch {
    return null;
  }
}

/** Обновить срез прогресса; при смене недели сохранить очки прошлой в снимок */
function updatePlayerStats(db: Database, userId: number, summary: ProgressSummary, now: number): void {
  const current = weekKey(now);
  const row = db.prepare("SELECT * FROM player_stats WHERE user_id = ?").get(userId);

  if (!row) {
    db.prepare(
      `INSERT INTO player_stats (user_id, xp_total, level, ac_balance, week_key, week_base_xp, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(userId, summary.xpTotal, summary.level, summary.acBalance, current, summary.xpTotal, now);
    return;
  }

  const oldWeek = str(row.week_key);
  let base = num(row.week_base_xp);
  if (oldWeek !== current) {
    const points = Math.max(0, num(row.xp_total) - base);
    if (oldWeek && points > 0) {
      db.prepare(
        "INSERT OR REPLACE INTO weekly_points (week_key, user_id, points) VALUES (?, ?, ?)",
      ).run(oldWeek, userId, points);
    }
    // Новая неделя стартует с текущего опыта: очки считаются только за неё
    base = summary.xpTotal;
  }
  db.prepare(
    `UPDATE player_stats SET xp_total = ?, level = ?, ac_balance = ?, week_key = ?, week_base_xp = ?, updated_at = ?
     WHERE user_id = ?`,
  ).run(summary.xpTotal, summary.level, summary.acBalance, current, base, now, userId);
}

export function putDoc(
  db: Database,
  userId: number,
  input: { key: string; value: string; baseVersion?: number },
  now = Date.now(),
): PutResult {
  const { key, value } = input;
  if (!isSyncKey(key) || typeof value !== "string") return { ok: false, reason: "invalid" };
  if (Buffer.byteLength(value, "utf8") > maxDocBytes(key)) return { ok: false, reason: "too_large" };

  return transaction(db, (): PutResult => {
    const existing = getDoc(db, userId, key);

    if (existing && input.baseVersion !== undefined && input.baseVersion !== existing.version) {
      return { ok: false, reason: "conflict", server: existing };
    }
    if (!existing) {
      const count = num(db.prepare("SELECT COUNT(*) AS c FROM user_docs WHERE user_id = ?").get(userId)?.c);
      if (count >= MAX_DOCS_PER_USER) return { ok: false, reason: "too_many" };
    }

    if (key === PROGRESS_DOC_KEY) {
      const next = summarizeProgress(value);
      if (!next) return { ok: false, reason: "invalid" };
      const prev = existing ? summarizeProgress(existing.value) : null;
      if (!prev && next.xpTotal > MAX_FIRST_XP) return { ok: false, reason: "invalid" };
      if (prev && existing) {
        const minutes = Math.max(0, (now - existing.updatedAt) / 60_000);
        const allowed = prev.xpTotal + XP_SLACK + Math.floor(minutes * XP_PER_MINUTE);
        if (next.xpTotal > allowed) return { ok: false, reason: "implausible", server: existing };
      }
      updatePlayerStats(db, userId, next, now);
    }

    const version = (existing?.version ?? 0) + 1;
    db.prepare(
      `INSERT INTO user_docs (user_id, doc_key, value, version, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, doc_key) DO UPDATE SET value = excluded.value, version = excluded.version, updated_at = excluded.updated_at`,
    ).run(userId, key, value, version, now);
    return { ok: true, version };
  });
}

/**
 * Запись документа администратором: без проверки версии и правдоподобности
 * опыта. Версия растёт, поэтому клиент игрока при следующей синхронизации
 * получит конфликт и примет серверное значение.
 */
export function adminWriteDoc(db: Database, userId: number, key: string, value: string, now = Date.now()): number {
  return transaction(db, () => {
    const existing = getDoc(db, userId, key);
    if (key === PROGRESS_DOC_KEY) {
      const summary = summarizeProgress(value);
      if (summary) updatePlayerStats(db, userId, summary, now);
    }
    const version = (existing?.version ?? 0) + 1;
    db.prepare(
      `INSERT INTO user_docs (user_id, doc_key, value, version, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, doc_key) DO UPDATE SET value = excluded.value, version = excluded.version, updated_at = excluded.updated_at`,
    ).run(userId, key, value, version, now);
    return version;
  });
}
