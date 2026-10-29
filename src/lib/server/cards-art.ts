/**
 * Арты персонажей: лежат в `data/cards-art/<id>.jpg`, отдаёт их маршрут
 * `/api/cards/art/<id>`. Недостающие сервер сам докачивает с AniList в фоне
 * (см. `startArtSync`), так что вручную ничего запускать не нужно.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CATALOG, setHidden } from "../cards/catalog";
import { ART_QUERY, pickImage, type RawChar } from "../cards/art-match";

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

const MISSING_FILE = path.join(ART_DIR, "_missing.json");

/** Герои, для которых AniList подтвердил: фото нет. Они не выпадают из паков, пока не появится файл арта. */
export function missingIds(): string[] {
  let list: string[] = [];
  try {
    if (existsSync(MISSING_FILE)) list = JSON.parse(readFileSync(MISSING_FILE, "utf8")) as string[];
  } catch {
    list = [];
  }
  const have = new Set(artIds());
  const hidden = list.filter((id) => !have.has(id));
  setHidden(hidden);
  return hidden;
}

function saveMissing(ids: string[]): void {
  try {
    mkdirSync(ART_DIR, { recursive: true });
    writeFileSync(MISSING_FILE, JSON.stringify([...new Set(ids)]));
  } catch {
    /* не критично */
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** null — сеть/сервис недоступны, "none" — AniList ответил, но фото у героя нет */
async function findImage(search: string, series: string): Promise<string | "none" | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: ART_QUERY, variables: { q: search } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 429) {
      await sleep((Number(res.headers.get("retry-after")) || 30) * 1000 + 500);
      continue;
    }
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { Page?: { characters?: RawChar[] } } };
    return pickImage(search, series, data.data?.Page?.characters ?? []) ?? "none";
  }
  return null;
}

export const artStatus = { running: false, done: 0, failed: [] as string[], lastError: "", nextTry: 0 };

/** Фоновая докачка недостающих артов. Безопасно вызывать сколько угодно раз. */
export function startArtSync(): void {
  if (artStatus.running || Date.now() < artStatus.nextTry) return;
  const missing = () => {
    const gone = new Set(missingIds());
    return CATALOG.filter((c) => !artIds().includes(c.id) && !artStatus.failed.includes(c.id) && !gone.has(c.id));
  };
  if (!missing().length) return;
  artStatus.running = true;
  void (async () => {
    let netFails = 0;
    try {
      mkdirSync(ART_DIR, { recursive: true });
      for (const c of missing()) {
        try {
          const url = await findImage(c.search, c.series);
          if (url === "none") {
            artStatus.failed.push(c.id);
            saveMissing([...missingIds(), c.id]);
            continue;
          }
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
