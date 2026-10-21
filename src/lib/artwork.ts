"use client";

/**
 * Арт-витрина в стиле Steam: раскладка и до пяти слотов с гифками/картинками.
 * Сами файлы — в media-store, здесь id, подписи и подгонка.
 */
import { createLocalStore } from "./store";

export const ARTWORK_KEY = "animehub:artwork:v1";

export type ArtLayout = "wide" | "steam" | "slices" | "triptych" | "grid" | "banner" | "single";

export const ART_LAYOUTS: { id: ArtLayout; name: string; slots: number; hint: string }[] = [
  { id: "wide", name: "Широкий + боковой", slots: 2, hint: "Как в Steam: большой арт и узкая колонка" },
  { id: "steam", name: "Steam: арт + полоса", slots: 2, hint: "Склеенный арт 506+100, без зазора" },
  { id: "slices", name: "Склейка из 5 полос", slots: 5, hint: "Пять анимированных полос подряд" },
  { id: "triptych", name: "Триптих", slots: 3, hint: "Три арта в ряд" },
  { id: "grid", name: "Сетка 2×2", slots: 4, hint: "Четыре равных арта" },
  { id: "banner", name: "Баннер", slots: 1, hint: "Один широкий арт на всю ширину" },
  { id: "single", name: "Один арт", slots: 1, hint: "Квадратный арт по центру" },
];

export interface ArtSlot {
  media: string;
  caption: string;
  fit: "cover" | "contain";
}

export interface ArtworkState {
  layout: ArtLayout;
  height: number;
  /** Пропорции готового арта (ширина / высота); 0 — по раскладке */
  aspect: number;
  slots: ArtSlot[];
}

export const DEFAULT_ARTWORK: ArtworkState = { layout: "wide", height: 300, aspect: 0, slots: [] };

function parse(raw: string): ArtworkState | null {
  try {
    const v = JSON.parse(raw) as Partial<ArtworkState>;
    if (!v || typeof v !== "object") return null;
    const layout = ART_LAYOUTS.some((l) => l.id === v.layout) ? (v.layout as ArtLayout) : "wide";
    return {
      layout,
      aspect: typeof v.aspect === "number" && v.aspect > 0.2 && v.aspect < 5 ? v.aspect : 0,
      height: typeof v.height === "number" ? Math.min(640, Math.max(160, v.height)) : 300,
      slots: (Array.isArray(v.slots) ? v.slots : [])
        .filter((s): s is ArtSlot => !!s && typeof s.media === "string")
        .map((s): ArtSlot => ({ media: s.media.slice(0, 64), caption: typeof s.caption === "string" ? s.caption.slice(0, 60) : "", fit: s.fit === "contain" ? "contain" : "cover" }))
        .slice(0, 5),
    };
  } catch {
    return null;
  }
}

const store = createLocalStore<ArtworkState>(ARTWORK_KEY, DEFAULT_ARTWORK, parse);
export const useArtwork = () => store.useStore();
export const patchArtwork = (fn: (a: ArtworkState) => ArtworkState) => store.update(fn);

/* ------------------------------ Текстовый блок ----------------------------- */

export const PTEXT_KEY = "animehub:ptext:v1";

export interface PText {
  text: string;
  size: "s" | "m" | "l";
  align: "left" | "center" | "right";
  style: "plain" | "quote" | "glow";
}

export const DEFAULT_PTEXT: PText = { text: "", size: "m", align: "left", style: "quote" };

function parseText(raw: string): PText | null {
  try {
    const v = JSON.parse(raw) as Partial<PText>;
    if (!v || typeof v !== "object") return null;
    return {
      text: typeof v.text === "string" ? v.text.slice(0, 400) : "",
      size: v.size === "s" || v.size === "l" ? v.size : "m",
      align: v.align === "center" || v.align === "right" ? v.align : "left",
      style: v.style === "plain" || v.style === "glow" ? v.style : "quote",
    };
  } catch {
    return null;
  }
}

const textStore = createLocalStore<PText>(PTEXT_KEY, DEFAULT_PTEXT, parseText);
export const usePText = () => textStore.useStore();
export const patchPText = (fn: (t: PText) => PText) => textStore.update(fn);
