import Link from "next/link";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/require-admin";
import { isRole, ROLE_LABELS } from "@/lib/roles";

import { UserRowActions } from "./user-row-actions";

export const metadata = { title: "Пользователи — панель AniGalaxy" };

const PAGE_SIZE = 25;

function formatDate(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Запрос и текущее время — вне компонента: правило react-hooks/purity
 * запрещает impure-вызовы в теле рендера (см. комментарий в admin/page.tsx).
 */
async function loadUsers(query: string, currentPage: number) {
  const now = Date.now();

  const where = query
    ? {
        OR: [
          { nickname: { contains: query } },
          { email: { contains: query } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        nickname: true,
        email: true,
        role: true,
        status: true,
        premiumUntil: true,
        bannedUntil: true,
        banReason: true,
        createdAt: true,
        lastSeenAt: true,
      },
    }),
    db.user.count({ where }),
  ]);

  return { users, total, now };
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const session = await requirePermission("users", "/admin/users");
  const { q, page } = await searchParams;

  const query = (q ?? "").trim();
  const currentPage = Math.max(1, Number(page) || 1);

  const { users, total, now } = await loadUsers(query, currentPage);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (n: number) =>
    `/admin/users?page=${n}${query ? `&q=${encodeURIComponent(query)}` : ""}`;

  return (
    <div className="ag-section" style={{ gap: 28 }}>
      <div className="ag-head">
        <div>
          <h1 className="ag-h1">Пользователи</h1>
          <p className="ag-sub">
            Всего {total}. Показаны {users.length}.
            {query ? ` Поиск: «${query}»` : ""}
          </p>
        </div>

        <form className="ag-form" method="get">
          <input
            name="q"
            defaultValue={query}
            placeholder="Ник или почта"
            aria-label="Поиск по нику или почте"
            className="ag-input"
            style={{ width: 260 }}
          />
          <button type="submit" className="ag-btn pri">
            Найти
          </button>
          {query ? (
            <Link href="/admin/users" className="ag-btn link sm">
              Сбросить
            </Link>
          ) : null}
        </form>
      </div>

      {users.length === 0 ? (
        <div className="ag-box">
          <div className="ag-empty">Никого не нашлось.</div>
        </div>
      ) : (
        <ul className="ag-section" style={{ listStyle: "none", margin: 0, padding: 0, gap: 12 }}>
          {users.map((user) => {
            const banned =
              user.status === "banned" &&
              (user.bannedUntil === null || Number(user.bannedUntil) > now);
            const self = user.id === session.user.id;
            const premiumLeft =
              Number(user.premiumUntil) > now
                ? Math.ceil((Number(user.premiumUntil) - now) / 86_400_000)
                : 0;

            return (
              <li className="ag-box pad" key={user.id}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 16,
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      <b style={{ fontSize: 15 }}>{user.nickname}</b>
                      {self ? <span className="ag-n">это вы</span> : null}
                      <span className="ag-n">
                        {isRole(user.role) ? ROLE_LABELS[user.role] : user.role}
                      </span>
                      {banned ? (
                        <span className="ag-lvl" style={{ background: "var(--ag-crbg)", color: "var(--ag-red)" }}>
                          бан
                        </span>
                      ) : null}
                      {premiumLeft > 0 ? (
                        <span className="ag-lvl" style={{ background: "var(--ag-accbg)", color: "var(--ag-acc)" }}>
                          Premium {premiumLeft} дн.
                        </span>
                      ) : null}
                    </p>

                    <p className="ag-note" style={{ marginTop: 4 }}>
                      {user.email}
                    </p>
                    <p className="ag-note" style={{ marginTop: 2 }}>
                      Регистрация {formatDate(Number(user.createdAt))} · активен{" "}
                      {formatDate(user.lastSeenAt === null ? null : Number(user.lastSeenAt))}
                    </p>

                    {user.banReason && banned ? (
                      <p className="ag-bad" style={{ marginTop: 8 }}>
                        Причина: {user.banReason}
                        {user.bannedUntil
                          ? ` · до ${formatDate(Number(user.bannedUntil))}`
                          : " · навсегда"}
                      </p>
                    ) : null}
                  </div>

                  <UserRowActions
                    userId={user.id}
                    isBanned={banned}
                    currentRole={user.role}
                    isSelf={self}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 ? (
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            fontSize: 14,
          }}
          aria-label="Страницы списка"
        >
          {currentPage > 1 ? (
            <Link href={pageHref(currentPage - 1)} className="ag-btn sm">
              ← Назад
            </Link>
          ) : null}
          <span className="ag-note">
            {currentPage} из {pages}
          </span>
          {currentPage < pages ? (
            <Link href={pageHref(currentPage + 1)} className="ag-btn sm">
              Вперёд →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}