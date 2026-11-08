import { useId, type CSSProperties } from "react";

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
  crown: "M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z M5 19h14",
  calendar: "M4 6h16v14H4z M4 10h16 M8 3v5 M16 3v5 M8 14h2 M12 14h2 M8 17h2",
  target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z M12 11.2a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6z",
  flag: "M5 21V4 M5 4h12l-2.5 4L17 12H5",
  book: "M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z M5 17a3 3 0 0 1 3-3h10",
  bell: "M6 17V11a6 6 0 0 1 12 0v6l2 2H4z M10 21h4",
  vol: "M4 9h4l5-4v14l-5-4H4z M16 9a4 4 0 0 1 0 6 M18.5 6.5a8 8 0 0 1 0 11",
  volx: "M4 9h4l5-4v14l-5-4H4z M16 9l5 6 M21 9l-5 6",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  pin: "M9 4h6l-1 6 3 3H7l3-3z M12 13v8",
  left: "M15 5l-7 7 7 7",
  right: "M9 5l7 7-7 7",
  search: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z M16 16l5 5",
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

/** Иллюстрация свитка заточки (прозрачный webp). Пропорции чуть шире квадрата — рисуем в квадрат с запасом. */
export function ScrollArt({ size = 24 }: { size?: number }) {
  return <img className="scroll-art" src="/icons/scroll.webp" width={size} height={size} alt="" draggable={false} />;
}

export type CurKey = "diamonds" | "dust" | "packs" | "energy";
export const CUR: Record<CurKey, { ico: IcoName; color: string; label: string }> = {
  diamonds: { ico: "diamond", color: "#5ec8ff", label: "Алмазы" },
  dust: { ico: "dust", color: "#b690ff", label: "Пыль" },
  packs: { ico: "pack", color: "#ffc45e", label: "Жетоны паков" },
  energy: { ico: "bolt", color: "#ffd84d", label: "Энергия" },
};

/** Иллюстрация валюты (прозрачный webp из /public/icons): алмазы, пыль, жетоны паков, энергия */
export function CurArt({ k, size = 28 }: { k: CurKey; size?: number }) {
  return <img className="cur-art" src={`/icons/cur-${k}.webp`} width={size} height={size} alt="" draggable={false} />;
}

/** Значок валюты в тексте */
export function Cur({ k, size = 15 }: { k: CurKey; size?: number }) {
  return <CurArt k={k} size={Math.round(size * 1.15)} />;
}

