"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { postToParent, viewedNickname } from "@/lib/view-mode";

/**
 * Оболочка документа `/view/<ник>`, который показывается внутри страницы
 * `/u/<ник>`. Данные игрока подставляются в localStorage этого окна
 * скриптом из HTML (см. `app/view/[nickname]/page.tsx`); шапка, подвал и
 * чат здесь скрыты — они есть на основной странице. Переходы по ссылкам
 * передаются основной странице, чтобы чужие данные не остались в памяти.
 */

const subscribe = () => () => {};

export function ViewShell({ nickname, children }: { nickname: string; children: ReactNode }) {
  const ready = useSyncExternalStore(
    subscribe,
    () => viewedNickname()?.toLowerCase() === nickname.toLowerCase(),
    () => false,
  );

  useEffect(() => {
    if (!ready) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.origin !== window.location.origin) return;
      if (link.pathname.startsWith("/view/") || (link.hash && link.pathname === window.location.pathname)) return;
      event.preventDefault();
      event.stopPropagation();
      if (link.target === "_blank") window.open(link.href, "_blank", "noopener");
      else postToParent({ type: "ag-nav", href: link.pathname + link.search + link.hash });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [ready]);

  return (
    <>
      <style>{`
        html[data-ag-view] header.hd, html[data-ag-view] footer,
        html[data-ag-view] .mnv-bar, html[data-ag-view] .mnv-sheet,
        html[data-ag-view] [aria-label^="Открыть общий чат"], html[data-ag-view] [aria-label="Общий чат"],
        html[data-ag-view] [aria-label^="Кланы"] { display: none !important; }
      `}</style>
      {ready ? children : <p className="px-4 py-10 text-center text-muted">Открываем профиль…</p>}
    </>
  );
}
