"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Страница ошибки — общая для всего сайта.
 *
 * Почему в корне, а не в каждой странице: `error.tsx` ловит ошибки своего
 * сегмента и всех вложенных. Один файл в `src/app/` закрывает все 16
 * страниц; копия в каждой папке означала бы, что новую страницу легко
 * открыть без границы.
 *
 * Чего файл не делает намеренно: не показывает текст ошибки и стек.
 * В проде это утечка внутренних деталей (пути, имена модулей, иногда
 * фрагменты запросов), а диагностике всё равно нужнее журнал ошибок —
 * те же сбои пишутся в `error_logs` через lib/logger.ts.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // digest — короткий идентификатор, по нему запись находится в журнале.
  const digest = error.digest;

  useEffect(() => {
    // Ошибка границы не доходит до серверного журнала сама: компонент
    // клиентский. Поэтому шлём явно.
    void fetch("/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack?.slice(0, 2000) ?? null,
        digest: digest ?? null,
      }),
    }).catch(() => undefined);
  }, [error, digest]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="relative grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-red-500/20 to-accent-2/20 ring-1 ring-white/10">
        <span className="text-4xl font-extrabold text-red-300">!</span>
      </div>

      <h1 className="mt-7 text-2xl font-extrabold tracking-tight sm:text-3xl">
        Что-то пошло не так
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
        Страница не смогла отобразиться. Попробуйте ещё раз — если не поможет,
        вернитесь на главную.
      </p>

      {digest ? (
        <p className="mt-4 font-mono text-xs text-white/30">
          Код ошибки: {digest}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="btn-primary rounded-xl px-6 py-3 text-sm font-bold text-white"
        >
          Попробовать снова
        </button>
        <Link
          href="/"
          className="btn-ghost rounded-xl bg-white/8 px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/12 hover:bg-white/14"
        >
          На главную
        </Link>
      </div>
    </div>
  );
}