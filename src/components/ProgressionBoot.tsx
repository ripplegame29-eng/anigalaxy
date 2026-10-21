"use client";

import { useEffect } from "react";
import { startProgressionSession, useProgress } from "@/lib/progression/events";
import { trackLeaderboardWeek } from "@/lib/leaderboard-rewards";

/**
 * Точка входа ежедневного входа: шлёт SESSION_START один раз после
 * монтирования. Повторные рендеры/переходы безопасны — движок идемпотентен
 * (входной XP и серия дней начисляются ровно раз в сутки), а rate-limit
 * отсекает гонки. Само событие чисто считается в lib (нет Date.now в UI).
 */
export function ProgressionBoot() {
  const xpTotal = useProgress().progress.xpTotal;
  useEffect(() => {
    startProgressionSession();
  }, []);
  /* Недельный итог лидерборда: точка отсчёта, смена недели и выплата призов */
  useEffect(() => {
    trackLeaderboardWeek(xpTotal);
  }, [xpTotal]);
  return null;
}
