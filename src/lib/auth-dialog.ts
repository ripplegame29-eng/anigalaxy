/**
 * Глобальное состояние модалки авторизации.
 *
 * Диалог один на всё приложение и живёт в шапке, а открывать его могут любые
 * клиентские компоненты (кнопка «Войти», тарифы на странице Premium,
 * пункт меню профиля). Состояние поэтому вынесено во внешний стор с
 * `useSyncExternalStore`, а не в контекст: так не нужно прокидывать провайдер
 * через серверный layout.
 */

export type AuthTab = "login" | "register";

export interface AuthDialogState {
  open: boolean;
  tab: AuthTab;
}

/** Константа для серверного рендера: диалог всегда закрыт */
const CLOSED: AuthDialogState = { open: false, tab: "login" };

let state: AuthDialogState = CLOSED;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeAuthDialog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAuthDialogState(): AuthDialogState {
  return state;
}

export function getServerAuthDialogState(): AuthDialogState {
  return CLOSED;
}

export function openAuthDialog(tab: AuthTab = "login"): void {
  if (state.open && state.tab === tab) return;
  state = { open: true, tab };
  emit();
}

export function closeAuthDialog(): void {
  if (!state.open) return;
  state = CLOSED;
  emit();
}
