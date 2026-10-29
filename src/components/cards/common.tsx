"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cardDef } from "@/lib/cards/catalog";
import { RANKS } from "@/lib/cards/config";
import { sfx } from "@/lib/cards/sound";
import type { InvCard } from "@/lib/cards/client";
import { GameCard } from "./GameCard";
import { Ico } from "./icons";

/* ------------------------------- уведомления ------------------------------ */
let toastState: { id: number; text: string; err: boolean } | null = null;
const toastSubs = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

export function toast(text: string, err = false): void {
  toastState = { id: Date.now(), text, err };
  sfx(err ? "err" : "ok");
  toastSubs.forEach((f) => f());
  clearTimeout(timer);
  timer = setTimeout(() => {
    toastState = null;
    toastSubs.forEach((f) => f());
  }, 3600);
}

export function ToastHost() {
  const t = useSyncExternalStore(
    (f) => {
      toastSubs.add(f);
      return () => {
        toastSubs.delete(f);
      };
    },
    () => toastState,
    () => null,
  );
  if (!t) return null;
  return (
    <div className={`cg-toast ${t.err ? "err" : ""}`} role="status" aria-live="polite">
      <Ico name={t.err ? "ban" : "check"} size={18} />
      {t.text}
    </div>
  );
}

/* --------------------------------- утилиты -------------------------------- */
export const fmt = (n: number): string => n.toLocaleString("ru-RU");

