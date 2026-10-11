"use client";

import { useEffect } from "react";
import { startProgressionSession } from "@/lib/progression/events";

/**
 * Точка входа ежедневного входа: шлёт SESSION_START один раз после
 * монтирования. Повторные рендеры/переходы безопасны — движок идемпотентен
 * (входной XP и серия дней начисляются ровно раз в сутки), а rate-limit
 * отсекает гонки. Само событие чисто считается в lib (нет Date.now в UI).
 */
export function ProgressionBoot() {
  useEffect(() => {
    startProgressionSession();
  }, []);
  return null;
}
