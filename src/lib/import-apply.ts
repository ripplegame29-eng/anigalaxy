"use client";

/** Запись результата переноса в «Мой список»: подборки, избранное, оценки */

import {
  loadCollections,
  loadFavorites,
  saveCollectionsList,
  toggleFavorite,
  sanitizeName,
  type Collection,
} from "./collections";
import { getRating, setRating } from "./ratings";
import { syncTitleRating } from "./ratings-cloud";
import { STATUS_LABEL, STATUS_ORDER, type ImportEntry } from "./import-lists";

export interface ApplyOptions {
  lists: boolean;
  favorites: boolean;
  ratings: boolean;
}

export interface ApplyResult {
  collections: number;
  added: number;
  favorites: number;
  ratings: number;
}

export interface Resolved {
  entry: ImportEntry;
  id: string;
}

export function applyImport(rows: Resolved[], options: ApplyOptions, source: string): ApplyResult {
  const result: ApplyResult = { collections: 0, added: 0, favorites: 0, ratings: 0 };

  if (options.lists) {
    const all = loadCollections();
    for (const status of STATUS_ORDER) {
      const ids = [...new Set(rows.filter((r) => r.entry.status === status).map((r) => r.id))];
      if (!ids.length) continue;
      const name = sanitizeName(`${STATUS_LABEL[status]} · ${source}`);
      const existing = all.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        const fresh = ids.filter((id) => !existing.animeIds.includes(id));
        existing.animeIds = [...existing.animeIds, ...fresh];
        result.added += fresh.length;
      } else {
        const created: Collection = {
          id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          name,
          animeIds: ids,
          createdAt: Date.now(),
          // Перенесённые списки приватные: делиться ими человек решает сам
          pub: false,
        };
        all.unshift(created);
        result.added += ids.length;
      }
      result.collections += 1;
    }
    saveCollectionsList(all);
  }

  if (options.favorites) {
    const have = new Set(loadFavorites());
    for (const r of rows) {
      if (!r.entry.fav || have.has(r.id)) continue;
      toggleFavorite(r.id);
      have.add(r.id);
      result.favorites += 1;
    }
  }

  if (options.ratings) {
    let n = 0;
    for (const r of rows) {
      const score = r.entry.score;
      if (!score || getRating(r.id) === score) continue;
      // setRating снимает оценку при повторе, поэтому сначала проверили выше
      if (setRating(r.id, score) === score) {
        result.ratings += 1;
        if (n < 200) {
          const id = r.id;
          window.setTimeout(() => syncTitleRating(id, score), n * 150);
          n += 1;
        }
      }
    }
  }

  return result;
}
