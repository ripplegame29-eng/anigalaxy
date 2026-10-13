/**
 * РџСЂРѕРіСЂРµСЃСЃ РёРіСЂРѕРєР° РЅР° СЃРµСЂРІРµСЂРµ вЂ” С‚РѕР»СЊРєРѕ РґР»СЏ СЃРµСЂРІРµСЂРЅРѕРіРѕ РєРѕРґР°.
 *
 * Р§С‚Рѕ СЌС‚Рѕ Р·Р° Р·РµСЂРєР°Р»Рѕ Рё Р·Р°С‡РµРј РѕРЅРѕ РЅСѓР¶РЅРѕ:
 *
 * РџРѕРєР° `storageMode: "local"`, РґРѕРєСѓРјРµРЅС‚ РїСЂРѕРіСЂРµСЃСЃРёРё Р»РµР¶РёС‚ РІ localStorage
 * Р±СЂР°СѓР·РµСЂР° (СЃРј. src/lib/progression/store.ts). РЈ РіРѕСЃС‚СЏ СЃР°Р№С‚Р°, РєРѕС‚РѕСЂС‹Р№ РЅРµ
 * РІС…РѕРґРёР» С‡РµСЂРµР· СЃРµСЂРІРµСЂРЅСѓСЋ С„РѕСЂРјСѓ, Р°РєРєР°СѓРЅС‚Р° РІРѕРѕР±С‰Рµ РЅРµС‚ вЂ” Р·РЅР°С‡РёС‚, С…СЂР°РЅРёС‚СЊ
 * РїСЂРѕРіСЂРµСЃСЃ РїРѕ-РЅР°СЃС‚РѕСЏС‰РµРјСѓ РїРѕРєР° РЅРµРіРґРµ.
 *
 * РќРѕ Р°РґРјРёРЅСѓ РЅСѓР¶РЅРѕ РІРёРґРµС‚СЊ, С‡С‚Рѕ РїСЂРѕРёСЃС…РѕРґРёС‚ СЃ РёРіСЂРѕРєР°РјРё. РџРѕСЌС‚РѕРјСѓ РґРѕРєСѓРјРµРЅС‚
 * РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ РѕС‚РїСЂР°РІР»СЏРµС‚СЃСЏ СЃСЋРґР°, Рё Р±Р°Р·Р° СЃС‚Р°РЅРѕРІРёС‚СЃСЏ РјРµСЃС‚РѕРј, РіРґРµ РјРѕР¶РЅРѕ
 * РїРѕСЃРјРѕС‚СЂРµС‚СЊ СЃРІРѕРґРєСѓ Рё РїРѕРїСЂР°РІРёС‚СЊ Р±Р°Р»Р°РЅСЃ РІСЂСѓС‡РЅСѓСЋ.
 *
 * РљРѕРіРґР° РёРіСЂРѕРІРѕР№ РІС…РѕРґ РїРµСЂРµРµРґРµС‚ РЅР° СЃРµСЂРІРµСЂ, СЌС‚Р° РјРѕРґРµР»СЊ СЃС‚Р°РЅРµС‚ РѕСЃРЅРѕРІРЅС‹Рј
 * С…СЂР°РЅРёР»РёС‰РµРј: РєРѕРЅС‚СЂР°РєС‚ `load/save` Сѓ `ProgressStore` СѓР¶Рµ Р°СЃРёРЅС…СЂРѕРЅРЅС‹Р№, С‚Р°Рє
 * С‡С‚Рѕ РїРµСЂРµРєР»СЋС‡РµРЅРёРµ `storageMode` РЅР° `server` РЅРµ РїРѕС‚СЂРµР±СѓРµС‚ РїСЂР°РІРѕРє РґРІРёР¶РєР°.
 */

import "server-only";

import { db } from "@/lib/db";
import { logError } from "@/lib/logger";
import { PROGRESS_SCHEMA } from "@/lib/progression/doc";
import type { ProgressDoc } from "@/lib/progression/types";

