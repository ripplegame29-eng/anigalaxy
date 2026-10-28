/**
 * Арты персонажей: лежат в `data/cards-art/<id>.jpg`, отдаёт их маршрут
 * `/api/cards/art/<id>`. Недостающие сервер сам докачивает с AniList в фоне
 * (см. `startArtSync`), так что вручную ничего запускать не нужно.
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CATALOG } from "../cards/catalog";

export const ART_DIR = path.join(process.cwd(), "data", "cards-art");

let cache: { at: number; ids: string[] } | null = null;

export function artIds(): string[] {
  if (cache && Date.now() - cache.at < 10_000) return cache.ids;
  let ids: string[] = [];
  try {
    if (existsSync(ART_DIR)) ids = readdirSync(ART_DIR).filter((f) => f.endsWith(".jpg")).map((f) => f.slice(0, -4));
  } catch {
    ids = [];
  }
  cache = { at: Date.now(), ids };
  return ids;
}

const QUERY = `query ($q: String) { Character(search: $q, sort: FAVOURITES_DESC) { image { large } } }`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function findImage(search: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { q: search } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 429) {
      await sleep((Number(res.headers.get("retry-after")) || 30) * 1000 + 500);
      continue;
    }
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { Character?: { image?: { large?: string } } } };
    const url = data.data?.Character?.image?.large;
    return url && !url.includes("default") ? url : null;
  }
  return null;
}

export const artStatus = { running: false, done: 0, failed: [] as string[], lastError: "", nextTry: 0 };

/** Фоновая докачка недостающих артов. Безопасно вызывать сколько угодно раз. */
export function startArtSync(): void {
  if (artStatus.running || Date.now() < artStatus.nextTry) return;
  const missing = () => CATALOG.filter((c) => !artIds().includes(c.id) && !artStatus.failed.includes(c.id));
  if (!missing().length) return;
  artStatus.running = true;
  void (async () => {
    let netFails = 0;
    try {
      mkdirSync(ART_DIR, { recursive: true });
      for (const c of missing()) {
        try {
          const url = await findImage(c.search);
          if (!url) {
            artStatus.failed.push(c.id);
            continue;
          }
          const img = await fetch(url, { signal: AbortSignal.timeout(20_000) });
          if (!img.ok) throw new Error(`HTTP ${img.status}`);
          writeFileSync(path.join(ART_DIR, `${c.id}.jpg`), Buffer.from(await img.arrayBuffer()));
          cache = null;
          artStatus.done += 1;
          netFails = 0;
        } catch (e) {
          artStatus.lastError = e instanceof Error ? e.message : String(e);
          netFails += 1;
          if (netFails >= 3) {
            artStatus.nextTry = Date.now() + 30 * 60_000;
            break;
          }
        }
        await sleep(700);
      }
    } finally {
      artStatus.running = false;
    }
  })();
}
