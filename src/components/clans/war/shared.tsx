"use client";

/**
 * Общие кирпичики войны и доната: гербы, звёзды, нижняя шторка, всплывающие подсказки,
 * миниатюры героев. Стили карт и арены подключаются здесь, чтобы работать вне страницы /cards.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cardDef } from "@/lib/cards/catalog";
import { RANKS } from "@/lib/cards/config";
import { ensureLoaded, hasArt, useCards } from "@/lib/cards/client";
import { Ico } from "@/components/cards/icons";
import "../../../app/cards.css";
import "../../../app/cards-card.css";
import "../../../app/cards-stage.css";
import "../../../app/cards-tabs.css";
import "../../../app/cards-battle.css";
import "../../../app/cards-skills.css";
import "../../../app/cards-progress.css";
import "../../../app/cards-campaign.css";
import "../../../app/clan-war-ui.css";

/* --------------------------------- время ---------------------------------- */

const p2 = (n: number) => String(n).padStart(2, "0");

/** 23:59:07 — для обратного отсчёта войны */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${p2(Math.floor(s / 3600))}:${p2(Math.floor((s % 3600) / 60))}:${p2(s % 60)}`;
}

/** 7ч 12м / 42:05 — для коротких сроков */
export function shortLeft(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}ч ${p2(m)}м` : `${p2(m)}:${p2(s % 60)}`;
}

export function plural(n: number, f: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  return a > 10 && a < 20 ? f[2] : b === 1 ? f[0] : b >= 2 && b <= 4 ? f[1] : f[2];
}

export function agoText(at: number, now: number): string {
  const m = Math.max(0, Math.floor((now - at) / 60_000));
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
}

export { useNow as useNowTick } from "@/components/cards/common";

/* ------------------------------- арт героев ------------------------------- */

/** Подгружает список имеющихся артов (общий с /cards) и перерисовывает компонент, когда он готов */
export function useCardArt(): ReturnType<typeof useCards> {
  const snap = useCards();
  useEffect(() => {
    ensureLoaded();
  }, []);
  return snap;
}

/** Крупная миниатюра героя для списков: арт, цвет ранга, уровень */
export function UnitThumb({ cardId, level, size = 52, rank }: { cardId: string; level?: number; size?: number; rank?: number }) {
  const def = cardDef(cardId);
  if (!def) return null;
  const r = RANKS[rank ?? def.rank] ?? RANKS[0];
  const style = { "--u-c": r.color, width: size, height: size * 1.2 } as CSSProperties;
  return (
    <span className="cw-thumb" style={style} title={`${def.name} · ${r.short}${level && level > 1 ? ` · +${level - 1}` : ""}`}>
      {hasArt(def.id) ? (
        <img src={`/api/cards/art/${def.id}`} alt="" loading="lazy" draggable={false} />
      ) : (
        <b aria-hidden>{def.name.slice(0, 1)}</b>
      )}
      <i>{r.short}</i>
      {level && level > 1 ? <em>+{level - 1}</em> : null}
    </span>
  );
}

/* --------------------------------- знаки ---------------------------------- */

const hue = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
};

/** Герб клана: щит с тегом. Цвет — от тега, сторона задаёт кайму */
export function Crest({ tag, size = 64, side = "mine", bot = false }: { tag: string; size?: number; side?: "mine" | "foe"; bot?: boolean }) {
  const h = hue(tag || "?");
  const style = { "--cr-h": h, "--cr-s": `${size}px`, "--cr-k": tag.length > 3 ? 0.2 : 0.26, width: size, height: size * 1.12 } as CSSProperties;
  return (
    <span className={`cw-crest ${side} ${bot ? "bot" : ""}`} style={style} aria-hidden>
      <svg viewBox="0 0 100 112" width="100%" height="100%">
        <path d="M50 3 L90 17 V56 C90 83 71 99 50 109 C29 99 10 83 10 56 V17Z" className="cw-crest-body" />
        <path d="M50 11 L82 23 V55 C82 77 67 91 50 99 C33 91 18 77 18 55 V23Z" className="cw-crest-in" />
        <path d="M50 3 L90 17 V40 L50 28 L10 40 V17Z" className="cw-crest-top" />
      </svg>
      <b>{bot ? "★" : tag}</b>
    </span>
  );
}

export function Stars({ n, max = 3, size = 16, dim = false }: { n: number; max?: number; size?: number; dim?: boolean }) {
  return (
    <span className={`cw-stars ${dim ? "dim" : ""}`} aria-label={`${n} из ${max} звёзд`} role="img">
      {Array.from({ length: max }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" width={size} height={size} className={i < n ? "on" : ""} aria-hidden>
          <path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.2 1.2-6.5L2.5 9.5l6.6-.9z" />
        </svg>
      ))}
    </span>
  );
}

export function Pips({ filled, total, label }: { filled: number; total: number; label: string }) {
  return (
    <span className="cw-pips" role="img" aria-label={`${label}: ${filled} из ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < filled ? "on" : ""} />
      ))}
    </span>
  );
}

/* --------------------------------- шторка --------------------------------- */

export function Sheet({
  title,
  sub,
  onClose,
  children,
  footer,
  wide = false,
  tone = "",
}: {
  title: ReactNode;
  sub?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  tone?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    ref.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="cg cw-portal">
      <div className="cw-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className={`cw-sheet ${wide ? "wide" : ""} ${tone}`} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} ref={ref} tabIndex={-1}>
          <span className="cw-grab" aria-hidden />
          <header className="cw-sheet-head">
            <div>
              <h3>{title}</h3>
              {sub ? <p>{sub}</p> : null}
            </div>
            <button type="button" className="cw-x" onClick={onClose} aria-label="Закрыть">
              <Ico name="close" size={20} />
            </button>
          </header>
          <div className="cw-sheet-body">{children}</div>
          {footer ? <footer className="cw-sheet-foot">{footer}</footer> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* -------------------------------- подсказки ------------------------------- */

export interface ToastMsg {
  id: number;
  text: string;
  err: boolean;
}

/** Локальные всплывающие подсказки вкладки */
export function useToast(): [ReactNode, (text: string, err?: boolean) => void] {
  const [t, setT] = useState<ToastMsg | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const push = useCallback((text: string, err = false) => {
    clearTimeout(timer.current);
    setT({ id: Date.now(), text, err });
    timer.current = setTimeout(() => setT(null), 3800);
  }, []);
  const node =
    t && typeof document !== "undefined"
      ? createPortal(
          <div className="cg cw-portal">
            <div key={t.id} className={`cw-toast ${t.err ? "err" : ""}`} role="status" aria-live="polite">
              <Ico name={t.err ? "ban" : "check"} size={18} />
              <span>{t.text}</span>
            </div>
          </div>,
          document.body,
        )
      : null;
  return [node, push];
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="cg cw" aria-busy="true">
      <div className="cw-skel hero" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="cw-skel" />
      ))}
    </div>
  );
}

export function LoadError({ onRetry, text }: { onRetry: () => void; text: string }) {
  return (
    <div className="cg cw">
      <div className="cw-empty">
        <Ico name="ban" size={30} />
        <p>{text}</p>
        <button type="button" className="cw-btn ghost" onClick={onRetry}>
          Повторить
        </button>
      </div>
    </div>
  );
}
