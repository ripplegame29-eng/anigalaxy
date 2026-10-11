import Link from "next/link";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { ROLE_LABELS } from "@/lib/roles";

import { AuditFeed, type AuditEntry } from "./audit-feed";
import { HeroProgress } from "./hero-progress";

const DAY_MS = 86_400_000;
/** Дней в графике обзора. Три недели — достаточно, чтобы заметить рост сбоев. */
const CHART_DAYS = 21;
/** Сколько строк ленты грузим с сервера: с запасом против SHOWN в AuditFeed. */
const AUDIT_TAKE = 50;

function kpi(label: string, value: string, hint?: string, tone?: "warn" | "up") {
  return (
    <div className={`ag-kpi${tone ? ` ${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <em>{hint}</em> : null}
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
    totalErrors,
    disabledFlags,
    recentAudit,
    series,
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
    db.errorLog.count(),
    db.featureFlag.count({ where: { enabled: false } }),
    db.auditLog.findMany({
      take: AUDIT_TAKE,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { nickname: true } } },
    }),
    // Ряд по дням для графика. Забираем все записи за период и раскладываем
    // по суткам в памяти: в SQLite агрегат по доле секунды не выразить без
    // UDF, а записей за три недели здесь единицы, не тысячи.
    db.errorLog.findMany({
      where: { lastSeenAt: { gte: BigInt(now - CHART_DAYS * DAY_MS) } },
      select: { lastSeenAt: true },
    }),
  ]);

  // Дни считаем назад от сегодняшнего, а не от первого дня выборки: иначе если
  // в старый день сбоев не было, график сдвигается и «вчера» окажется справа
  // не у последней точки.
  const days: number[] = new Array(CHART_DAYS).fill(0);
  const startOfToday = now - (now % DAY_MS);

  for (const row of series) {
    const day = Math.floor((Number(row.lastSeenAt) - startOfToday) / DAY_MS);
    // day <= 0 — сегодня; day < 0 — вчера (смещение минус один день).
    const index = day >= 0 ? day : CHART_DAYS - 1 + day;
    if (index >= 0 && index < CHART_DAYS) days[index] += 1;
  }

  return {
    totalUsers,
    newUsers,
    admins,
    banned,
    activeSessions,
    openErrors,
    errorsLast24h,
    totalErrors,
    disabledFlags,
    recentAudit,
    series: days,
  };
}

export default async function AdminHome() {
  const session = await requireAdmin("/admin");
  const stats = await loadOverview();

  const auditEntries: AuditEntry[] = stats.recentAudit.map((entry) => ({
    id: entry.id,
    summary: entry.summary,
    action: entry.action,
    actor: entry.actor?.nickname ?? "система",
    when: new Date(Number(entry.createdAt)).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  const donePercent =
    stats.totalErrors === 0 ? 100 : ((stats.totalErrors - stats.openErrors) / stats.totalErrors) * 100;

  const name = session.user.displayName ?? session.user.nickname;
  const clean = stats.openErrors === 0;

  return (
    <div className="ag-section" style={{ gap: 28 }}>
      {/* --------------------------------- Hero ---------------------------- */}
      <section className="ag-hero">
        <div className="ag-hl">
          <span className="ag-pill">
            Рабочая смена <i>{ROLE_LABELS[session.user.role]}</i> {name}
          </span>

          <h1 className="ag-ht">
            {clean ? (
              <>
                Спокойный <span className="ag-u">сайт</span> — и это проверено
              </>
            ) : (
              <>
                <span className="ag-u">{stats.openErrors}</span> неразобранных
                ошибок в журнале
              </>
            )}
          </h1>

          <p>
            {clean
              ? "Журнал пуст: последние сбои разобраны, парсеры отвечают, страницы отдаются. Загляните в «Настройки», если нужно временно снять сломанную механику."
              : "Ошибки сгруппированы по отпечатку — одинаковые сбои не засоряют список. Разберите их по одной, и они перестанут попадать в KPI."}
          </p>

          <HeroProgress
            series={stats.series}
            done={donePercent}
            label="ошибок разобрано"
            caption={`${stats.errorsLast24h} за последние сутки`}
          />
        </div>

        <div className="ag-hr">
          <span className="ag-note" style={{ fontWeight: 600 }}>Быстрые действия</span>
          <Link className="ag-qa" href="/admin/errors">
            <span>
              {clean
                ? "Проверить журнал ошибок"
                : `Разобрать ошибки — ${stats.openErrors}`}
            </span>
            <span aria-hidden="true">→</span>
          </Link>
          <Link className="ag-qa" href="/admin/content">
            <span>Выложить новый блок на главной</span>
            <span aria-hidden="true">→</span>
          </Link>
          <Link className="ag-qa" href="/admin/economy">
            <span>Выдать промокод или подкрутить прогресс</span>
            <span aria-hidden="true">→</span>
          </Link>
          <Link className="ag-qa" href="/admin/settings">
            <span>
              {stats.disabledFlags
                ? `Вернуть выключенные механики — ${stats.disabledFlags}`
                : "Выключить сломанную механику"}
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {/* --------------------------------- KPI ----------------------------- */}
      <div className="ag-kpis">
        {kpi(
          "Пользователей",
          String(stats.totalUsers),
          `+${stats.newUsers} за сутки`,
          "up",
        )}
        {kpi("Активных сессий", String(stats.activeSessions), "сейчас в системе")}
        {kpi(
          "Неразобранных ошибок",
          String(stats.openErrors),
          `${stats.errorsLast24h} за сутки`,
          stats.openErrors ? "warn" : undefined,
        )}
        {kpi(
          "Сотрудников",
          String(stats.admins),
          `${stats.banned} забанено`,
          stats.banned ? "warn" : undefined,
        )}
      </div>

      {/* --------------------------- Действия ----------------------------- */}
      <div className="ag-cols">
        <section className="ag-section" style={{ flex: "2 1 460px" }}>
          <h2 className="ag-h2">Последние действия администраторов</h2>
          <AuditFeed entries={auditEntries} />
        </section>

        <section className="ag-section" style={{ flex: "1 1 280px" }}>
          <h2 className="ag-h2">Что проверить, если что-то сломалось</h2>
          <ol className="ag-section" style={{ listStyle: "none", margin: 0, padding: 0, gap: 8 }}>
            <li className="ag-qa" style={{ cursor: "default" }}>
              <span>Каталог и карточки тайтлов — часто отваливается прокси картинок</span>
            </li>
            <li className="ag-qa" style={{ cursor: "default" }}>
              <span>Страница тайтла — медленнее всего, тут же виден источник</span>
            </li>
            <li className="ag-qa" style={{ cursor: "default" }}>
              <span>Раздел контента — последнее, что менялось</span>
            </li>
            <li className="ag-qa" style={{ cursor: "default" }}>
              <span>Вход и зеркало прогресса — ломаются вместе с сессиями</span>
            </li>
          </ol>
        </section>
      </div>
    </div>
  );
}