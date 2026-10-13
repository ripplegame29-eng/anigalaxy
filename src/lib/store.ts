"use client";

import { useSyncExternalStore } from "react";

import { dayKeyOf, systemTz } from "./progression/time";

/**
 * Фабрика локального стора поверх localStorage.
 *
 * Тот же приём, что в `lib/quality.ts` и `lib/auth-dialog.ts`: состояние
 * живёт вне React, компоненты подписываются через `useSyncExternalStore`.
 * Сервер всегда отдаёт значение по умолчанию — так гидратация совпадает
 * с первым клиентским рендером, а «прочитать в эффекте и сделать setState»
 * (запрещено линтером проекта) не требуется.
 *
 * Снимок обязан быть стабильным по ссылке, поэтому состояние кэшируется
 * в замыкании и меняется только через `set`/`update`.
 */
export interface LocalStore<T> {
  readonly key: string;
  subscribe(listener: () => void): () => void;
  /** Текущее значение (в SSR — всегда `fallback`) */
  get(): T;
  getServer(): T;
  set(next: T): void;
  update(fn: (current: T) => T): void;
  /** Хук для компонента: подписан на изменения стора */
  useStore(): T;
}

export function createLocalStore<T>(
  key: string,
  fallback: T,
  parse?: (raw: string) => T | null,
): LocalStore<T> {
  const listeners = new Set<() => void>();
  let cached: T | undefined;
  let loaded = false;

  const read = (): T => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      if (parse) return parse(raw) ?? fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  const get = (): T => {
    if (typeof window === "undefined") return fallback;
    if (!loaded) {
      loaded = true;
      cached = read();
    }
    return cached ?? fallback;
  };

  const getServer = (): T => fallback;

  const emit = (): void => {
    for (const listener of listeners) listener();
  };

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    // Синхронизация между вкладками: storage приходит только на чужих
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      loaded = true;
      cached = read();
      emit();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };

  const set = (next: T): void => {
    if (typeof window !== "undefined") get();
    cached = next;
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* приватный режим или переполнение квоты — держим значение в памяти */
    }
    emit();
  };

  const update = (fn: (current: T) => T): void => set(fn(get()));

  const useStore = (): T => useSyncExternalStore(subscribe, get, getServer);

  return { key, subscribe, get, getServer, set, update, useStore };
}

/**
 * «YYYY-MM-DD» для момента времени — ключ дневных счётчиков и квестов.
 *
 * Считается в часовом поясе пользователя, а не в UTC. Это не косметика:
 * `toISOString()` всегда отдаёт UTC, поэтому у игрока в UTC+3 между 00:00 и
 * 03:00 по местному «сегодня» ещё было вчера по UTC. Движок прогрессии при
 * этом считал сутки правильно (по `ctx.tz`), и в эти три часа он и профиль
 * с кланами считали разные дни: дневной квест обнулялся не там, где
 * показывала панель, а «серия» могла сдвинуться на сутки назад.
 *
 * Принимает и `Date`, и миллисекунды: вызывающие места зовут функцию по-разному
 * (store-овские — `new Date()`, клановые — `Date.now()`), и менять их все
 * разом — лишний риск в момент правки бага.
 */
export function dayKey(when: Date | number = Date.now(), tz: string = systemTz()): string {
  return dayKeyOf(when instanceof Date ? when.getTime() : when, tz);
}

/** Короткий id для локальных записей */
export function localId(prefix = "id"): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
