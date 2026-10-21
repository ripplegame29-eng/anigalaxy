"use client";

import { useEffect } from "react";
import { startProgressionSession } from "@/lib/progression/events";
import { isViewMode } from "@/lib/view-mode";

/**
 * Точка входа ежедневного входа: шлёт SESSION_START один раз после
 * монтирования. Повторные рендеры/переходы безопасны — движок идемпотентен
 * (входной XP и серия дней начисляются ровно раз в сутки), а rate-limit
 * отсекает гонки. Само событие чисто считается в lib (нет Date.now в UI).
 *
 * Недельный итог лидерборда раньше считался здесь же локально (место
 * среди сгенерированных соперников). Теперь место и приз — только с
 * сервера, среди настоящих игроков (`lib/leaderboard-cloud`, подключено
 * в `CloudSync`), поэтому локального расчёта тут больше нет.
 */
export function ProgressionBoot() {
  useEffect(() => {
    if (!isViewMode()) startProgressionSession();
  }, []);
  return null;
}
