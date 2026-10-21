"use client";

/**
 * Общая оценка тайтла (все игроки, сервер) поверх личной оценки
 * (`lib/ratings.ts`, локальная и зеркалится через общую синхронизацию).
 *
 * Сервер не умеет «снять оценку» (это право есть только у локального
 * режима — повторное нажатие убирает её из браузера), поэтому отправляем
 * на сервер только выставление, а отмену — нет: прежняя оценка останется
 * в общем счёте, что честнее, чем тайно подменять чужую статистику.
 *
 * Как и остальные сторы проекта (`lib/store.ts`), данные живут вне React:
 * запрос уходит из `subscribe`, а не из эффекта с `setState`.
 */

import { useCallback, useSyncExternalStore } from "react";

interface AvgReply {
  avg: number;
  votes: number;
}

const EMPTY: AvgReply = { avg: 0, votes: 0 };

const cache = new Map<string, AvgReply>();
const listeners = new Map<string, Set<() => void>>();
const requested = new Set<string>();

function notify(titleId: string): void {
  listeners.get(titleId)?.forEach((fn) => fn());
}

async function fetchAvg(titleId: string): Promise<void> {
  try {
    const response = await fetch(`/api/ratings?title=${encodeURIComponent(titleId)}`, { credentials: "same-origin" });
    const data = (await response.json()) as Partial<AvgReply> | null;
    if (typeof data?.avg === "number" && typeof data?.votes === "number") {
      cache.set(titleId, { avg: data.avg, votes: data.votes });
      notify(titleId);
    }
  } catch {
    /* сеть недоступна — остаёмся без общей оценки */
  } finally {
    requested.delete(titleId);
  }
}

/** Средняя оценка всех игроков по тайтлу (0 голосов, пока не пришёл ответ) */
export function useTitleAvgRating(titleId: string): AvgReply {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!titleId) return () => {};
      if (!listeners.has(titleId)) listeners.set(titleId, new Set());
      const set = listeners.get(titleId)!;
      set.add(onChange);
      if (!cache.has(titleId) && !requested.has(titleId)) {
        requested.add(titleId);
        void fetchAvg(titleId);
      }
      return () => set.delete(onChange);
    },
    [titleId],
  );
  const getSnapshot = useCallback(() => cache.get(titleId) ?? EMPTY, [titleId]);
  const getServerSnapshot = useCallback(() => EMPTY, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Отправить мою оценку в общий счёт (без await — страница не ждёт сеть) */
export function syncTitleRating(titleId: string, score: number): void {
  void fetch("/api/ratings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ titleId, score }),
  })
    .then((response) => response.json())
    .then((data: Partial<AvgReply> | null) => {
      if (typeof data?.avg === "number" && typeof data?.votes === "number") {
        cache.set(titleId, { avg: data.avg, votes: data.votes });
        notify(titleId);
      }
    })
    .catch(() => {
      /* не вошли или сеть недоступна — личная оценка всё равно сохранена локально */
    });
}
