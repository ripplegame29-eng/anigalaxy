"use client";

/**
 * Режим «экономия» (§14, §16).
 *
 * Гасит декоративные анимации на слабых машинах и по желанию пользователя:
 *
 *  - **автоматика**: `navigator.hardwareConcurrency <= 4` → экономия включена;
 *  - **переключатель** (Авто / Всегда / Выкл) переопределяет автоматику —
 *    выбор хранится в сторе проекта `animehub:eco:v1` и переживает перезагрузку;
 *  - применяется как `<html data-eco="on">`: анимации выключает сам CSS
 *    (`effects.css`, `globals.css`) — тот же эффект, что и
 *    `prefers-reduced-motion`, но переключаемый без настроек ОС.
 *
 * SSR-фолбэк стора — `"auto"`: сервер рендерит документ без `data-eco`,
 * значение применяется после гидратации (`<EcoBoot/>` в layout), поэтому
 * разметка первого клиентского рендера совпадает с серверной.
 */

import { createLocalStore } from "./store";

export type EcoMode = "auto" | "on" | "off";

export const ECO_KEY = "animehub:eco:v1";

export const ecoStore = createLocalStore<EcoMode>(ECO_KEY, "auto");

/** Слабая машина: ≤ 4 ядер (§14) */
export function weakCpu(): boolean {
  if (typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency;
  return typeof cores === "number" && cores > 0 && cores <= 4;
}

/** Ядер в машине (для подписи в настройках); 0 — неизвестно/SSR */
export function cpuCores(): number {
  if (typeof navigator === "undefined") return 0;
  const cores = navigator.hardwareConcurrency;
  return typeof cores === "number" && Number.isFinite(cores) ? cores : 0;
}

/** Эффективное состояние: ручной выбор важнее автоматики */
export function ecoActive(): boolean {
  const mode = ecoStore.get();
  if (mode === "on") return true;
  if (mode === "off") return false;
  return weakCpu();
}

/** Повесить состояние на `<html data-eco>` — вызывается после гидратации */
export function applyEco(): void {
  if (typeof document === "undefined") return;
  if (ecoActive()) document.documentElement.setAttribute("data-eco", "on");
  else document.documentElement.removeAttribute("data-eco");
}

/** Переключатель из настроек: пишет выбор и сразу применяет */
export function setEco(mode: EcoMode): void {
  ecoStore.set(mode);
  applyEco();
}
