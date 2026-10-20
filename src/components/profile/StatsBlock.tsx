"use client";

import { memo, useEffect, useRef, useState, type CSSProperties, type JSX, type ReactNode } from "react";

/** Часы просмотра: ≥1000 → «2.5K ч», иначе «N ч» (формат эталона) */
export const fmtHours = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}K ч` : `${Math.round(n)} ч`;

/** Остальные числа — без разделителей, как Math.round в эталоне */
const fmtInt = (n: number): string => String(Math.round(n));

export type StatIcon = "clock" | "tv" | "play" | "trophy";

/** SVG иконок дословно из эталона: к ним привязаны микро-анимации */
const ICONS: Record<StatIcon, JSX.Element> = {
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path className="stat-h" d="M12 12V7" />
      <path d="M12 12l3.5 2" />
    </>
  ),
  tv: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="3" />
      <path className="stat-an" d="M8 2.5l4 4.5 4-4.5" />
    </>
  ),
  play: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path className="stat-tr" d="M10 8.5l5.5 3.5-5.5 3.5z" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 3h8v6a4 4 0 01-8 0zM8 5H4v2a4 4 0 004 4M16 5h4v2a4 4 0 01-4 4M12 13v4M8 21h8M10 17h4v4h-4z" />
      <path className="stat-gl" d="M19 1v4M17 3h4" />
    </>
  ),
};

/* Общий IntersectionObserver всех карточек: запуск count-up при 40%
   видимости + пауза бесконечных анимаций вне экрана (.stat-pz) */
const ratioByEl = new Map<Element, (ratio: number) => void>();
let sharedIO: IntersectionObserver | null = null;
function getIO(): IntersectionObserver | null {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return null;
  if (!sharedIO) {
    sharedIO = new IntersectionObserver(
      (list) => {
        for (const entry of list) {
          const el = entry.target as HTMLElement;
          el.classList.toggle("stat-pz", !entry.isIntersecting);
          ratioByEl.get(el)?.(entry.intersectionRatio);
        }
      },
      { threshold: [0, 0.4] },
    );
  }
  return sharedIO;
}

export interface StatCardProps {
  label: string;
  value: number;
  icon?: StatIcon | ReactNode;
  color: string;
  color2?: string;
  format?: (n: number) => string;
  /** Порядковый номер в блоке — задержка появления и count-up */
  index?: number;
  loading?: boolean;
  onClick?: () => void;
}

function StatCardImpl({
  label,
  value,
  icon,
  color,
  color2,
  format = fmtInt,
  index = 0,
  loading = false,
  onClick,
}: StatCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  /** Показываемое число: null — count-up ещё не запускался, рендерится итог */
  const [shown, setShown] = useState<number | null>(null);
  /** Число, которое сейчас показано (для анимации от старого к новому) */
  const displayRef = useRef(value);
  const startedRef = useRef(false); // count-up уже запускался
  const visibleRef = useRef(false);
  const loadingRef = useRef(loading);
  const valueRef = useRef(value);
  const indexRef = useRef(index);
  const reducedRef = useRef(false);
  const rafRef = useRef(0);
  const apiRef = useRef<{ start: () => void; update: (v: number) => void } | null>(null);

  /* синхронизация рефов после каждого рендера */
  useEffect(() => {
    valueRef.current = value;
    loadingRef.current = loading;
    indexRef.current = index;
  });

  /* значение обновилось (например, посмотрели серию) */
  useEffect(() => {
    if (!startedRef.current) {
      displayRef.current = value;
      return;
    }
    if (displayRef.current === value) return;
    apiRef.current?.update(value);
  }, [value]);

  /* сняли скелетон — если карточка уже видна, запускаем счёт */
  useEffect(() => {
    if (!loading && visibleRef.current && !startedRef.current) apiRef.current?.start();
  }, [loading]);

  /* монтирование: observer, count-up, подсветка и наклон от курсора */
  useEffect(() => {
    const card = cardRef.current;
    if (!card || typeof window === "undefined") return;
    const mq = (q: string) =>
      typeof window.matchMedia === "function" ? window.matchMedia(q).matches : false;
    reducedRef.current = mq("(prefers-reduced-motion: reduce)");
    const io = getIO();

    const paint = (v: number) => {
      displayRef.current = v;
      setShown(v);
    };

    const animate = (from: number, to: number, delay: number) => {
      const card = cardRef.current;
      if (!card) return;
      cancelAnimationFrame(rafRef.current);
      card.classList.remove("stat-done");
      const t0 = performance.now() + delay;
      const T = 1700; // easeOutExpo, 1.7с — как в эталоне
      const step = (t: number) => {
        const p = Math.max(0, Math.min(1, (t - t0) / T));
        const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
        paint(from + (to - from) * e);
        if (p < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          paint(to);
          card.classList.add("stat-done");
        }
      };
      rafRef.current = requestAnimationFrame(step);
    };

    const start = () => {
      if (startedRef.current || loadingRef.current) return;
      startedRef.current = true;
      if (reducedRef.current) paint(valueRef.current);
      else animate(0, valueRef.current, indexRef.current * 110 + 300);
    };
    const update = (v: number) => {
      if (!startedRef.current) {
        displayRef.current = v;
        return;
      }
      if (reducedRef.current) paint(v);
      else animate(displayRef.current, v, 0);
    };
    apiRef.current = { start, update };

    const onRatio = (ratio: number) => {
      if (ratio > 0) visibleRef.current = true;
      if (ratio >= 0.4) start();
    };
    if (io) {
      ratioByEl.set(card, onRatio);
      io.observe(card);
    }

    /* подсветка/наклон: только на hover+точный указатель, через rAF */
    const fine = mq("(hover: hover) and (pointer: fine)");
    let raf = 0;
    let cx = 0;
    let cy = 0;
    const apply = () => {
      raf = 0;
      const b = card.getBoundingClientRect();
      const x = (cx - b.left) / b.width;
      const y = (cy - b.top) / b.height;
      card.style.setProperty("--mx", `${x * 100}%`);
      card.style.setProperty("--my", `${y * 100}%`);
      if (!reducedRef.current) {
        card.style.setProperty("--ry", `${(x - 0.5) * 14}deg`);
        card.style.setProperty("--rx", `${(0.5 - y) * 14}deg`);
      }
    };
    const onMove = (e: PointerEvent) => {
      cx = e.clientX;
      cy = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    };
    if (fine) {
      card.addEventListener("pointermove", onMove);
      card.addEventListener("pointerleave", onLeave);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (raf) cancelAnimationFrame(raf);
      card.removeEventListener("pointermove", onMove);
      card.removeEventListener("pointerleave", onLeave);
      if (io) {
        io.unobserve(card);
        ratioByEl.delete(card);
      }
      apiRef.current = null;
    };
  }, []);

  const clickable = Boolean(onClick);
  const iconName =
    typeof icon === "string" && icon in ICONS ? (icon as StatIcon) : null;
  const finalText = format(value);
  // Призраки глитча берут содержимое отсюда, поэтому у счётчика должен быть
  // ровно тот же текст, что нарисован на экране — иначе копия «плывёт».
  const shownText = shown === null ? finalText : format(shown);

  return (
    <div
      ref={cardRef}
      className={`stat-card${clickable ? " stat-link" : ""}`}
      style={
        {
          "--i": String(index),
          "--c": color,
          "--c2": color2 ?? color,
        } as CSSProperties
      }
      role="group"
      aria-label={loading ? label : `${label}: ${finalText}`}
      aria-busy={loading || undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <i className="stat-au" aria-hidden="true" />
      <i className="stat-au stat-au-b" aria-hidden="true" />
      <i className="stat-sp" aria-hidden="true" />
      <i className="stat-sh" aria-hidden="true" />
      {/* 7 точек: позиции и задержки детерминированные, без Math.random */}
      {Array.from({ length: 7 }, (_, j) => (
        <i
          key={j}
          className="stat-pt"
          aria-hidden="true"
          style={
            {
              "--x": `${12 + j * 13}%`,
              "--t": `${(2.6 + ((j * 37) % 17) / 10).toFixed(1)}s`,
              "--d": `${(-((j * 53) % 30) / 10).toFixed(1)}s`,
            } as CSSProperties
          }
        />
      ))}
      <i className="stat-bd" aria-hidden="true" />

      {icon != null && (
        <span className={`stat-ic${iconName ? ` stat-i-${iconName}` : ""}`} aria-hidden="true">
          {iconName ? <svg viewBox="0 0 24 24">{ICONS[iconName]}</svg> : icon}
        </span>
      )}

      {loading ? (
        <span className="stat-skel" aria-hidden="true" />
      ) : (
        <span className="stat-num" data-text={shownText} aria-hidden="true">
          {shownText}
        </span>
      )}
      <span className="stat-lb">{label}</span>
      {!loading && <span className="stat-sr">{finalText}</span>}
    </div>
  );
}

export const StatCard = memo(StatCardImpl);

export type StatCardItem = Omit<StatCardProps, "index">;

export function StatsBlock({
  cards,
  loading,
  className,
}: {
  cards: StatCardItem[];
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={className ? `stat-grid ${className}` : "stat-grid"}>
      {cards.map((card, i) => (
        <StatCard key={card.label} {...card} index={i} loading={loading ?? card.loading} />
      ))}
    </div>
  );
}
