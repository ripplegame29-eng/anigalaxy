/**
 * Оценки тайтлов (1…10) — отдельный стор `animehub:ratings:v1`.
 *
 * Пользовательская оценка живёт отдельно от серверных рейтингов
 * Shikimori/Кинопоиск на странице тайтла. Изменение оценки XP не даёт
 * (движок начисляет «оценить тайтл» один раз на тайтл).
 */

export const RATINGS_KEY = "animehub:ratings:v1";

export interface Rating {
  /** Целая оценка 1…10 */
  score: number;
  at: number;
}

export const MIN_SCORE = 1;
export const MAX_SCORE = 10;

const MAX_ENTRIES = 5000;

function available(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readMap(): Record<string, Rating> {
  if (!available()) return {};
  try {
    const raw = window.localStorage.getItem(RATINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, Rating> = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      const rating = value as Partial<Rating> | null;
      if (
        typeof id === "string" &&
        id &&
        rating &&
        typeof rating.score === "number" &&
        Number.isFinite(rating.score) &&
        rating.score >= MIN_SCORE &&
        rating.score <= MAX_SCORE
      ) {
        out[id] = { score: Math.round(rating.score), at: Number(rating.at) || 0 };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, Rating>): void {
  if (!available()) return;
  try {
    const entries = Object.entries(map).slice(0, MAX_ENTRIES);
    window.localStorage.setItem(RATINGS_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* приватный режим или переполнение квоты — не сохраняем */
  }
}

export function loadRatings(): Record<string, Rating> {
  return readMap();
}

export function getRating(titleId: string): number | null {
  return readMap()[titleId]?.score ?? null;
}

/**
 * Ставит оценку. Повторное нажатие на текущую оценку снимает её
 * (возврат к «без оценки») — возвращает null.
 */
export function setRating(titleId: string, score: number): number | null {
  if (!Number.isFinite(score) || score < MIN_SCORE || score > MAX_SCORE) return null;
  const rounded = Math.round(score);
  const map = readMap();
  if (map[titleId]?.score === rounded) {
    delete map[titleId];
    writeMap(map);
    return null;
  }
  map[titleId] = { score: rounded, at: Date.now() };
  writeMap(map);
  return rounded;
}
