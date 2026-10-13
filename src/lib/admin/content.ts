/**
 * Чтение управляемого контента для рендера на сайте — только сервер.
 *
 * Описание типов блоков лежит отдельно, в `content-kinds.ts`: там чистые данные,
 * которые нужны и клиентскому редактору, и серверной валидации. Смешай их в
 * одном файле — и клиентский компонент потянет за собой базу.
 */

import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";

import type { ContentKind } from "./content-kinds";

export interface ActiveBlock {
  id: string;
  title: string | null;
  sortOrder: number;
  payload: Record<string, string>;
}

/**
 * Активные блоки типа для рендера.
 *
 * `cache` из React: результат переживает в пределах одного запроса, поэтому
 * страница, зовущая функцию из трёх компонентов, делает одну выборку.
 *
 * Отдаём только `enabled` и те, чей срок показа попадает в now — иначе
 * забытый блок с прошлой акцией всплыл бы на сайте через год.
 *
 * Битый payload пропускаем, а не роняем страницу: поле редактируется вручную
 * в панели, и одна ошибка не должна ронять главную. Пропуск виден в журнале
 * ошибок (см. lib/logger.ts).
 */
export const getActiveBlocks = cache(async (kind: ContentKind): Promise<ActiveBlock[]> => {
  const now = BigInt(Date.now());

  const rows = await db.contentBlock.findMany({
    where: {
      kind,
      enabled: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    },
    orderBy: { sortOrder: "asc" },
  });

  const blocks: ActiveBlock[] = [];

  for (const row of rows) {
    let payload: unknown;
    try {
      payload = JSON.parse(row.payload);
    } catch {
      continue;
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) continue;

    blocks.push({
      id: row.id,
      title: row.title,
      sortOrder: row.sortOrder,
      payload: payload as Record<string, string>,
    });
  }

  return blocks;
});