/**
 * Защита серверных страниц админки.
 *
 * Главное правило: проверка прав живёт только здесь и только на сервере.
 * Клиентская проверка «спрятать кнопку» — это удобство интерфейса, а не
 * безопасность; доступ определяет серверный код, выполняющий действие.
 *
 * `requireAdmin` бросает redirect, а не возвращает null: страница, которая
 * забыла проверить результат, всё равно не отрендерится.
 */

import "server-only";

import { redirect } from "next/navigation";

import { getSession, type ActiveSession } from "@/lib/auth-server";
import { can, type Permission } from "@/lib/roles";

/**
 * Текущая сессия или redirect на страницу входа.
 *
 * `from` запоминаем, чтобы после входа вернуть человека туда, куда он шёл:
 * без этого админ, кликнувший на прямую ссылку /admin/users, попадал на
 * главную и не понимал, что произошло.
 */
export async function requireAdmin(from?: string): Promise<ActiveSession> {
  const session = await getSession();

  if (!session) {
    redirect(`/login?from=${encodeURIComponent(from ?? "/admin")}`);
  }

  // Сессия есть, но прав на панель нет: молча уводим на главную.
  // Отдельная страница «доступ запрещён» тут лишняя — она раскрывает
  // существование раздела тому, кому он закрыт.
  if (!can(session.user.role, "panel")) {
    redirect("/");
  }

  return session;
}

/** Сессия с правом на конкретный раздел; иначе redirect на корень панели. */
export async function requirePermission(
  permission: Permission,
  from?: string,
): Promise<ActiveSession> {
  const session = await requireAdmin(from);

  if (!can(session.user.role, permission)) {
    redirect("/admin");
  }

  return session;
}