"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import {
  getAuthDialogState,
  getServerAuthDialogState,
  subscribeAuthDialog,
} from "@/lib/auth-dialog";

/**
 * Ленивый хост модалки авторизации.
 *
 * Диалог нужен только после клика «Войти», но раньше он был смонтирован в
 * layout и его код (формы, валидация, демо-Telegram) входил в бандл каждой
 * страницы. Хост подписан на тот же стор, что и сам диалог, и монтирует
 * его динамическим импортом — модуль подгружается при первом открытии.
 * SSR-снимок стора всегда «закрыто», поэтому на сервере ничего нет.
 */
const AuthDialog = dynamic(
  () => import("./AuthDialog").then((module) => module.AuthDialog),
  { ssr: false, loading: () => null },
);

export function AuthDialogHost() {
  const state = useSyncExternalStore(
    subscribeAuthDialog,
    getAuthDialogState,
    getServerAuthDialogState,
  );
  if (!state.open) return null;
  return <AuthDialog />;
}
