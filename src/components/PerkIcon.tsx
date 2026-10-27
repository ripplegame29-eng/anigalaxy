/** Премиальные многослойные SVG-иконки привилегий (стили — premium-page.css, .pk-*) */
const defs = (
  <defs>
    <linearGradient id="pk-c" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#f2fdff" />
      <stop offset=".45" stopColor="#4cc9ff" />
      <stop offset="1" stopColor="#1f5fff" />
    </linearGradient>
    <linearGradient id="pk-v" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#f3ecff" />
      <stop offset=".45" stopColor="#a287ff" />
      <stop offset="1" stopColor="#5a35ee" />
    </linearGradient>
    <linearGradient id="pk-o" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#fff3c9" />
      <stop offset=".5" stopColor="#ffb62a" />
      <stop offset="1" stopColor="#ff6a1a" />
    </linearGradient>
    <linearGradient id="pk-p" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#ffe6f3" />
      <stop offset=".5" stopColor="#ff7ab8" />
      <stop offset="1" stopColor="#a63cff" />
    </linearGradient>
    <linearGradient id="pk-shine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fff" stopOpacity=".75" />
      <stop offset=".55" stopColor="#fff" stopOpacity="0" />
    </linearGradient>
    <clipPath id="pk-tk">
      <path d="M6 14a3 3 0 0 1 3-3h30a3 3 0 0 1 3 3v6a4 4 0 0 0 0 8v6a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-6a4 4 0 0 0 0-8z" />
    </clipPath>
  </defs>
);

const Spark = ({ x, y, s = 1, d = false }: { x: number; y: number; s?: number; d?: boolean }) => (
  <path
    className={`pk-tw${d ? " pk-tw2" : ""}`}
    d={`M${x} ${y - 3.5 * s}l${0.9 * s} ${2.6 * s} ${2.6 * s} ${0.9 * s}-${2.6 * s} ${0.9 * s}-${0.9 * s} ${2.6 * s}-${0.9 * s}-${2.6 * s}-${2.6 * s}-${0.9 * s} ${2.6 * s}-${0.9 * s}z`}
    fill="#fff"
  />
);