/** Премиальные двухслойные значки вкладок: градиентная заливка + тонкий контур + акцентные искры */
const TAB_ICO: Record<string, { fill?: string[]; line: string[]; dots?: string[] }> = {
  packs: {
    fill: ["M7 5.4h10v13.2H7z"],
    line: ["M6.4 5.5 7.4 4l1.1 1.5 1.1-1.5 1.1 1.5 1.1-1.5 1.1 1.5 1.1-1.5 1.1 1.5 1.1-1.5 1 1.5", "M6.4 18.5l1 1.5 1.1-1.5 1.1 1.5 1.1-1.5 1.1 1.5 1.1-1.5 1.1 1.5 1.1-1.5 1 1.5", "M7 5.6v12.8 M17 5.6v12.8"],
    dots: ["M12 8.8l.95 2 2.15.3-1.55 1.5.37 2.15L12 13.7l-1.92 1.05.37-2.15-1.55-1.5 2.15-.3z"],
  },
  forge: {
    fill: ["M3.8 8.2h15.9c-.2 2.7-2.1 4.3-4.7 4.3h-1.3l1.5 3.5H8.6l1.5-3.5H8.2c-2.5 0-4.2-1.6-4.4-4.3z"],
    line: ["M3.8 8.2h15.9c-.2 2.7-2.1 4.3-4.7 4.3h-1.3l1.5 3.5H8.6l1.5-3.5H8.2c-2.5 0-4.2-1.6-4.4-4.3z", "M7 19.2h10 M3.8 8.2 2 6.6"],
    dots: ["M19 2.6l.7 1.7 1.7.7-1.7.7L19 7.4l-.7-1.7-1.7-.7 1.7-.7z"],
  },
  sharpen: {
    fill: ["M12 3.2l2.6 5.4 5.9.9-4.3 4.2 1 5.9L12 16.8 6.8 19.6l1-5.9-4.3-4.2 5.9-.9z"],
    line: ["M12 3.2l2.6 5.4 5.9.9-4.3 4.2 1 5.9L12 16.8 6.8 19.6l1-5.9-4.3-4.2 5.9-.9z", "M12 3.2v13.6 M3.5 9.5l8.5 3.6 8.5-3.6"],
    dots: ["M19.6 2.2l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z"],
  },
  battle: {
    fill: ["M4.2 4.2h3.4l8.4 8.4-2.2 2.2-9.6-9.6z", "M19.8 4.2h-3.4l-8.4 8.4 2.2 2.2 9.6-9.6z"],
    line: ["M4.2 4.2h3.4l8.4 8.4-2.2 2.2-9.6-9.6z", "M19.8 4.2h-3.4l-8.4 8.4 2.2 2.2 9.6-9.6z", "M14.4 14.8l2.8 2.8 M9.6 14.8l-2.8 2.8 M17.2 17.6l1.6 1.6 M6.8 17.6l-1.6 1.6"],
  },
  auction: {
    fill: ["M13 3.8l6 6-3.4 3.4-6-6z"],
    line: ["M13 3.8l6 6-3.4 3.4-6-6z", "M11.4 11.2 4.6 18 M4 20.4h9.5 M14.8 18.6h5.2"],
  },
  trade: {
    fill: ["M12 3.2a8.8 8.8 0 1 0 0 17.6 8.8 8.8 0 0 0 0-17.6z"],
    line: ["M7 9.2h9.6l-2.4-2.5 M17 14.8H7.4l2.4 2.5"],
  },
  collection: {
    fill: ["M5.2 7.4h10.2a1.6 1.6 0 0 1 1.6 1.6v10a1.6 1.6 0 0 1-1.6 1.6H5.2a1.6 1.6 0 0 1-1.6-1.6V9a1.6 1.6 0 0 1 1.6-1.6z"],
    line: ["M5.2 7.4h10.2a1.6 1.6 0 0 1 1.6 1.6v10a1.6 1.6 0 0 1-1.6 1.6H5.2a1.6 1.6 0 0 1-1.6-1.6V9a1.6 1.6 0 0 1 1.6-1.6z", "M8 4h10.8A1.2 1.2 0 0 1 20 5.2V16 M7 12h6 M7 15.4h3.6"],
    dots: ["M14.4 10.2l.45.95 1.05.15-.76.74.18 1.04-.92-.5-.92.5.18-1.04-.76-.74 1.05-.15z"],
  },
  progress: {
    fill: ["M8 4h8v5.2a4 4 0 0 1-8 0z"],
    line: ["M8 4h8v5.2a4 4 0 0 1-8 0z", "M8 6H5v1.4A2.9 2.9 0 0 0 8 10.3 M16 6h3v1.4a2.9 2.9 0 0 1-3 2.9 M12 13.2v3.2 M9.4 16.4h5.2v3.6H9.4z M7.8 20h8.4"],
    dots: ["M12 6.2l.8 1.7 1.8.25-1.3 1.25.3 1.8-1.6-.85-1.6.85.3-1.8-1.3-1.25 1.8-.25z"],
  },
  shop: {
    fill: ["M5 9h14l-1.2 10.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z"],
    line: ["M5 9h14l-1.2 10.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z", "M8.6 9V7.4a3.4 3.4 0 0 1 6.8 0V9"],
    dots: ["M12 12.4l.8 1.6 1.7.25-1.25 1.2.3 1.7-1.55-.8-1.55.8.3-1.7-1.25-1.2 1.7-.25z"],
  },
  tiers: {
    fill: ["M4 4.5h4.5v4.5H4z M4 10.5h4.5V15H4z"],
    line: ["M4 4.5h4.5v4.5H4z M4 10.5h4.5V15H4z M4 16.5h4.5V21H4z", "M11 6.75h9 M11 12.75h6.5 M11 18.75h4"],
  },
  season: {
    fill: ["M3.4 8.2l4.4 3.9L12 5l4.2 7.1 4.4-3.9-1.9 10.4H5.3z"],
    line: ["M3.4 8.2l4.4 3.9L12 5l4.2 7.1 4.4-3.9-1.9 10.4H5.3z", "M5.6 20.4h12.8"],
    dots: ["M12 3.2m-.9 0a.9.9 0 1 0 1.8 0 .9.9 0 1 0-1.8 0 M3.4 6.4m-.8 0a.8.8 0 1 0 1.6 0 .8.8 0 1 0-1.6 0 M20.6 6.4m-.8 0a.8.8 0 1 0 1.6 0 .8.8 0 1 0-1.6 0"],
  },
};

export function TabIco({ id, size = 22 }: { id: string; size?: number }) {
  const g = useId().replace(/:/g, "");
  const d = TAB_ICO[id];
  if (!d) return null;
  return (
    <svg className="ico tab-ico" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id={g} x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="currentColor" stopOpacity=".62" />
          <stop offset="1" stopColor="currentColor" stopOpacity=".1" />
        </linearGradient>
      </defs>
      {d.fill?.map((p, i) => <path key={`f${i}`} d={p} fill={`url(#${g})`} />)}
      {d.line.map((p, i) => <path key={`l${i}`} d={p} stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />)}
      {d.dots?.map((p, i) => <path key={`d${i}`} d={p} fill="currentColor" />)}
    </svg>
  );
}
