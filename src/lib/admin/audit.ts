/**
 * Запись в аудит-лог.
 *
 * Кто, когда и что поменял — единственный способ потом разобраться с
 * «кто выдал премиум» или «кто откатил баланс». Поэтому пишем в каждом
 * изменении, а не только в очевидных местах.
 *
 * Значения `before`/`after` — JSON со значимыми полями. Секреты в них не
 * попадают: `passwordHash` исключается явно (см. `safeUser`).
 */

import "server-only";

import { db } from "@/lib/db";

export interface AuditInput {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  summary?: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

/** Поля, которые нельзя писать в журнал даже в виде «до/после». */
const REDACTED_FIELDS = new Set(["passwordHash", "tokenHash", "password", "token"]);

/** Оставляет только перечисленные ключи и вычищает секреты. */
export function pick<T extends Record<string, unknown>>(
  row: T,
  // readonly — чтобы можно было передавать `as const`-массив полей
  fields: readonly (keyof T)[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (REDACTED_FIELDS.has(String(field))) continue;
    const value = row[field];
    // BigInt не сериализуется в JSON — приводим к строке, иначе логгер упадёт
    // на ровно том действии, которое мы пытаемся записать.
    out[String(field)] = typeof value === "bigint" ? value.toString() : value;
  }
  return out;
}

/**
 * Пишет запись в журнал. Не бросает: если аудит не записался, действие
 * всё равно уже состоялось, и падать здесь — значит показать пользователю
 * ошибку на уже применённом изменении.
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        summary: input.summary ?? null,
        before: input.before === undefined ? null : JSON.stringify(input.before),
        after: input.after === undefined ? null : JSON.stringify(input.after),
        ip: input.ip ?? null,
        createdAt: Date.now(),
      },
    });
  } catch (error: unknown) {
    console.error("[audit] не удалось записать в журнал:", error);
  }
}