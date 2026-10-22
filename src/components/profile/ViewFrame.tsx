"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { openAuthDialog } from "@/lib/auth-dialog";
import { useAccount } from "@/lib/use-account";
import type { ViewMessage } from "@/lib/view-mode";

/**
 * Вложенное окно с чужим профилем. Высота — от шапки до низа экрана
 * (на телефоне — до нижнего меню), прокрутка внутри окна, поэтому диалоги
 * профиля центрируются по видимой области. Окно перезагружается, когда
 * зритель входит или выходит: связь с игроком зависит от аккаунта.
 */
export function ViewFrame({ src, title }: { src: string; title: string }) {
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const who = useAccount()?.nickname ?? "guest";

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const fit = () => {
      const top = box.getBoundingClientRect().top + window.scrollY;
      const bar = document.querySelector<HTMLElement>(".mnv-bar");
      const barH = bar && getComputedStyle(bar).display !== "none" ? bar.getBoundingClientRect().height : 0;
      box.style.height = `${Math.max(420, window.innerHeight - top - barH)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as ViewMessage | null;
      if (data?.type === "ag-nav" && typeof data.href === "string" && data.href.startsWith("/")) router.push(data.href);
      else if (data?.type === "ag-auth") openAuthDialog("login");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router]);

  return (
    <div ref={boxRef} style={{ height: "calc(100dvh - 72px)" }}>
      <iframe key={who} src={src} title={title} className="block h-full w-full border-0" />
    </div>
  );
}
