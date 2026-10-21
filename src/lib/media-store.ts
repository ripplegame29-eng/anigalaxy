"use client";

/**
 * Хранилище своих картинок и гифок профиля (IndexedDB).
 *
 * localStorage держит ~5 МБ на всё, а гиф-арты весят по 2–8 МБ, поэтому
 * тяжёлые файлы лежат здесь как Blob, а в настройках профиля хранится
 * только короткий id. Файл не перекодируется — анимация гифки сохраняется.
 */
import { useEffect, useState } from "react";

const DB = "animehub-media";
const STORE = "blobs";
/** Потолок одного файла */
export const MEDIA_MAX_MB = 20;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = run(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export type MediaPut = { ok: true; id: string } | { ok: false; error: string };

/** Сохраняет файл и возвращает id */
export async function putMedia(file: File): Promise<MediaPut> {
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    return { ok: false, error: "Нужна картинка, гифка или короткое видео" };
  }
  if (file.size > MEDIA_MAX_MB * 1024 * 1024) {
    return { ok: false, error: `Файл больше ${MEDIA_MAX_MB} МБ` };
  }
  try {
    const id = `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    await tx("readwrite", (s) => s.put(file, id));
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Браузер не дал сохранить файл — не хватает места" };
  }
}

export async function deleteMedia(id: string): Promise<void> {
  if (id.startsWith("/")) return;
  urlCache.delete(id);
  try {
    await tx("readwrite", (s) => s.delete(id));
  } catch {
    /* нечего удалять */
  }
}

const urlCache = new Map<string, { url: string; video: boolean }>();

async function resolveMedia(id: string): Promise<{ url: string; video: boolean } | null> {
  // Готовые сборки лежат в public и приходят прямым адресом
  if (id.startsWith("/")) return { url: id, video: /\.(webm|mp4)$/i.test(id) };
  const hit = urlCache.get(id);
  if (hit) return hit;
  try {
    const blob = await tx<Blob | undefined>("readonly", (s) => s.get(id));
    if (!blob) return null;
    const entry = { url: URL.createObjectURL(blob), video: blob.type.startsWith("video/") };
    urlCache.set(id, entry);
    return entry;
  } catch {
    return null;
  }
}

/** URL файла по id; null, пока грузится или файла нет */
export function useMedia(id: string | undefined): { url: string; video: boolean } | null {
  const [state, setState] = useState<{ id: string; v: { url: string; video: boolean } | null } | null>(null);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    void resolveMedia(id).then((v) => alive && setState({ id, v }));
    return () => {
      alive = false;
    };
  }, [id]);
  return id && state?.id === id ? state.v : null;
}