export function PerkIcon({ id }: { id: string }) {
  let body: React.ReactNode;
  switch (id) {
    case "tag": // значок Premium у ника
      body = (
        <g className="pk-tilt">
          <path d="M24 4l16 6v12c0 10-6.5 17.5-16 22C14.500 39.500 8 32 8 22V10z" fill="url(#pk-c)" />
          <path d="M24 4l16 6v12c0 10-6.5 17.5-16 22C14.500 39.500 8 32 8 22V10z" fill="url(#pk-shine)" />
          <path d="M24 9l11 4.200V22c0 7.200-4.400 12.600-11 16-6.600-3.400-11-8.800-11-16v-8.800z" fill="#0b1b4a" fillOpacity=".55" />
          <path d="M24 15.500l2.600 5.300 5.800.8-4.200 4.100 1 5.800-5.200-2.700-5.200 2.700 1-5.800-4.200-4.100 5.800-.8z" fill="url(#pk-o)" />
          <Spark x={39} y={9} s={0.9} />
        </g>
      );
      break;
    case "boost": // x2 XP и AC
      body = (
        <g>
          <circle className="pk-pulse" cx="24" cy="24" r="17" fill="none" stroke="#ffb62a" strokeWidth="1.500" />
          <circle cx="24" cy="24" r="17" fill="#ffb62a" fillOpacity=".12" stroke="url(#pk-o)" strokeWidth="1.600" strokeOpacity=".8" />
          <path className="pk-flash" d="M27.500 5L12 27h10l-3 16L36 20H25.500z" fill="url(#pk-o)" stroke="#fff3c9" strokeWidth="1" strokeLinejoin="round" />
          <Spark x={39} y={11} s={0.8} />
          <Spark x={8} y={37} s={0.7} d />
        </g>
      );
      break;
    case "pass": // билет
      body = (
        <g className="pk-tilt">
          <path d="M6 14a3 3 0 0 1 3-3h30a3 3 0 0 1 3 3v6a4 4 0 0 0 0 8v6a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-6a4 4 0 0 0 0-8z" fill="url(#pk-p)" />
          <g clipPath="url(#pk-tk)">
            <path d="M0 11h48v12H0z" fill="url(#pk-shine)" />
            <rect className="pk-sheen" x="-12" y="6" width="9" height="36" fill="#fff" fillOpacity=".5" />
          </g>
          <path d="M31 13v22" stroke="#fff" strokeOpacity=".7" strokeWidth="1.500" strokeDasharray="2.200 2.800" strokeLinecap="round" />
          <path d="M18 18.500l1.900 3.900 4.300.6-3.100 3 .8 4.200-3.900-2-3.900 2 .8-4.200-3.100-3 4.300-.6z" fill="#fff" />
          <path d="M35.500 19.500h3M35.500 24h3M35.500 28.500h3" stroke="#fff" strokeOpacity=".8" strokeWidth="1.600" strokeLinecap="round" />
        </g>
      );
      break;
    case "cosmetics": // рамки аватара
      body = (
        <g>
          <rect x="7" y="7" width="34" height="34" rx="10" fill="url(#pk-v)" fillOpacity=".25" stroke="url(#pk-v)" strokeWidth="2.400" />
          <rect x="11.500" y="11.500" width="25" height="25" rx="7" fill="#0d0a2e" fillOpacity=".55" />
          <circle cx="24" cy="20.500" r="5" fill="url(#pk-c)" />
          <path d="M14.500 35c1-5.500 5-8 9.500-8s8.500 2.500 9.500 8z" fill="url(#pk-c)" />
          <path className="pk-spin" d="M7 24h2.500M38.500 24H41M24 7v2.500M24 38.500V41" stroke="#fff" strokeWidth="2" strokeLinecap="round" style={{ transformOrigin: "24px 24px" }} />
          <Spark x={40} y={8} s={1} />
          <Spark x={8} y={40} s={0.7} d />
        </g>
      );
      break;
    case "daily": // ежедневный бонус
      body = (
        <g>
          <rect x="7" y="10" width="34" height="31" rx="7" fill="url(#pk-c)" fillOpacity=".22" stroke="url(#pk-c)" strokeWidth="2.200" />
          <path d="M7 19h34" stroke="url(#pk-c)" strokeWidth="2.200" />
          <path d="M16 6v8M32 6v8" stroke="url(#pk-c)" strokeWidth="2.800" strokeLinecap="round" />
          <circle cx="24" cy="30" r="7.500" fill="url(#pk-o)" />
          <circle cx="24" cy="30" r="7.500" fill="url(#pk-shine)" />
          <path className="pk-draw" d="M20.500 30l2.600 2.800 4.800-5.600" fill="none" stroke="#7a3a00" strokeWidth="2.200" strokeLinecap="round" strokeLinejoin="round" />
          <Spark x={40} y={9} s={0.8} d />
        </g>
      );
      break;
    case "drop": // подарок
      body = (
        <g>
          <g className="pk-lid">
            <rect x="6" y="14" width="36" height="9" rx="3" fill="url(#pk-v)" />
            <path d="M24 14c-4-1-9-4-7.500-7 1.500-3 7 0 7.500 7zM24 14c4-1 9-4 7.500-7-1.500-3-7 0-7.500 7z" fill="none" stroke="url(#pk-o)" strokeWidth="2.200" strokeLinejoin="round" />
          </g>
          <path d="M9 23h30v15a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3z" fill="url(#pk-v)" fillOpacity=".85" />
          <path d="M9 23h30v6H9z" fill="url(#pk-shine)" />
          <path d="M21 14h6v27h-6z" fill="url(#pk-o)" />
          <Spark x={41} y={26} s={0.8} />
          <Spark x={7} y={6} s={0.7} d />
        </g>
      );
      break;
    case "backgrounds": // фоны профиля
      body = (
        <g>
          <rect x="5" y="9" width="38" height="30" rx="7" fill="#0d0a2e" fillOpacity=".5" stroke="url(#pk-c)" strokeWidth="2.200" />
          <circle cx="32" cy="18" r="4.200" fill="url(#pk-o)" />
          <path d="M7 36l10.500-13 7.500 8.500 5-5.500L41 36v0a5 5 0 0 1-5 3H12a5 5 0 0 1-5-3z" fill="url(#pk-c)" />
          <path d="M17.500 23L25 31.500 12 36l-5 0z" fill="url(#pk-shine)" fillOpacity=".5" />
          <Spark x={39} y={9} s={0.9} d />
        </g>
      );
      break;
    default: // подарки по промокоду
      body = (
        <g className="pk-swing">
          <circle cx="17" cy="17" r="9" fill="url(#pk-o)" />
          <circle cx="17" cy="17" r="9" fill="url(#pk-shine)" />
          <circle cx="17" cy="17" r="3.400" fill="#0d0a2e" fillOpacity=".7" />
          <path d="M23.500 23.500L40 40M32 32l5-5M36 36l4-4" fill="none" stroke="url(#pk-o)" strokeWidth="3.800" strokeLinecap="round" strokeLinejoin="round" />
          <Spark x={40} y={10} s={0.9} />
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
