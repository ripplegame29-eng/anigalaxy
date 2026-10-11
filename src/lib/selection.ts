"use client";

/**
 * Мультивыбор тегов и титулов.
 *
 * Основной тег живёт в документе прогрессии (`equippedTagId`) — его считают
 * движок, комментарии и секрет «Смена облика». Дополнительные — в профиле
 * (`extraTagIds`): чисто косметический слой. Правило синхронизации одно:
 * сняли основной → первый дополнительный становится основным.
 * Титулы полностью в профиле: `titleId` — основной, `extraTitleIds` — прочие.
 */

import { progressEmit, useProgress } from "@/lib/progression/events";
import { updateProfile, useProfile } from "@/lib/profile";
import type { TagDef } from "@/lib/progression/types";
import type { TitleItem } from "@/lib/cosmetics";

export interface TagSelection {
  /** id основного тега (движок) */
  primary: string;
  /** id дополнительных (без основного) */
  extras: string[];
  isSelected: (id: string) => boolean;
  isOwned: (id: string) => boolean;
  /** клик по карточке: основной снять / дополнительный убрать / добавить */
  toggle: (tag: TagDef) => void;
}

export function useTagSelection(): TagSelection {
  const doc = useProgress();
  const profile = useProfile();
  const primary = doc.progress.equippedTagId ?? "";
  // гигиена: основной не должен дублироваться в дополнительных
  const extras = profile.extraTagIds.filter((id) => id !== primary && Boolean(doc.tags[id]));

  const isOwned = (id: string) => Boolean(doc.tags[id]);

  const toggle = (tag: TagDef) => {
    if (!isOwned(tag.id)) return;
    if (primary === tag.id) {
      progressEmit({ type: "UNEQUIP_TAG" });
      const [next, ...rest] = extras;
      updateProfile({ extraTagIds: rest });
      if (next) progressEmit({ type: "TAG_EQUIPPED", tagId: next });
      return;
    }
    if (extras.includes(tag.id)) {
      updateProfile({ extraTagIds: extras.filter((id) => id !== tag.id) });
      return;
    }
    if (!primary) {
      progressEmit({ type: "TAG_EQUIPPED", tagId: tag.id });
      return;
    }
    updateProfile({ extraTagIds: [...extras, tag.id] });
  };

  return {
    primary,
    extras,
    isSelected: (id) => primary === id || extras.includes(id),
    isOwned,
    toggle,
  };
}

export interface TitleSelection {
  primary: string;
  extras: string[];
  isSelected: (id: string) => boolean;
  toggle: (item: TitleItem, owned: boolean) => void;
}

export function useTitleSelection(): TitleSelection {
  const profile = useProfile();
  const primary = profile.titleId;
  const extras = profile.extraTitleIds.filter((id) => id !== primary);

  const toggle = (item: TitleItem, owned: boolean) => {
    if (!owned) return;
    if (primary === item.id) {
      const [next, ...rest] = extras;
      updateProfile({ titleId: next ?? "", extraTitleIds: rest });
      return;
    }
    if (extras.includes(item.id)) {
      updateProfile({ extraTitleIds: extras.filter((id) => id !== item.id) });
      return;
    }
    if (!primary) {
      updateProfile({ titleId: item.id });
      return;
    }
    updateProfile({ extraTitleIds: [...extras, item.id] });
  };

  return {
    primary,
    extras,
    isSelected: (id) => primary === id || extras.includes(id),
    toggle,
  };
}
