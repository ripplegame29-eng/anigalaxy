"use client";

/**
 * Тосты наград (§12.6): короткие всплывашки над контентом — игрок сразу
 * видит, что и за что получил. Состояние вне React (как у модалки профиля),
 * записи дублируются в раздел «Уведомления» профиля — тосты уходят, а
 * история остаётся.
 *
 * Тосты ничего не начисляют: их собирает `ToastHost` из эффектов движка.
 */

export type ToastKind = "xp" | "level" | "achievement" | "tag" | "quest" | "ac" | "premium";

export interface ToastInput {
  kind: ToastKind;
  title: string;
  text?: string;
  /** для тоста о теге: id тега, чтобы показать саму капсулу */
  tagId?: string;
}

export interface ToastItem extends ToastInput {
  id: string;
}

/** Сколько тостов видно одновременно (остальное очередь) */
const MAX_VISIBLE = 4;

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();

/** SSR-фолбэк: сервер тосты не показывает (ссылка обязана быть стабильной —
 *  иначе React в dev-режиме пишет «getServerSnapshot should be cached») */
const NO_TOASTS: ToastItem[] = [];

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts(): ToastItem[] {
  return items;
}

/** SSR-фолбэк: сервер тосты не показывает */
export function getServerToasts(): ToastItem[] {
  return NO_TOASTS;
}

export function pushToast(input: ToastInput): string {
  seq += 1;
  const item: ToastItem = { ...input, id: `toast-${seq}` };
  items = [item, ...items].slice(0, MAX_VISIBLE);
  emit();
  return item.id;
}

export function dismissToast(id: string): void {
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) return;
  items = next;
  emit();
}

/** Тесты/dev: очистить очередь */
export function clearToasts(): void {
  if (!items.length) return;
  items = [];
  emit();
}
