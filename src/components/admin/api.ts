/** Запросы админ-панели к `/api/admin` и общие форматтеры */

export async function adminGet<T>(view: string, params: Record<string, string | number> = {}): Promise<T | null> {
  const qs = new URLSearchParams({ view, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  try {
    const response = await fetch(`/api/admin?${qs}`, { credentials: "same-origin", cache: "no-store" });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

export interface ActResult {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

export async function adminPost(body: Record<string, unknown>): Promise<ActResult> {
  try {
    const response = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as ActResult;
    return data.ok ? data : { ...data, ok: false, error: data.error ?? "Не удалось выполнить действие" };
  } catch {
    return { ok: false, error: "Нет связи с сервером" };
  }
}

export const fmtNum = (n: number) => Math.round(n).toLocaleString("ru-RU");

export const fmtDate = (ms: number) =>
  ms ? new Date(ms).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export function ago(ms: number, now: number): string {
  if (!ms) return "никогда";
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return "только что";
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} дн назад`;
  return fmtDate(ms);
}

export function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d ? `${d} д ${h} ч` : h ? `${h} ч ${m} мин` : `${m} мин`;
}
