/**
 * Эффекты профиля: частицы на канвасе и стили оформления.
 *
 * Модель ровно как в макете `profile-effects.html`, и разделена на две
 * независимые оси, потому что так её и рисовали:
 *
 *   • частица — одна на профиль (летущие лепестки, светлячки и т. д.);
 *   • стиль  — несколько одновременно (глитч, неон, голограмма, перелив
 *     ника): это классы на корне карточки, они не мешают друг другу;
 *   • уровень I…III — множитель: больше частиц и амплитуда эффектов.
 *
 * Частицы рисует `ProfileFx` на канвасе, стили и уровень — CSS-переменные
 * `--g` (амплитуда) и `--gd` (длительность цикла) на том же корне, поэтому
 * добавление нового стиля не трогает логику частиц, и наоборот.
 *
 * Цены и редкости — как у остальной косметики: предмет продаётся в магазине
 * (`kind: "effect"`) и открывается навсегда, а надевается в «Внешнем виде».
 */

import type { Rarity } from "./progression/types";

/** Частицы: одна на профиль, выбирается из списка */
export interface ParticleEffect {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  /** Цена в AC */
  price: number;
  /** Идентификатор режима в `ProfileFx` */
  mode: string;
}

/** Стиль оформления: можно включать несколько сразу */
export interface StyleEffect {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  price: number;
  /** Класс на корне карточки профиля */
  className: string;
}

export const PARTICLE_EFFECTS: ParticleEffect[] = [
  {
    id: "fx_particle_sakura",
    name: "Сакура",
    description: "Лепестки падают вбок, покачиваясь на ходу",
    rarity: "RARE",
    price: 4000,
    mode: "sakura",
  },
  {
    id: "fx_particle_fireflies",
    name: "Светлячки",
    description: "Медленно плывущие точки с мягким свечением",
    rarity: "RARE",
    price: 6000,
    mode: "fireflies",
  },
  {
    // id и цена — от старой позиции `fx-sparks`: она была в магазине, и
    // переименование сломало бы покупки, уже записанные в журнал.
    id: "fx-sparks",
    name: "Искры",
    description: "Всполохи оранжевого, поднимающиеся снизу вверх",
    rarity: "RARE",
    price: 1200,
    mode: "embers",
  },
  {
    id: "fx_particle_snow",
    name: "Снег",
    description: "Ровный медленный снег по всей карточке",
    rarity: "UNCOMMON",
    price: 2500,
    mode: "snow",
  },
  {
    id: "fx_particle_meteors",
    name: "Метеоры",
    description: "Редкие падающие следы через всю карточку",
    rarity: "LEGENDARY",
    price: 25000,
    mode: "meteors",
  },
];

export const STYLE_EFFECTS: StyleEffect[] = [
  {
    id: "fx_style_glitch",
    name: "Глитч",
    description: "Короткие сдвиги и цветные ореолы на аватарке, нике и чипах",
    rarity: "EPIC",
    price: 9000,
    className: "fx-glitch",
  },
  {
    id: "fx_style_neon",
    name: "Неон",
    description: "Пульсирующее свечение рамки аватара и ника",
    rarity: "RARE",
    price: 5000,
    className: "fx-neon",
  },
  {
    // как и с «Искрами»: та же позиция fx-holo из магазина
    id: "fx-holo",
    name: "Голограмма",
    description: "Сканлайны и бегущий блик по всей карточке",
    rarity: "EPIC",
    price: 2500,
    className: "fx-holo",
  },
  {
    id: "fx_style_foil",
    name: "Перелив ника",
    description: "Ник переливается золотым и голубым",
    rarity: "LEGENDARY",
    price: 20000,
    className: "fx-foil",
  },
];

/** Уровни эффекта: множитель количества частиц и амплитуды */
export const EFFECT_LEVELS = [1, 2, 3] as const;
export type EffectLevel = (typeof EFFECT_LEVELS)[number];

/** Амплитуда и длительность цикла по уровню — как `data-level` в макете.
 *  Длительности глитча взяты с animeon.cc по их стадиям: 5.5 → 4.4 → 2.7 с.
 *  Короткий цикл — не «веселее», а плотнее: на нём разломы карточек идут
 *  чаще, и профиль выглядит сильнее повреждённым. */
export const EFFECT_LEVEL_VARS: Record<EffectLevel, { g: number; gd: string }> = {
  1: { g: 1, gd: "5.5s" },
  2: { g: 2, gd: "4.4s" },
  3: { g: 3, gd: "2.7s" },
};

export const EFFECT_LEVEL_LABEL: Record<EffectLevel, string> = {
  1: "I",
  2: "II",
  3: "III",
};

export const PARTICLE_BY_ID = new Map(PARTICLE_EFFECTS.map((item) => [item.id, item]));
export const STYLE_BY_ID = new Map(STYLE_EFFECTS.map((item) => [item.id, item]));

/** Частица по mode-идентификатору (нужно рендеру) */
export const PARTICLE_BY_MODE = new Map(PARTICLE_EFFECTS.map((item) => [item.mode, item]));

export function isEffectLevel(value: unknown): value is EffectLevel {
  return typeof value === "number" && (EFFECT_LEVELS as readonly number[]).includes(value);
}
