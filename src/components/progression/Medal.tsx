"use client";

/**
 * Медаль достижения (§11): шестигранник из трёх слоёв (`clip-path`),
 * вращающаяся рамка, лучи, иконка семейства со своей анимацией, шкала
 * ступеней из 10 ромбиков, 3D-наклон и голографический блик за курсором,
 * волна при клике, пауза невидимых через IntersectionObserver.
 *
 * Все вычисления — в чистых хелперах `lib/progression/visual` (правило
 * react-hooks/purity запрещает Math.* прямо в компоненте).
 */

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { AchievementDef } from "@/lib/progression/types";
import { romanTier, tierBand } from "@/lib/progression/visual";

/* --------------------------- Иконки семейств ---------------------------- */
/* Оригинальные контурные пиктограммы (24×24, stroke currentColor) */

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const FAMILY_ICON: Record<string, ReactNode> = {
  /* Всход: солнце с лучами */
  start: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" {...S} />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1" {...S} />
    </svg>
  ),
  /* Серия: play в круге */
  episodes: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" {...S} />
      <path d="M10 8.4l6 3.6-6 3.6z" {...S} />
    </svg>
  ),
  /* Финал: финишный флажок */
  titles: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5.5 21V3.5" {...S} />
      <path d="M5.5 4.5h13l-2.6 4 2.6 4h-13" {...S} />
    </svg>
  ),
  /* Дни: календарь с отмеченным днём */
  days: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" {...S} />
      <path d="M3.5 10.5h17M8 3v4M16 3v4" {...S} />
      <path d="M7.5 14h3.5v3.5H7.5z" {...S} />
    </svg>
  ),
  /* Серия подряд: молния */
  streak: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13 2.5 5.5 13H11l-1.5 8.5L18 10.5h-5.5z" {...S} />
    </svg>
  ),
  /* Коллекция: четыре ячейки */
  collection: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" {...S} />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" {...S} />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" {...S} />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" {...S} />
    </svg>
  ),
  /* Минуты: циферблат */
  minutes: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" {...S} />
      <path d="M12 7v5.2l3.4 2" {...S} />
    </svg>
  ),
  /* Комментарии: речевой пузырь */
  comments: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5.5h16v11h-8l-4.5 3.5v-3.5H4z" {...S} />
      <path d="M8.5 10.2h.01M12 10.2h.01M15.5 10.2h.01" {...S} />
    </svg>
  ),
  /* Уровни: лестница ступеней */
  levels: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 20.5h5v-5h5v-5h5v-5" {...S} />
    </svg>
  ),
  /* Оценки: звезда */
  ratings: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" {...S} />
    </svg>
  ),
  /* Ночные серии: луна */
  night: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19.5 14.8A8.2 8.2 0 0 1 9.2 4.5a8.4 8.4 0 1 0 10.3 10.3z" {...S} />
    </svg>
  ),
  /* Жанры: киноплёнка */
  genres: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" {...S} />
      <path d="M8 5.5v13M16 5.5v13M3.5 10H8M3.5 14H8M16 10h4.5M16 14h4.5" {...S} />
    </svg>
  ),
  /* Социальные: два силуэта */
  social: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="9" r="3.2" {...S} />
      <path d="M3.5 19.5c.6-3.1 2.8-4.8 5.5-4.8s4.9 1.7 5.5 4.8" {...S} />
      <circle cx="17.2" cy="10" r="2.5" {...S} />
      <path d="M15.6 14.8c2.4-.4 4.5 1.1 5.1 3.8" {...S} />
    </svg>
  ),
  /* Квесты: мишень */
  quests: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" {...S} />
      <circle cx="12" cy="12" r="4.5" {...S} />
      <circle cx="12" cy="12" r="1" {...S} />
    </svg>
  ),
  /* Теги: бирка-этикетка */
  tags: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h7.6L20 12.4 12.4 20 4 11.6z" {...S} />
      <circle cx="8.6" cy="8.6" r="1.7" {...S} />
    </svg>
  ),
  /* Секреты: замок */
  secret: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" {...S} />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" {...S} />
      <path d="M12 14v3" {...S} />
    </svg>
  ),
};

