/**
 * Глобальное состояние модалки «Ежедневный бонус».
 *
 * Тот же приём, что у модалки авторизации (`lib/auth-dialog.ts`): диалог один
 * на всё приложение, живёт в layout (не в шапке — у <header> есть
 * backdrop-blur, а элементы с backdrop-filter становятся containing block для
 * position:fixed, панель тогда центрируется по 64-пиксельной шапке), а
 * открывать его может любая клиентская компонента — здесь кнопка в шапке.
 * Состояние вынесено во внешний стор с `useSyncExternalStore`, чтобы не
 * прокидывать провайдер через серверный layout.
 */

export interface BonusDialogState {
  open: boolean;
}

/** Константа для серверного рендера: диалог всегда закрыт */
const CLOSED: BonusDialogState = { open: false };

let state: BonusDialogState = CLOSED;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeBonusDialog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getBonusDialogState(): BonusDialogState {
  return state;
}

export function getServerBonusDialogState(): BonusDialogState {
  return CLOSED;
}

export function openBonusDialog(): void {
  if (state.open) return;
  state = { open: true };
  emit();
}

export function closeBonusDialog(): void {
  if (!state.open) return;
  state = CLOSED;
  emit();
}
