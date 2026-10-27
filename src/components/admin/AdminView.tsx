"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import "./admin.css";
import { Analytics } from "./Analytics";
import "./an.css";
import { Dashboard } from "./Dashboard";
import { ErrorsTab, LogTab } from "./Diagnostics";
import { Moderation } from "./Moderation";
import { Tickets } from "./Tickets";
import { Rewards } from "./Rewards";
import { UserEditor } from "./UserEditor";
import { UsersTab } from "./UsersTab";
import { UiProvider } from "./ui";

/**
 * Админ-панель AniGalaxy. Данные и действия — через `/api/admin`, который
 * сам проверяет роль: даже подменив страницу, чужой ничего не получит.
 */

type Tab = "dashboard" | "analytics" | "users" | "rewards" | "moderation" | "tickets" | "errors" | "log";

const P = {
  dashboard: "M4 13h6V4H4zM14 20h6V11h-6zM14 9h6V4h-6zM4 20h6v-5H4z",
  analytics: "M4 20V10M10 20V4M16 20v-8M22 20H2M4 6l6-2 6 6 5-4",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-3.5 3-6 7-6s7 2.5 7 6M17 4a3.5 3.5 0 0 1 0 7M19 15c2 .7 3 2.4 3 5",
  rewards: "M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8c-3 0-5-4-2-4 2 0 2 4 2 4zM12 8c3 0 5-4 2-4-2 0-2 4-2 4z",
  moderation: "M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6zM9 12l2.2 2.2L15.5 10",
  tickets: "M4 6h16v10H8l-4 4zM8 10h8M8 13h5",
  errors: "M12 3 2 20h20zM12 10v4M12 17h.01",
  log: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5",
};

const TABS: { id: Tab; label: string; sub: string }[] = [
  { id: "dashboard", label: "Обзор", sub: "Сводка, графики и состояние сервера" },
  { id: "analytics", label: "Аналитика", sub: "Рост сайта: регистрации, активность, популярные тайтлы" },
  { id: "users", label: "Игроки", sub: "Поиск, профили, валюты, предметы, доступ" },
  { id: "rewards", label: "Награды", sub: "Массовые выдачи и рассылки" },
  { id: "moderation", label: "Модерация", sub: "Жалобы, чат, комментарии, комнаты" },
  { id: "tickets", label: "Поддержка", sub: "Обращения игроков и ответы" },
  { id: "errors", label: "Ошибки", sub: "Сбои сервера и браузеров игроков" },
  { id: "log", label: "Журнал", sub: "Кто и что менял в админ-панели" },
];

function NavIcon({ id }: { id: Tab }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={P[id]} />
    </svg>
  );
}

export function AdminView({ me }: { me: string }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [editId, setEditId] = useState<number | null>(null);
  const [refresh, setRefresh] = useState(0);
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];

  const go = useCallback((next: string) => setTab(next as Tab), []);
  const openUser = useCallback((id: number) => setEditId(id), []);

  return (
    <UiProvider>
      <style>{`
        header.hd, footer, .mnv-bar, .mnv-sheet,
        [aria-label^="Открыть общий чат"], [aria-label="Общий чат"], [aria-label^="Кланы"] { display: none !important; }
        body { padding-bottom: 0 !important; }
      `}</style>
      <div className="adm-root">
        <div className="adm-aurora" aria-hidden />
        <aside className="adm-side">
          <Link href="/" className="adm-brand" aria-label="На сайт">
            <span className="adm-brand-mark" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z" />
                <path d="m9 12 2.2 2.2L15.5 10" />
              </svg>
            </span>
            <span>
              <b>AniGalaxy</b>
              <small>Админ-панель</small>
            </span>
          </Link>
          <nav className="adm-nav" aria-label="Разделы админ-панели">
            {TABS.map((t) => (
              <button key={t.id} type="button" className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined}>
                <NavIcon id={t.id} />
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
          <div className="adm-side-foot">
            <span>Вы вошли как</span>
            <b>{me}</b>
            <Link href="/" className="adm-btn adm-btn-sm">
              ← На сайт
            </Link>
          </div>
        </aside>

        <main className="adm-main">
          <header className="adm-head">
            <div>
              <h1>{current.label}</h1>
              <p>{current.sub}</p>
            </div>
          </header>
          <div className="adm-view" key={tab}>
            {tab === "dashboard" ? <Dashboard go={go} openUser={openUser} /> : null}
            {tab === "analytics" ? <Analytics /> : null}
            {tab === "users" ? <UsersTab onOpen={openUser} refreshKey={refresh} /> : null}
            {tab === "rewards" ? <Rewards /> : null}
            {tab === "moderation" ? <Moderation openUser={openUser} /> : null}
            {tab === "tickets" ? <Tickets openUser={openUser} /> : null}
            {tab === "errors" ? <ErrorsTab openUser={openUser} /> : null}
            {tab === "log" ? <LogTab openUser={openUser} /> : null}
          </div>
        </main>

        {editId !== null ? <UserEditor key={editId} id={editId} me={me} onClose={() => setEditId(null)} onChanged={() => setRefresh((n) => n + 1)} /> : null}
      </div>
    </UiProvider>
  );
}
