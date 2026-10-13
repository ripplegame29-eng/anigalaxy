/**
 * Типы управляемого контента — чистые данные, без базы и без серверных импортов.
 *
 * Отдельный файл не для красоты: `CONTENT_KINDS` нужен и серверной валидации,
 * и клиентскому редактору. Если держать его рядом с `getActiveBlocks`, то
 * клиентский компонент потянет за собой `server-only` и сборка упадёт.
 *
 * Описание здесь единственное: панель валидирует по нему payload, а подсказка
 * в форме рисуется из него же.
 */

export const CONTENT_KINDS = {
  hero_slide: {
    label: "Слайд главной",
    hint: "Показывается в hero-слайдере на главной",
    fields: [
      { name: "title", label: "Заголовок", required: true },
      { name: "poster", label: "Ссылка на постер", required: true },
      { name: "link", label: "Ссылка при клике", required: true },
      { name: "description", label: "Описание", required: false },
      { name: "video", label: "Ссылка на ролик (опционально)", required: false },
    ],
    example: {
      title: "Покорённый титан",
      poster: "https://shikimori.io/uploads/poster/animes/52299/poster.jpeg",
      link: "/title/serial-56366",
      description: "Четвёртый сезон уже в каталоге",
    },
  },
  banner: {
    label: "Баннер",
    hint: "Полоса под шапкой или между рядами",
    fields: [
      { name: "title", label: "Заголовок", required: true },
      { name: "link", label: "Ссылка", required: true },
      { name: "image", label: "Ссылка на картинку", required: false },
      { name: "description", label: "Текст", required: false },
    ],
    example: {
      title: "Ранний доступ открыт",
      link: "/premium",
      description: "Все тарифы до конца месяца",
    },
  },
  notice: {
    label: "Объявление",
    hint: "Плашка поверх страницы, для срочных сообщений",
    fields: [
      { name: "title", label: "Заголовок", required: true },
      { name: "text", label: "Текст", required: true },
      { name: "link", label: "Ссылка", required: false },
    ],
    example: {
      title: "Технические работы",
      text: "Сегодня с 04:00 до 06:00 по Москве",
    },
  },
} as const satisfies Record<
  string,
  {
    label: string;
    hint: string;
    fields: readonly { name: string; label: string; required: boolean }[];
    example: Record<string, string>;
  }
>;

export type ContentKind = keyof typeof CONTENT_KINDS;

export const CONTENT_KIND_NAMES = Object.keys(CONTENT_KINDS) as ContentKind[];

/** Обязательные поля типа — выводим из описания, второго списка не заводим. */
export function requiredFields(kind: ContentKind): string[] {
  return CONTENT_KINDS[kind].fields.filter((f) => f.required).map((f) => f.name);
}

/** Все допустимые поля типа — обязательные плюс необязательные. */
export function allowedFields(kind: ContentKind): Set<string> {
  return new Set(CONTENT_KINDS[kind].fields.map((f) => f.name));
}

/** Поля, которые уходят в href/src и потому требуют проверки схемы. */
export const URL_FIELDS = ["link", "poster", "image", "video"] as const;