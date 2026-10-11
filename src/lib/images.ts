"use client";

/**
 * Чтение картинок из файлового диалога в data-URL.
 *
 * Аватар и фон хранятся прямо в localStorage, поэтому изображения
 * ужимаются до разумного размера. GIF пережать нельзя (анимация
 * сломается) — он сохраняется как есть, но строго по размеру файла.
 */

export type ImageResult =
  | { ok: true; data: string; animated: boolean }
  | { ok: false; error: string };

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

/** 4 МБ на аватар, 6 МБ на фон — потолок localStorage по факту ниже */
export const IMAGE_LIMITS = { avatar: 4, background: 6 } as const;

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

function drawScaled(image: HTMLImageElement, maxDim: number): string {
  const scale = Math.min(1, maxDim / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, width, height);

  // WebP сохраняет прозрачность и жмётся заметно лучше PNG
  const webp = canvas.toDataURL("image/webp", 0.86);
  if (webp.startsWith("data:image/webp")) return webp;
  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Файл не похож на изображение"));
    image.src = src;
  });
}

export async function readImageFile(
  file: File,
  options: { maxDim: number; maxMb: number },
): Promise<ImageResult> {
  if (!ACCEPTED.includes(file.type)) {
    return { ok: false, error: "Нужен файл изображения: JPEG, PNG, WebP, GIF" };
  }
  if (file.size > options.maxMb * 1024 * 1024) {
    return { ok: false, error: `Максимальный размер — ${options.maxMb} МБ` };
  }

  const raw = await readDataUrl(file);
  if (file.type === "image/gif") {
    // Анимацию не пережимаем — иначе кадры разъедутся
    return { ok: true, data: raw, animated: true };
  }

  try {
    const image = await loadImage(raw);
    const data = drawScaled(image, options.maxDim);
    if (!data) return { ok: false, error: "Браузер не смог обработать изображение" };
    return { ok: true, data, animated: false };
  } catch {
    return { ok: false, error: "Не удалось открыть изображение" };
  }
}
