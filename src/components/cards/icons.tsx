import type { CSSProperties } from "react";

/** Набор линейных иконок раздела карточек (24×24, stroke = currentColor). */
const P: Record<string, string> = {
  diamond: "M6.5 3h11L22 9l-10 12L2 9z M2 9h20 M9 3 7 9l5 12 5-12-2-6",
  dust: "M11 3l1.9 5.6L18.5 10.5l-5.6 1.9L11 18l-1.9-5.6L3.5 10.5l5.6-1.9z M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z",
  pack: "M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M9 8h6 M9 12h6 M9 16h3",
  bolt: "M13 2 4.5 13.5H11L10 22l9-12h-6.5z",
  sword: "M14.5 4H20v5.5L9.5 20 4 14.5z M4 20l3.5-3.5 M7 13l4 4",
  swords: "M4 4l8 8 M4 4v4h4 M20 4l-8 8 M20 4v4h-4 M9 15l-5 5 M15 15l5 5 M12 12l-3 3 M12 12l3 3",
  shield: "M12 3l8 3v6c0 4.8-3.3 7.9-8 9-4.7-1.1-8-4.2-8-9V6z",
  heart: "M12 20.5S4 15.6 4 9.8A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 8 2.2c0 5.8-8 10.7-8 10.7z",
  lock: "M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  gift: "M4 10h16v10H4z M3 7h18v3H3z M12 7v13 M12 7C10 3 6 4 7.5 7 M12 7c2-4 6-3 4.5 0",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0z M8 6H4v2a3 3 0 0 0 4 3 M16 6h4v2a3 3 0 0 1-4 3 M12 13v4 M8 21h8 M10 17h4",
  fire: "M12 3c.8 3.8 5 5 5 10a5 5 0 0 1-10 0c0-2 .8-3.2 2-4.2 0 2 1 3 2 3-.4-3-1.4-5 1-8.8z",
  water: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z",
  wind: "M3 8h11a3 3 0 1 0-3-3 M3 12h16a3 3 0 1 1-3 3 M3 16h8",
  earth: "M3 19l6-11 4 6 3-4 5 9z",
  light: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M19 5l-2 2 M7 17l-2 2",
  dark: "M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  anvil: "M3 8h17v3h-5l-1 3h-4l-1-3H3z M8 14v4h8v-4",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  swap: "M7 7h13l-3-3 M17 17H4l3 3",
  grid: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
  tag: "M3 12V4h8l10 10-8 8z M7.5 8.5h.01",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2",
  scroll: "M7 4h11v13a3 3 0 0 1-3 3H6a3 3 0 0 0 3-3V6a2 2 0 0 0-2-2z M10 9h5 M10 13h5",
  skull: "M12 3a7 7 0 0 0-4 12.8V19h8v-3.2A7 7 0 0 0 12 3z M9.5 11h.01 M14.5 11h.01 M10.5 19v-2 M13.5 19v-2",
  down: "M6 9l6 6 6-6",
  plus: "M12 5v14 M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7.5",
  close: "M6 6l12 12 M18 6 6 18",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 3.6-7 8-7s8 3 8 7",
  trend: "M4 17l6-6 4 4 6-8 M15 7h5v5",
  ban: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M6 6l12 12",
};

export type IcoName = keyof typeof P;

export function Ico({ name, size = 18, className = "", style }: { name: IcoName; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg className={`ico ${className}`} style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={P[name]} />
    </svg>
  );
}

export const ELEMENT_ICON: Record<string, IcoName> = { fire: "fire", water: "water", wind: "wind", earth: "earth", light: "light", dark: "dark" };

export type CurKey = "diamonds" | "dust" | "packs" | "energy";
export const CUR: Record<CurKey, { ico: IcoName; color: string; label: string }> = {
  diamonds: { ico: "diamond", color: "#5ec8ff", label: "Алмазы" },
  dust: { ico: "dust", color: "#b690ff", label: "Пыль" },
  packs: { ico: "pack", color: "#ffc45e", label: "Жетоны паков" },
  energy: { ico: "bolt", color: "#ffd84d", label: "Энергия" },
};

/** Значок валюты в тексте */
export function Cur({ k, size = 15 }: { k: CurKey; size?: number }) {
  return <Ico name={CUR[k].ico} size={size} className="cur" style={{ color: CUR[k].color, verticalAlign: "-0.2em" }} />;
}