export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function fmtLeft(ms: number): string {
  if (ms <= 0) return "завершён";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}ч ${String(m).padStart(2, "0")}м` : `${m}:${String(sec).padStart(2, "0")}`;
}

export const rankName = (r: number): string => RANKS[r]?.name ?? "";

/* ------------------------------ фильтр по рангу --------------------------- */
export function RankFilter({ value, onChange, all = true, only }: { value: number; onChange: (r: number) => void; all?: boolean; only?: number[] }) {
  return (
    <div className="cg-filter" role="group" aria-label="Ранг">
      {all && (
        <button type="button" aria-pressed={value === -1} onClick={() => onChange(-1)}>
          Все
        </button>
      )}
      {RANKS.filter((r) => !only || only.includes(r.id)).map((r) => (
        <button key={r.id} type="button" aria-pressed={value === r.id} onClick={() => onChange(r.id)} style={value === r.id ? { borderColor: r.color } : undefined}>
          {r.name}
        </button>
      ))}
    </div>
  );
}

/* --------------------------- выбор карт из коллекции ---------------------- */
export function InvPicker({
  cards,
  selected,
  onToggle,
  max,
  empty = "Подходящих карт нет",
  size = "",
  rankFilter = -1,
  search = true,
}: {
  cards: InvCard[];
  selected: number[];
  onToggle: (id: number) => void;
  max: number;
  empty?: string;
  size?: "" | "lg" | "xs";
  rankFilter?: number;
  search?: boolean;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return cards
      .filter((c) => {
        const d = cardDef(c.cardId);
        if (!d) return false;
        if (rankFilter >= 0 && d.rank !== rankFilter) return false;
        return !needle || d.name.toLowerCase().includes(needle) || d.series.toLowerCase().includes(needle) || d.search.toLowerCase().includes(needle);
      })
      .sort((a, b) => (cardDef(b.cardId)!.rank - cardDef(a.cardId)!.rank) || b.level - a.level || a.cardId.localeCompare(b.cardId));
  }, [cards, q, rankFilter]);
  return (
    <div>
      {search && <input className="cg-input" style={{ width: "100%", marginBottom: 10 }} placeholder="Поиск по имени или аниме" value={q} onChange={(e) => setQ(e.target.value)} />}
      {list.length === 0 ? (
        <div className="cg-empty">{empty}</div>
      ) : (
        <div className={`cg-cards ${size}`} style={{ maxHeight: 640, overflowY: "auto", padding: 4 }}>
          {list.map((c) => (
            <button key={c.id} type="button" className="cg-cell" onClick={() => onToggle(c.id)} disabled={max > 1 && !selected.includes(c.id) && selected.length >= max} aria-pressed={selected.includes(c.id)}>
              <GameCard cardId={c.cardId} foil={c.foil} level={c.level} evo={c.evo} selected={selected.includes(c.id)} locked={c.locked} stats={size !== "xs"} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ показ новых карт -------------------------- */
export function Reveal({
  cards,
  onClose,
  title,
  sub,
  cta = "Отлично",
}: {
  cards: { cardId: string; foil?: boolean; level?: number }[];
  onClose: () => void;
  title: string;
  sub?: ReactNode;
  cta?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const topRank = cards.reduce((m, c) => Math.max(m, cardDef(c.cardId)?.rank ?? 0), 0);
  useEffect(() => {
    if (cards.length) sfx(`reveal${topRank}` as "reveal0");
  }, [cards.length, topRank]);
  if (!cards.length) return null;
  const defs = cards.map((c) => cardDef(c.cardId)).filter((d): d is NonNullable<ReturnType<typeof cardDef>> => !!d);
  const best = defs.reduce((m, d) => Math.max(m, d.rank), 0);
  const bestIdx = cards.findIndex((c) => cardDef(c.cardId)?.rank === best);
  const many = cards.length > 1;
  const tally = RANKS.map((r) => ({ r, n: defs.filter((d) => d.rank === r.id).length })).filter((x) => x.n > 0);
  return (
    <div className={`cg-reveal rv-r${best}`} role="dialog" aria-modal="true" aria-label={title} onClick={onClose} style={{ ["--rc" as string]: RANKS[best].color }}>
      <div className="burst" aria-hidden />
      <div className="cg-reveal-in" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {sub && <p className="sub">{sub}</p>}
        {many && (
          <div className="cg-tally">
            {tally.reverse().map(({ r, n }) => (
              <span key={r.id} style={{ ["--c" as string]: r.color }}>
                <b>{n}</b> {r.name}
              </span>
            ))}
          </div>
        )}
        <div className={`cg-deal ${many ? "many" : "one"}`}>
          {cards.map((c, i) => (
            <div key={i} style={{ ["--i" as string]: i }} className={i === bestIdx && many && best >= 2 ? "best" : ""}>
              <GameCard cardId={c.cardId} foil={c.foil} level={c.level} stats={!many} live={!many} />
            </div>
          ))}
        </div>
        <button type="button" className="cg-btn pri lg" onClick={onClose}>
          {cta}
        </button>
      </div>
    </div>
  );
}

/** «5 мин назад» по времени события */
export function ago(at: number, now: number): string {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 60) return "только что";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
}

export function Panel({ title, hint, children, right }: { title?: string; hint?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="cg-panel">
      {(title || right) && (
        <div className="cg-panel-head">
          {title && <h2 className="cg-h2">{title}</h2>}
          {right}
        </div>
      )}
      {hint && <p className="cg-hint">{hint}</p>}
      {children}
    </section>
  );
}

export function useBusy(): [boolean, <T>(fn: () => Promise<T>) => Promise<T | undefined>] {
  const [busy, setBusy] = useState(false);
  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (busy) return undefined;
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  };
  return [busy, run];
}

/** Выносит модальные окна в <body>, чтобы их не ломали transform/overflow предков страницы */
export function Portal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(<div className="cg cg-portal">{children}</div>, document.body);
}

/** Числовое поле с кнопками «−» и «+»: зажатие повторяет шаг, значение можно вводить с клавиатуры */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999_999,
  step = 1,
  width = 150,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  width?: number;
  label: string;
}) {
  const clamp = useCallback((n: number) => Math.min(max, Math.max(min, Math.round(n))), [min, max]);
  const [draft, setDraft] = useState<string | null>(null);
  const cur = useRef(value);
  useEffect(() => {
    cur.current = value;
  }, [value]);
  const timer = useRef<number | undefined>(undefined);
  const stop = () => {
    window.clearTimeout(timer.current);
    window.clearInterval(timer.current);
  };
  useEffect(() => stop, []);
  const bump = (dir: 1 | -1) => {
    const next = clamp(cur.current + dir * step);
    cur.current = next;
    onChange(next);
  };
  const hold = (dir: 1 | -1) => {
    stop();
    bump(dir);
    timer.current = window.setTimeout(() => {
      timer.current = window.setInterval(() => bump(dir), 70);
    }, 380);
  };
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft.replace(/\s/g, ""));
    onChange(clamp(Number.isFinite(n) && draft.trim() !== "" ? n : value));
    setDraft(null);
  };
  return (
    <div className="cg-step" style={{ width }} role="group" aria-label={label}>
      <button type="button" className="cg-step-b" aria-label="Меньше" disabled={value <= min} onPointerDown={() => hold(-1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); bump(-1); } }}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><path d="M6 12h12" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
      </button>
      <input
        className="cg-step-i"
        inputMode="numeric"
        aria-label={label}
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d\s]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "ArrowUp") { e.preventDefault(); bump(1); }
          if (e.key === "ArrowDown") { e.preventDefault(); bump(-1); }
        }}
      />
      <button type="button" className="cg-step-b" aria-label="Больше" disabled={value >= max} onPointerDown={() => hold(1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); bump(1); } }}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><path d="M12 6v12M6 12h12" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}
