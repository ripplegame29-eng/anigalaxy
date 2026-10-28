"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { RANKS } from "@/lib/cards/config";
import type { InvCard } from "@/lib/cards/client";
import { GameCard } from "./GameCard";

/* ------------------------------- уведомления ------------------------------ */
let toastState: { id: number; text: string; err: boolean } | null = null;
const toastSubs = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

export function toast(text: string, err = false): void {
  toastState = { id: Date.now(), text, err };
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
              <GameCard cardId={c.cardId} foil={c.foil} level={c.level} selected={selected.includes(c.id)} locked={c.locked} stats={size !== "xs"} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ показ новой карты ------------------------- */
export function Reveal({ cards, onClose, title }: { cards: { cardId: string; foil?: boolean; level?: number }[]; onClose: () => void; title: string }) {
  if (!cards.length) return null;
  return (
    <div className="cg-reveal" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div style={{ width: cards.length > 1 ? "min(560px, 92vw)" : undefined }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-display, inherit)", fontWeight: 800 }}>{title}</h2>
        <div className="cg-cards lg" style={{ width: "100%", gridTemplateColumns: cards.length > 1 ? "repeat(2,1fr)" : "1fr" }}>
          {cards.map((c, i) => (
            <div key={i} className="cg-result">
              <GameCard cardId={c.cardId} foil={c.foil} level={c.level} />
            </div>
          ))}
        </div>
        <button type="button" className="cg-btn pri" onClick={onClose}>
          Отлично
        </button>
      </div>
    </div>
  );
}

export function Panel({ title, hint, children, right }: { title?: string; hint?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="cg-panel">
      {(title || right) && (
        <div className="cg-row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
          {title && <h2>{title}</h2>}
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
