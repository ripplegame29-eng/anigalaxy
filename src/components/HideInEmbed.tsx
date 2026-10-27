"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const noop = () => () => undefined;
const embedded = () => {
  try {
    return window.self !== window.top && new URLSearchParams(window.location.search).has("embed");
  } catch {
    return false;
  }
};

/**
 * Страница, открытая внутри макета телефона (`?embed=1` в iframe), не должна
 * показывать всплывающие окна, чат и бонусы: это витрина, а не сессия игрока.
 */
export function HideInEmbed({ children }: { children: ReactNode }) {
  const hidden = useSyncExternalStore(noop, embedded, () => false);
  return hidden ? null : <>{children}</>;
}
