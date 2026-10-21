"use client";

/**
 * Готовые сборки профиля: арт-витрина с анимированными гифками + фон +
 * акцент. Файлы лежат в /public/themes (webm из исходных гифок).
 * Применение раскладывает всё по хранилищам: тема, арт-витрина и блок
 * «Арт-витрина» наверху раскладки виджетов.
 */
import { patchArtwork, type ArtLayout } from "./artwork";
import { DEFAULT_THEME, patchTheme } from "./ptheme";
import { MAX_WIDGETS, readWidgetLayout, saveWidgetLayout } from "./widgets";

export interface ThemePreset {
  id: string;
  name: string;
  tag: string;
  accent: string;
  poster: string;
  layout: ArtLayout;
  files: string[];
  /** Пропорции готового арта (ширина / высота) */
  aspect: number;
  height: number;
}

const f = (id: string, ...parts: string[]) => parts.map((p) => `/themes/${id}-${p}.webm`);

export const THEME_PRESETS: ThemePreset[] = [
  { id: "p1", name: "Zero Two · Неон", tag: "Портрет · неоновая рамка", accent: "#ff4fb0", poster: "/themes/p1.webp", layout: "single", files: f("p1", "main"), aspect: 630 / 944, height: 460 },
  { id: "p2", name: "Zero Two · Алый", tag: "Steam-арт 506+100", accent: "#ff5a3c", poster: "/themes/p2.webp", layout: "steam", files: f("p2", "l", "r"), aspect: 606 / 908, height: 460 },
  { id: "zero", name: "Zero Two · Ночной город", tag: "Портрет · неон и асфальт", accent: "#d4506a", poster: "/themes/zero.webp", layout: "single", files: f("zero", "main"), aspect: 630 / 824, height: 460 },
  { id: "p6", name: "Эллен · Кармин", tag: "Steam-арт 506+100", accent: "#e5365e", poster: "/themes/p6.webp", layout: "steam", files: f("p6", "l", "r"), aspect: 606 / 908, height: 460 },
  { id: "s7", name: "Яэ Мико · Сакура", tag: "Склейка из 5 полос", accent: "#ff6f91", poster: "/themes/s7.webp", layout: "slices", files: f("s7", "1", "2", "3", "4", "5"), aspect: 625 / 824, height: 460 },
  { id: "p8", name: "Кэцин · Лаванда", tag: "Steam-арт 506+100", accent: "#9b86ff", poster: "/themes/p8.webp", layout: "steam", files: f("p8", "l", "r"), aspect: 606 / 942, height: 460 },
  { id: "fate", name: "Готика · Монохром", tag: "Steam-арт 506+100", accent: "#c9ced6", poster: "/themes/fate.webp", layout: "steam", files: f("fate", "l", "r"), aspect: 606 / 820, height: 440 },
  { id: "p9", name: "Коми · Чёрно-белое", tag: "Steam-арт 506+100", accent: "#cfd3da", poster: "/themes/p9.webp", layout: "steam", files: f("p9", "l", "r"), aspect: 606 / 908, height: 460 },
  { id: "s5", name: "Эскиз · Монохром", tag: "Широкая склейка из 5 полос", accent: "#9aa0a8", poster: "/themes/s5.webp", layout: "slices", files: f("s5", "1", "2", "3", "4", "5"), aspect: 750 / 422, height: 320 },
  { id: "luna", name: "Луна · Туман", tag: "Портрет · светлая", accent: "#b8c7da", poster: "/themes/luna.webp", layout: "single", files: f("luna", "main"), aspect: 630 / 824, height: 460 },
];

/** Применяет сборку: тема, арты и блок «Арт-витрина» в начале раскладки */
export function applyThemePreset(p: ThemePreset): void {
  patchArtwork(() => ({
    layout: p.layout,
    height: p.height,
    aspect: p.aspect,
    slots: p.files.map((media) => ({ media, caption: "", fit: "cover" as const })),
  }));
  patchTheme(() => ({
    ...DEFAULT_THEME,
    on: true,
    accent: p.accent,
    // фон — тот же арт, сильно размытый и затемнённый
    bg: { media: p.files[0], dim: 72, blur: 22, fit: "cover" },
    glass: { opacity: 70, blur: 16 },
    radius: 20,
  }));
  const layout = readWidgetLayout();
  if (layout[0]?.id !== "artwork") {
    const next = [{ id: "artwork" as const, w: "l" as const }, ...layout.filter((s) => s.id !== "artwork")].slice(0, MAX_WIDGETS);
    saveWidgetLayout(next);
    // панель виджетов слушает storage — даём знать в этой же вкладке
    if (typeof window !== "undefined") window.dispatchEvent(new Event("storage"));
  }
}

/** Какая сборка сейчас применена (по первому файлу арта) */
export function activePresetId(firstMedia: string | undefined): string | null {
  return THEME_PRESETS.find((p) => p.files[0] === firstMedia)?.id ?? null;
}

/* ------------------------------ Живые фоны ------------------------------ */

export interface BgPreset {
  id: string;
  name: string;
  accent: string;
  poster: string;
  file: string;
  /** Затемнение по умолчанию: светлые фоны гасим сильнее, чтобы читался текст */
  dim: number;
}

const bg = (n: number, name: string, accent: string, dim = 40): BgPreset => {
  const id = `bg${String(n).padStart(2, "0")}`;
  return { id, name, accent, dim, poster: `/bgs/${id}.webp`, file: `/bgs/${id}.webm` };
};

export const BG_PRESETS: BgPreset[] = [
  bg(3, "Сердца", "#ff3d7f", 35),
  bg(9, "Синтвейв", "#ff4fa0", 30),
  bg(6, "Сцена · Неон", "#ff3da8", 30),
  bg(14, "Неон-комната", "#55d6ff", 35),
  bg(4, "Глубина", "#2aa8ff", 25),
  bg(8, "Ночной лес", "#3fb7a8", 30),
  bg(13, "Лунная веранда", "#ffc857", 35),
  bg(10, "Милая пара", "#b9a5ff", 40),
  bg(2, "Чёрная дыра", "#b8bec9", 20),
  bg(1, "Эскиз во тьме", "#d9dde6", 25),
  bg(11, "Лаборатория", "#aab4bf", 45),
  bg(12, "Пустошь", "#a0a0a0", 50),
  bg(7, "Пепельный туман", "#a8a8b0", 55),
  bg(5, "Туманные руины", "#aeb8c2", 60),
];

/** Ставит живой фон страницы, не трогая остальную тему */
export function applyBgPreset(p: BgPreset): void {
  patchTheme((t) => ({ ...t, on: true, accent: p.accent, bg: { media: p.file, dim: p.dim, blur: 0, fit: "cover" } }));
}
