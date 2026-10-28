/** Какие арты персонажей уже скачаны в `public/cards/art/` (скрипт `tools/cards-sync.mjs`). */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

let cache: { at: number; ids: string[] } | null = null;

export function artIds(): string[] {
  if (cache && Date.now() - cache.at < 15_000) return cache.ids;
  const dir = path.join(process.cwd(), "public", "cards", "art");
  let ids: string[] = [];
  try {
    if (existsSync(dir)) ids = readdirSync(dir).filter((f) => f.endsWith(".jpg") || f.endsWith(".webp")).map((f) => f.replace(/\.(jpg|webp)$/, ""));
  } catch {
    ids = [];
  }
  cache = { at: Date.now(), ids };
  return ids;
}
