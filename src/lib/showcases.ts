"use client";

/**
 * Витрины профиля «как в Steam»: избранное аниме, арт-витрина и витрина
 * достижений. Данные лежат отдельно от раскладки виджетов (там только
 * «какой блок и где»), ключ новый — старые данные профиля не затрагиваются.
 */
import { createLocalStore } from "./store";

export const SHOWCASES_KEY = "animehub:showcases:v1";

export interface FeaturedAnime {
  id: string;
  title: string;
  poster?: string;
}

export interface ArtItem {
  /** data-URL уменьшенной картинки */
  src: string;
  caption: string;
}

export interface ShowcasesState {
  featured: FeaturedAnime | null;
  /** Подпись «почему любимое», до 160 символов */
  featNote: string;
  /** Оценка 0…10, 0 — не показывать */
  featRate: number;
  art: ArtItem[];
  /** id достижений для витрины; пусто — самые редкие */
  picks: string[];
}

export const MAX_ART = 4;
export const MAX_PICKS = 6;

const EMPTY: ShowcasesState = { featured: null, featNote: "", featRate: 0, art: [], picks: [] };

function parse(raw: string): ShowcasesState | null {
  try {
    const v = JSON.parse(raw) as Partial<ShowcasesState>;
    if (!v || typeof v !== "object") return null;
    const f = v.featured as Partial<FeaturedAnime> | null | undefined;
    return {
      featured: f && typeof f.id === "string" && typeof f.title === "string" ? { id: f.id, title: f.title, poster: typeof f.poster === "string" ? f.poster : undefined } : null,
      featNote: typeof v.featNote === "string" ? v.featNote.slice(0, 160) : "",
      featRate: typeof v.featRate === "number" ? Math.min(10, Math.max(0, Math.round(v.featRate))) : 0,
      art: (Array.isArray(v.art) ? v.art : [])
        .filter((a): a is ArtItem => !!a && typeof a.src === "string" && a.src.startsWith("data:image/"))
        .map((a) => ({ src: a.src, caption: typeof a.caption === "string" ? a.caption.slice(0, 60) : "" }))
        .slice(0, MAX_ART),
      picks: (Array.isArray(v.picks) ? v.picks : []).filter((x): x is string => typeof x === "string").slice(0, MAX_PICKS),
    };
  } catch {
    return null;
  }
}

const store = createLocalStore<ShowcasesState>(SHOWCASES_KEY, EMPTY, parse);

export function useShowcases(): ShowcasesState {
  return store.useStore();
}

export function patchShowcases(patch: Partial<ShowcasesState>): void {
  store.update((s) => ({ ...s, ...patch }));
}

/** Уменьшает картинку до ширины 900px и жмёт в JPEG, чтобы не забить localStorage */
export function shrinkImage(file: File, max = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      const ctx = c.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}
