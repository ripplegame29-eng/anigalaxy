/**
 * Разделы панели: подпись, адрес, требуемое право.
 *
 * Один список на весь интерфейс: боковое меню, поиск по «/» и счётчики
 * берут его отсюда, поэтому новый раздел добавляется одной строкой.
 *
 * `icon` — путь внутри viewBox 24×24. Обводка задаётся в admin.css
 * (.ag-navlink svg), поэтому здесь только геометрия.
 */

import type { Permission } from "@/lib/roles";

export interface AdminSection {
  href: string;
  label: string;
  permission: Permission;
  /** Группа в меню. null — раздел стоит над группами, без подписи. */
  group: string | null;
  icon: string;
  /** Короткое пояснение для строки поиска. */
  hint: string;
}

export const ADMIN_SECTIONS: AdminSection[] = [
  {
    href: "/admin",
    label: "Обзор",
    permission: "panel",
    group: null,
    icon: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    hint: "Состояние сайта и последние действия администраторов",
  },
  {
    href: "/admin/users",
    label: "Пользователи",
    permission: "users",
    group: "Сообщество",
    icon: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.8a3.5 3.5 0 010 6.4M18 14.8c2 .7 3.2 2.4 3.5 5.2"/>',
    hint: "Роли, баны, снятие ограничений",
  },
  {
    href: "/admin/moderation",
    label: "Модерация",
    permission: "moderation",
    group: "Сообщество",
    icon: '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/>',
    hint: "Жалобы игроков и разбор спорных ситуаций",
  },
  {
    href: "/admin/content",
    label: "Контент",
    permission: "content",
    group: "Сайт",
    icon: '<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>',
    hint: "Блоки главной: баннеры, слайдеры, объявления",
  },
  {
    href: "/admin/economy",
    label: "Экономика",
    permission: "economy",
    group: "Сайт",
    icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1 1-1.8 2.5-1.8s2.5.8 2.5 1.8-1 1.6-2.5 2-2.5 1-2.5 2 1 1.8 2.5 1.8 2.5-.8 2.5-1.8"/>',
    hint: "Прогресс игроков, промокоды, сезоны",
  },
  {
    href: "/admin/errors",
    label: "Журнал ошибок",
    permission: "settings",
    group: "Система",
    icon: '<rect x="7" y="8" width="10" height="11" rx="5"/><path d="M9 8a3 3 0 016 0M12 12v7M3 12h4M17 12h4M4 6l3 2M20 6l-3 2M4 19l3-2M20 19l-3-2"/>',
    hint: "Сбои парсеров, страниц и клиента",
  },
  {
    href: "/admin/settings",
    label: "Настройки",
    permission: "settings",
    group: "Система",
    icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    hint: "Тумблеры механик, конфигурация, здоровье API",
  },
];