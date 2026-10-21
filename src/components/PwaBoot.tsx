"use client";

import { useEffect } from "react";

/** Регистрирует service worker (только в продакшене — в dev он мешает горячей перезагрузке) */
export function PwaBoot() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
