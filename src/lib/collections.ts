/**
 * Локальные подборки и избранное.
 *
 * Всё живёт в localStorage — аккаунтов у проекта нет, сервер ничего не хранит.
 * Модулю разрешён browser-API, поэтому отдельного «use client» не требуется:
 * импортировать его можно только из клиентских компонентов.
 */

export interface Collection {
  id: string;
  name: string;
  /** id тайтлов Kodik (`serial-29315`) */
  animeIds: string[];
  createdAt: number;
  /**
   * Видна ли подборка другим. У старых подборок поля нет — они считаются
   * публичными, иначе половина списка внезапно стала бы приватной.
   */
  pub?: boolean;
}

export const COLLECTIONS_KEY = "animehub:collections:v1";
export const FAVORITES_KEY = "animehub:favorites:v1";

const MAX_COLLECTIONS = 100;
const MAX_NAME = 48;

function available(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function read<T>(key: string, fallback: T): T {
  if (!available()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (!available()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* приватный режим или переполнение квоты — просто не сохраняем */
  }
}

export function sanitizeName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
}

/* --------------------------- Подборки -------------------------------- */

export function loadCollections(): Collection[] {
  const list = read<Collection[]>(COLLECTIONS_KEY, []);
  return list.filter(
    (item) =>
      item &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      Array.isArray(item.animeIds),
  );
}

export function saveCollections(list: Collection[]): void {
  write(COLLECTIONS_KEY, list.slice(0, MAX_COLLECTIONS));
}

/**
 * Создаёт подборку и сразу кладёт в неё тайл.
 *
 * `pub` — публичная или приватная (окно «В подборки» спрашивает это при
 * создании). Подборка с уже таким именем переиспользуется, а не дублируется.
 */
export function createCollection(
  name: string,
  animeId: string,
  options?: { pub?: boolean },
): Collection[] {
  const clean = sanitizeName(name);
  const list = loadCollections();
  if (!clean) return list;

  // Название не должно дублироваться — переиспользуем подборку
  const existing = list.find((item) => item.name.toLowerCase() === clean.toLowerCase());
  if (existing) {
    const next = list.map((item) =>
      item.id === existing.id && !item.animeIds.includes(animeId)
        ? { ...item, animeIds: [...item.animeIds, animeId] }
        : item,
    );
    saveCollections(next);
    return next;
  }

  const created: Collection = {
    id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: clean,
    animeIds: [animeId],
    createdAt: Date.now(),
    pub: options?.pub !== false,
  };
  const next = [created, ...list];
  saveCollections(next);
  return next;
}

/** Добавляет/убирает тайтл из подборки, возвращает новый список */
export function toggleInCollection(collectionId: string, animeId: string): Collection[] {
  const next = loadCollections().map((item) => {
    if (item.id !== collectionId) return item;
    return item.animeIds.includes(animeId)
      ? { ...item, animeIds: item.animeIds.filter((id) => id !== animeId) }
      : { ...item, animeIds: [...item.animeIds, animeId] };
  });
  saveCollections(next);
  return next;
}

/** Полная замена списка подборок (используется в разделе «Подборки» профиля) */
export function saveCollectionsList(list: Collection[]): void {
  saveCollections(list);
}

/** Удаление подборки по id */
export function deleteCollection(collectionId: string): Collection[] {
  const next = loadCollections().filter((item) => item.id !== collectionId);
  saveCollections(next);
  return next;
}

export function countFor(list: Collection[], animeId: string): number {
  return list.filter((item) => item.animeIds.includes(animeId)).length;
}

/* --------------------------- Избранное ------------------------------- */

export function loadFavorites(): string[] {
  return read<string[]>(FAVORITES_KEY, []).filter((id) => typeof id === "string");
}

export function isFavorite(animeId: string): boolean {
  return loadFavorites().includes(animeId);
}

export function toggleFavorite(animeId: string): boolean {
  const list = loadFavorites();
  const next = list.includes(animeId)
    ? list.filter((id) => id !== animeId)
    : [animeId, ...list];
  write(FAVORITES_KEY, next);
  return next.includes(animeId);
}
