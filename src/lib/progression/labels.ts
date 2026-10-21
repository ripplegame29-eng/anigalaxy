/**
 * Человекочитаемые подписи источников наград: общие для тостов (§12.6)
 * и журнала «История XP и AC» (§12.5). Словарь — данные: новый источник
 * XP добавляется строкой сюда, логика не меняется.
 */

const SOURCE_LABELS: Record<string, string> = {
  SESSION_START: "Ежедневный вход",
  EP_COMPLETE: "Досмотр серии",
  EPISODE_TICK: "Просмотр (heartbeat)",
  TITLE_WATCHED: "Тайтл просмотрен",
  TITLE_COMPLETED: "Тайтл завершён",
  LIST_FAVORITE: "Добавлено в избранное",
  LIST_PLANNED: "Добавлено в планы",
  LIST_WATCHED: "Отмечено просмотренным",
  TITLE_RATED: "Оценка тайтла",
  COMMENT_FIRST: "Первый комментарий",
  COMMENT_NEXT: "Комментарий",
  COMMENT_REPLY: "Ответ на комментарий",
  LIKE_GIVEN: "Лайк",
  LIKE_RECEIVED: "Лайк в ваш ответ",
  PROFILE_AVATAR: "Аватар установлен",
  PROFILE_BIO: "Описание профиля",
  PROFILE_GENRES: "Любимые жанры",
  PROFILE_SHOWCASE: "Витрина заполнена",
  PROFILE_COMPLETE: "Профиль заполнен",
  PROFILE_COMPLETED: "Профиль заполнен",
  ACHIEVEMENT: "Достижение",
  QUEST: "Квест",
  STREAK_BONUS: "Бонус серии",
  STREAK: "Серия посещений",
  DAILY_LOGIN: "Ежедневный вход",
  LEVEL: "Уровень",
  SHOP: "Покупка в магазине",
  ADMIN: "Выдача администратором",
  MIGRATION: "Перенос старых данных",
  LEGACY_DELTA: "Перенос из старой системы",
  REVERSAL: "Откат награды",
  SEASON: "Сезонное событие",
  LEADERBOARD: "Итоги недели лидерборда",
  TAG: "Тег",
  FREEZE: "Заморозка серии",
};

/** Источник → подпись (неизвестный источник показывается как есть) */
export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

/** Тип записи журнала → подпись (тип = ruleId / id достижения / «покупка») */
export function typeLabel(type: string): string {
  if (type.startsWith("ach_")) return "Достижение";
  if (type.startsWith("qd_") || type.startsWith("qw_")) return "Квест";
  if (type.startsWith("tag_") || type.startsWith("svc_")) return "Покупка";
  return SOURCE_LABELS[type] ?? type;
}

/** Валюта и знак операции → цветная подпись суммы */
export function amountLabel(currency: "XP" | "AC", amount: number): string {
  return `${amount > 0 ? "+" : ""}${amount} ${currency}`;
}
