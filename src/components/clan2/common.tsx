"use client";

import { useState, useSyncExternalStore, type CSSProperties } from "react";
import { ROLES, type Role } from "@/lib/clan2/data";
import type { Clan2, Result } from "@/lib/clan2/store";

/* Время для рендера: Date.now() нельзя звать в компоненте, поэтому
   «сейчас» хранится во внешнем сторе и обновляется таймером. */
let nowValue = 0;
const nowListeners = new Set<() => void>();
let nowTimer: number | undefined;
function subscribeNow(cb: () => void): () => void {
  nowListeners.add(cb);
  if (nowTimer === undefined) {
    nowValue = Date.now();
    nowTimer = window.setInterval(() => {
      nowValue = Date.now();
      nowListeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    nowListeners.delete(cb);
    if (nowListeners.size === 0 && nowTimer !== undefined) {
      window.clearInterval(nowTimer);
      nowTimer = undefined;
    }
  };
}
export function useNow(): number {
  return useSyncExternalStore(subscribeNow, () => nowValue || (nowValue = Date.now()), () => 0);
}

export const num = (n: number): string => Math.round(n).toLocaleString("ru-RU");

export function plural(n: number, one: string, few: string, many: string): string {
  const m = Math.abs(n) % 100;
  const d = m % 10;
  if (m > 10 && m < 20) return many;
  if (d > 1 && d < 5) return few;
  return d === 1 ? one : many;
}

export function timeLeft(ms: number): string {
  if (ms <= 0) return "сейчас";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d > 0 ? `${d} д ${h} ч` : h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}

/** Сообщение-результат действия, исчезает само */
export function useNote(): [string, (r: Result, okText?: string) => void] {
  const [note, setNote] = useState("");
  const say = (r: Result, okText?: string) => {
    setNote(r.ok ? (okText ?? "Готово") : (r.reason ?? "Не получилось"));
    window.setTimeout(() => setNote(""), 3200);
  };
  return [note, say];
}

export function Emblem({ clan, size = 64 }: { clan: Pick<Clan2, "emblem" | "color">; size?: number }) {
  return (
    <span
      className="c2-emblem"
      style={{ width: size, height: size, fontSize: size * 0.5, ["--c" as string]: clan.color } as CSSProperties}
      aria-hidden
    >
      {clan.emblem}
    </span>
  );
}

export function RoleChip({ role }: { role: Role }) {
  const r = ROLES[role];
  return (
    <span className="c2-role" style={{ ["--rc" as string]: r.color } as CSSProperties} title={r.perk}>
      {r.glyph} {r.name}
    </span>
  );
}

export function Bar({ pct, color, label }: { pct: number; color?: string; label?: string }) {
  return (
    <div className="c2-bar" style={color ? ({ ["--bc" as string]: color } as CSSProperties) : undefined} role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <i style={{ width: `${Math.max(0, Math.min(100, pct * 100))}%` }} />
    </div>
  );
}
