"use client";

"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Чтение значения из localStorage через `useSyncExternalStore`.
 *
 * Такая схема выбрана сознательно: гидратация должна совпасть с серверным
 * HTML (на сервере хранилища нет → пустое значение), а «прочитать в
 * useEffect и сделать setState» запрещено линтером проекта
 * (`react-hooks/set-state-in-effect`) и устраивает лишний рендер.
 */
export function useLocalSnapshot(key: string): string {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === key) onChange();
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
    [key],
  );

  const getSnapshot = useCallback(() => {
    try {
      return window.localStorage.getItem(key) ?? "";
    } catch {
      return "";
    }
  }, [key]);

  const getServerSnapshot = useCallback(() => "", []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Разбирает JSON-массив из снимка хранилища, при любой ошибке — пусто */
export function parseList<T>(raw: string, fallback: T[]): T[] {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

/** Закрывает окно по Escape, блокирует прокрутку и ставит фокус на панель */
export function useModalBehaviour(
  open: boolean,
  close: () => void,
): React.RefObject<HTMLDivElement | null> {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return panelRef;
}
