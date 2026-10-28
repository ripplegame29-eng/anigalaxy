import type { FrameResult } from "./frame-types";

/** Вырезает часть кадра (в долях) и сохраняет JPEG не шире 960 px */
async function cut(bitmap: ImageBitmap, x: number, y: number, w: number, h: number, name: string): Promise<File | null> {
  const sw = Math.round(bitmap.width * w);
  const sh = Math.round(bitmap.height * h);
  const scale = Math.min(1, 960 / sw);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  canvas.getContext("2d")?.drawImage(bitmap, bitmap.width * x, bitmap.height * y, sw, sh, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  return blob ? new File([blob], name, { type: "image/jpeg" }) : null;
}

/**
 * Готовим варианты кадра: в скриншоте часто есть интерфейс плеера, субтитры
 * и чёрные полосы, и поиск по целому кадру промахивается. Поэтому кроме
 * целого кадра делаем «без нижней полосы» (субтитры) и «центр» (без рамок).
 */
async function variants(file: File): Promise<File[]> {
  if (file.type === "image/gif") return [file];
  try {
    const bitmap = await createImageBitmap(file);
    const out = (
      await Promise.all([
        cut(bitmap, 0, 0, 1, 1, "full.jpg"),
        cut(bitmap, 0, 0, 1, 0.78, "nosubs.jpg"),
        cut(bitmap, 0.08, 0.08, 0.84, 0.72, "center.jpg"),
      ])
    ).filter((item): item is File => Boolean(item));
    bitmap.close();
    return out.length ? out : [file];
  } catch {
    return [file];
  }
}

/** Отправляет кадр (файл или ссылку) на поиск. Бросает Error с текстом для пользователя. */
export async function findFrame(input: File | string): Promise<FrameResult> {
  const form = new FormData();
  if (typeof input === "string") form.set("url", input);
  else for (const part of await variants(input)) form.append("file", part);

  let res: Response;
  try {
    res = await fetch("/api/frame", { method: "POST", body: form, signal: AbortSignal.timeout(45_000) });
  } catch {
    throw new Error("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.");
  }
  const data = (await res.json().catch(() => ({}))) as FrameResult & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Не удалось выполнить поиск.");
  return data;
}

/** 83.4 → «83%» */
export const percent = (similarity: number) => `${Math.round(similarity * 100)}%`;

/** 754 секунды → «12:34» */
export function clockOf(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/* ------------------------------ ИИ-разбор -------------------------------- */

export interface FrameAiPick {
  /** null — тайтла нет в каталоге сайта */
  id: string | null;
  title: string;
  year?: number;
  poster?: string;
  shikimoriId?: number;
  genres: string[];
  why: string;
  confidence: "high" | "medium" | "low";
}

export interface FrameAiResult {
  description: string;
  picks: FrameAiPick[];
}

/** Для разбора входа нужен аккаунт: вызывающий открывает окно входа */
export class FrameAuthError extends Error {}

/** Сжимает кадр до 1280 px по ширине в JPEG: модели хватает, а запрос лёгкий */
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    return blob ? new File([blob], "frame.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

/** Просит ИИ определить аниме по кадру. Бросает Error с текстом для пользователя. */
export async function askFrameAi(input: File | string): Promise<FrameAiResult> {
  const form = new FormData();
  if (typeof input === "string") form.set("url", input);
  else form.set("file", await shrink(input));

  let res: Response;
  try {
    res = await fetch("/api/frame/ai", { method: "POST", body: form, signal: AbortSignal.timeout(60_000) });
  } catch {
    throw new Error("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.");
  }
  const data = (await res.json().catch(() => ({}))) as Partial<FrameAiResult> & { error?: string };
  if (res.status === 401) throw new FrameAuthError("Нужен вход");
  if (!res.ok || typeof data.description !== "string") throw new Error(data.error ?? "ИИ не смог разобрать кадр.");
  return { description: data.description, picks: data.picks ?? [] };
}
