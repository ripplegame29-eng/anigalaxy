/**
 * Локальная «база данных» проекта: экспорт и импорт всех данных.
 *
 * Бэкенда нет (§0): база данных — это localStorage браузера с ключами
 * вида `animehub:*`. Хранилище уже версионировано и мигрируется
 * (`lib/migrate.ts`), здесь добавляется защита от потери:
 *
 *  1. **Экспорт** — все ключи собираются в один JSON-файл, который можно
 *     сохранить/перенести на другое устройство;
 *  2. **Импорт** — файл валидируется целиком ДО записи (метка формата,
 *     версия, только наши ключи), затем применяется: сначала запись,
 *     затем удаление лишнего — при ошибке старые данные не теряются;
 *  3. **Откат** — перед импортом текущее состояние снимается в
 *     `PREIMPORT_KEY`, его можно восстановить одной кнопкой.
 *
 * Ядро (`buildBackup`/`validateBackup`/`planRestore`) — чистые функции
 * без браузера, их покрывают юнит-тесты `tests/progression/backup.test.mjs`;
 * обёртки с `localStorage` — только для UI.
 */

export const BACKUP_FORMAT = "anigalaxy-backup";
export const BACKUP_VERSION = 1;
/** Префикс всех ключей проекта в localStorage */
export const BACKUP_KEY_PREFIX = "animehub:";
/** Снимок состояния перед импортом — даёт «откатить последний импорт» */
export const PREIMPORT_KEY = "animehub:backup:preimport:v1";

export interface BackupFile {
  format: string;
  version: number;
  /** Когда сделан экспорт, мс */
  exportedAt: number;
  /** Ключ → сырое значение (строка из localStorage, как есть) */
  keys: Record<string, string>;
}

export type BackupResult<T> = { ok: true; value: T } | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function done<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

/* ------------------------------ Чистое ядро ----------------------------- */

/**
 * Собирает бэкап из пар `[ключ, значение]`.
 * Берёт только ключи проекта (`animehub:*`), снимок отката не переносит —
 * он операционный и не должен уезжать в файл.
 */
export function buildBackup(entries: Iterable<[string, string]>): BackupFile {
  const keys: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (!key.startsWith(BACKUP_KEY_PREFIX)) continue;
    if (key === PREIMPORT_KEY) continue;
    keys[key] = value;
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: Date.now(), keys };
}

/** Полная проверка разобранного JSON перед записью — данные ещё не тронуты */
export function validateBackup(raw: unknown): BackupResult<BackupFile> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return fail("Файл не похож на бэкап AniGalaxy");
  }
  const candidate = raw as Partial<BackupFile>;
  if (candidate.format !== BACKUP_FORMAT) {
    return fail("В файле нет метки бэкапа AniGalaxy");
  }
  if (typeof candidate.version !== "number" || candidate.version > BACKUP_VERSION) {
    return fail("Версия файла новее поддерживаемой — обновите сайт");
  }
  if (typeof candidate.exportedAt !== "number") {
    return fail("Файл бэкапа повреждён (нет даты экспорта)");
  }
  if (!candidate.keys || typeof candidate.keys !== "object" || Array.isArray(candidate.keys)) {
    return fail("В файле нет данных");
  }
  for (const [key, value] of Object.entries(candidate.keys)) {
    if (!key.startsWith(BACKUP_KEY_PREFIX)) return fail(`Чужой ключ в файле: ${key}`);
    if (key === PREIMPORT_KEY) return fail("Снимок отката не должен попадать в бэкап");
    if (typeof value !== "string") return fail(`Некорректное значение ключа ${key}`);
  }
  return done({
    format: BACKUP_FORMAT,
    version: candidate.version,
    exportedAt: candidate.exportedAt,
    keys: { ...candidate.keys },
  });
}

/** Разбор текста файла: JSON + полная валидация */
export function parseBackup(text: string): BackupResult<BackupFile> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail("Это не JSON-файл бэкапа");
  }
  return validateBackup(raw);
}

export interface RestorePlan {
  /** Что записать: `[ключ, значение]` */
  set: Array<[string, string]>;
  /** Какие ключи проекта удалить (восстановление — точная копия файла) */
  remove: string[];
}

/**
 * План восстановления: записать всё из бэкапа и удалить лишние ключи
 * проекта. Снимок отката не удаляется — он пишется ДО применения плана.
 */
