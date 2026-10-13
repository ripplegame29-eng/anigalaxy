import Link from "next/link";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/require-admin";
import { getSiteConfig } from "@/lib/site-config";

import { ReportResolver } from "./report-resolver";

export const metadata = { title: "Модерация — панель AniGalaxy" };

const PAGE_SIZE = 30;

const REASON_LABELS: Record<string, string> = {
  spam: "Спам",
  abuse: "Оскорбления",
  adult: "Неприемлемый контент",
  wrong_info: "Неверная информация",
  other: "Другое",
};

const TARGET_LABELS: Record<string, string> = {
  comment: "Комментарий",
  chat: "Сообщение в чате",
  profile: "Профиль",
  title: "Тайтл",
};

async function loadReports(show: string) {
  const where = show === "all" ? {} : { status: "open" };

  const reports = await db.report.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    include: { author: { select: { nickname: true } }, resolvedBy: { select: { nickname: true } } },
  });

  // Сколько раз на каждую цель жаловались — всего, включая уже закрытые.
  // Именно это число сравнивается с порогом автоскрытия, поэтому группировка
  // идёт по всем жалобам, а не только по открытым.
  const grouped = await db.report.groupBy({
    by: ["targetId"],
    _count: { _all: true },
  });

  return {
    reports,
    counts: new Map(grouped.map((g) => [g.targetId, g._count._all])),
    openCount: await db.report.count({ where: { status: "open" } }),
  };
}

export default async function AdminModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  await requirePermission("moderation", "/admin/moderation");
  const { show } = await searchParams;
  const all = show === "all";
  const { autoHideThreshold } = await getSiteConfig();
  const { reports, counts, openCount } = await loadReports(show ?? "open");

  return (
    <div className="ag-section" style={{ gap: 28 }}>
      <div className="ag-head">
        <div>
          <h1 className="ag-h1">Модерация</h1>
          <p className="ag-sub">
            Неразобранных: <b style={{ color: "var(--ag-text)" }}>{openCount}</b>
          </p>
        </div>

        <div className="ag-seg">
          <Link href="/admin/moderation" className={all ? "" : "on"} style={{ display: "flex", alignItems: "center" }}>
            Неразобранные
          </Link>
          <Link href="/admin/moderation?show=all" className={all ? "on" : ""} style={{ display: "flex", alignItems: "center" }}>
            Все
          </Link>
        </div>
      </div>

      {/* Ограничение модерации стоит назвать прямо: жалобы можно разобрать,
          но наказать нечем — комментарии игроков лежат в их браузере, сервер
          их не видит. Иначе администратор будет искать в интерфейсе кнопку
          «забанить за спам», которой нет и не может быть без переноса. */}
      <div className="ag-box pad">
        <b style={{ fontSize: 14 }}>Что здесь можно и чего нельзя</b>
        <p className="ag-note" style={{ marginTop: 4 }}>
          Решение по жалобе фиксируется здесь, с пометкой «обоснованна» или
          «отклонена». Но санкцию применить не к чему: комментарии и сообщения
          хранятся в браузере игрока, сервер их не видит. Чтобы появились баны
          и скрытие комментариев, комментарии нужно перенести в базу — тогда
          заработает и кнопка «Забанить автора» в разделе «Пользователи».
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="ag-box">
          <div className="ag-empty">Жалоб нет.</div>
        </div>
      ) : (
        <ul className="ag-section" style={{ listStyle: "none", margin: 0, padding: 0, gap: 12 }}>
          {reports.map((report) => {
            const total = counts.get(report.targetId) ?? 0;
            const hot = total >= autoHideThreshold;

            return (
              <li
                key={report.id}
                className="ag-box pad"
                style={
                  report.status === "open"
                    ? undefined
                    : {
                        opacity: 0.72,
                        borderColor: hot ? "var(--ag-ambline)" : undefined,
                      }
                }
              >
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
                      <span className="ag-n">
                        {TARGET_LABELS[report.targetType] ?? report.targetType}
                      </span>
                      <span className="ag-n">
                        {REASON_LABELS[report.reason] ?? report.reason}
                      </span>
                      {hot ? (
                        <span className="ag-lvl">порог автоскрытия</span>
                      ) : null}
                      {report.status !== "open" ? (
                        <span
                          className="ag-lvl"
                          style={
                            report.status === "resolved"
                              ? { background: "var(--ag-okbg)", color: "var(--ag-grn)" }
                              : { background: "var(--ag-chipbg)", color: "var(--ag-mut)" }
                          }
                        >
                          {report.status === "resolved" ? "обоснованна" : "отклонена"}
                        </span>
                      ) : null}
                    </p>

                    <p style={{ marginTop: 8 }}>
                      <span className="ag-code">{report.targetId}</span>
                      <span className="ag-note" style={{ marginLeft: 8 }}>
                        жалоб на цель: {total} из {autoHideThreshold}
                      </span>
                    </p>

                    {report.details ? (
                      <p style={{ marginTop: 6 }}>{report.details}</p>
                    ) : null}

                    <p className="ag-note" style={{ marginTop: 8 }}>
                      {report.author?.nickname ?? "без аккаунта"} ·{" "}
                      {new Date(Number(report.createdAt)).toLocaleString("ru-RU")}
                      {report.resolvedBy ? ` · разобрал ${report.resolvedBy.nickname}` : ""}
                    </p>

                    {report.resolution ? (
                      <p className="ag-note" style={{ marginTop: 4 }}>
                        Решение: {report.resolution}
                      </p>
                    ) : null}
                  </div>

                  {report.status === "open" ? (
                    <ReportResolver reportId={report.id} />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}