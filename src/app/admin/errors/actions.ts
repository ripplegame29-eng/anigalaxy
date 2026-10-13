"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/admin/audit";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/require-admin";

export interface ErrorState {
  error: string | null;
  ok: string | null;
}

const IDLE: ErrorState = { error: null, ok: null };

/** Идентификаторы — cuid, поэтому латница и цифры. */
function parseId(formData: FormData): string | null {
  const id = String(formData.get("id") ?? "").trim();
  return /^[a-z0-9]{20,30}$/i.test(id) ? id : null;
}

async function guard() {
  return requirePermission("settings", "/admin/errors");
}

export async function toggleResolvedAction(
  _prev: ErrorState,
  formData: FormData,
): Promise<ErrorState> {
  const session = await guard();

  const id = parseId(formData);
  if (!id) return { ...IDLE, error: "Некорректный идентификатор" };

  const entry = await db.errorLog.findUnique({ where: { id } });
  if (!entry) return { ...IDLE, error: "Запись не найдена" };

  const resolved = !entry.resolved;

  await db.errorLog.update({
    where: { id },
    data: {
      resolved,
      resolvedById: resolved ? session.user.id : null,
      // lastSeenAt — время последнего повтора, а не время закрытия,
      // поэтому после закрытия остаётся видно, как долго ошибка жила.
      lastSeenAt: Date.now(),
    },
  });

  await audit({
    actorId: session.user.id,
    action: resolved ? "error.resolve" : "error.reopen",
    targetType: "error",
    targetId: id,
    summary: `${resolved ? "Разобрана" : "Возвращена в работу"} ошибка «${entry.operation ?? entry.source}» (${entry.level})`,
  });

  revalidatePath("/admin/errors");
  revalidatePath("/admin");

  return {
    ...IDLE,
    ok: resolved ? "Помечено решённой" : "Возвращено в работу",
  };
}

/**
 * Массовое «пометить решёнными».
 *
 * Берёт всё, что сейчас не разобрано и подходит под выбранный уровень, а не
 * только видимые страницей строки: ограничение `take: 200` — страховка от
 * того, что одна кнопка разом закроет журнал на годы. Об этом сказано в
 * подтверждении на клиенте.
 */
export async function resolveAllAction(
  _prev: ErrorState,
  formData: FormData,
): Promise<ErrorState> {
  const session = await guard();

  const level = String(formData.get("level") ?? "");

  const where = {
    resolved: false,
    ...(level && level !== "all" ? { level } : {}),
  };

  const victims = await db.errorLog.findMany({
    where,
    select: { id: true },
    take: 200,
  });

  if (victims.length === 0) {
    return { ...IDLE, ok: "Помечать нечего — всё уже разобрано" };
  }

  await db.errorLog.updateMany({
    where: { id: { in: victims.map((v) => v.id) } },
    data: {
      resolved: true,
      resolvedById: session.user.id,
      lastSeenAt: Date.now(),
    },
  });

  await audit({
    actorId: session.user.id,
    action: "error.resolveAll",
    targetType: "error",
    targetId: null,
    summary: `Массово помечено решёнными: ${victims.length}`,
    after: { count: victims.length, level: level || "all" },
  });

  revalidatePath("/admin/errors");
  revalidatePath("/admin");

  return { ...IDLE, ok: `Помечено решёнными: ${victims.length}` };
}