/** Премиальные анимированные SVG-иконки привилегий (стили — premium-page.css, .pk-*) */
const defs = (
  <defs>
    <linearGradient id="pk-g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#ffffff" />
      <stop offset=".45" stopColor="#8fd8ff" />
      <stop offset="1" stopColor="#7a5cff" />
    </linearGradient>
    <linearGradient id="pk-gd" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#ffe9a8" />
      <stop offset=".5" stopColor="#ffb020" />
      <stop offset="1" stopColor="#ff7a1a" />
    </linearGradient>
  </defs>
);

export function PerkIcon({ id }: { id: string }) {
  let body: React.ReactNode;
  switch (id) {
    case "tag":
      body = (
        <g className="pk-swing">
          <path d="M8 8h18l14 14a3 3 0 0 1 0 4L26 40a3 3 0 0 1-4 0L8 26z" fill="url(#pk-g)" fillOpacity=".18" stroke="url(#pk-g)" strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="16" cy="16" r="3" fill="#fff" />
          <path className="pk-draw" d="M22 24l6 6M26 20l8 8" stroke="url(#pk-g)" strokeWidth="2" strokeLinecap="round" />
        </g>
      );
      break;
    case "boost":
      body = (
        <>
          <circle className="pk-pulse" cx="24" cy="24" r="17" stroke="url(#pk-g)" strokeWidth="1.5" strokeDasharray="3 5" fill="none" />
          <path className="pk-flash" d="M27 5 11 27h10l-3 16 19-24H26z" fill="url(#pk-gd)" stroke="#fff" strokeOpacity=".6" strokeWidth="1.2" strokeLinejoin="round" />
        </>
      );
      break;
    case "pass":
      body = (
        <g className="pk-tilt">
          <path d="M5 14a3 3 0 0 1 3-3h32a3 3 0 0 1 3 3v4a4 4 0 0 0 0 8v4a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-4a4 4 0 0 0 0-8z" fill="url(#pk-gd)" fillOpacity=".22" stroke="url(#pk-gd)" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M17 12v24" stroke="url(#pk-gd)" strokeWidth="1.8" strokeDasharray="2.5 3" />
          <path d="m30 18 2 4 4.5.6-3.3 3.1.8 4.5L30 28l-4 2.2.8-4.5-3.3-3.1L28 22z" fill="#fff" />
          {/* Блик ходит только внутри билета: обрезаем по его контуру */}
          <clipPath id="pk-tk">
            <path d="M5 14a3 3 0 0 1 3-3h32a3 3 0 0 1 3 3v4a4 4 0 0 0 0 8v4a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-4a4 4 0 0 0 0-8z" />
          </clipPath>
          <linearGradient id="pk-sh" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <g clipPath="url(#pk-tk)">
            <rect className="pk-sheen" x="-16" y="6" width="12" height="36" fill="url(#pk-sh)" />
          </g>
        </g>
      );
      break;
    case "cosmetics":
    case "backgrounds":
      body = (
        <>
          <g className="pk-spin">
            <path d="M24 4 42 24 24 44 6 24z" fill="url(#pk-g)" fillOpacity=".16" stroke="url(#pk-g)" strokeWidth="2.2" strokeLinejoin="round" />
          </g>
          <path d="M24 12 34 24 24 36 14 24z" fill="url(#pk-g)" />
          <path d="M14 24h20M24 12v24" stroke="#fff" strokeOpacity=".7" strokeWidth="1" />
          <path className="pk-tw pk-tw1" d="M40 6v6M37 9h6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
          <path className="pk-tw pk-tw2" d="M8 36v5M5.5 38.5h5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        </>
      );
      break;
    case "daily":
    case "drop":
      body = (
        <>
          <g className="pk-lid">
            <rect x="7" y="16" width="34" height="9" rx="2.5" fill="url(#pk-gd)" />
            <path d="M24 16c-9-1-12-10-6-10 5 0 6 6 6 10zm0 0c9-1 12-10 6-10-5 0-6 6-6 10z" fill="none" stroke="url(#pk-gd)" strokeWidth="2.2" strokeLinejoin="round" />
          </g>
          <rect x="10" y="25" width="28" height="17" rx="2.5" fill="url(#pk-gd)" fillOpacity=".25" stroke="url(#pk-gd)" strokeWidth="2.2" />
          <path d="M24 16v26" stroke="url(#pk-gd)" strokeWidth="3" />
          <circle className="pk-tw pk-tw1" cx="38" cy="8" r="1.8" fill="#fff" />
          <circle className="pk-tw pk-tw2" cx="9" cy="10" r="1.4" fill="#fff" />
        </>
      );
      break;
    default:
      body = (
        <g className="pk-swing">
          <circle cx="17" cy="17" r="8" fill="url(#pk-gd)" fillOpacity=".25" stroke="url(#pk-gd)" strokeWidth="2.4" />
          <circle cx="17" cy="17" r="2.6" fill="#fff" />
          <path d="m23 23 17 17M32 32l5-5M37 37l4-4" stroke="url(#pk-gd)" strokeWidth="3" strokeLinecap="round" />
          <circle className="pk-pulse" cx="17" cy="17" r="12" stroke="url(#pk-gd)" strokeWidth="1" fill="none" />
        </g>
      );
  }
  return (
    <span className="pp-perk-ic pk-ic" aria-hidden>
      <svg viewBox="0 0 48 48" fill="none">
        {defs}
        {body}
      </svg>
    </span>
  );
}
