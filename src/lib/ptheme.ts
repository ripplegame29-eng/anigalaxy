"use client";

/**
 * Тема профиля: фон всей страницы (картинка, гиф или видео), боковые арты,
 * «стекло» карточек и акцент. Файлы лежат в media-store, тут — только id и
 * числа. Тема живёт отдельно от раскладки виджетов.
 */
import { createLocalStore } from "./store";

export const PTHEME_KEY = "animehub:ptheme:v1";

export interface SideArt {
  media: string;
  /** Ширина колонки, % экрана */
  width: number;
  /** Прозрачность, % */
  opacity: number;
}

export interface ProfileTheme {
  on: boolean;
  bg: { media: string; dim: number; blur: number; fit: "cover" | "contain" };
  left: SideArt;
  right: SideArt;
  /** Карточки: прозрачность заливки (%) и размытие фона за ними (px) */
  glass: { opacity: number; blur: number };
  /** Свой акцент, "" — стандартный */
  accent: string;
  /** Скругление карточек, px */
  radius: number;
  /** Плавное «дыхание» боковых артов */
  float: boolean;
}

const SIDE: SideArt = { media: "", width: 14, opacity: 100 };

export const DEFAULT_THEME: ProfileTheme = {
  on: false,
  bg: { media: "", dim: 55, blur: 0, fit: "cover" },
  left: SIDE,
  right: SIDE,
  glass: { opacity: 78, blur: 14 },
  accent: "",
  radius: 18,
  float: true,
};

const num = (v: unknown, d: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 64) : "");

function side(v: unknown): SideArt {
  const o = (v && typeof v === "object" ? v : {}) as Partial<SideArt>;
  return { media: str(o.media), width: num(o.width, 14, 6, 30), opacity: num(o.opacity, 100, 10, 100) };
}

function parse(raw: string): ProfileTheme | null {
  try {
    const v = JSON.parse(raw) as Partial<ProfileTheme>;
    if (!v || typeof v !== "object") return null;
    const bg = (v.bg ?? {}) as Partial<ProfileTheme["bg"]>;
    const g = (v.glass ?? {}) as Partial<ProfileTheme["glass"]>;
    return {
      on: v.on === true,
      bg: { media: str(bg.media), dim: num(bg.dim, 55, 0, 90), blur: num(bg.blur, 0, 0, 24), fit: bg.fit === "contain" ? "contain" : "cover" },
      left: side(v.left),
      right: side(v.right),
      glass: { opacity: num(g.opacity, 78, 20, 100), blur: num(g.blur, 14, 0, 30) },
      accent: typeof v.accent === "string" && /^#[0-9a-f]{6}$/i.test(v.accent) ? v.accent : "",
      radius: num(v.radius, 18, 4, 32),
      float: v.float !== false,
    };
  } catch {
    return null;
  }
}

const store = createLocalStore<ProfileTheme>(PTHEME_KEY, DEFAULT_THEME, parse);

export const useProfileTheme = () => store.useStore();
export const getProfileTheme = () => store.get();
export function patchTheme(fn: (t: ProfileTheme) => ProfileTheme): void {
  store.update(fn);
}
export function resetTheme(): void {
  store.set(DEFAULT_THEME);
}
