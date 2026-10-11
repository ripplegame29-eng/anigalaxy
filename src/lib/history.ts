"use client";

import { createLocalStore, dayKey, localId } from "./store";

/**
 * Локальная история просмотра и счётчики статистики.
 *
 * Плеер Kodik встроен чужим iframe — реальный прогресс сериала прочитать
 * нельзя, поэтому история фиксирует сам факт открытия серии, а «минуты
 * просмотра» считаются как время, пока блок плеера виден на экране
 * (WatchBox зовёт `tickWatch` раз в 15 секунд).
 */

export interface WatchRecord {
  /** id тайтла Kodik (`serial-29315`) */
  id: string;
  title: string;
  season: number;
  episode: number;
  /** Когда открыли, мс */
  at: number;
  poster?: string;
}

export interface WatchState {
  records: WatchRecord[];
  /** Сколько секунд плеер был на виду всего */
  seconds: number;
  /** Ключ дня для дневных счётчиков */
  day: string;
  /** Секунды за сегодня */
  daySeconds: number;
  /** Открытых серий за сегодня */
  dayEpisodes: number;
}

const EMPTY: WatchState = {
  records: [],
  seconds: 0,
  day: dayKey(),
  daySeconds: 0,
  dayEpisodes: 0,
};

function parse(raw: string): WatchState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<WatchState>;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.records)) return null;
    return {
      records: parsed.records.filter(
        (item): item is WatchRecord =>
          Boolean(item) && typeof item.id === "string" && typeof item.title === "string",
      ),
      seconds: typeof parsed.seconds === "number" ? parsed.seconds : 0,
      day: typeof parsed.day === "string" ? parsed.day : dayKey(),
      daySeconds: typeof parsed.daySeconds === "number" ? parsed.daySeconds : 0,
      dayEpisodes: typeof parsed.dayEpisodes === "number" ? parsed.dayEpisodes : 0,
    };
  } catch {
    return null;
  }
}

export const watchStore = createLocalStore<WatchState>(
  "animehub:history:v1",
  EMPTY,
  parse,
);

/** Сбрасывает дневные счётчики, если наступил новый день */
function rollover(state: WatchState): WatchState {
  const today = dayKey();
  if (state.day === today) return state;
  return { ...state, day: today, daySeconds: 0, dayEpisodes: 0 };
}

export interface WatchInput {
  id: string;
  title: string;
  season: number;
  episode: number;
  poster?: string;
}

/** Отметить открытие серии: поднимает её в начало истории */
export function recordWatch(input: WatchInput): void {
  watchStore.update((state) => {
    const current = rollover(state);
    const rest = current.records.filter(
      (item) => !(item.id === input.id && item.episode === input.episode && item.season === input.season),
    );
    const record: WatchRecord = {
      id: input.id,
      title: input.title,
      season: input.season,
      episode: input.episode,
      at: Date.now(),
      poster: input.poster,
    };
    return {
      ...current,
      records: [record, ...rest].slice(0, 120),
      dayEpisodes: current.dayEpisodes + 1,
    };
  });
}

/** Накопление секунд присутствия у плеера (шаг — 15 с) */
export function tickWatch(seconds: number): void {
  if (seconds <= 0) return;
  watchStore.update((state) => {
    const current = rollover(state);
    return {
      ...current,
      seconds: current.seconds + seconds,
      daySeconds: current.daySeconds + seconds,
    };
  });
}

export function removeWatch(id: string, episode: number, season: number): void {
  watchStore.update((state) => ({
    ...state,
    records: state.records.filter(
      (item) => !(item.id === id && item.episode === episode && item.season === season),
    ),
  }));
}

export function clearWatchHistory(): void {
  watchStore.update((state) => ({ ...state, records: [] }));
}

/* ------------------------------ Статистика ------------------------------ */

export interface WatchStats {
  /** Всего минут у плеера */
  minutes: number;
  /** Минут за сегодня */
  minutesToday: number;
  /** Уникальных тайтлов */
  titles: number;
  /** Открытых серий (всего записей) */
  episodes: number;
  /** Серий за сегодня */
  episodesToday: number;
}

export function watchStats(state: WatchState): WatchStats {
  const ids = new Set(state.records.map((item) => item.id));
  return {
    minutes: Math.floor(state.seconds / 60),
    minutesToday: Math.floor(state.daySeconds / 60),
    titles: ids.size,
    episodes: state.records.length,
    episodesToday: state.dayEpisodes,
  };
}

/** «5 минут назад», «вчера», дата */
export function timeAgo(at: number): string {
  const diff = Date.now() - at;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "вчера";
  if (days < 30) return `${days} дн. назад`;
  return new Date(at).toLocaleDateString("ru-RU");
}

export { localId };
