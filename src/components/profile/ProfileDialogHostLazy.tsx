"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import {
  getProfileDialogState,
  getServerProfileDialogState,
  subscribeProfileDialog,
} from "@/lib/profile-dialog";

/**
 * Ленивый хост модалок профиля.
 *
 * Окна (фон, титул, внешний вид, настройки, превью, журнал) открываются
 * только по действию пользователя, но раньше весь модуль висел в шапке и
 * грузился на каждой странице. Хост подписан на стор диалогов и тянет
 * тяжёлый модуль динамическим импортом при первом открытии — в стартовый
 * бандл он больше не входит. Портал в `document.body` и поведение
 * Escape/фокуса остались прежними (их настраивает сам `ProfileDialogHost`).
 */
const ProfileDialogsLazy = dynamic(
  () => import("./ProfileDialogs").then((module) => module.ProfileDialogHost),
  { ssr: false, loading: () => null },
);

export function ProfileDialogHost() {
  const state = useSyncExternalStore(
    subscribeProfileDialog,
    getProfileDialogState,
    getServerProfileDialogState,
  );
  if (!state.open) return null;
  return <ProfileDialogsLazy />;
}
