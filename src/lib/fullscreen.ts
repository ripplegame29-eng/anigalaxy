/**
 * Полный экран для плеера.
 *
 * `requestFullscreen` на обычном блоке не работает в Safari на iPhone и
 * иногда отказывает в мобильных браузерах: кнопка «На весь экран» просто
 * молчит. На iPhone открывается родной полноэкранный плеер iOS. В остальных
 * случаях, если браузер не развернул блок сам, плеер раскрывается
 * поверх страницы (`position: fixed` на весь экран, стили `.ag-pseudo-fs` в
 * globals.css) — выглядит и работает так же, а выход — кнопкой или Esc.
 */

const FS_CLASS = "ag-pseudo-fs";
const LOCK_CLASS = "ag-fs-lock";
export const FS_EVENT = "ag-fs-change";

type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type IosVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

export function isFullscreen(shell?: Element | null): boolean {
  const doc = document as FsDocument;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || shell?.classList.contains(FS_CLASS));
}

function setPseudo(shell: HTMLElement, on: boolean): void {
  shell.classList.toggle(FS_CLASS, on);
  document.documentElement.classList.toggle(LOCK_CLASS, on);
  document.dispatchEvent(new Event(FS_EVENT));
}

function lockLandscape(): void {
  try {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (type: string) => Promise<void> };
    void orientation.lock?.("landscape").catch(() => undefined);
  } catch {
    /* не везде поддерживается */
  }
}

/** Войти в полный экран или выйти из него */
export async function toggleFullscreen(shell: HTMLElement | null): Promise<void> {
  if (!shell) return;
  const doc = document as FsDocument;

  if (shell.classList.contains(FS_CLASS)) {
    setPseudo(shell, false);
    return;
  }
  if (doc.fullscreenElement || doc.webkitFullscreenElement) {
    try {
      await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
    } catch {
      /* уже вышли */
    }
    return;
  }

  const el = shell as FsElement;
  const request = el.requestFullscreen ?? el.webkitRequestFullscreen;

  // iPhone: Safari не умеет разворачивать блок, зато умеет родной плеер iOS
  // (перемотка, звук, «картинка в картинке», выход свайпом) — открываем его.
  const video = shell.querySelector<IosVideo>("video");
  if (!request && video?.webkitEnterFullscreen) {
    try {
      video.webkitEnterFullscreen();
      return;
    } catch {
      /* видео ещё не готово — раскрываем сами */
    }
  }
  if (request) {
    try {
      await request.call(el);
      lockLandscape();
      return;
    } catch {
      /* браузер отказал — раскрываем сами */
    }
  }

  setPseudo(shell, true);
  lockLandscape();
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    setPseudo(shell, false);
  };
  const cleanup = () => {
    if (shell.classList.contains(FS_CLASS)) return;
    document.removeEventListener("keydown", onKey);
    document.removeEventListener(FS_EVENT, cleanup);
  };
  document.addEventListener("keydown", onKey);
  document.addEventListener(FS_EVENT, cleanup);
}
