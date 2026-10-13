/**
 * Роли и права.
 *
 * В SQLite нет перечислений, поэтому «роли» — это строки, а список допустимых
 * значений живёт здесь. Проверка прав всегда на сервере (`requireAdmin`): роль
 * приходит из httpOnly-сессии, а не из localStorage клиента.
 */

export const ROLES = ["user", "moderator", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const DEFAULT_ROLE: Role = "user";

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function asRole(value: unknown): Role {
  return isRole(value) ? value : DEFAULT_ROLE;
}

/** Ранг для сравнения «кто главнее»: admin > moderator > user */
const RANK: Record<Role, number> = { user: 0, moderator: 1, admin: 2 };

export function atLeast(role: string, required: Role): boolean {
  return (RANK[asRole(role)] ?? 0) >= RANK[required];
}

export const ROLE_LABELS: Record<Role, string> = {
  user: "Пользователь",
  moderator: "Модератор",
  admin: "Администратор",
};

/* ----------------------------- Права по разделам ------------------------ */

/**
 * Что конкретно может делать роль. Матрица хранится в коде, а не в БД:
 * набор разделов меняется вместе с самими разделами, и разъезжающийся
 * интерфейс настроек — источник ошибок. Если понадобится прав на уровне
 * отдельных действий, добавляем ключи сюда.
 */
export const PERMISSIONS = {
  /** Просмотр панели */
  panel: "panel",
  /** Пользователи: бан, роли, Premium, сброс пароля */
  users: "users",
  /** Модерация: жалобы, комментарии, чат, баны */
  moderation: "moderation",
  /** Контент: баннеры, слайды, страницы */
  content: "content",
  /** Экономика: сезоны, награды, магазин, промокоды */
  economy: "economy",
  /** Настройки, флаги, рассылки, аудит-лог */
  settings: "settings",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const USER_PERMISSIONS: Permission[] = [];
const MODERATOR_PERMISSIONS: Permission[] = [
  PERMISSIONS.panel,
  PERMISSIONS.users,
  PERMISSIONS.moderation,
];
const ADMIN_PERMISSIONS: Permission[] = [
  PERMISSIONS.panel,
  PERMISSIONS.users,
  PERMISSIONS.moderation,
  PERMISSIONS.content,
  PERMISSIONS.economy,
  PERMISSIONS.settings,
];

export function permissionsFor(role: string): Permission[] {
  switch (asRole(role)) {
    case "admin":
      return [...ADMIN_PERMISSIONS];
    case "moderator":
      return [...MODERATOR_PERMISSIONS];
    default:
      return [...USER_PERMISSIONS];
  }
}

export function can(role: string, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}

/** Подпись раздела панели для заголовка и хлебных крошек */
export const PERMISSION_LABELS: Record<Permission, string> = {
  panel: "Панель",
  users: "Пользователи",
  moderation: "Модерация",
  content: "Контент",
  economy: "Экономика",
  settings: "Настройки",
};