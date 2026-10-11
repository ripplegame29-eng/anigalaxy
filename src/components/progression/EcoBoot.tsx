"use client";

import { useEffect } from "react";
import { applyEco, ecoStore } from "@/lib/eco";

/**
 * Применяет режим «экономия» к `<html data-eco>` после гидратации.
 *
 * Стоит в `layout.tsx` рядом с `ToastHost`/`DevPanel`: серверный рендер
 * всегда идёт без `data-eco` (иначе разметка сошлась бы не с первым
 * клиентским рендером), а значение появляется в эффекте.
 */
export function EcoBoot() {
  const mode = ecoStore.useStore();

  useEffect(() => {
    applyEco();
  }, [mode]);

  return null;
}
