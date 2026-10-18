/**
 * Расписание релизов для страницы `/releases`.
 *
 * Отдельный модуль от `admin/releases-data`: здесь то, что нужно самому сайту,
 * а панель работает со своей таблицей через Prisma напрямую.
 *
 * Расписание повторяется каждую неделю, поэтому хранится день недели и время,
 * а конкретные даты считаются на клиенте для выбранной недели. Так страница
 * показывает и прошлую, и будущую неделю без единой записи в базе.
 */

import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";

export interface ReleaseItem {
  id: string;
  title: string;
  studio: string | null;
  /** 0 = понедельник … 6 = воскресенье */
  day: number;
  /** «ЧЧ:ММ» */
  time: string;
  episodes: number | null;
  rating: number | null;
  isNew: boolean;
  genres: string[];
  poster: string | null;
  banner: string | null;
}

/**
 * Снимок расписания на запрос.
 *
 * `cache` из React: страница зовёт список и в разметке, и в счётчиках
 * статистики — без кэша это были бы два одинаковых SELECT'а на один рендер.
 */
export const listReleases = cache(async (): Promise<ReleaseItem[]> => {
  const rows = await db.release.findMany({
    where: { enabled: true },
    orderBy: [{ day: "asc" }, { time: "asc" }],
    select: {
      id: true,
      title: true,
      studio: true,
      day: true,
      time: true,
      episodes: true,
      rating: true,
      isNew: true,
      genres: true,
      poster: true,
      banner: true,
    },
  });

  return rows.map((row) => ({
    ...row,
    genres: row.genres ? row.genres.split(",").filter(Boolean) : [],
  }));
});

/** Три числа для плиток статистики: всего, премьер, средняя оценка. */
export function releaseStats(items: ReleaseItem[]) {
  const total = items.length;
  const premieres = items.filter((i) => i.isNew).length;

  const rated = items.filter((i) => typeof i.rating === "number");
  const avg = rated.length
    ? Math.round((rated.reduce((sum, i) => sum + (i.rating ?? 0), 0) / rated.length) * 100) / 100
    : 0;

  return { total, premieres, avg };
}