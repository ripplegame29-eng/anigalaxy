"use client";

/**
 * Звук карточек: все эффекты синтезируются на лету (Web Audio), файлов нет.
 * Включается и выключается переключателем в шапке раздела; выбор хранится в браузере.
 */

import { useSyncExternalStore } from "react";
import { renderBattleSound, uxPlay } from "./battle-audio";

export type Sfx = "ok" | "err" | "hit" | "crit" | "cast" | "ult" | "heal" | "shield" | "ko" | "win" | "lose" | "charge" | "burst" | "reveal0" | "reveal1" | "reveal2" | "reveal3" | "reveal4" | "star";

const KEY = "animehub:cards:sound";

let on: boolean | null = null;
const subs = new Set<() => void>();

function readOn(): boolean {
  if (on === null) {
    try {
      on = window.localStorage.getItem(KEY) !== "0";
    } catch {
      on = true;
    }
  }
  return on;
}

export function soundOn(): boolean {
  return typeof window === "undefined" ? false : readOn();
}

export function setSound(v: boolean): void {
  on = v;
  try {
    window.localStorage.setItem(KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
  subs.forEach((f) => f());
  if (v) sfx("ok");
}

export function useSoundOn(): boolean {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
    () => soundOn(),
    () => false,
  );
}

/** Звуки интерфейса и гачи включены (тосты, зарядка и открытие паков). Чтобы отключить — SOUND_ENABLED = false */
const SOUND_ENABLED = true;

export function sfx(name: Sfx): void {
  if (!SOUND_ENABLED || typeof window === "undefined" || !readOn()) return;
  uxPlay(name);
}

/** Офлайн-рендер звука в буфер (для прослушивания и выгрузки в файлы) */
export async function renderLegacySound(name: Sfx, seconds: number): Promise<AudioBuffer> {
  return renderBattleSound(() => uxPlay(name), seconds);
}
