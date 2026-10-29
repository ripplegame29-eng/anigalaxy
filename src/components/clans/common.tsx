"use client";

/** Общие кирпичики клан-хаба: контекст, форматирование, время, иконки, кнопки, панели. */

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { CLAN_EMBLEMS } from "@/lib/emblems.data";
import { ROLE_NAME, type ClanRole } from "@/lib/clan-rules";
import type { ClanInfo, MyClan } from "@/lib/clans/client";
import { EmblemArt } from "./EmblemArt";

export const fmt = (n: number): string => Math.round(n).toLocaleString("ru-RU");

/* ------------------------------- Контекст -------------------------------- */

export type TabId = "overview" | "war" | "donate" | "roster" | "league" | "shop";

export interface ClanCtxValue {
  me: MyClan;
  clan: ClanInfo;
  role: ClanRole;
  /** Глава или офицер */
  manage: boolean;
  go: (tab: TabId) => void;
  /** Действие клана: показывает ответ сервера (ошибку — как есть) и обновляет данные */
  act: (action: string, body?: Record<string, unknown>, okText?: string) => Promise<boolean>;
  notify: (kind: "ok" | "err", text: string) => void;
  reload: () => Promise<void>;
}
export const ClanCtx = createContext<ClanCtxValue | null>(null);
export function useClan(): ClanCtxValue {
  const v = useContext(ClanCtx);
  if (!v) throw new Error("ClanCtx отсутствует");
  return v;
}

/* --------------------------------- Время --------------------------------- */

let nowValue = 0;
const nowSubs = new Set<() => void>();
let nowTimer: ReturnType<typeof setInterval> | null = null;
function nowSubscribe(cb: () => void): () => void {
  nowSubs.add(cb);
  if (!nowTimer) {
    nowValue = Date.now();
    nowTimer = setInterval(() => {
      nowValue = Date.now();
      nowSubs.forEach((f) => f());
    }, 1000);
  }
  return () => {
    nowSubs.delete(cb);
    if (nowSubs.size === 0 && nowTimer) {
      clearInterval(nowTimer);
      nowTimer = null;
    }
  };
}
/** Текущее время, обновляется раз в секунду. До гидратации — 0 */
export function useNow(): number {
  return useSyncExternalStore(
    nowSubscribe,
    () => (nowValue ||= Date.now()),
    () => 0,
  );
}

export function countdown(ms: number): string {
  if (ms <= 0) return "0 м";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} д ${h} ч`;
  if (h > 0) return `${h} ч ${m} м`;
  return `${m} м ${String(s % 60).padStart(2, "0")} с`;
}
export function ago(ts: number, now: number): string {
  if (!now) return "";
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return "только что";
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`;
  return `${Math.floor(s / 86400)} д назад`;
}

/* -------------------------------- Эмблемы -------------------------------- */

/** У клана пока нет выбранной эмблемы на сервере — подбираем стабильную по id */
export function emblemFor(clanId: number) {
  return CLAN_EMBLEMS[Math.abs(clanId) % CLAN_EMBLEMS.length];
}
export function Crest({ clanId, size = 150, interactive = false }: { clanId: number; size?: number; interactive?: boolean }) {
  return (
    <span className="ca-crest" style={{ width: size, height: size }}>
      <EmblemArt emblem={emblemFor(clanId)} size={size} interactive={interactive} />
    </span>
  );
}

/* --------------------------------- Иконки -------------------------------- */

const PATHS: Record<string, ReactNode> = {
  overview: <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  war: (
    <>
      <path d="M14.5 4.5L19 3l-1.5 4.5L9 16l-3-3z" />
      <path d="M9.5 14.5L5 19M4 14l6 6M5 21l-2-2" />
    </>
  ),
  donate: (
    <>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M12 8v12M3 13h18M12 8c-2-4-6-3-5 0 .6 1.6 3 1.2 5 0zm0 0c2-4 6-3 5 0-.6 1.6-3 1.2-5 0z" />
    </>
  ),
  roster: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 5.2a3 3 0 0 1 0 5.6M18 14.4c2 .8 3 2.8 3 5.6" />
    </>
  ),
  league: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 21h8M9 18h6" />
    </>
  ),
  shop: (
    <>
      <path d="M4 8h16l-1.2 11.2a1 1 0 0 1-1 .8H6.2a1 1 0 0 1-1-.8zM8 8V6a4 4 0 0 1 8 0v2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  star: <path d="M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 17l-5.6 3 1.3-6.2L3 9.5l6.3-.7z" />,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M4 12l5 5L20 6" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  up: <path d="M12 19V6M6 12l6-6 6 6" />,
  down: <path d="M12 5v13M6 12l6 6 6-6" />,
  alert: (
    <>
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5M12 18v.5" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9 9.5h4.5a1.8 1.8 0 0 1 0 3.5H9.5" />
    </>
  ),
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />,
  logout: <path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" />,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  sword: <path d="M5 19L19 5M14 5h5v5M5 19l-2 2" />,
};
export function Ico({ n, size = 20, stroke = 1.8 }: { n: keyof typeof PATHS | string; size?: number; stroke?: number }) {
  return (
    <svg className="ca-ico" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[n] ?? PATHS.star}
    </svg>
  );
}

/* --------------------------- Кнопки, панели, мелочи ---------------------- */

export function Btn({
  children,
  kind = "ghost",
  size = "md",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: "primary" | "ghost" | "danger" | "gold"; size?: "sm" | "md" | "lg" }) {
  return (
    <button type="button" {...rest} className={`ca-btn ca-btn-${kind} ca-btn-${size} ${className}`}>
      <span className="ca-btn-in">{children}</span>
    </button>
  );
}

export function Panel({
  title,
  icon,
  aside,
  children,
  className = "",
  id,
}: {
  title?: ReactNode;
  icon?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`ca-panel ${className}`} id={id}>
      {(title || aside) && (
        <header className="ca-panel-h">
          <h2>
            {icon && <Ico n={icon} size={18} />}
            {title}
          </h2>
          {aside && <div className="ca-panel-aside">{aside}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function RoleBadge({ role }: { role: ClanRole }) {
  return <span className={`ca-role ca-role-${role}`}>{ROLE_NAME[role] ?? "Боец"}</span>;
}

export function Skeleton({ h = 120 }: { h?: number }) {
  return <div className="ca-skel" style={{ height: h }} aria-hidden />;
}

/** Цвет аватарки по нику */
export function hueOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const h = hueOf(name);
  return (
    <span
      className="ca-avatar"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(135deg,hsl(${h} 70% 58%),hsl(${(h + 50) % 360} 65% 30%))` }}
      aria-hidden
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}