/* -------------------------------- Компонент ----------------------------- */

interface MedalProps {
  def: AchievementDef;
  /** Ступень внутри семейства (1..10) */
  tier?: number;
  status?: "locked" | "progress" | "unlocked";
  /** Размер стороны, px */
  size?: number;
  /** Неполученный секрет: вместо иконки — замок, ступень скрыта */
  disguised?: boolean;
  /** 3D-наклон и блик за курсором (для больших медалей) */
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
}

interface Tilt {
  rx: number;
  ry: number;
  mx: string;
  my: string;
}

const FLAT: Tilt = { rx: 0, ry: 0, mx: "50%", my: "35%" };

/* Детерминированные точки-искры для мерцания (как у эмблемы уровня) */
const SPARKS = [
  { left: "22%", top: "28%", t: "1.8s", d: "0s" },
  { left: "76%", top: "24%", t: "2.3s", d: "-0.6s" },
  { left: "70%", top: "74%", t: "2s", d: "-1.2s" },
  { left: "26%", top: "70%", t: "2.6s", d: "-0.3s" },
];

export function Medal({
  def,
  tier = 1,
  status = "unlocked",
  size = 84,
  disguised = false,
  interactive = false,
  className = "",
  onClick,
}: MedalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [tilt, setTilt] = useState<Tilt>(FLAT);

  // Невидимые медали стоят на паузе (IntersectionObserver)
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => setPaused(!entries[0]?.isIntersecting),
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Волна по клику: класс снимается через кадр, чтобы анимация повторилась
  useEffect(() => {
    if (!pulse) return;
    const timer = setTimeout(() => setPulse(false), 600);
    return () => clearTimeout(timer);
  }, [pulse]);

  const band = tierBand(disguised ? 1 : tier);
  const icon = FAMILY_ICON[def.family] ?? FAMILY_ICON.secret;
  const shownTier = disguised ? 0 : tier;
  const pips = [];
  for (let i = 1; i <= 10; i += 1) {
    pips.push(<i key={i} className={i <= shownTier ? "on" : ""} style={{ "--k": i } as CSSProperties} />);
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    setTilt({
      rx: (0.5 - py) * 16,
      ry: (px - 0.5) * 16,
      mx: `${px * 100}%`,
      my: `${py * 100}%`,
    });
  };

  const handleClick = () => {
    setPulse(true);
    onClick?.();
  };

  const style = {
    "--medal": `${size}px`,
    "--rx": `${tilt.rx}deg`,
    "--ry": `${tilt.ry}deg`,
    "--mx": tilt.mx,
    "--my": tilt.my,
  } as CSSProperties;

  return (
    <div
      ref={ref}
      className={`medal ${pulse ? "is-pulse" : ""} ${className}`}
      style={style}
      data-band={band}
      data-status={status}
      data-family={def.family}
      data-paused={paused ? "true" : undefined}
      aria-hidden="true"
      onPointerMove={onPointerMove}
      onPointerLeave={() => interactive && setTilt(FLAT)}
      onClick={handleClick}
    >
      <div className="medal__body">
        <span className="medal__aura" />
        <span className="medal__hex">
          <span className="medal__sheen" />
        </span>
        <span className="medal__rays" />
        <span className="medal__rays medal__rays--b" />
        <span className="medal__ring" />
        <span className="medal__holo" />
        <span className="medal__orb" />
        <span className="medal__sparks" aria-hidden="true">
          {SPARKS.map((s, i) => (
            <i key={i} style={{ left: s.left, top: s.top, "--t": s.t, "--d": s.d } as CSSProperties} />
          ))}
        </span>
        <span className="medal__tier">{disguised ? "?" : romanTier(tier)}</span>
        <span className="medal__icon">{icon}</span>
        <span className="medal__pips">{pips}</span>
        <span className="medal__wave" />
      </div>
    </div>
  );
}
