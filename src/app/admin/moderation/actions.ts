"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { audit, pick } from "@/lib/admin/audit";
import { getSession } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/require-admin";

export interface ModerationState {
  error: string | null;
  ok: string | null;
}

const IDLE: ModerationState = { error: null, ok: null };

const REPORT_FIELDS = ["status", "targetType", "targetId", "resolution"] as const;

/** Идентификатор жалобы — cuid, как и у остальных записей. */
function parseId(formData: FormData): string | null {
  const id = String(formData.get("id") ?? "").trim();
  return /^[a-z0-9]{20,30}$/i.test(id) ? id : null;
}

async function guard() {
  return requirePermission("moderation", "/admin/moderation");
}

/**
 * Закрыть жалобу.
 *
 * `outcome` — не просто «закрыть», а зафиксировать решение: «удалено» или
 * «отклонено». Разница видна в журнале и в статистике, и по ней видно, не
 * отклоняем ли мы всё подряд.
 */
export async function resolveReportAction(
  _prev: ModerationState,
  formData: FormData,
): Promise<ModerationState> {
  const session = await guard();

  const id = parseId(formData);
  if (!id) return { ...IDLE, error: "Некорректный идентификатор" };

  const outcome = String(formData.get("outcome") ?? "");
  if (outcome !== "resolved" && outcome !== "rejected") {
    return { ...IDLE, error: "Неизвестное решение" };
  }

  const report = await db.report.findUnique({ where: { id } });
  if (!report) return { ...IDLE, error: "Жалоба не найдена" };

  if (report.status !== "open") {
    return { ...IDLE, error: "Жалоба уже разобрана" };
  }

  const note = String(formData.get("note") ?? "").trim().slice(0, 500);

  const updated = await db.report.update({
    where: { id },
    data: {
      status: outcome,
      resolution: note || null,
      resolvedById: session.user.id,
      resolvedAt: Date.now(),
    },
  });

  await audit({
    actorId: session.user.id,
    action: `report.${outcome}`,
    targetType: "report",
    targetId: id,
    summary: `Жалоба на ${report.targetType} «${report.targetId}» — ${
      outcome === "resolved" ? "признана обоснованной" : "отклонена"
    }${note ? `: ${note}` : ""}`,
    before: pick(report, REPORT_FIELDS),
    after: pick(updated, REPORT_FIELDS),
    ip: (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  revalidatePath("/admin/moderation");
  return { ...IDLE, ok: "Жалоба разобрана" };
}

/**
 * Создать жалобу.
 *
 * Это серверная точка для публичной кнопки «Пожаловаться» на сайте: до неё
 * жалобы не существовало, и модерации было нечего разбирать.
 *
 * Идентичность автора берётся из серверной сессии, а не из тела запроса: иначе
 * можно было бы жаловаться от чужого имени или приписать жалобу другому.
 */
export async function createReportAction(input: {
  targetType: string;
  targetId: string;
  reason: string;
  details?: string;
}): Promise<{ ok: boolean; error?: string }> {
  // Публичная форма: никаких прав не требуется, но и без причины не принимаем.
  const ALLOWED = new Set(["comment", "chat", "profile", "title"]);

  if (!ALLOWED.has(input.targetType)) {
    return { ok: false, error: "Неизвестный тип жалобы" };
  }

  const targetId = input.targetId.trim().slice(0, 200);
  if (!targetId) return { ok: false, error: "Не указано, на что жалоба" };

  const reason = input.reason.trim().slice(0, 120);
  if (!reason) return { ok: false, error: "Выберите причину" };

  const details = input.details?.trim().slice(0, 1000) ?? null;

  const author = await getSession();

  // Одна жалоба от одного автора на одну цель: иначе кнопка «пожаловаться»,
  // нажатая десять раз, забивает очередь и мешает разбору.
  const duplicate = await db.report.findFirst({
    where: {
      targetType: input.targetType,
      targetId,
      status: "open",
      ...(author ? { authorId: author.user.id } : {}),
    },
  });
  if (duplicate) {
    return { ok: false, error: "Такая жалоба уже отправлена и ждёт разбора" };
  }

  await db.report.create({
    data: {
      authorId: author?.user.id ?? null,
      targetType: input.targetType,
      targetId,
      reason,
      details,
      status: "open",
      createdAt: Date.now(),
    },
  });

  return { ok: true };
}