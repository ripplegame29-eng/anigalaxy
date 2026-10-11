import Link from "next/link";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/require-admin";

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

  return {
    reports: await db.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      include: { author: { select: { nickname: true } }, resolvedBy: { select: { nickname: true } } },
    }),
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
  const { reports, openCount } = await loadReports(show ?? "open");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Модерация</h1>
          <p className="mt-1 text-sm text-white/50">
            Неразобранных: <span className="text-white">{openCount}</span>
          </p>
        </div>

        <div className="flex gap-2 text-sm">
          <Link
            href="/admin/moderation"
            className={
              show === "all"
                ? "rounded-lg border border-white/10 px-3 py-1.5 text-white/50"
                : "rounded-lg bg-white/10 px-3 py-1.5 text-white"
            }
          >
            Неразобранные
          </Link>
          <Link
            href="/admin/moderation?show=all"
            className={
              show === "all"
                ? "rounded-lg bg-white/10 px-3 py-1.5 text-white"
                : "rounded-lg border border-white/10 px-3 py-1.5 text-white/50"
            }
          >
            Все
          </Link>
        </div>
      </div>

      {reports.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-10 text-center text-white/40">
          Жалоб нет.
        </p>
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => (
            <li
              key={report.id}
              className={[
                "rounded-2xl border bg-white/[0.03] p-5",
                report.status === "open" ? "border-white/10" : "border-white/5 opacity-70",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70">
                      {TARGET_LABELS[report.targetType] ?? report.targetType}
                    </span>
                    <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70">
                      {REASON_LABELS[report.reason] ?? report.reason}
                    </span>
                    {report.status !== "open" ? (
                      <span
                        className={[
                          "rounded-md px-1.5 py-0.5 text-[10px]",
                          report.status === "resolved"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-white/10 text-white/50",
                        ].join(" ")}
                      >
                        {report.status === "resolved" ? "обоснованна" : "отклонена"}
                      </span>
                    ) : null}
                  </p>

                  <p className="mt-2 font-mono text-xs text-white/50">
                    {report.targetId}
                  </p>

                  {report.details ? (
                    <p className="mt-1 text-sm text-white/70">{report.details}</p>
                  ) : null}

                  <p className="mt-2 text-xs text-white/35">
                    {report.author?.nickname ?? "без аккаунта"} ·{" "}
                    {new Date(Number(report.createdAt)).toLocaleString("ru-RU")}
                    {report.resolvedBy ? ` · разобрал ${report.resolvedBy.nickname}` : ""}
                  </p>

                  {report.resolution ? (
                    <p className="mt-1 text-xs text-white/45">
                      Решение: {report.resolution}
                    </p>
                  ) : null}
                </div>

                {report.status === "open" ? (
                  <ReportResolver reportId={report.id} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}