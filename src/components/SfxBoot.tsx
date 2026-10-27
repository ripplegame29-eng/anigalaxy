"use client";

import { useEffect } from "react";
import { playSfx } from "@/lib/sfx";

/**
 * Один делегированный слушатель на весь сайт: мягкий тик на основные кнопки и
 * щелчок на переключатели. Остальные звуки (награда, успех, ошибка) зовут
 * playSfx из своих мест.
 */
export function SfxBoot() {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.("button, [role='button'], [role='switch'], a.btn-primary, .btn-premium");
      if (!el || (el as HTMLButtonElement).disabled || el.closest("[data-nosfx]")) return;
      playSfx(el.getAttribute("role") === "switch" ? "pop" : "tap");
    };
    document.addEventListener("pointerdown", onDown, { capture: true, passive: true });
    return () => document.removeEventListener("pointerdown", onDown, { capture: true });
  }, []);
  return null;
}
