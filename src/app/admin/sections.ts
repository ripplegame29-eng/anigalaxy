/**
 * Разделы админ-панели.
 *
 * Список один и на сервере, и в меню: иначе разъедутся — добавили пункт в
 * меню, а страница осталась без проверки прав, или наоборот.
 * `permission` читается из `lib/roles.ts`, пункт без доступа просто не
 * показывается в меню (но и его страница всё равно проверяет право).
 */

import type { Permission } from "@/lib/roles";

export interface AdminSection {
  href: string;
  label: string;
  permission: Permission;
  /** Появится позже; до реализации показывается отдельным видом */
  ready: boolean;
  hint?: string;
}

export const ADMIN_SECTIONS: AdminSection[] = [
  { href: "/admin", label: "Обзор", permission: "panel", ready: true },
  { href: "/admin/users", label: "Пользователи", permission: "users", ready: true },
  { href: "/admin/moderation", label: "Модерация", permission: "moderation", ready: true },
  { href: "/admin/content", label: "Контент", permission: "content", ready: true },
  { href: "/admin/economy", label: "Экономика", permission: "economy", ready: false },
  { href: "/admin/errors", label: "Журнал ошибок", permission: "settings", ready: true },
  { href: "/admin/settings", label: "Настройки", permission: "settings", ready: true },
];