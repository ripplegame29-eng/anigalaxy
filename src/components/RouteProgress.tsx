"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

/** Тонкая полоса сверху при переходах между страницами: сразу показывает, что клик принят */
function Bar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [p, setP] = useState(0);
  const [on, setOn] = useState(false);
  const timer = useRef<number | null>(null);
  const first = useRef(true);

  // Навигация завершилась: дотягиваем полосу до конца и прячем
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (timer.current) window.clearInterval(timer.current);
    const done = window.setTimeout(() => setP(1), 0);
    const hide = window.setTimeout(() => { setOn(false); setP(0); }, 380);
    return () => { window.clearTimeout(done); window.clearTimeout(hide); };
  }, [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (timer.current) window.clearInterval(timer.current);
      setOn(true);
      setP(0.12);
      timer.current = window.setInterval(() => setP((v) => (v < 0.9 ? v + (0.9 - v) * 0.12 : v)), 180);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  return (
    <div className={`ui-route-bar${on ? " on" : ""}`} aria-hidden>
      <i style={{ ["--p" as string]: p }} />
    </div>
  );
}

export function RouteProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