/** Р”РѕРєСѓРјРµРЅС‚ РЅРѕСЂРјР°Р»РёР·РѕРІР°РЅРЅС‹Р№, РЅРѕ СЂР°Р·РґСѓС‚СЊСЃСЏ РѕРЅ РІСЃС‘ СЂР°РІРЅРѕ РјРѕР¶РµС‚. */
const MAX_DOC_BYTES = 512 * 1024;

export interface ProgressSummary {
  userId: string;
  revision: number;
  updatedAt: number;
  touchedByAdmin: boolean;
  level: number;
  xpTotal: number;
  ac: number;
  streak: number;
  achievements: number;
  tags: number;
  purchases: number;
  events: number;
}

/**
 * РџСЂРёРЅРёРјР°РµС‚ РґРѕРєСѓРјРµРЅС‚ РѕС‚ РєР»РёРµРЅС‚Р°.
 *
 * РџСЂРѕРІРµСЂРѕРє Р·РґРµСЃСЊ РЅР°РјРµСЂРµРЅРЅРѕ РјРёРЅРёРјСѓРј, Рё СЌС‚Рѕ РѕСЃРѕР·РЅР°РЅРЅС‹Р№ СЂР°Р·РјРµРЅ: РґРѕРєСѓРјРµРЅС‚
 * РїСЂРёС…РѕРґРёС‚ РѕС‚ С‚РѕРіРѕ Р¶Рµ РґРІРёР¶РєР°, С‡С‚Рѕ Рё Р»РѕРєР°Р»СЊРЅС‹Р№, Рё РїРѕР»РЅР°СЏ РІР°Р»РёРґР°С†РёСЏ РЅР° СЃРµСЂРІРµСЂРµ
 * РѕР·РЅР°С‡Р°Р»Р° Р±С‹ РІС‚РѕСЂРѕР№ РґРІРёР¶РѕРє, РєРѕС‚РѕСЂС‹Р№ СЃРѕ РІСЂРµРјРµРЅРµРј СЂР°Р·РѕР№РґС‘С‚СЃСЏ СЃ РїРµСЂРІС‹Рј.
 * РџРѕСЌС‚РѕРјСѓ РїСЂРѕРІРµСЂСЏРµРј С‚РѕР»СЊРєРѕ С‚Рѕ, С‡С‚Рѕ РЅСѓР¶РЅРѕ РґР»СЏ Р±РµР·РѕРїР°СЃРЅРѕСЃС‚Рё Рё С†РµР»РѕСЃС‚РЅРѕСЃС‚Рё:
 *
 * - СЂР°Р·РјРµСЂ (РёРЅР°С‡Рµ РѕРґРёРЅ РёРіСЂРѕРє Р·Р°Р±СЊС‘С‚ Р±Р°Р·Сѓ РјРµРіР°Р±Р°Р№С‚РЅС‹РјРё СЃС‚СЂРѕРєР°РјРё)
 * - СЃС…РµРјР° СЃРѕРІРїР°РґР°РµС‚ СЃ РёР·РІРµСЃС‚РЅРѕР№ (РёРЅР°С‡Рµ РїСЂРёРґС‘С‚СЃСЏ РіР°РґР°С‚СЊ, РєР°Рє РµС‘ С‡РёС‚Р°С‚СЊ)
 * - СЌС‚Рѕ РѕР±СЉРµРєС‚, Р° РЅРµ РјР°СЃСЃРёРІ Рё РЅРµ СЃС‚СЂРѕРєР°
 *
 * Р РµР°Р»СЊРЅР°СЏ Р·Р°С‰РёС‚Р° РѕС‚ РЅР°РєСЂСѓС‚РєРё вЂ” РЅРµ Р·РґРµСЃСЊ: РґРѕРІРµСЂСЏС‚СЊ РєР»РёРµРЅС‚СЃРєРѕР№ РѕС‚РїСЂР°РІРєРµ
 * РЅРµР»СЊР·СЏ, РїРѕРєР° С…СЂР°РЅРёР»РёС‰Рµ РѕСЃС‚Р°С‘С‚СЃСЏ Р±СЂР°СѓР·РµСЂРЅС‹Рј. Р­С‚Рѕ СЃС‚Р°РЅРµС‚ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹Рј
 * РїСЂРё РїРµСЂРµС…РѕРґРµ РЅР° СЃРµСЂРІРµСЂРЅРѕРµ С…СЂР°РЅРёР»РёС‰Рµ (СЃРѕР±С‹С‚РёСЏ РЅР°РґРѕ Р±СѓРґРµС‚ СЃР»Р°С‚СЊ РЅР° СЃРµСЂРІРµСЂ
 * Рё РїСЂРёРјРµРЅСЏС‚СЊ РґРІРёР¶РєРѕРј, Р° РЅРµ РїСЂРёРЅРёРјР°С‚СЊ РіРѕС‚РѕРІС‹Р№ РґРѕРєСѓРјРµРЅС‚).
 */
