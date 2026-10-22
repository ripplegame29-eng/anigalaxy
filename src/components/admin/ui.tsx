"use client";

/** Общие элементы админ-панели: уведомления, подтверждения, счётчики, график */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/* ------------------------------ Уведомления ---------------------------- */

type ToastKind = "ok" | "err" | "info";
interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}
interface ConfirmState {
  title: string;
  text?: string;
  danger?: boolean;
  confirmLabel?: string;
  resolve: (value: boolean) => void;
}
interface UiApi {
  toast: (text: string, kind?: ToastKind) => void;
  confirm: (title: string, opts?: { text?: string; danger?: boolean; confirmLabel?: string }) => Promise<boolean>;
}

const UiContext = createContext<UiApi>({ toast: () => {}, confirm: async () => false });
export const useUi = () => useContext(UiContext);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ask, setAsk] = useState<ConfirmState | null>(null);
  const seq = useRef(0);

  const toast = useCallback((text: string, kind: ToastKind = "ok") => {
    const id = ++seq.current;
    setToasts((list) => [...list.slice(-3), { id, text, kind }]);
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4200);
  }, []);

  const confirm = useCallback(
    (title: string, opts: { text?: string; danger?: boolean; confirmLabel?: string } = {}) =>
      new Promise<boolean>((resolve) => setAsk({ title, ...opts, resolve })),
    [],
  );

  const api = useMemo(() => ({ toast, confirm }), [toast, confirm]);
  const close = (value: boolean) => {
    ask?.resolve(value);
    setAsk(null);
  };

  return (
    <UiContext.Provider value={api}>
      {children}
      <div className="adm-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`adm-toast adm-toast-${t.kind}`} role="status">
            <i aria-hidden />
            {t.text}
          </div>
        ))}
      </div>
      {ask ? (
        <div className="adm-modal-wrap" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
          <div className={`adm-modal ${ask.danger ? "adm-modal-danger" : ""}`} role="alertdialog" aria-label={ask.title}>
            <h3>{ask.title}</h3>
            {ask.text ? <p>{ask.text}</p> : null}
            <div className="adm-modal-actions">
              <button type="button" className="adm-btn" onClick={() => close(false)} autoFocus>
                Отмена
              </button>
              <button type="button" className={`adm-btn ${ask.danger ? "adm-btn-danger" : "adm-btn-primary"}`} onClick={() => close(true)}>
                {ask.confirmLabel ?? "Подтвердить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </UiContext.Provider>
  );
}

/* -------------------------------- Числа -------------------------------- */

/** Плавный счёт от нуля до значения (один раз при появлении) */
export function CountUp({ value, className = "" }: { value: number; className?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = window.setTimeout(() => setShown(value), 0);
      return () => window.clearTimeout(t);
    }
    let raf = 0;
    const from = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - from) / 900);
      setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{shown.toLocaleString("ru-RU")}</span>;
}

/** Свечение под курсором: ставит --mx/--my на контейнер, карточки внутри рисуют пятно */
export function useSpotlight() {
  return useCallback((e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    for (const card of el.querySelectorAll<HTMLElement>(".adm-card")) {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    }
  }, []);
}

/* -------------------------------- График ------------------------------- */

export function AreaChart({ labels, series }: { labels: string[]; series: { name: string; color: string; values: number[] }[] }) {
  const W = 640;
  const H = 180;
  const pad = { l: 28, r: 8, t: 10, b: 22 };
  const max = Math.max(4, ...series.flatMap((s) => s.values));
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, labels.length - 1);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const [hover, setHover] = useState<number | null>(null);
  const ticks = [0, Math.round(max / 2), max];
  return (
    <div className="adm-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="График за 14 дней" onPointerLeave={() => setHover(null)}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.name} id={`adm-g${i}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity=".38" />
              <stop offset="1" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="adm-grid" />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" className="adm-axis">
              {t}
            </text>
          </g>
        ))}
        {series.map((s, i) => {
          const pts = s.values.map((v, k) => `${x(k)},${y(v)}`);
          return (
            <g key={s.name}>
              <polygon points={`${x(0)},${y(0)} ${pts.join(" ")} ${x(s.values.length - 1)},${y(0)}`} fill={`url(#adm-g${i})`} />
              <polyline points={pts.join(" ")} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" className="adm-line" />
            </g>
          );
        })}
        {labels.map((l, i) => (
          <g key={l + i}>
            {i % 2 === 0 ? (
              <text x={x(i)} y={H - 6} textAnchor="middle" className="adm-axis">
                {l}
              </text>
            ) : null}
            <rect x={x(i) - 18} y={0} width={36} height={H} fill="transparent" onPointerEnter={() => setHover(i)} />
          </g>
        ))}
        {hover !== null ? (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} className="adm-cursor" />
            {series.map((s) => (
              <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r="4" fill={s.color} stroke="#0a0f1e" strokeWidth="2" />
            ))}
          </g>
        ) : null}
      </svg>
      <div className="adm-legend">
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} />
            {s.name}
            {hover !== null ? <b>{s.values[hover]}</b> : null}
          </span>
        ))}
        {hover !== null ? <em>{labels[hover]}</em> : null}
      </div>
    </div>
  );
}

/* ------------------------------ Мелочи UI ------------------------------ */

export function Initial({ name, size = 40, hue }: { name: string; size?: number; hue?: number }) {
  const h = hue ?? (name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 7) % 360;
  return (
    <span
      className="adm-ini"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(135deg,hsl(${h} 80% 55%),hsl(${(h + 50) % 360} 85% 45%))` }}
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Pill({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "gold" | "red" | "green" | "violet" | "gray" }) {
  return <span className={`adm-pill adm-pill-${tone}`}>{children}</span>;
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string; count?: number }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="adm-seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={value === o.id} className={value === o.id ? "on" : ""} onClick={() => onChange(o.id)}>
          {o.label}
          {o.count ? <em>{o.count}</em> : null}
        </button>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="adm-empty">{children}</p>;
}
