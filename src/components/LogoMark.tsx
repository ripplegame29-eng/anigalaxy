import { useId } from "react";

/**
 * Знак AniGalaxy — нарисован с нуля в SVG (никаких растровых картинок):
 *   • монограмма-буква «A» с градиентной перекладиной;
 *   • наклонная орбита: дальняя половина уходит за букву, ближняя проходит поверх;
 *   • четырёхлучевая искра в левом верхнем углу.
 * Всё вписано в viewBox 66×38, прозрачный фон — «полей» у картинки нет by construction.
 */
export function LogoMark({ className = "" }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gA = `lg-a-${uid}`; // буква
  const gX = `lg-x-${uid}`; // перекладина
  const gO = `lg-o-${uid}`; // орбита
  const gS = `lg-s-${uid}`; // искра

  return (
    <svg
      viewBox="0 0 66 38"
      className={className}
      aria-hidden="true"
      focusable="false"
      shapeRendering="geometricPrecision"
    >
      <defs>
        <linearGradient id={gA} x1="16" y1="6" x2="50" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7ad7ff" />
          <stop offset="0.45" stopColor="#2f9bff" />
          <stop offset="1" stopColor="#1350ff" />
        </linearGradient>
        <linearGradient id={gX} x1="19" y1="26" x2="47" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00e5ff" />
          <stop offset="1" stopColor="#3f9dff" />
        </linearGradient>
        <linearGradient id={gO} x1="5" y1="30" x2="61" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00c8ff" />
          <stop offset="1" stopColor="#5fb6ff" />
        </linearGradient>
        <linearGradient id={gS} x1="4" y1="2" x2="15" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#aef4ff" />
          <stop offset="1" stopColor="#2f9bff" />
        </linearGradient>
      </defs>

      {/* дальняя половина орбиты — уходит за букву */}
      <path
        d="M4,21 C4,6.3 62,6.3 62,21"
        transform="rotate(-16 33 21)"
        fill="none"
        stroke={`url(#${gO})`}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.45"
      />

      {/* монограмма A */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.5,33.5 33,4.5 53.5,33.5" stroke={`url(#${gA})`} strokeWidth="7" />
        <path d="M19,26 47,26" stroke={`url(#${gX})`} strokeWidth="6" />
      </g>

      {/* ближняя половина орбиты — поверх буквы, как настоящее кольцо */}
      <path
        d="M4,21 C4,35.7 62,35.7 62,21"
        transform="rotate(-16 33 21)"
        fill="none"
        stroke={`url(#${gO})`}
        strokeWidth="3.4"
        strokeLinecap="round"
      />

      {/* искра */}
      <path
        d="M9.5,2.2 Q10.6,6.9 15.3,8 Q10.6,9.1 9.5,13.8 Q8.4,9.1 3.7,8 Q8.4,6.9 9.5,2.2 Z"
        fill={`url(#${gS})`}
      />
    </svg>
  );
}
