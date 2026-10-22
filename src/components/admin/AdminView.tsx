"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

/**
 * Админ-панель AniGalaxy. Данные и действия — через `/api/admin`, который
 * сам проверяет роль: даже подменив страницу, чужой ничего не получит.
 */

type Tab = "stats" | "users" | "reports" | "chat";

interface Stats {
  users: number;
  newToday: number;
  newWeek: number;
  online: number;
  premium: number;
  banned: number;
  comments: number;
  chatMessages: number;
  openReports: number;
  rooms: number;
}
interface AdminUser {
  id: number;
  nickname: string;
  email: string;
  role: string;
  premiumUntil: number;
  bannedUntil: number;
  createdAt: number;
  lastSeenAt: number;
  level: number;
  xp: number;
}
interface Report {
  id: number;
  reporter: string;
  kind: string;
  targetId: string;
  reason: string;
  createdAt: number;
}
interface ChatRow {
  id: number;
  userId: number;
  nickname: string;
  body: string;
  createdAt: number;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "stats", label: "Обзор" },
  { id: "users", label: "Игроки" },
  { id: "reports", label: "Жалобы" },
  { id: "chat", label: "Чат" },
];

const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

async function api<T>(view: string, extra = ""): Promise<T | null> {
  try {
    const response = await fetch(`/api/admin?view=${view}${extra}`, { credentials: "same-origin", cache: "no-store" });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

async function act(body: Record<string, unknown>): Promise<string | null> {
  try {
    const response = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return data.ok ? null : (data.error ?? "Не удалось выполнить действие");
  } catch {
    return "Нет связи с сервером";
  }
}

const CARD = "rounded-2xl border border-white/10 bg-white/[0.03] p-4";
const BTN = "rounded-lg border border-white/12 bg-white/6 px-3 py-1.5 text-xs font-bold text-white/90 transition hover:border-accent/50 hover:bg-white/10 disabled:opacity-40";

function StatTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className={CARD}>
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 text-3xl font-black tabular-nums">{value.toLocaleString("ru-RU")}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

function StatsTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    let alive = true;
    void api<{ stats: Stats }>("stats").then((data) => alive && setStats(data?.stats ?? null));
    return () => {
      alive = false;
    };
  }, []);
  if (!stats) return <p className="text-muted">Загрузка…</p>;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label="Игроков всего" value={stats.users} hint={`+${stats.newToday} за сутки · +${stats.newWeek} за неделю`} />
      <StatTile label="Сейчас на сайте" value={stats.online} hint="активны последние 5 минут" />
      <StatTile label="С Premium" value={stats.premium} />
      <StatTile label="Заблокировано" value={stats.banned} />
      <StatTile label="Открытых жалоб" value={stats.openReports} />
      <StatTile label="Комментариев" value={stats.comments} />
      <StatTile label="Сообщений в чате" value={stats.chatMessages} />
      <StatTile label="Комнат просмотра" value={stats.rooms} />
    </div>
  );
}

