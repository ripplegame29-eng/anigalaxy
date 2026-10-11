/**
 * Конфигурация сайта из панели.
 *
 * Строки в таблице `settings` создавались, но до этого модуля их никто не
 * читал: администратор менял «Название сайта», а заголовок вкладки оставался
 * прежним. Здесь они превращаются в значения, которые реально применяются.
 *
 * Значения по умолчанию продублированы с prisma/seed.ts. Дублирование
 * намеренное: база может быть не создана (свежий клон, сборка без миграций),
 * и падать на этом должен не рендер сайта, а сам seed.
 */

import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";

export interface SiteConfig {
  /** Название сайта: заголовок вкладки, OpenGraph, подпись. */
  title: string;
  /** Подзаголовок: описание страницы по умолчанию. */
  tagline: string;
  /** Сколько жалоб на одну цель переводит её в статус «скрыто автоматически». */
  autoHideThreshold: number;
}

const DEFAULTS: SiteConfig = {
  title: "AniGalaxy",
  tagline: "Смотри аниме с комментариями, кланами и боевым пропуском",
  autoHideThreshold: 5,
};

/**
 * Снимок конфигурации на запрос.
 *
 * `cache` из React: корневой layout и страницы читают настройки независимо,
 * и без кэша одна отрисовка сделала бы несколько одинаковых SELECT'ов.
 */
export const getSiteConfig = cache(async (): Promise<SiteConfig> => {
  const rows = await db.setting.findMany({
    where: { key: { in: ["site.title", "site.tagline", "moderation.autoHideThreshold"] } },
    select: { key: true, value: true },
  });

  const values = new Map(rows.map((r) => [r.key, r.value]));

  const threshold = Number(values.get("moderation.autoHideThreshold"));
  const title = values.get("site.title")?.trim();
  const tagline = values.get("site.tagline")?.trim();

  return {
    // Пустая строка в настройке — не повод оставлять страницу без заголовка.
    title: title || DEFAULTS.title,
    tagline: tagline || DEFAULTS.tagline,
    autoHideThreshold:
      Number.isInteger(threshold) && threshold > 0 ? threshold : DEFAULTS.autoHideThreshold,
  };
});

/** Настройка по ключу — для тех мест, где нужен один параметр. */
export async function getSetting(key: string, fallback: string): Promise<string> {
  const row = await db.setting.findUnique({ where: { key } });
  const value = row?.value?.trim();
  return value || fallback;
}