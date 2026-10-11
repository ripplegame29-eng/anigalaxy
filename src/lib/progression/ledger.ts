/**
 * USER_REWARDS_LOG — операции с журналом наград.
 *
 * Правила (§2.3):
 *  - журнал append-only: отмена/забирание/реверс = НОВАЯ запись `reversesId`,
 *    удаление записей не бывает (меняется только статус pending→confirmed/reversed);
 *  - `idempotencyKey` уникален: одна награда невозможна дважды;
 *  - в режиме local окно ограничено (LEDGER_WINDOW) — цена отсутствия сервера.
 */

import type { Currency, LedgerEntry, ProgressDoc } from "./types";

/** Сколько записей хранится в режиме local */
export const LEDGER_WINDOW = 500;

/** Ключ идемпотентности для записи: XP и AC живут раздельно */
export function entryKey(baseKey: string, currency: Currency): string {
  return currency === "XP" ? baseKey : `${baseKey}:ac`;
}

/** Есть ли уже награда с таким ключом */
export function hasKey(doc: ProgressDoc, baseKey: string, currency: Currency = "XP"): boolean {
  const key = entryKey(baseKey, currency);
  for (let i = doc.ledger.length - 1; i >= 0; i -= 1) {
    if (doc.ledger[i].idempotencyKey === key) return true;
  }
  return false;
}

/** Запись в конец журнала с ограничением окна */
export function appendEntry(doc: ProgressDoc, entry: LedgerEntry): void {
  doc.ledger.push(entry);
  if (doc.ledger.length > LEDGER_WINDOW) {
    doc.ledger.splice(0, doc.ledger.length - LEDGER_WINDOW);
  }
}

/** Все записи по предикату */
export function findEntries(
  doc: ProgressDoc,
  pred: (entry: LedgerEntry) => boolean,
): LedgerEntry[] {
  return doc.ledger.filter(pred);
}

/**
 * Подтверждение отложенных наград (комментарии: pending 15 минут, §10).
 * Вызывается перед обработкой каждого события — дешёвый проход по окну.
 */
export function confirmDue(doc: ProgressDoc, now: number): number {
  let changed = 0;
  for (const entry of doc.ledger) {
    if (entry.status !== "pending") continue;
    const due = typeof entry.metadata?.confirmAt === "number" ? entry.metadata.confirmAt : 0;
    if (due && now >= due) {
      entry.status = "confirmed";
      changed += 1;
    }
  }
  return changed;
}
