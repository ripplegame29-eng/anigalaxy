"use client";

import { useEffect } from "react";

import { startCloudSync } from "@/lib/cloud";
import { claimServerLeaderboardRewards } from "@/lib/leaderboard-cloud";
import { useAccount } from "@/lib/use-account";
import { isViewMode } from "@/lib/view-mode";

/**
 * Фоновая синхронизация с сервером и выдача недельных призов лидерборда
 * (ничего не рисует). В режиме просмотра чужого профиля не делает ничего.
 */
export default function CloudSync() {
  const account = useAccount();
  useEffect(() => {
    if (isViewMode()) return;
    startCloudSync();
  }, []);
  useEffect(() => {
    if (!account || isViewMode()) return;
    void claimServerLeaderboardRewards();
    const id = window.setInterval(() => void claimServerLeaderboardRewards(), 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [account]);
  return null;
}
