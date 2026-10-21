"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { viewedNickname } from "@/lib/view-mode";

/**
 * Оболочка просмотра чужого профиля.
 *
 * Данные игрока подставляются в localStorage страницы скриптом, который
 * сервер вставляет в HTML (см. `app/u/[nickname]/page.tsx`). Скрипт
 * работает только при полной загрузке документа, поэтому при переходе
 * внутри приложения (клик по нику в чате или рейтинге) страница один раз
 * перезагружается. Любой выход со страницы — тоже полная загрузка, чтобы
 * чужие данные не остались в памяти приложения зрителя.
 */

const subscribe = () => () => {};

export function ViewShell({ nickname, children }: { nickname: string; children: ReactNode }) {
  const ready = useSyncExternalStore(
    subscribe,
    () => viewedNickname()?.toLowerCase() === nickname.toLowerCase(),
    () => false,
  );

  useEffect(() => {
    if (ready) return;
    // Защита от цикла: перезагружаем не чаще раза в несколько секунд
    const stamp = `ag-view-reload:${nickname.toLowerCase()}`;
    try {
      const last = Number(window.sessionStorage.getItem(stamp) ?? 0);
      if (Date.now() - last < 8000) return;
      window.sessionStorage.setItem(stamp, String(Date.now()));
    } catch {
      /* без sessionStorage просто перезагружаем */
    }
    window.location.reload();
  }, [ready, nickname]);

  useEffect(() => {
    if (!ready) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.origin !== window.location.origin) return;
      if (link.pathname.startsWith("/u/") || link.hash && link.pathname === window.location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      window.location.assign(link.href);
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
      <div className="sticky top-0 z-[60] flex items-center gap-3 border-b border-white/10 bg-[#0a0e1c]/90 px-4 py-2.5 text-sm backdrop-blur">
        <Link href="/leaderboard" className="font-bold text-accent hover:underline">
          ← К рейтингу
        </Link>
        <span className="text-muted">Профиль игрока {nickname}</span>
      </div>
      {ready ? children : <p className="px-4 py-10 text-center text-muted">Открываем профиль…</p>}
    </>
  );
}
