/**
 * Перенос списков с других сайтов (MyAnimeList, Shikimori, AniList-экспорты,
 * простой список названий). Модуль общий: разбор файлов идёт в браузере,
 * сопоставление с тайтлами сайта — на сервере (/api/import/resolve).
 */

export type ImportStatus =
  | "watching"
  | "completed"
  | "planned"
  | "on_hold"
  | "dropped";

export interface ImportEntry {
  /** id тайтла на Shikimori / MyAnimeList (у Kodik они совпадают) */
  sid?: number;
  title?: string;
  status: ImportStatus;
  /** Оценка 1…10, 0/undefined — без оценки */
  score?: number;
  /** Пришло из «Избранного» источника */
  fav?: boolean;
}

export const STATUS_LABEL: Record<ImportStatus, string> = {
  watching: "Смотрю",
  completed: "Просмотрено",
  planned: "В планах",
  on_hold: "Отложено",
  dropped: "Брошено",
};

export const STATUS_ORDER: ImportStatus[] = ["watching", "completed", "planned", "on_hold", "dropped"];

export const MAX_IMPORT = 3000;

/** Приводит статус из любого источника к нашему */
export function normStatus(raw: unknown): ImportStatus {
  const v = String(raw ?? "").toLowerCase().replace(/[\s_-]+/g, "");
  if (v === "1" || v === "watching" || v === "currentlywatching" || v === "current" || v === "rewatching" || v === "repeating") return "watching";
  if (v === "2" || v === "completed" || v === "complete" || v === "finished") return "completed";
  if (v === "3" || v === "onhold" || v === "paused" || v === "hold") return "on_hold";
  if (v === "4" || v === "dropped" || v === "drop") return "dropped";
  if (v === "6" || v === "plantowatch" || v === "planned" || v === "planning" || v === "wantwatch") return "planned";
  return "planned";
}

function score10(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.min(10, Math.round(n));
}

function sidOf(raw: unknown): number | undefined {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

/** Экспорт в формате MyAnimeList (.xml) — его же отдаёт Shikimori */
export function parseMalXml(text: string): ImportEntry[] {
  const doc = new DOMParser().parseFromString(text, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("Не удалось прочитать XML");
  const out: ImportEntry[] = [];
  for (const node of Array.from(doc.getElementsByTagName("anime"))) {
    const get = (tag: string) => node.getElementsByTagName(tag)[0]?.textContent?.trim() ?? "";
    const sid = sidOf(get("series_animedb_id"));
    const title = get("series_title");
    if (!sid && !title) continue;
    out.push({
      sid,
      title: title || undefined,
      status: normStatus(get("my_status")),
      score: score10(get("my_score")),
    });
  }
  return out;
}

/** JSON-экспорт Shikimori (animes.json / anime_list.json) */
export function parseShikimoriJson(text: string): ImportEntry[] {
  const data = JSON.parse(text) as unknown;
  const rows = Array.isArray(data) ? data : [];
  const out: ImportEntry[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const type = String(r.target_type ?? "Anime");
    if (type.toLowerCase() !== "anime") continue;
    const sid = sidOf(r.target_id ?? r.id);
    const title = String(r.target_title_ru ?? r.target_title ?? r.title ?? "").trim();
    if (!sid && !title) continue;
    out.push({
      sid,
      title: title || undefined,
      status: normStatus(r.status),
      score: score10(r.score),
    });
  }
  return out;
}

/** Простой список: строка = название, можно «Название; 9» или «Название | 9» */
export function parseTitlesList(text: string): ImportEntry[] {
  const out: ImportEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean || clean.startsWith("#")) continue;
    const m = clean.match(/^(.*?)[\s]*[;|\t][\s]*(\d{1,2})$/);
    const title = (m ? m[1] : clean).replace(/^["«]|["»]$/g, "").trim();
    if (title.length < 2) continue;
    out.push({ title, status: "planned", score: m ? score10(m[2]) : undefined });
  }
  return out;
}

/** Определяет формат по содержимому и разбирает файл */
export function parseImportFile(name: string, text: string): ImportEntry[] {
  const body = text.replace(/^﻿/, "");
  const head = body.trimStart().slice(0, 1);
  let rows: ImportEntry[];
  if (head === "<") rows = parseMalXml(body);
  else if (head === "[" || head === "{") rows = parseShikimoriJson(body);
  else rows = parseTitlesList(body);
  if (!rows.length) throw new Error(`В файле «${name}» не нашлось ни одного аниме`);
  return rows.slice(0, MAX_IMPORT);
}