function UsersTab() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const load = useCallback(async (q: string) => {
    const data = await api<{ users: AdminUser[] }>("users", `&q=${encodeURIComponent(q)}`);
    setUsers(data?.users ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(query), 250);
    return () => window.clearTimeout(timer);
  }, [query, load]);

  const run = async (body: Record<string, unknown>, okText: string) => {
    const error = await act(body);
    setNote(error ?? okText);
    if (!error) await load(query);
  };

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск по нику или почте"
        aria-label="Поиск игрока"
        className="w-full rounded-xl bg-white/6 px-4 py-3 text-sm ring-1 ring-white/10 focus:outline-none focus:ring-accent/60"
      />
      {note ? <p role="status" className="mt-3 text-sm text-accent-2">{note}</p> : null}
      <ul className="mt-4 space-y-3">
        {(users ?? []).map((u) => {
          const banned = u.bannedUntil > now;
          const premium = u.premiumUntil > now;
          return (
            <li key={u.id} className={CARD}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-extrabold">
                    <Link href={`/u/${encodeURIComponent(u.nickname)}`} className="hover:underline">{u.nickname}</Link>
                    {u.role !== "user" ? <span className="rounded-md bg-accent/20 px-1.5 py-0.5 text-[10px] font-black uppercase text-accent-2">{u.role}</span> : null}
                    {premium ? <span className="rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-black text-amber-300">PREMIUM</span> : null}
                    {banned ? <span className="rounded-md bg-red-500/20 px-1.5 py-0.5 text-[10px] font-black text-red-300">БАН</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted">{u.email}</p>
                </div>
                <p className="text-right text-xs text-muted">
                  Ур. {u.level} · {u.xp.toLocaleString("ru-RU")} XP
                  <br />
                  с {fmtDate(u.createdAt)} · был {fmtDate(u.lastSeenAt)}
                </p>
              </div>
              {u.role !== "admin" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {banned ? (
                    <button className={BTN} onClick={() => void run({ action: "ban", id: u.id, days: 0 }, `${u.nickname} разблокирован`)}>Разблокировать</button>
                  ) : (
                    <>
                      <button className={BTN} onClick={() => void run({ action: "ban", id: u.id, days: 1 }, `${u.nickname} заблокирован на сутки`)}>Бан на 1 день</button>
                      <button className={BTN} onClick={() => void run({ action: "ban", id: u.id, days: 3650 }, `${u.nickname} заблокирован навсегда`)}>Бан навсегда</button>
                    </>
                  )}
                  <button className={BTN} onClick={() => void run({ action: "premium", id: u.id, days: 30 }, `${u.nickname}: +30 дней Premium`)}>+30 дн. Premium</button>
                  {premium ? <button className={BTN} onClick={() => void run({ action: "premium", id: u.id, days: 0 }, `У ${u.nickname} снят Premium`)}>Снять Premium</button> : null}
                  <button
                    className={BTN}
                    onClick={() => void run({ action: "role", id: u.id, role: u.role === "moderator" ? "user" : "moderator" }, u.role === "moderator" ? "Модератор снят" : `${u.nickname} теперь модератор`)}
                  >
                    {u.role === "moderator" ? "Снять модератора" : "Сделать модератором"}
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
        {users && users.length === 0 ? <p className="text-muted">Никого не нашли</p> : null}
      </ul>
    </div>
  );
}

function ReportsTab() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const load = useCallback(async () => {
    const data = await api<{ reports: Report[] }>("reports");
    setReports(data?.reports ?? []);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (!reports) return <p className="text-muted">Загрузка…</p>;
  if (!reports.length) return <p className="text-muted">Открытых жалоб нет</p>;
  return (
    <ul className="space-y-3">
      {reports.map((r) => (
        <li key={r.id} className={CARD}>
          <p className="text-xs text-muted">
            {fmtDate(r.createdAt)} · от <b className="text-white">{r.reporter}</b> · {r.kind === "user" ? "на игрока" : r.kind}
          </p>
          <p className="mt-1 font-extrabold">
            {r.kind === "user" ? (
              <Link href={`/u/${encodeURIComponent(r.targetId)}`} className="hover:underline">{r.targetId}</Link>
            ) : (
              r.targetId
            )}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">{r.reason || "Без пояснения"}</p>
          <button
            className={`${BTN} mt-3`}
            onClick={() => void act({ action: "resolve", id: r.id }).then(() => load())}
          >
            Закрыть жалобу
          </button>
        </li>
      ))}
    </ul>
  );
}

function ChatTab() {
  const [rows, setRows] = useState<ChatRow[] | null>(null);
  const load = useCallback(async () => {
    const data = await api<{ messages: ChatRow[] }>("chat");
    setRows(data?.messages ?? []);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (!rows) return <p className="text-muted">Загрузка…</p>;
  return (
    <ul className="space-y-2">
      {rows.map((m) => (
        <li key={m.id} className={`${CARD} flex items-start justify-between gap-3 !p-3`}>
          <div className="min-w-0">
            <p className="text-xs text-muted">
              <b className="text-white">{m.nickname}</b> · {fmtDate(m.createdAt)}
            </p>
            <p className="mt-0.5 break-words text-sm text-white/85">{m.body}</p>
          </div>
          <button className={BTN} onClick={() => void act({ action: "deleteChat", id: m.id }).then(() => load())}>
            Удалить
          </button>
        </li>
      ))}
      {!rows.length ? <p className="text-muted">В чате пока пусто</p> : null}
    </ul>
  );
}

export function AdminView({ me }: { me: string }) {
  const [tab, setTab] = useState<Tab>("stats");
  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-8">
      <h1 className="text-3xl font-black tracking-tight">Админ-панель</h1>
      <p className="mt-1 text-sm text-muted">Вы вошли как {me}. Действия применяются сразу.</p>

      <div role="tablist" className="mt-6 flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              tab === t.id ? "bg-accent text-white shadow-[0_8px_24px_-10px_rgba(43,127,255,0.9)]" : "text-muted hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "stats" && <StatsTab />}
        {tab === "users" && <UsersTab />}
        {tab === "reports" && <ReportsTab />}
        {tab === "chat" && <ChatTab />}
      </div>
    </div>
  );
}
