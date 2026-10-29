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

/** Детальный значок валюты: градиенты, грани, блики */
export function CurArt({ k, size = 28 }: { k: CurKey; size?: number }) {
  const id = `cga-${k}`;
  const common = { width: size, height: size, viewBox: "0 0 32 32", "aria-hidden": true, focusable: false, className: "cur-art", style: { verticalAlign: "-0.22em", flex: "none" } } as const;
  if (k === "diamonds")
    return (
      <svg {...common}>
        <defs>
          <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e9fbff" /><stop offset=".5" stopColor="#5ec8ff" /><stop offset="1" stopColor="#1f6fe0" /></linearGradient>
          <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7fdcff" /><stop offset="1" stopColor="#1a4fc4" /></linearGradient>
        </defs>
        <path d="M16 29.5 3.5 12.2 8.4 4.5h15.2l4.9 7.7z" fill={`url(#${id}-b)`} stroke="#d9f6ff" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M3.5 12.2h25M8.4 4.5l3.9 7.7L16 4.5l3.7 7.7 3.9-7.7M12.3 12.2 16 29.5l3.7-17.3" fill="none" stroke="#d9f6ff" strokeOpacity=".75" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M8.4 4.5h7.6l-3.7 7.7H3.5z" fill={`url(#${id}-a)`} opacity=".85" />
        <path d="M16 4.5h7.6l4.9 7.7h-8.8z" fill="#fff" opacity=".28" />
      </svg>
    );
  if (k === "dust")
    return (
      <svg {...common}>
        <defs>
          <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fbe9ff" /><stop offset=".5" stopColor="#b690ff" /><stop offset="1" stopColor="#6a3fe0" /></linearGradient>
        </defs>
        <path d="M16 2.5c.9 7.4 3.9 10.4 11.3 11.5-7.4 1.1-10.4 4.1-11.3 11.5C15.1 18.1 12.1 15.1 4.7 14 12.1 12.9 15.1 9.9 16 2.5z" fill={`url(#${id}-a)`} stroke="#f1dcff" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M25.5 20.5c.4 3 1.5 4.1 4.5 4.5-3 .4-4.1 1.5-4.5 4.5-.4-3-1.5-4.1-4.5-4.5 3-.4 4.1-1.5 4.5-4.5zM6.5 22c.3 2.2 1.1 3 3.3 3.3-2.2.3-3 1.1-3.3 3.3-.3-2.2-1.1-3-3.3-3.3 2.2-.3 3-1.1 3.3-3.3z" fill="#e6c9ff" />
        <circle cx="16" cy="14" r="2.2" fill="#fff" opacity=".9" />
      </svg>
    );
  if (k === "packs")
    return (
      <svg {...common}>
        <defs>
          <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff1c4" /><stop offset=".5" stopColor="#f0b43c" /><stop offset="1" stopColor="#a8630c" /></linearGradient>
        </defs>
        <rect x="9.5" y="3.5" width="17" height="23" rx="3" transform="rotate(10 18 15)" fill="#2a1a08" stroke="#a8630c" strokeWidth="1" />
        <rect x="5.5" y="4.5" width="17" height="23" rx="3" transform="rotate(-6 14 16)" fill="#140e05" stroke={`url(#${id}-a)`} strokeWidth="1.6" />
        <rect x="8.4" y="7.6" width="11.2" height="17" rx="1.8" transform="rotate(-6 14 16)" fill="none" stroke="#f0b43c" strokeOpacity=".5" strokeWidth=".8" />
        <path d="m14 11.2 1.5 3.2 3.5.4-2.6 2.4.7 3.5-3.1-1.8-3.1 1.8.7-3.5-2.6-2.4 3.5-.4z" transform="rotate(-6 14 16)" fill={`url(#${id}-a)`} />
      </svg>
    );
  return (
    <svg {...common}>
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff6c0" /><stop offset=".55" stopColor="#ffc92e" /><stop offset="1" stopColor="#e07a0a" /></linearGradient>
      </defs>
      <path d="M18.8 2 6.5 17.4h7.3L12.2 30l13.3-16.6h-7.6z" fill={`url(#${id}-a)`} stroke="#fff3b8" strokeWidth=".9" strokeLinejoin="round" />
      <path d="M18.8 2 6.5 17.4h4.6z" fill="#fff" opacity=".45" />
    </svg>
  );
}

/** Значок валюты в тексте */
export function Cur({ k, size = 15 }: { k: CurKey; size?: number }) {
  return <CurArt k={k} size={Math.round(size * 1.15)} />;
}
