/**
 * Глобальные модалки профиля (фон, титул, внешний вид, настройки, ссылка).
 *
 * Тот же приём, что у модалки авторизации (`lib/auth-dialog.ts`): диалог
 * один, живёт в шапке, а открывать его могут любые клиентские компоненты —
 * в том числе дропдаун аккаунта, когда страница профиля не открыта.
 */

export type ProfileDialogKind =
  | "background"
  | "title"
  | "appearance"
  | "settings"
  | "share"
  | "preview"
  | "rewards";

export interface ProfileDialogState {
  open: boolean;
  kind: ProfileDialogKind;
}

const CLOSED: ProfileDialogState = { open: false, kind: "background" };

let state: ProfileDialogState = CLOSED;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeProfileDialog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getProfileDialogState(): ProfileDialogState {
  return state;
}

export function getServerProfileDialogState(): ProfileDialogState {
  return CLOSED;
}

export function openProfileDialog(kind: ProfileDialogKind): void {
  if (state.open && state.kind === kind) return;
  state = { open: true, kind };
  emit();
}

export function closeProfileDialog(): void {
  if (!state.open) return;
  state = CLOSED;
  emit();
}
