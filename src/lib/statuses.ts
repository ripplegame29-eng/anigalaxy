/**
 * Статусы тайтлов в списках: «Буду смотреть», «Смотрю», «Просмотрено», «Брошено».
 *
 * Отдельный стор (`animehub:statuses:v1`), как требует PROMPT: списки —
 * независимая от избранного/подборок сущность. Модулю разрешён browser-API,
 * импортировать можно только из клиентских компонентов.
 */

export const STATUSES_KEY = "animehub:statuses:v1";

export type WatchStatus = "planned" | "watching" | "completed" | "dropped";

/** Порядок отображения в интерфейсе */
export const STATUS_ORDER: WatchStatus[] = ["planned", "watching", "completed", "dropped"];

export const STATUS_LABEL: Record<WatchStatus, string> = {
  planned: "Буду смотреть",
  watching: "Смотрю",
  completed: "Просмотрено",
  dropped: "Брошено",
};

const VALID: ReadonlySet<string> = new Set(STATUS_ORDER);
const MAX_ENTRIES = 5000;

function available(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readMap(): Record<string, WatchStatus> {
  if (!available()) return {};
  try {
    const raw = window.localStorage.getItem(STATUSES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, WatchStatus> = {};
    for (const [id, status] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof id === "string" && id && typeof status === "string" && VALID.has(status)) {
        out[id] = status as WatchStatus;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, WatchStatus>): void {
  if (!available()) return;
  try {
    const entries = Object.entries(map).slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STATUSES_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* приватный режим или переполнение квоты — не сохраняем */
  }
}

export function loadStatuses(): Record<string, WatchStatus> {
  return readMap();
}

export function getStatus(titleId: string): WatchStatus | null {
  return readMap()[titleId] ?? null;
}

/**
 * Ставит/меняет статус. Повторное нажатие на текущий статус снимает его
 * (возврат к «без статуса») — возвращает null.
 */
export function setStatus(titleId: string, status: WatchStatus): WatchStatus | null {
  const map = readMap();
  if (map[titleId] === status) {
    delete map[titleId];
    writeMap(map);
    return null;
  }
  map[titleId] = status;
  writeMap(map);
  return status;
}
