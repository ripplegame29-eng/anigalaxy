import { Manrope } from "next/font/google";
import type { Metadata } from "next";
import Link from "next/link";

import "./admin.css";

import { logoutAction } from "@/app/login/actions";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { ROLE_LABELS, can } from "@/lib/roles";

import { ADMIN_BG } from "./admin-bg";
import { AdminNav } from "./admin-nav";
import { ADMIN_SECTIONS } from "./sections";
import { ADMIN_THEME_SCRIPT, ThemeToggle } from "./theme-toggle";
import { ToastProvider } from "./toast";
import { TopSearch } from "./top-search";

/**
 * Шрифт панели — отдельный от сайта: у сайта свои акцидентные гарнитуры,
 * в плотной таблице админки они читаются хуже, чем нейтральный гротеск.
 */
const adminFont = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-ag-admin",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Панель управления AniGalaxy",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Проверка входа и прав — здесь, в layout'е, а не в каждой странице:
  // все разделы под /admin защищены по умолчанию, и новая страница не может
  // оказаться открытой просто потому, что про неё забыли.
  const session = await requireAdmin();

  const visible = ADMIN_SECTIONS.filter((section) =>
    can(session.user.role, section.permission),
  );

  // Счётчик непрочитанных ошибок — в меню и на плитке обзора. Один запрос:
  // панель открывается редко, лишнее обращение к базе заметно на медленной.
  const openErrors = await db.errorLog
    .count({ where: { resolved: false } })
    .catch(() => 0);

  const name = session.user.displayName ?? session.user.nickname;
  const initial = (session.user.displayName ?? session.user.nickname)
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <div className={`ag-app ${adminFont.variable}`}>
      {/* Тема ставится до первой отрисовки — иначе при перезагрузке на
          тёмной теме панель мигнёт светлой.

          Именно обычный инлайновый <script>, а не next/script с
          beforeInteractive: тот по требованию Next живёт только в корневом
          layout, а панель — вложенная. Скрипт без async React не выносит в
          head, он выполняется на месте — то есть раньше, чем отрисуется
          разметка под ним. */}
      <script dangerouslySetInnerHTML={{ __html: ADMIN_THEME_SCRIPT }} />

      {/* Фоновая графика из макета: лучи и зерно. Декорация без событий,
          pointer-events отключены в .ag-bg. */}
      <div className="ag-bg" aria-hidden="true">
        <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
          {/* Содержимое статичное и из репозитория — не пользовательский ввод. */}
          <g dangerouslySetInnerHTML={{ __html: ADMIN_BG }} />
        </svg>
      </div>

      <aside className="ag-side">
        <Link href="/admin" className="ag-logo">
          <svg className="ag-mark" viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="16" r="6" />
            <ellipse
              cx="16"
              cy="16"
              rx="14"
              ry="5"
              fill="none"
              strokeWidth="2"
            />
          </svg>
          Ani<b>Galaxy</b>
          <small>Панель управления</small>
        </Link>

        <AdminNav
          sections={visible}
          badges={{ "/admin/errors": openErrors }}
        />

        <div className="ag-me">
          <div>
            <span className="ag-av" aria-hidden="true">
              {initial}
            </span>
            <span style={{ minWidth: 0 }}>
              <b title={name}>{name}</b>
              <small>{ROLE_LABELS[session.user.role]}</small>
            </span>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="ag-btn" style={{ width: "100%" }}>
              Выйти
            </button>
          </form>
        </div>
      </aside>

      <main className="ag-main">
        <div className="ag-top">
          <TopSearch sections={visible} />
          <Link href="/" target="_blank" rel="noreferrer">
            Открыть сайт
          </Link>
          <ThemeToggle />
        </div>

        <ToastProvider>{children}</ToastProvider>
      </main>
    </div>
  );
}