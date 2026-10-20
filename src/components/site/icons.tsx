/**
 * Иконки прототипа шапки.
 *
 * В макете это объект `P` со строками путей и обёртка
 * `I(p) = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
 * stroke-width="2" stroke-linecap="round" stroke-linejoin="round">…</svg>'`.
 *
 * Здесь те же пути, разложенные по элементам React: строка с `innerHTML`
 * в разметке шапки означала бы дыру в экранировании и лишний
 * `dangerouslySetInnerHTML`. Атрибуты обёртки перенесены 1:1 — меняется
 * только имя свойства (`stroke-width` → `strokeWidth`).
 *
 * Набор полный, включая иконки палитры поиска (`flame`, `frame`, `arrow`,
 * `nw`): шапка их не рисует, но они пригодятся компоненту оверлея,
 * который ставится в тот же контейнер `.agh`.
 */

import type { ReactNode } from "react";

/** Содержимое иконки — обёртка `<svg>` собирается в `Icon` */
const PATHS = {
  logo: () => (
    <>
      <path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-9z" />
      <path d="M19 3l.6 1.6L21 5l-1.4.4L19 7l-.6-1.6L17 5l1.4-.4z" />
    </>
  ),
  search: () => (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </>
  ),
  ch: () => <path d="M6 9l6 6 6-6" />,
  shield: () => (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  users: () => (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.5 3.3-5 6.5-5s5.7 1.5 6.5 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .5 3.3 2 3.8 5" />
    </>
  ),
  gift: () => (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M5 12v8h14v-8M12 8v12M12 8S9 8 8.5 6 11 3.5 12 8zM12 8s3 0 3.5-2S13 3.5 12 8z" />
    </>
  ),
  bell: () => <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />,
  crown: () => <path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" />,
  compass: () => (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  layers: () => <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" />,
  cal: () => (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  dice: () => (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9" cy="9" r="1" />
      <circle cx="15" cy="15" r="1" />
      <circle cx="15" cy="9" r="1" />
      <circle cx="9" cy="15" r="1" />
    </>
  ),
  trophy: () => (
    <path d="M8 4h8v6a4 4 0 0 1-8 0zM8 6H4v2a3 3 0 0 0 4 3M16 6h4v2a3 3 0 0 1-4 3M12 14v4M8 20h8" />
  ),
  spark: () => <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  tv: () => (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M8 21h8" />
    </>
  ),
  user: () => (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </>
  ),
  book: () => <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M9 7h6" />,
  list: () => <path d="M4 6h10M4 12h7M4 18h7M15 14l5 3-5 3z" />,
  heart: () => <path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.4-7 10-7 10z" />,
  store: () => (
    <path d="M4 9l1-5h14l1 5M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9M5 11v9h14v-9" />
  ),
  target: () => (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  gear: () => (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </>
  ),
  out: () => <path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" />,
  menu: () => <path d="M4 7h16M4 12h16M4 17h16" />,
  check: () => <path d="M5 12l5 5 9-10" />,
  msg: () => <path d="M4 5h16v11H9l-5 4z" />,
  film: () => (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M8 5v14M16 5v14" />
    </>
  ),
  pass: () => (
    <>
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
      <path d="M12 9.5l.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z" />
    </>
  ),
  together: () => (
    <>
      <rect x="3" y="4" width="18" height="11" rx="2" />
      <path d="M10.5 7.5l3.5 2-3.5 2z" />
      <circle cx="8" cy="19" r="1.6" />
      <circle cx="16" cy="19" r="1.6" />
    </>
  ),
  shieldstar: () => (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <path d="M12 8.4l1.15 2.35 2.6.35-1.9 1.8.5 2.55L12 14.2l-2.35 1.25.5-2.55-1.9-1.8 2.6-.35z" />
    </>
  ),
  refresh: () => (
    <path d="M20 11a8 8 0 0 0-14.5-4.2L4 9M4 4v5h5M4 13a8 8 0 0 0 14.5 4.2L20 15M20 20v-5h-5" />
  ),
  ext: () => <path d="M7 17L17 7M8 7h9v9" />,
  flame: () => <path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-9z" />,
  frame: () => (
    <>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  arrow: () => <path d="M5 12h14M13 6l6 6-6 6" />,
  nw: () => (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </>
  ),
} satisfies Record<string, () => ReactNode>;

export type IconName = keyof typeof PATHS;

export interface IconProps {
  name: IconName;
  /** В макете `class="ch"` добавлялся строковой заменой: `<svg class="ch">` */
  className?: string;
}

/** Иконка прототипа: `<svg viewBox="0 0 24 24" …>{paths}</svg>` */
export function Icon({ name, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      /* Иконка в кнопке с aria-label: озвучивать её второй раз незачем */
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]()}
    </svg>
  );
}