"use client";

import { useSyncExternalStore } from "react";

/**
 * Кнопка «Апскейл» и режимы обработки картинки при просмотре
 * («Оригинал / HD+ / Апскейл 2x»).
 *
 * Как устроена технология — всё на самом сайте, без внешних расширений:
 * — плеер Kodik встроен <iframe> чужого домена: страница не может читать
 *   его пиксели напрямую (canvas tainted, CORS), а SVG url(#…)-фильтры
 *   браузер к кросс-доменным кадрам вообще не применяет — проверено
 *   замерами (0/255), от них осталась только путаница. Поэтому CSS-цепочки
 *   ниже отвечают исключительно за цвет/контраст/яркость: композитор
 *   применяет их к уже отрисованному кадру iframe;
 * — НАСТОЯЩИЙ апскейл 2x живёт в lib/live-upscale: один раз получив
 *   разрешение браузера показать вкладку (Screen Capture API), страница
 *   захватывает пиксели именно iframe (Element Capture — постороннее, включая
 *   собственный оверлей, отсекается), гонит их через WebGL-шейдер 2x
 *   (lib/upscale-shader: Catmull-Rom + нерезкая маска) и рисует поверх
 *   плеера. Режим «Апскейл» запускает этот конвейер; при отказе или
 *   отсутствии API страница остаётся на CSS-цепочках QUALITY_FILTERS;
 * — на локальных hero-ролях работает отдельный WebGL-шейдер
 *   обработки текстуры ролика пиксель в пиксель (lib/video-shader.ts).
 *
 * Стор — тот же паттерн, что и модалка авторизации: `useSyncExternalStore`,
 * сервер всегда отдаёт настройку по умолчанию, значение из localStorage
 * подхватывается после гидратации (лишний рендер вместо рассинхрона разметки).
 */

export type Quality = "original" | "hd" | "4k";

export const QUALITY_KEY = "animehub:quality:v1";

/** Режим по умолчанию — сразу «Апскейл» (4k), как и просил пользователь */
export const DEFAULT_QUALITY: Quality = "4k";

export interface QualityOption {
  id: Quality;
  /** Подпись пункта в списке */
  label: string;
  /** Короткий бейдж, он же текст на кнопке */
  badge: string;
  /** Пояснение под подписью */
  hint: string;
  /** Всплывающая надпись над плеером при переключении */
  flash: string;
}

export const QUALITY_OPTIONS: QualityOption[] = [
  {
    id: "original",
    label: "Оригинал",
    badge: "1080p",
    hint: "Исходная картинка без какой-либо обработки",
    flash: "Апскейл выключен — оригинал",
  },
  {
    id: "hd",
    label: "HD+",
    badge: "HD+",
    hint: "Контраст и цвет, работает без нагрузки на видеоядро",
    flash: "Апскейл HD+ — контраст и цвет включены",
  },
  {
    id: "4k",
    label: "Апскейл",
    badge: "2x",
    hint: "Кадры плеера захватываются и режутся WebGL-шейдером 2x прямо поверх плеера",
    flash: "Апскейл 2x включён — обработка идёт на GPU",
  },
];

/**
 * Фильтр iframe-плеера — только CSS-функции, без url(#…): SVG-фильтр
 * браузер не применяет к кадру чужого домена и инвалидирует вместе с собой
 * всю цепочку (см. замеры в комментарии к модулю). Сила режима растёт
 * от «Оригинал» (ничего) к «Апскейл» (замеры: ~13/255 средней разницы
 * с оригиналом на постере — смена режима видна на глаз).
 */
export const QUALITY_FILTERS: Record<Quality, string> = {
  original: "none",
  hd: "contrast(1.08) saturate(1.1) brightness(1.01)",
  "4k": "contrast(1.25) saturate(1.22) brightness(1.04)",
};

/**
 * Итоговый CSS-фильтр для плеера. Отдельная сборка не нужна: цепочка
 * целиком состоит из CSS-функций, поэтому её можно отдать браузеру как есть —
 * композитор применит её к кадру iframe на видеоядре.
 */
export function playerFilter(quality: Quality): string {
  return QUALITY_FILTERS[quality];
}

/** Сила нерезкой маски на hero-ролях (0 — шейдер выключен) */
export const SHADER_STRENGTH: Record<Quality, number> = {
  original: 0,
  hd: 0.22,
  "4k": 0.42,
};

/** Подъём контраста в том же шейдере (1 — выкл) */
export const SHADER_CONTRAST: Record<Quality, number> = {
  original: 1,
  hd: 1.05,
  "4k": 1.1,
};

/* ------------------------------ Стор ------------------------------ */

const listeners = new Set<() => void>();
let state: Quality = DEFAULT_QUALITY;
let loaded = false;

function isQuality(value: unknown): value is Quality {
  return value === "original" || value === "hd" || value === "4k";
}

function readStored(): Quality {
  try {
    const raw = window.localStorage.getItem(QUALITY_KEY);
    return isQuality(raw) ? raw : DEFAULT_QUALITY;
  } catch {
    return DEFAULT_QUALITY;
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeQuality(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getQuality(): Quality {
  if (typeof window === "undefined") return DEFAULT_QUALITY;
  if (!loaded) {
    loaded = true;
    state = readStored();
  }
  return state;
}

export function getServerQuality(): Quality {
  return DEFAULT_QUALITY;
}

export function setQuality(next: Quality): void {
  getQuality(); // подхватываем сохранённое значение до записи
  if (state === next) return;
  state = next;
  try {
    window.localStorage.setItem(QUALITY_KEY, next);
  } catch {
    /* приватный режим — просто держим значение в памяти */
  }
  emit();
}

export function useQuality(): Quality {
  return useSyncExternalStore(subscribeQuality, getQuality, getServerQuality);
}
