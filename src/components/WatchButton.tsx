"use client";

import { watchStore } from "@/lib/history";

/**
 * Главная кнопка страницы тайтла. Ведёт к плееру (#watch) и подписывается по
 * истории: если серию уже открывали — «Продолжить с N серии», иначе «Смотреть с 1 серии».
 * На сервере и до чтения истории показывается нейтральная подпись, чтобы не было рассинхрона.
 */
export function WatchButton({ id }: { id: string }) {
  const watch = watchStore.useStore();
  const last = watch.records.filter((r) => r.id === id).sort((a, b) => b.at - a.at)[0];
  const label = last ? `Продолжить с ${last.episode} серии` : "Смотреть онлайн";

  return (
    <a
      href="#watch"
      className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.9-6.86a1.04 1.04 0 0 0 0-1.76L9.56 4.26A1.04 1.04 0 0 0 8 5.14Z" />
      </svg>
      {label}
    </a>
  );
}
