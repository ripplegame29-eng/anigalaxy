import Link from "next/link";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/require-admin";

export const metadata = { title: "Журнал ошибок — панель AniGalaxy" };

const PAGE_SIZE = 40;

/** Цвет плашки по уровню — тот же язык, что в консоли разработчика. */
const LEVEL_TONE: Record<string, string> = {
  error: "bg-red-500/20 text-red-300",
  warn: "bg-amber-500/20 text-amber-300",
  info: "bg-sky-500/20 text-sky-300",
};

const SOURCE_LABELS: Record<string, string> = {
  kodik: "Kodik",
  shikimori: "Shikimori",
  mangadex: "MangaDex",
  anilibria: "AniLibria",
  parser: "Парсеры",
  client: "Клиент",
  auth: "Авторизация",
  admin: "Админка",
  db: "База данных",
  job: "Задачи",
};

export default async function AdminErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; source?: string }>;
}) {
  await requirePermission("settings", "/admin/errors");
  const { show, source } = await searchParams;

  // По умолчанию показываем неразобранные: закрытые — архив, за ними
  // не нужно ходить каждый день.
  const onlyOpen = show !== "all";
  const where = {
    ...(onlyOpen ? { resolved: false } : {}),
    ...(source ? { source } : {}),
  };

  const [errors, openCount] = await Promise.all([
    db.errorLog.findMany({
      where,
      orderBy: { lastSeenAt: "desc" },
      take: PAGE_SIZE,
    }),
    db.errorLog.count({ where: { resolved: false } }),
  ]);

  async function toggleResolved(formData: FormData) {
    "use server";
    const session = await requirePermission("settings", "/admin/errors");
    const id = String(formData.get("id") ?? "");
    if (!/^[a-z0-9]{20,30}$/i.test(id)) return;

    const entry = await db.errorLog.findUnique({ where: { id } });
    if (!entry) return;

    await db.errorLog.update({
      where: { id },
      data: {
        resolved: !entry.resolved,
        resolvedById: session.user.id,
        // lastSeenAt — время последнего повтора, а не время закрытия,
        // поэтому после закрытия остаётся видно, как долго ошибка жила.
        lastSeenAt: Date.now(),
      },
    });

    revalidatePath("/admin/errors");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Журнал ошибок</h1>
          <p className="mt-1 text-sm text-white/50">
            Неразобранных: <span className="text-white">{openCount}</span>. Одинаковые
            ошибки схлопываются в одну строку со счётчиком.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/admin/errors"
            className={
              onlyOpen
                ? "rounded-lg bg-white/10 px-3 py-1.5 text-white"
                : "rounded-lg border border-white/10 px-3 py-1.5 text-white/50"
            }
          >
            Неразобранные
          </Link>
          <Link
            href="/admin/errors?show=all"
            className={
              !onlyOpen
                ? "rounded-lg bg-white/10 px-3 py-1.5 text-white"
                : "rounded-lg border border-white/10 px-3 py-1.5 text-white/50"
            }
          >
            Все
          </Link>
        </div>
      </div>

      {errors.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-10 text-center text-white/40">
          {onlyOpen
            ? "Неразобранных ошибок нет. Или ни одна внешняя ругалка ещё не ловилась."
            : "Журнал пуст."}
        </p>
      ) : (
        <ul className="space-y-3">
          {errors.map((entry) => (
            <li
              key={entry.id}
              className={[
                "rounded-2xl border bg-white/[0.03] p-5",
                entry.resolved
                  ? "border-white/5 opacity-60"
                  : "border-white/10",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] ${LEVEL_TONE[entry.level] ?? LEVEL_TONE.error}`}
                    >
                      {entry.level}
                    </span>
                    <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
                      {SOURCE_LABELS[entry.source] ?? entry.source}
                    </span>
                    {entry.operation ? (
                      <code className="text-xs text-white/50">{entry.operation}</code>
                    ) : null}
                    {entry.count > 1 ? (
                      <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70">
                        ×{entry.count}
                      </span>
                    ) : null}
                  </p>

                  <p className="mt-2 font-mono text-sm text-white/90">{entry.message}</p>

                  <p className="mt-1 text-xs text-white/35">
                    впервые {new Date(Number(entry.firstSeenAt)).toLocaleString("ru-RU")} ·
                    повтор {new Date(Number(entry.lastSeenAt)).toLocaleString("ru-RU")}
                  </p>

                  {entry.context ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-white/40 hover:text-white/70">
                        Контекст
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/60">
                        {safeJson(entry.context)}
                      </pre>
                    </details>
                  ) : null}

                  {entry.stack ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-white/40 hover:text-white/70">
                        Стек
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/50">
                        {entry.stack.slice(0, 2000)}
                      </pre>
                    </details>
                  ) : null}
                </div>

                <form action={toggleResolved}>
                  <input type="hidden" name="id" value={entry.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/70 transition hover:border-white/35"
                  >
                    {entry.resolved ? "Вернуть в работу" : "Пометить решённой"}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Контекст мог остаться битым после ручной правки БД — не роняем из-за него страницу. */
function safeJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}