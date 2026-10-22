"use client";

import { useEffect } from "react";

/** Отправляет необработанные ошибки браузера в журнал админ-панели (не больше 5 за загрузку страницы) */
export function ErrorReporter() {
  useEffect(() => {
    let sent = 0;
    const send = (message: string, stack = "") => {
      if (sent >= 5 || !message) return;
      sent += 1;
      void fetch("/api/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        keepalive: true,
        body: JSON.stringify({ message: message.slice(0, 500), stack: stack.slice(0, 3000), path: location.pathname }),
      }).catch(() => {});
    };
    const onError = (e: ErrorEvent) => {
      // ошибки сторонних скриптов без деталей («Script error.») не информативны
      if (!e.error && /^Script error/i.test(e.message)) return;
      send(e.message, e.error instanceof Error ? (e.error.stack ?? "") : "");
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      send(r instanceof Error ? r.message : `Необработанный промис: ${String(r)}`, r instanceof Error ? (r.stack ?? "") : "");
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
