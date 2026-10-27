/**
 * Какие локальные хранилища браузера зеркалятся в серверную базу.
 *
 * Модуль общий для клиента и сервера: сервер принимает только эти ключи,
 * клиент отправляет только их. Всё остальное остаётся на устройстве
 * (аккаунт, привязанные устройства, резервные копии и служебные метки).
 */

const SYNC_PREFIXES = ["animehub:", "anigalaxy:", "anigalaxy."];

/** Ключи, которые остаются на устройстве */
const LOCAL_ONLY = new Set<string>([
  "animehub:account:v1",
  "animehub:devices:v1",
  "animehub:backup:preimport:v1",
  "animehub:schedule:notified",
  "animehub:catalog-density",
  "animehub:sync:meta:v1",
]);

const KEY_RE = /^[A-Za-z0-9:._-]{3,80}$/;

/** Лимиты, защищающие базу от мусора */
export const MAX_DOC_BYTES = 1024 * 1024;
export const MAX_DOCS_PER_USER = 150;

/**
 * Профиль хранит аватар и свой фон картинками (до 4 и 6 МБ), поэтому ему
 * нужен запас: с лимитом в 1 МБ он тихо не доезжал до сервера, и в рейтингах
 * не было ни аватара, ни фона игрока.
 */
const PROFILE_DOC_KEY = "animehub:profile:v1";
const MAX_PROFILE_DOC_BYTES = 16 * 1024 * 1024;

export function maxDocBytes(key: string): number {
  return key === PROFILE_DOC_KEY ? MAX_PROFILE_DOC_BYTES : MAX_DOC_BYTES;
}

export function isSyncKey(key: string): boolean {
  if (!KEY_RE.test(key)) return false;
  if (LOCAL_ONLY.has(key)) return false;
  return SYNC_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/** Ключ документа прогресса (по нему считаются рейтинги) */
export const PROGRESS_DOC_KEY = "animehub:progress:v1";
