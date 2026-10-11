import Link from "next/link";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";

const DAY_MS = 86_400_000;

function card(label: string, value: string, hint?: string) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-sm text-white/50">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-white/35">{hint}</p> : null}
    </div>
  );
}

/**
 * Сбор данных вынесен из компонента намеренно: правило react-hooks/purity
 * запрещает читать `Date.now()` и ходить в базу в теле рендера. Для Server
 * Component это не вопрос корректности (он и так рендерится один раз на
 * запрос), но правило полезное: как только компонент однажды станет клиентским,
 * такое чтение действительно начнёт «прыгать» между рендерами.
 */
async function loadOverview() {
  const now = Date.now();
  const at = BigInt(now);
  const dayAgo = BigInt(now - DAY_MS);

  const [
    totalUsers,
    newUsers,
    admins,
    banned,
    activeSessions,
    openErrors,
    errorsLast24h,
    disabledFlags,
    recentAudit,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: dayAgo } } }),
    db.user.count({ where: { role: { in: ["admin", "moderator"] } } }),
    db.user.count({
      where: { OR: [{ status: "banned" }, { bannedUntil: { gt: at } }] },
    }),
    db.session.count({ where: { expiresAt: { gt: at } } }),
    db.errorLog.count({ where: { resolved: false } }),
    db.errorLog.count({ where: { lastSeenAt: { gte: dayAgo } } }),
    db.featureFlag.count({ where: { enabled: false } }),
    db.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { nickname: true } } },
    }),
  ]);

  return {
    totalUsers,
    newUsers,
    admins,
    banned,
    activeSessions,
    openErrors,
    errorsLast24h,
    disabledFlags,
    recentAudit,
  };
}

export default async function AdminHome() {
  const session = await requireAdmin("/admin");
  const stats = await loadOverview();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Обзор</h1>
        <p className="mt-1 text-sm text-white/50">
          Вы вошли как {session.user.nickname}. Здесь видно, что происходит с сайтом.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {card("Пользователей", String(stats.totalUsers), `+${stats.newUsers} за сутки`)}
        {card("Активных сессий", String(stats.activeSessions))}
        {card("Неразобранных ошибок", String(stats.openErrors), `${stats.errorsLast24h} за сутки`)}
        {card("Сотрудников", String(stats.admins), `${stats.banned} забанено`)}
      </div>

      {stats.openErrors > 0 ? (
        <Link
          href="/admin/errors"
          className="flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 transition hover:border-amber-500/50"
        >
          <span className="text-amber-200">
            {stats.openErrors} неразобранных ошибок в журнале
          </span>
          <span className="text-sm text-amber-300/70">открыть журнал →</span>
        </Link>
      ) : null}

      {stats.disabledFlags > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-white/60">
          Выключено флагов: {stats.disabledFlags}. Раздел «Настройки» ещё не сделан —
          менять флаги пока негде.
        </div>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-medium">Последние действия</h2>
        {stats.recentAudit.length === 0 ? (
          <p className="text-sm text-white/40">Журнал пуст.</p>
        ) : (
          <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.03]">
            {stats.recentAudit.map((entry) => (
              <li key={entry.id} className="flex items-baseline justify-between gap-4 px-5 py-3">
                <span className="min-w-0 truncate text-sm">
                  {entry.summary ?? entry.action}
                </span>
                <span className="shrink-0 text-xs text-white/35">
                  {entry.actor?.nickname ?? "система"} ·{" "}
                  {new Date(Number(entry.createdAt)).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}