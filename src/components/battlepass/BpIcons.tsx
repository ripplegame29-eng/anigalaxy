import { useId } from "react";

/**
 * Премиальные анимированные SVG боевого пропуска — вместо эмодзи.
 * Цвета: алый → розовое золото, анимации — на transform/opacity,
 * при reduced-motion выключаются (см. battlepass-premium.css).
 */
type IconName = "flag" | "gift" | "hourglass" | "puzzle" | "gem" | "crown" | "lock";

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffd1da" />
        <stop offset=".5" stopColor="#ff4d6e" />
        <stop offset="1" stopColor="#a3102f" />
      </linearGradient>
      <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff3c4" />
        <stop offset=".5" stopColor="#ffb86b" />
        <stop offset="1" stopColor="#e0702a" />
      </linearGradient>
    </defs>
  );
}

export function BpIcon({ name, size = 22 }: { name: IconName; size?: number }) {
  const id = useId().replace(/:/g, "");
  const r = `url(#${id}r)`;
  const g = `url(#${id}g)`;
  let body;
  switch (name) {
    case "flag":
      body = (
        <>
          <path d="M6 3v27" stroke={g} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="6" cy="3" r="2" fill={g} />
          <g className="bpi-wave">
            <rect x="8" y="5" width="20" height="15" rx="1.2" fill="#fff" />
            <rect x="8" y="5" width="5" height="5" fill="#1b0610" /><rect x="18" y="5" width="5" height="5" fill="#1b0610" /><rect x="13" y="10" width="5" height="5" fill="#1b0610" /><rect x="23" y="10" width="5" height="5" fill="#1b0610" /><rect x="8" y="15" width="5" height="5" fill="#1b0610" /><rect x="18" y="15" width="5" height="5" fill="#1b0610" />
            <rect x="8" y="5" width="20" height="15" rx="1.2" fill="none" stroke={r} strokeWidth="1.6" />
          </g>
        </>
      );
      break;
    case "gift":
      body = (
        <>
          <rect x="5" y="14" width="22" height="14" rx="2.5" fill={r} />
          <path d="M16 14v14" stroke="#fff3c4" strokeWidth="2.4" />
          <g className="bpi-lid">
            <rect x="3.5" y="9" width="25" height="6" rx="2" fill={g} />
            <path d="M16 9c-3-6-9-4-7-1.5S16 9 16 9zm0 0c3-6 9-4 7-1.5S16 9 16 9z" stroke="#fff3c4" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          </g>
          <path className="bpi-tw" d="M27 4v4M25 6h4" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
        </>
      );
      break;
    case "hourglass":
      body = (
        <g className="bpi-flip">
          <path d="M8 4h16M8 28h16" stroke={g} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M10 4c0 7 6 8 6 12s-6 5-6 12h12c0-7-6-8-6-12s6-5 6-12z" fill="rgba(255,255,255,.08)" stroke={r} strokeWidth="1.8" strokeLinejoin="round" />
          <path className="bpi-sand" d="M12.5 8h7c-1 3-3 4-3.5 5-.5-1-2.5-2-3.5-5z" fill={g} />
          <path className="bpi-sand2" d="M16 17v8M12 27.5h8c-.5-2-2-3.5-4-5.5-2 2-3.5 3.500-4 5.500z" fill={g} stroke="none" />
        </g>
      );
      break;
    case "puzzle":
      body = (
        <path className="bpi-pz" d="M6 10h6a3 3 0 1 1 6 0h6v6a3 3 0 1 1 0 6v6H6V10z" fill={r} stroke="#fff" strokeOpacity=".5" strokeWidth="1" />
      );
      break;
    case "gem":
      body = (
        <>
          <path d="M16 28 3 12l5-7h16l5 7z" fill={r} />
          <path d="M3 12h26M11 5l-3 7 8 16 8-16-3-7M11 5l5 7 5-7" stroke="#fff" strokeOpacity=".6" strokeWidth="1" fill="none" strokeLinejoin="round" />
          <path className="bpi-shine" d="M9 6 14 6 8 28 4 28z" fill="#fff" fillOpacity=".5" />
        </>
      );
      break;
    case "crown":
      body = (
        <>
          <path d="M4 24 3 9l7 6 6-10 6 10 7-6-1 15z" fill={g} />
          <rect x="4" y="25" width="24" height="3.5" rx="1.5" fill={r} />
          <circle className="bpi-tw" cx="16" cy="5" r="2" fill="#fff" />
          <circle cx="3" cy="9" r="1.6" fill="#fff3c4" />
          <circle cx="29" cy="9" r="1.6" fill="#fff3c4" />
        </>
      );
      break;
    case "lock":
      body = (
        <g className="bpi-lock">
          <path d="M10 14v-3a6 6 0 0 1 12 0v3" stroke={g} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <rect x="6" y="14" width="20" height="14" rx="3.5" fill={r} />
          <circle cx="16" cy="21" r="2.2" fill="#2a0610" />
        </g>
      );
      break;
  }
  return (
    <svg className={`bpi bpi-${name}`} viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      <Defs id={id} />
      {body}
    </svg>
  );
}
