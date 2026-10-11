import Link from "next/link";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/require-admin";

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Пользователи</h1>
          <p className="mt-1 text-sm text-white/50">
            Всего {total}. Показаны {users.length}.
          </p>
        </div>

        <form className="flex gap-2" method="get">
          <input
            name="q"
            defaultValue={query}
            placeholder="Ник или почта"
            className="w-56 rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm outline-none focus:border-[#1f7bff]"
          />
          <button
            type="submit"
            className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white/80 transition hover:bg-white/15"
          >
            Найти
          </button>
          {query ? (
            <Link
              href="/admin/users"
              className="rounded-xl px-3 py-2 text-sm text-white/40 hover:text-white/70"
            >
              Сбросить
            </Link>
          ) : null}
        </form>
      </div>

      {users.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-8 text-center text-white/40">
          Никого не нашлось.
        </p>
      ) : (
        <ul className="space-y-3">
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
              <li
                key={user.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{user.nickname}</span>
                      {self ? (
                        <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
                          это вы
                        </span>
                      ) : null}
                      <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
                        {user.role}
                      </span>
                      {banned ? (
                        <span className="rounded-md bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300">
                          бан
                        </span>
                      ) : null}
                      {premiumLeft > 0 ? (
                        <span className="rounded-md bg-[#1f7bff]/20 px-1.5 py-0.5 text-[10px] text-[#7db4ff]">
                          Premium {premiumLeft} дн.
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-sm text-white/45">{user.email}</p>
                    <p className="mt-1 text-xs text-white/30">
                      Регистрация {formatDate(Number(user.createdAt))} · активен{" "}
                      {formatDate(user.lastSeenAt === null ? null : Number(user.lastSeenAt))}
                    </p>
                    {user.banReason && banned ? (
                      <p className="mt-2 text-xs text-red-300/80">
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
        <nav className="flex items-center justify-center gap-2 text-sm">
          {currentPage > 1 ? (
            <Link
              href={`/admin/users?page=${currentPage - 1}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-white/60 hover:text-white"
            >
              ← Назад
            </Link>
          ) : null}
          <span className="text-white/40">
            {currentPage} из {pages}
          </span>
          {currentPage < pages ? (
            <Link
              href={`/admin/users?page=${currentPage + 1}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-white/60 hover:text-white"
            >
              Вперёд →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}