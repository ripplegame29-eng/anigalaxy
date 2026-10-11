"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { audit, pick } from "@/lib/admin/audit";
import { destroyOtherSessions, getSession, metaFromHeaders } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/require-admin";
import { isRole, ROLE_LABELS, type Role } from "@/lib/roles";

export interface ActionState {
  error: string | null;
  ok: string | null;
}

const IDLE: ActionState = { error: null, ok: null };

/**
 * Любое действие начинается с проверки прав.
 *
 * Это дублирует проверку в layout, и это намеренно: страница — это вёрстка,
 * а экшен можно вызвать напрямую, подставив id формы. Полагаться на то, что
 * кнопка «Забанить» отрисована только у модератора, нельзя.
 */
async function guard() {
  const session = await requirePermission("users", "/admin/users");
  return session;
}

function parseId(formData: FormData): string | null {
  const id = String(formData.get("id") ?? "").trim();
  // cuid — буквы и цифры, всегда начинается с «c». Фильтр защищает не только
  // от мусора, но и от попытки подставить в запрос произвольную строку.
  return /^[a-z0-9]{20,30}$/i.test(id) ? id : null;
}

const USER_FIELDS = ["nickname", "email", "role", "status", "premiumUntil", "bannedUntil"] as const;

/* --------------------------------- Бан ---------------------------------- */

export async function banUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await guard();

  const id = parseId(formData);
  if (!id) return { ...IDLE, error: "Некорректный идентификатор" };

  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  const daysRaw = String(formData.get("days") ?? "");
  const days = daysRaw === "" ? null : Number(daysRaw);
  if (days !== null && (!Number.isFinite(days) || days <= 0 || days > 3650)) {
    return { ...IDLE, error: "Срок бана: от 1 дня до 10 лет" };
  }

  const user = await db.user.findUnique({ where: { id } });
  if (!user) return { ...IDLE, error: "Пользователь не найден" };

  // Админа нельзя забанить через эту форму, если бан выставляет не он сам:
  // иначе модератор с правом на пользователей уронил бы доступ всей команды.
  if (user.role === "admin" && session.user.id !== id) {
    return { ...IDLE, error: "Забанить другого администратора нельзя" };
  }

  const bannedUntil = days === null ? null : Date.now() + days * 86_400_000;

  const updated = await db.user.update({
    where: { id },
    data: {
      status: "banned",
      bannedUntil,
      banReason: reason || null,
      bannedById: session.user.id,
      bannedAt: Date.now(),
      updatedAt: Date.now(),
    },
  });

  // Сессии гасим сразу: иначе забаненный продолжит пользоваться сайтом,
  // пока у него открыта вкладка — бан в интерфейсе, а не в доступе.
  const dropped = await destroyOtherSessions(id);

  await audit({
    actorId: session.user.id,
    action: "user.ban",
    targetType: "user",
    targetId: id,
    summary: `Бан: ${user.nickname}${days === null ? " (навсегда)" : ` на ${days} дн.`}`,
    before: pick(user, USER_FIELDS),
    after: pick(updated, USER_FIELDS),
    ip: metaFromHeaders(await headers()).ip,
  });

  revalidatePath("/admin/users");
  return { ...IDLE, ok: `${user.nickname} забанен. Сессий завершено: ${dropped}.` };
}

export async function unbanUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await guard();

  const id = parseId(formData);
  if (!id) return { ...IDLE, error: "Некорректный идентификатор" };

  const user = await db.user.findUnique({ where: { id } });
  if (!user) return { ...IDLE, error: "Пользователь не найден" };

  const updated = await db.user.update({
    where: { id },
    data: {
      status: "active",
      bannedUntil: null,
      banReason: null,
      bannedById: null,
      bannedAt: null,
      updatedAt: Date.now(),
    },
  });

  await audit({
    actorId: session.user.id,
    action: "user.unban",
    targetType: "user",
    targetId: id,
    summary: `Разбан: ${user.nickname}`,
    before: pick(user, USER_FIELDS),
    after: pick(updated, USER_FIELDS),
  });

  revalidatePath("/admin/users");
  return { ...IDLE, ok: `${user.nickname} разбанен` };
}

/* -------------------------------- Роль ---------------------------------- */

