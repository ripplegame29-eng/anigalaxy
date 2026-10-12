/**
 * Кэш в памяти процесса со stale-while-revalidate.
 *
 * Вынесен из `lib/kodik.ts`, потому что им пользуется и Shikimori, а
 * проверять поведение удобно только когда оно не спрятано в модуле с
 * сетевыми запросами и настройками окружения.
 *
 * Зачем stale-while-revalidate. Прежний вариант по истечении TTL удалял запись
 * и следующий запрос **ждал** внешний источник. Главная дёргает шесть рядов
 * подряд, и каждое ожидание упиралось в собственный 12-секундный таймаут —
 * отсюда полуминутное открытие страницы, когда Kodik отвечает медленно.
 *
 * Теперь протукшее значение отдаётся немедленно, а обновление уходит в фон.
 * Если источник лежит совсем, отдаётся последнее известное значение: аниме
 * в каталоге за вчера лучше, чем 502.
 */

export interface CacheEntry {
  /** Момент, после которого значение считается протукшим. */
  expires: number;
  /** Момент, после которого протукшее значение окончательно выбрасывается. */
  dropAt: number;
  value: unknown;
}

const cache = new Map<string, CacheEntry>();

/** Ключи, которые уже обновляются: не даём запустить десять одинаковых запросов. */
const refreshing = new Set<string>();

/** Больше этого — вход забывается, чтобы кэш не рос без границ. */
const MAX_ENTRIES = 500;

/**
 * Сколько протукшее значение живёт после истечения TTL.
 *
 * Полчаса — с запасом на несколько неудачных обновлений подряд. Пока окно
 * не кончилось, сайт отдаёт данные, даже если источник лежит сутки.
 */
export const STALE_GRACE_MS = 30 * 60_000;

function cacheSet(key: string, value: unknown, ttlMs: number, now: number): void {
  if (cache.size > MAX_ENTRIES) cache.clear();
  cache.set(key, { expires: now + ttlMs, dropAt: now + ttlMs + STALE_GRACE_MS, value });
}

/**
 * Читает значение с кэшированием.
 *
 * Поведение по веткам:
 * - свежая запись — отдаём и всё;
 * - протукшая, но в пределах grace — отдаём сразу, обновляем в фоне;
 * - записи нет вовсе — приходится ждать, иначе нечего показать;
 * - источник лежит, но запись ещё не выброшена — отдаём её, чтобы сайт
 *   не ложился вместе с внешним API.
 */
export async function withCache<T>(
  key: string,
  ttlMs: number,
  producer: () => Promise<T>,
): Promise<T> {
  const hit = cache.get(key);
  const now = Date.now();

  if (hit && hit.expires > now) return hit.value as T;

  if (hit) {
    if (!refreshing.has(key)) {
      refreshing.add(key);
      // Ошибка фонового обновления проглатывается намеренно: значение,
      // которое мы отдаём, остаётся годным, а падение здесь уронило бы
      // рендер поверх ничего.
      void producer()
        .then((value) => cacheSet(key, value, ttlMs, Date.now()))
        .catch(() => {})
        .finally(() => refreshing.delete(key));
    }
    return hit.value as T;
  }

  try {
    const value = await producer();
    cacheSet(key, value, ttlMs, Date.now());
    return value;
  } catch (error: unknown) {
    // Запись могла появиться, пока шёл этот запрос (две параллельные
    // выборки с пустым кэшем). Она лучше, чем ошибка.
    const late = cache.get(key);
    if (late) return late.value as T;
    throw error;
  }
}

/** Сбрасывает кэш. Нужен тестам и смене адреса источника на лету. */
export function clearCache(): void {
  cache.clear();
  refreshing.clear();
}