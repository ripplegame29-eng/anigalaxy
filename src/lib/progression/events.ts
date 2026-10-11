"use client";

/**
 * React-слой прогрессии: хук подписки на документ, подписка на эффекты,
 * эмиттер-помощники. UI НЕ начисляет награды сам — только шлёт события
 * и показывает то, что вернул движок.
 */

import { useEffect } from "react";
import { getProgressStore } from "./store";
import {
  emit,
  getProgress,
  startProgression,
  subscribeEffects,
  type EmitResult,
} from "./service";
import { PROGRESSION_CONFIG } from "./progression.config";
import { levelInfo, type LevelInfo } from "../levels";
import type { DomainEvent, ProgressDoc, ProgressEffect } from "./types";

/** Подписка на документ прогрессии (SSR-фолбэк — EMPTY_DOC) */
export function useProgress(): ProgressDoc {
  return getProgressStore(PROGRESSION_CONFIG).useStore();
}

/** Подписка на эффекты движка: тосты, журнал, анимации наград */
export function useProgressEffects(listener: (effects: ProgressEffect[]) => void): void {
  useEffect(() => subscribeEffects((effects) => listener(effects)), [listener]);
}

/** Эмиттер события (стабильная ссылка — безопасен в зависимостях эффектов) */
export function progressEmit(event: DomainEvent): EmitResult {
  return emit(event);
}

/** Ежедневный вход/серия — вызывается один раз после монтирования */
export function startProgressionSession(): EmitResult {
  return startProgression();
}

export { getProgress as getProgressSnapshot };

/**
 * Уровень/эра/прогресс из документа прогрессии: XP берётся из единого
 * документа (он всегда ≥ старого профиля после миграции), шкала — из
 * конфига. Чистая функция — вне React, чтобы делиться с рендером.
 */
export function levelInfoFromDoc(doc: ProgressDoc): LevelInfo {
  return levelInfo(doc.progress.xpTotal);
}

/** Уровень/эра/XP-бар текущего пользователя (React) */
export function useLevelInfo(): LevelInfo {
  return levelInfoFromDoc(useProgress());
}

/** Сколько незабранных, но готовых квестов (дневных + недельных) */
export function readyQuestCount(doc: ProgressDoc): number {
  const all = [...doc.quests.daily, ...doc.quests.weekly];
  return all.filter((quest) => quest.done && !quest.claimed).length;
}