export function planRestore(backup: BackupFile, existingKeys: readonly string[]): RestorePlan {
  const incoming = new Set(Object.keys(backup.keys));
  const remove = existingKeys.filter(
    (key) => key.startsWith(BACKUP_KEY_PREFIX) && key !== PREIMPORT_KEY && !incoming.has(key),
  );
  return { set: Object.entries(backup.keys), remove };
}

/* --------------------------- Обёртки браузера --------------------------- */

function available(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStorage(): Storage | null {
  if (!available()) return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Все пары `localStorage` проекта (или null, если хранилища нет) */
export function storageEntries(): Array<[string, string]> | null {
  const storage = readStorage();
  if (!storage) return null;
  try {
    const out: Array<[string, string]> = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key === null) continue;
      out.push([key, storage.getItem(key) ?? ""]);
    }
    return out;
  } catch {
    return null;
  }
}

/** Сколько ключей проекта лежит в хранилище и сколько они занимают */
export function storageStats(): { count: number; bytes: number } {
  const entries = storageEntries();
  if (!entries) return { count: 0, bytes: 0 };
  let count = 0;
  let bytes = 0;
  for (const [key, value] of entries) {
    if (!key.startsWith(BACKUP_KEY_PREFIX)) continue;
    count += 1;
    bytes += key.length + value.length;
  }
  return { count, bytes };
}

/** Имя файла бэкапа: `anigalaxy-backup-2026-10-06.json` */
export function backupFileName(at: number = Date.now()): string {
  return `anigalaxy-backup-${new Date(at).toISOString().slice(0, 10)}.json`;
}

/**
 * Экспорт: собирает все ключи и отдаёт файл на скачивание.
 * Возвращает количество сохранённых ключей.
 */
export function exportBackup(): BackupResult<number> {
  const entries = storageEntries();
  if (!entries) return fail("Хранилище браузера недоступно (приватный режим?)");
  const backup = buildBackup(entries);
  const count = Object.keys(backup.keys).length;
  if (count === 0) return fail("Нет данных для экспорта");
  try {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = backupFileName(backup.exportedAt);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return done(count);
  } catch {
    return fail("Не удалось сохранить файл — возможно, браузер блокирует загрузки");
  }
}

/**
 * Импорт: снимок текущего состояния → запись данных файла → удаление
 * лишних ключей. Возвращает число записанных и удалённых ключей.
 */
export function importBackup(
  backup: BackupFile,
): BackupResult<{ restored: number; removed: number }> {
  const storage = readStorage();
  const entries = storageEntries();
  if (!storage || !entries) return fail("Хранилище браузера недоступно (приватный режим?)");

  // Страховочный снимок текущего состояния — «откатить последний импорт»
  try {
    const snapshot = buildBackup(entries);
    storage.setItem(PREIMPORT_KEY, JSON.stringify(snapshot));
  } catch {
    return fail("Недостаточно места в хранилище для снимка перед импортом");
  }

  const plan = planRestore(backup, entries.map(([key]) => key));
  try {
    for (const [key, value] of plan.set) storage.setItem(key, value);
    for (const key of plan.remove) storage.removeItem(key);
  } catch {
    // Запись упала на середине: старые ключи, не входящие в бэкап, ещё не
    // удалены — состояние читаемо, откат по снимку работает.
    return fail("Недостаточно места в хранилище — файл не поместился");
  }
  return done({ restored: plan.set.length, removed: plan.remove.length });
}

/** Есть ли снимок для отката (показывать кнопку «Откатить импорт») */
export function hasPreimport(): boolean {
  const storage = readStorage();
  if (!storage) return false;
  try {
    return storage.getItem(PREIMPORT_KEY) !== null;
  } catch {
    return false;
  }
}

/** Откат последнего импорта: восстановить снимок и убрать его */
export function rollbackImport(): BackupResult<number> {
  const storage = readStorage();
  if (!storage) return fail("Хранилище браузера недоступно");
  try {
    const raw = storage.getItem(PREIMPORT_KEY);
    if (!raw) return fail("Снимка для отката нет");
    const parsed = parseBackup(raw);
    if (!parsed.ok) return parsed;
    const entries = storageEntries() ?? [];
    const plan = planRestore(parsed.value, entries.map(([key]) => key));
    for (const [key, value] of plan.set) storage.setItem(key, value);
    for (const key of plan.remove) storage.removeItem(key);
    storage.removeItem(PREIMPORT_KEY);
    return done(plan.set.length);
  } catch {
    return fail("Не удалось откатить импорт");
  }
}