export async function setRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await guard();

  const id = parseId(formData);
  if (!id) return { ...IDLE, error: "Некорректный идентификатор" };

  const role = String(formData.get("role") ?? "");
  if (!isRole(role)) return { ...IDLE, error: "Неизвестная роль" };

  const user = await db.user.findUnique({ where: { id } });
  if (!user) return { ...IDLE, error: "Пользователь не найден" };

  if (user.id === session.user.id && role !== "admin") {
    // Иначе можно лишить себя прав и больше не вернуться в панель.
    return { ...IDLE, error: "Нельзя снять роль с самого себя" };
  }

  if (user.role === "admin" && role !== "admin") {
    const admins = await db.user.count({ where: { role: "admin", status: "active" } });
    if (admins <= 1) {
      return { ...IDLE, error: "Это последний администратор — роль снять нельзя" };
    }
  }

  const updated = await db.user.update({
    where: { id },
    data: { role, updatedAt: Date.now() },
  });

  await audit({
    actorId: session.user.id,
    action: "user.role",
    targetType: "user",
    targetId: id,
    summary: `Роль: ${user.nickname} — ${user.role} → ${role}`,
    before: pick(user, USER_FIELDS),
    after: pick(updated, USER_FIELDS),
  });

  revalidatePath("/admin/users");
  return { ...IDLE, ok: `${user.nickname} → ${ROLE_LABELS[role as Role]}` };
}

/* ------------------------------- Premium -------------------------------- */

export async function grantPremiumAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await guard();

  const id = parseId(formData);
  if (!id) return { ...IDLE, error: "Некорректный идентификатор" };

  const days = Number(String(formData.get("days") ?? ""));
  if (!Number.isFinite(days) || days <= 0 || days > 3650) {
    return { ...IDLE, error: "Срок: от 1 дня до 10 лет" };
  }

  const user = await db.user.findUnique({ where: { id } });
  if (!user) return { ...IDLE, error: "Пользователь не найден" };

  // Продлеваем от текущего срока, а не от сегодня: если подписка ещё не истекла,
  // «+30 дней» должны её продлить, а не съесть остаток.
  const base = Math.max(Date.now(), Number(user.premiumUntil));
  const premiumUntil = base + days * 86_400_000;

  const updated = await db.user.update({
    where: { id },
    data: { premiumUntil, updatedAt: Date.now() },
  });

  await audit({
    actorId: session.user.id,
    action: "user.premium",
    targetType: "user",
    targetId: id,
    summary: `Premium ${user.nickname}: +${days} дн. (до ${new Date(premiumUntil).toLocaleDateString("ru-RU")})`,
    before: pick(user, USER_FIELDS),
    after: pick(updated, USER_FIELDS),
  });

  revalidatePath("/admin/users");
  return { ...IDLE, ok: `${user.nickname}: Premium до ${new Date(premiumUntil).toLocaleDateString("ru-RU")}` };
}

/* ------------------------------- Сессии --------------------------------- */

export async function killSessionsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await guard();

  const id = parseId(formData);
  if (!id) return { ...IDLE, error: "Некорректный идентификатор" };

  const user = await db.user.findUnique({ where: { id } });
  if (!user) return { ...IDLE, error: "Пользователь не найден" };

  // Свои сессии не трогаем: следующее действие выкинет админа из панели,
  // и он решит, что панель «сломалась».
  const dropped = await destroyOtherSessions(id, session.sessionId);

  await audit({
    actorId: session.user.id,
    action: "user.sessions_revoked",
    targetType: "user",
    targetId: id,
    summary: `Сессии закрыты: ${user.nickname} (${dropped})`,
  });

  revalidatePath("/admin/users");
  return { ...IDLE, ok: `Закрыто сессий: ${dropped}` };
}

/* ---------------------------- Список сессий ----------------------------- */

/** Активные сессии пользователя — показывает, откуда он сейчас зашёл. */
export async function listSessionsFor(userId: string) {
  const session = await getSession();
  if (!session) return [];
  return db.session.findMany({
    where: { userId, expiresAt: { gt: BigInt(Date.now()) } },
    orderBy: { lastUsedAt: "desc" },
    select: { id: true, ip: true, userAgent: true, lastUsedAt: true, createdAt: true },
  });
}