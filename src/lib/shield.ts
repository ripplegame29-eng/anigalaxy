"use client";

/**
 * «Щит» плеера Kodik: iframe запускается в песочнице без `allow-popups` и
 * `allow-top-navigation`, поэтому рекламные всплывающие окна и редиректы
 * всей страницы блокируются браузером. Реклама внутри самого видео
 * (кросс-доменный iframe) для кода сайта недоступна — её нет только в
 * нашем плеере (AniGalaxy), поэтому он и стоит по умолчанию.
 *
 * Щит можно выключить: у части озвучек плеер Kodik в песочнице не стартует.
 */

import { createLocalStore } from "./store";

interface ShieldState {
  on: boolean;
}

const store = createLocalStore<ShieldState>("animehub:shield:v1", { on: true }, (raw) => {
  const v = JSON.parse(raw) as Partial<ShieldState>;
  return typeof v?.on === "boolean" ? { on: v.on } : null;
});

export const useShield = (): boolean => store.useStore().on;

export const setShield = (on: boolean): void => store.set({ on });

/** Права песочницы: всё для воспроизведения, без окон и навигации страницы */
export const SHIELD_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-presentation";
