/**
 * Feature flags на стороне сервера.
 *
 * Зачем: в панели есть тумблеры «выключить сломанную механику», но до
 * появления этого модуля флаги нигде не читались — тумблер менял строку в
 * базе и больше ничего. Здесь они превращаются в реальные проверки.
 *
 * Ключевой момент — проверка идёт на СЕРВЕРЕ, а не в клиентском коде.
 * Спрятать пункт меню недостаточно: ссылка останется в истории браузера и в
 * закладках, а страница продолжит открываться напрямую. Настоящее выключение
 * возможно только там, где решается, отдавать ли страницу вообще.
 */

import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import { db } from "@/lib/db";

export const FEATURE_KEYS = [
  "battlePass",
  "clans",
  "watchTogether",
  "donate",
  "premium",
  "chat",
  "manga",
  /** Календарь релизов */
  "releases",
  "adminPanel",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/**
 * Флаг без записи в базе считаем включённым.
 *
 * Обратное поведение страшнее: строка, потерянная при пересоздании базы,
 * молча выключила бы половину сайта. Явное выключение — это всегда явная
 * строка `enabled = false` в панели.
 */
const DEFAULT_ENABLED = true;

/**
 * Снимок флагов на текущий запрос.
 *
 * `cache` из React: главная дёргает флаги в шапке и в пяти секциях, и без
 * кэша это было бы пять одинаковых запросов на один рендер.
 */
export const getFeatures = cache(async (): Promise<Record<FeatureKey, boolean>> => {
  const rows = await db.featureFlag.findMany({
    where: { key: { in: [...FEATURE_KEYS] } },
    select: { key: true, enabled: true },
  });

  const known = new Map(rows.map((r) => [r.key, r.enabled]));
  const result = {} as Record<FeatureKey, boolean>;

  for (const key of FEATURE_KEYS) {
    result[key] = known.get(key) ?? DEFAULT_ENABLED;
  }

  return result;
});

/** Включена ли механика. */
export async function isEnabled(key: FeatureKey): Promise<boolean> {
  return (await getFeatures())[key];
}

/**
 * Страница выключенной механики отдаёт 404.
 *
 * Именно 404, а не редирект: при выключенном боевом пропуске честнее сказать
 * «страницы нет», чем молча отправить на главную — иначе человек решит, что
 * его перекинуло багом.
 *
 * Ссылка в меню прячется тоже, но это удобство: по прямому адресу страница
 * недоступна в любом случае.
 */
export async function requireFeature(key: FeatureKey): Promise<void> {
  if (!(await isEnabled(key))) notFound();
}