export async function saveProgress(
  userId: string,
  raw: string,
  meta: { ip?: string | null } = {},
): Promise<{ ok: boolean; error?: string }> {
  if (raw.length > MAX_DOC_BYTES) {
    return { ok: false, error: `Р”РѕРєСѓРјРµРЅС‚ Р±РѕР»СЊС€Рµ ${MAX_DOC_BYTES / 1024} РљР‘` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Р”РѕРєСѓРјРµРЅС‚ вЂ” РЅРµРІР°Р»РёРґРЅС‹Р№ JSON" };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "Р”РѕРєСѓРјРµРЅС‚ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РѕР±СЉРµРєС‚РѕРј" };
  }

  const doc = parsed as ProgressDoc;
  const schemaVersion = typeof doc.schema === "number" ? doc.schema : PROGRESS_SCHEMA;

  if (schemaVersion > PROGRESS_SCHEMA) {
    // РљР»РёРµРЅС‚ РЅРѕРІРµРµ СЃРµСЂРІРµСЂР°. РќРµ Р·Р°С‚РёСЂР°РµРј: РёРЅР°С‡Рµ РёРіСЂРѕРє РїРѕС‚РµСЂСЏРµС‚ РїСЂРѕРіСЂРµСЃСЃ,
    // РїСЂРѕСЃС‚Рѕ РѕС‚РєСЂС‹РІ СЃР°Р№С‚ РґРѕ РґРµРїР»РѕСЏ РЅРѕРІРѕР№ РІРµСЂСЃРёРё.
    return {
      ok: false,
      error: `Р”РѕРєСѓРјРµРЅС‚ РІРµСЂСЃРёРё ${schemaVersion} РЅРѕРІРµРµ СЃРµСЂРІРµСЂРЅРѕР№ (${PROGRESS_SCHEMA}). РћР±РЅРѕРІРё СЃРµСЂРІРµСЂ.`,
    };
  }

  const now = Date.now();

  try {
    await db.playerProgress.upsert({
      where: { userId },
      create: { userId, doc: raw, schemaVersion, createdAt: now, updatedAt: now, revision: 1 },
      update: {
        doc: raw,
        schemaVersion,
        updatedAt: now,
        revision: { increment: 1 },
        // Р СѓС‡РЅР°СЏ РїСЂР°РІРєР° Р°РґРјРёРЅРѕРј РЅРµ Р·Р°С‚РёСЂР°РµС‚СЃСЏ СЃР»РµРґСѓСЋС‰РµР№ РѕС‚РїСЂР°РІРєРѕР№ РѕС‚ РєР»РёРµРЅС‚Р°,
        // РЅРѕ С„Р»Р°Рі РѕСЃС‚Р°С‘С‚СЃСЏ: РѕРЅ Р¶Рµ РїРѕРєР°Р·С‹РІР°РµС‚ РІ РїР°РЅРµР»Рё В«СЌС‚РѕРіРѕ С‚СЂРѕРіР°Р»Рё СЂСѓРєР°РјРёВ».
      },
    });
  } catch (error: unknown) {
    await logError({
      level: "error",
      source: "db",
      operation: "progress.save",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      context: { userId, ip: meta.ip, bytes: raw.length },
    });
    return { ok: false, error: "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ" };
  }

  return { ok: true };
}

/** Р”РѕРєСѓРјРµРЅС‚ РёРіСЂРѕРєР° РёР»Рё null, РµСЃР»Рё РµРіРѕ РµС‰С‘ РЅРµС‚. */
export async function readProgress(userId: string): Promise<string | null> {
  const row = await db.playerProgress.findUnique({ where: { userId } });
  return row?.doc ?? null;
}

/**
 * РЎРІРѕРґРєР° РїРѕ РїСЂРѕРіСЂРµСЃСЃСѓ РґР»СЏ СЃРїРёСЃРєР° РІ Р°РґРјРёРЅРєРµ.
 *
 * Р”РѕРєСѓРјРµРЅС‚ СЂР°Р·Р±РёСЂР°РµС‚СЃСЏ С†РµР»РёРєРѕРј Рё Р·РґРµСЃСЊ, Р° РЅРµ РІ SQL: РѕРЅ Р»РµР¶РёС‚ СЃС‚СЂРѕРєРѕР№ JSON,
 * Рё SQLite Р±РµР· JSON-С„СѓРЅРєС†РёР№ РІ РєРѕРЅС„РёРіСѓСЂР°С†РёРё Prisma РІСЃС‘ СЂР°РІРЅРѕ РЅРµ РґР°СЃС‚
 * РѕС‚С„РёР»СЊС‚СЂРѕРІР°С‚СЊ РїРѕ `progress.level`. Р Р°Р·Р±РѕСЂ РЅР° СЃРµСЂРІРµСЂРµ С‡РµСЃС‚РЅРµРµ, С‡РµРј
 * РїСЂРёС‚РІРѕСЂСЏС‚СЊСЃСЏ, С‡С‚Рѕ Р°РіСЂРµРіР°С‚С‹ РїРѕ РІР»РѕР¶РµРЅРЅРѕРјСѓ JSON СЃС‡РёС‚Р°СЋС‚СЃСЏ РёРЅРґРµРєСЃРѕРј.
 */
export function summarize(userId: string, raw: string, meta: {
  revision: number;
  updatedAt: number;
  touchedByAdmin: boolean;
}): ProgressSummary {
  let doc: ProgressDoc | null = null;
  try {
    doc = JSON.parse(raw) as ProgressDoc;
  } catch {
    doc = null;
  }

  const progress = doc?.progress;

  return {
    userId,
    revision: meta.revision,
    updatedAt: meta.updatedAt,
    touchedByAdmin: meta.touchedByAdmin,
    level: progress?.level ?? 1,
    xpTotal: progress?.xpTotal ?? 0,
    ac: progress?.acBalance ?? 0,
    streak: progress?.streakCurrent ?? 0,
    achievements: doc ? Object.keys(doc.achievements ?? {}).length : 0,
    tags: doc ? Object.keys(doc.tags ?? {}).length : 0,
    purchases: doc?.purchases?.length ?? 0,
    events: doc?.meta?.events ?? 0,
  };
}

/** Р’СЃРµ, Сѓ РєРѕРіРѕ РµСЃС‚СЊ РїСЂРѕРіСЂРµСЃСЃ, СЃРІРµР¶РёРµ СЃРІРµСЂС…Сѓ. */
export async function listProgressSummaries(limit = 50): Promise<ProgressSummary[]> {
  const rows = await db.playerProgress.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return rows.map((row) =>
    summarize(row.userId, row.doc, {
      revision: row.revision,
      updatedAt: Number(row.updatedAt),
      touchedByAdmin: row.touchedByAdmin,
    }),
  );
}
