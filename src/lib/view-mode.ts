/**
 * Режим просмотра чужого профиля (`/u/<ник>`).
 *
 * Страница подменяет localStorage документа данными игрока (см.
 * `ViewShell`), поэтому в этом режиме нельзя ничего отправлять на сервер
 * и начислять — иначе чужие данные попали бы в аккаунт зрителя.
 */

export const VIEW_FLAG = "__AG_VIEW__";

/** Ник просматриваемого игрока или null, если режим выключен */
export function viewedNickname(): string | null {
  if (typeof window === "undefined") return null;
  const value = (window as unknown as Record<string, unknown>)[VIEW_FLAG];
  return typeof value === "string" ? value : null;
}

export const isViewMode = (): boolean => viewedNickname() !== null;

/** Сообщение основной странице: чужой профиль живёт во вложенном окне */
export type ViewMessage = { type: "ag-nav"; href: string } | { type: "ag-auth" };

export function postToParent(message: ViewMessage): void {
  if (typeof window === "undefined" || window.parent === window) return;
  window.parent.postMessage(message, window.location.origin);
}
