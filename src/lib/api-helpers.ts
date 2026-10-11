import { NextResponse } from "next/server";

import { KodikError } from "./kodik";
import { logError, type LogSource } from "./logger";

/**
 * Единая обработка ошибок внешних API для всех Route Handlers:
 * ошибку API отдаём клиенту с тем же кодом, остальное — 502.
 *
 * Заодно пишем в журнал. Раньше ошибка уходила только в `console.error` сервера,
 * а это самая частая причина «не понимаю, что сломалось»: в проде консоль никто
 * не смотрит, а падение выглядит снаружи как «просто пропал трейлер» —
 * страница ловит исключение через `.catch(() => [])` и рендерится наполовину.
 *
 * Запись не ждём: ошибку клиенту нужно отдать сразу, а база может оказаться
 * медленнее, чем сам ответ.
 */
export function handleSourceError(
  error: unknown,
  source: LogSource,
  operation: string,
  context?: unknown,
): NextResponse {
  void logError({
    level: "error",
    source,
    operation,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
    context,
  });

  if (error instanceof KodikError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(`[${source}.${operation}]`, error);
  return NextResponse.json({ error: "Не удалось получить данные" }, { status: 502 });
}

/** Обработчик для Kodik — самое частое, поэтому отдельная короткая обёртка. */
export function handleKodikError(
  error: unknown,
  operation = "unknown",
  context?: unknown,
): NextResponse {
  return handleSourceError(error, "kodik", operation, context);
}