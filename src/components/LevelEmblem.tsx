"use client";

import { useEffect, useRef } from "react";
import { levelEmblem } from "@/lib/levelEmblem";

interface LevelEmblemProps {
  /** Уровень (1..) */
  level: number;
  /** Прогресс внутри уровня, 0–100 */
  percent?: number;
  /** Размер стороны, px */
  size?: number;
  /** Закрытый уровень: серая эмблема с замком */
  locked?: boolean;
  /** Вспышка при повышении уровня (один раз) */
  up?: boolean;
}

/**
 * Обёртка эмблемы уровня для React.
 *
 * Разметка генерируется `levelEmblem` дословно, как в оригинале. Глобальный
 * счётчик UID и внутренние random-тайминги расходятся между серверным и
 * клиентским рендером, поэтому HTML вставляется в DOM только на клиенте
 * (в эффекте), а на SSR отдаётся пустой блок того же размера —
 * без layout shift и без рассинхрона гидрации.
 */
export function LevelEmblem({ level, percent = 0, size = 96, locked = false, up = false }: LevelEmblemProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = levelEmblem(level, percent, size, {
        ...(locked ? { locked: 1 } : {}),
        ...(up ? { up: 1 } : {}),
      });
    }
  }, [level, percent, size, locked, up]);

  return <div ref={ref} style={{ width: size, height: size }} suppressHydrationWarning />;
}
