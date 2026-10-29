"use client";

import {
  Children, Fragment, isValidElement, useCallback, useEffect, useId, useMemo, useRef, useState,
  type ChangeEvent, type CSSProperties, type ReactElement, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import "./psel.css";

interface Opt { value: string; label: ReactNode; disabled?: boolean }

function collect(children: ReactNode, out: Opt[] = []): Opt[] {
  Children.forEach(children, (ch) => {
    if (!isValidElement(ch)) return;
    const el = ch as ReactElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>;
    if (el.type === Fragment || el.type === "optgroup") collect(el.props.children, out);
    else if (el.type === "option") {
      const label = el.props.children;
      out.push({ value: String(el.props.value ?? (typeof label === "string" ? label : "")), label, disabled: el.props.disabled });
    }
  });
  return out;
}

/**
 * Премиальная замена нативного <PSelect>: тот же API (value, onChange(e), <option>),
 * но список рисуется в стиле сайта вместо серого системного.
 */
export function PSelect({
  value, onChange, children, className, disabled, style, id, title, name,
  "aria-label": ariaLabel,
}: {
  value?: string | number;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  style?: CSSProperties;
  id?: string;
  title?: string;
  name?: string;
  "aria-label"?: string;
}) {
  const opts = useMemo(() => collect(children), [children]);
  const cur = String(value ?? "");
  const sel = opts.find((o) => o.value === cur) ?? opts[0];
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [pos, setPos] = useState<{ l: number; t: number; w: number; up: boolean; mh: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const lid = useId();

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 180 && above > below;
    setPos({ l: r.left, t: up ? r.top - 6 : r.bottom + 6, w: Math.max(r.width, 150), up, mh: Math.max(120, Math.min(320, up ? above : below)) });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const close = (e: Event) => {
      if (e.target instanceof Node && (list.current?.contains(e.target) || btn.current?.contains(e.target))) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", close, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>('[data-hi="1"]')?.scrollIntoView({ block: "nearest" });
  }, [open, hi]);

  const pick = (o: Opt) => {
    if (o.disabled) return;
    onChange?.({ target: { value: o.value, name }, currentTarget: { value: o.value, name } } as unknown as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
    btn.current?.focus();
  };
  const toggle = () => {
    if (disabled) return;
    setHi(Math.max(0, opts.findIndex((o) => o.value === cur)));
    setOpen((v) => !v);
  };
  const step = (d: number) => {
    let i = hi;
    for (let n = 0; n < opts.length; n++) { i = (i + d + opts.length) % opts.length; if (!opts[i].disabled) break; }
    setHi(i);
  };

  return (
    <>
      <button
        ref={btn} id={id} type="button" title={title} disabled={disabled} style={style}
        className={`${className ?? ""} ps-btn${open ? " is-open" : ""}`}
        role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? lid : undefined} aria-label={ariaLabel}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) toggle(); else step(e.key === "ArrowDown" ? 1 : -1);
          } else if ((e.key === "Enter" || e.key === " ") && open) {
            e.preventDefault();
            if (opts[hi]) pick(opts[hi]);
          }
        }}
      >
        <span className="ps-val">{sel?.label}</span>
        <svg className="ps-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <ul
          ref={list} id={lid} role="listbox" className={`ps-list${pos.up ? " is-up" : ""}`}
          style={{ left: pos.l, top: pos.t, minWidth: pos.w, maxHeight: pos.mh }}
        >
          {opts.map((o, i) => (
            <li
              key={o.value + i} role="option" aria-selected={o.value === cur} aria-disabled={o.disabled}
              data-hi={i === hi ? "1" : undefined}
              className={`ps-opt${o.value === cur ? " is-sel" : ""}${i === hi ? " is-hi" : ""}${o.disabled ? " is-off" : ""}`}
              onPointerEnter={() => setHi(i)}
              onClick={() => pick(o)}
            >
              <span>{o.label}</span>
              {o.value === cur && <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12 5 5 9-10" /></svg>}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </>
  );
}
