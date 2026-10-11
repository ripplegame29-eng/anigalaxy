"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import {
  getBonusDialogState,
  getServerBonusDialogState,
  subscribeBonusDialog,
} from "@/lib/bonus-dialog";

/**
 * Ленивый хост модалки «Ежедневный бонус».
 *
 * Хост живёт в layout (см. комментарий в `lib/bonus-dialog.ts` — почему не в
 * шапке) и подписан на стор диалога: сам модуль модалки подгружается только
 * при первом клике по кнопке в шапке. SSR-снимок стора всегда «закрыто»,
 * поэтому на сервере ничего нет.
 */
const DailyBonusDialog = dynamic(
  () => import("./DailyBonusDialog").then((module) => module.DailyBonusDialog),
  { ssr: false, loading: () => null },
);

export function DailyBonusHost() {
  const state = useSyncExternalStore(
    subscribeBonusDialog,
    getBonusDialogState,
    getServerBonusDialogState,
  );
  if (!state.open) return null;
  return <DailyBonusDialog />;
}
