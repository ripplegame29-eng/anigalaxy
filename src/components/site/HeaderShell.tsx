"use client";

import { useState } from "react";
import { CommandPalette } from "./CommandPalette";
import { SiteHeader } from "./SiteHeader";
import { ProfileDialogHost } from "@/components/profile/ProfileDialogHostLazy";

/**
 * Обёртка шапки: сама шапка и оверлей поиска — два независимых компонента,
 * а состояние «открыта ли палитра» общее, поэтому его держит этот клиентский
 * слой. В layout попадает только он.
 *
 * onPick не передан: переход по строке в прототипе остаётся TODO
 * (см. комментарий в CommandPalette) — до появления реальных маршрутов
 * тайтлов, зрителей и подборок переходить некуда.
 */
export function HeaderShell() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <SiteHeader onOpenSearch={() => setSearchOpen(true)} />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      {/* Хост диалогов профиля («Изменить фон», аватар, рамка косметики).
          Раньше он жил внутри прежней шапки Header.tsx; когда шапку заменили на
          SiteHeader, хост потерялся вместе с ней и кнопки профиля перестали
          открывать окна. Держим его здесь — рядом с шапкой, как было. */}
      <ProfileDialogHost />
    </>
  );
}