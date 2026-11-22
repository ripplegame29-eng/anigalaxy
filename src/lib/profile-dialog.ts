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
  | "effects"
  | "avatar"
  | "theme"
  | "settings"
  | "share"
  | "preview"
  | "rewards"
  | "erase"
  | "studio";

/** Разделы «Студии профиля» — единого редактора оформления */
export type StudioTab = "look" | "avatar" | "banner" | "badges" | "fx" | "cards" | "blocks";

export interface ProfileDialogState {
  open: boolean;
  kind: ProfileDialogKind;
  /**
   * Куда вернуться при закрытии. Подробные окна (загрузка аватара, свой
   * баннер, тонкая настройка темы) открываются из Студии поверх неё, и
   * крестик должен вести обратно в Студию, а не закрывать всё.
   */
  back?: ProfileDialogKind;
  /** Открытый раздел Студии */
  tab?: StudioTab;
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

/** Последний открытый раздел Студии: возвращаемся в него из подробных окон */
let lastStudioTab: StudioTab = "look";

export function openProfileDialog(kind: ProfileDialogKind, options: { back?: ProfileDialogKind } = {}): void {
  if (state.open && state.kind === kind && !options.back) return;
  state = { open: true, kind, ...(options.back ? { back: options.back } : {}), ...(kind === "studio" ? { tab: lastStudioTab } : {}) };
  emit();
}

/** Открыть Студию профиля сразу на нужном разделе */
export function openStudio(tab?: StudioTab): void {
  if (tab) lastStudioTab = tab;
  state = { open: true, kind: "studio", tab: lastStudioTab };
  emit();
}

/** Переключить раздел внутри уже открытой Студии */
export function setStudioTab(tab: StudioTab): void {
  lastStudioTab = tab;
  if (state.open && state.kind === "studio") {
    state = { ...state, tab };
    emit();
  }
}

/** Подробное окно поверх Студии: крестик вернёт в неё */
export function openFromStudio(kind: ProfileDialogKind): void {
  openProfileDialog(kind, { back: "studio" });
}

export function closeProfileDialog(): void {
  if (!state.open) return;
  if (state.back === "studio") {
    state = { open: true, kind: "studio", tab: lastStudioTab };
  } else {
    state = CLOSED;
  }
  emit();
}

/** Закрыть всё, даже если окно открыто из Студии */
export function closeAllProfileDialogs(): void {
  if (!state.open) return;
  state = CLOSED;
  emit();
}
