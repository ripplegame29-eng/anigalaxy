import Link from "next/link";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/require-admin";

import { ErrorFeed, type ErrorRow } from "./error-feed";

export const metadata = { title: "Журнал ошибок — панель AniGalaxy" };

const PAGE_SIZE = 40;

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

/** Чипы-фильтры из макета. `where` собирается сервером, а не в браузере. */
const FILTERS = {
  all: { label: "Все", level: null, unresolved: false },
  crit: { label: "Критичные", level: "error", unresolved: false },
  warn: { label: "Внимание", level: "warn", unresolved: false },
  unread: { label: "Непрочитанные", level: null, unresolved: true },
} as const;

type FilterKey = keyof typeof FILTERS;

/** Контекст мог остаться битым после ручной правки БД — не роняем из-за него страницу. */
function safeJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function when(ms: bigint | number | null): string {
  if (ms === null) return "—";
  return new Date(Number(ms)).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; source?: string }>;
}) {
  await requirePermission("settings", "/admin/errors");
  const { f, source } = await searchParams;

  const key = ((f && f in FILTERS ? f : "unread") as FilterKey) || "unread";
  const filter = FILTERS[key];

  const where = {
    ...(filter.unresolved ? { resolved: false } : {}),
    ...(filter.level ? { level: filter.level } : {}),
    ...(source ? { source } : {}),
  };

  const [entries, counts, sources] = await Promise.all([
    db.errorLog.findMany({
      where,
      orderBy: { lastSeenAt: "desc" },
      take: PAGE_SIZE,
    }),
    // Счётчики для чипов считаются по всем уровням разом: четыре отдельных
    // count-запроса дали бы тот же результат дороже вчетверо.
    db.errorLog.groupBy({ by: ["level", "resolved"], _count: { _all: true } }),
    db.errorLog.groupBy({ by: ["source"], _count: { _all: true } }),
  ]);

  const tally = { all: 0, crit: 0, warn: 0, unread: 0 };
  for (const row of counts) {
    const n = row._count._all;
    tally.all += n;
    if (row.level === "error") tally.crit += n;
    if (row.level === "warn") tally.warn += n;
    if (!row.resolved) tally.unread += n;
  }

  const rows: ErrorRow[] = entries.map((entry) => ({
    id: entry.id,
    level: entry.level,
    source: entry.source,
    sourceLabel: SOURCE_LABELS[entry.source] ?? entry.source,
    operation: entry.operation,
    message: entry.message,
    resolved: entry.resolved,
    count: entry.count,
    firstSeen: when(entry.firstSeenAt),
    lastSeen: when(entry.lastSeenAt),
    context: entry.context ? safeJson(entry.context) : null,
    // Стек обрезаем здесь, на сервере: в панель он попадает только для чтения,
    // а целиком это сотни строк на каждую из сорока записей.
    stack: entry.stack ? entry.stack.slice(0, 2000) : null,
    userAgent: entry.userAgent,
  }));

  /** Ссылка на тот же фильтр, но с другим чипом или источником. */
  const href = (nextKey: FilterKey, nextSource?: string) => {
    const params = new URLSearchParams();
    // «Все» — фильтр по умолчанию в макете; если выбран он и источник не
    // задан, ссылка должна быть чистой, иначе появляется ?f=all.
    if (nextKey !== "unread") params.set("f", nextKey);
    if (nextSource) params.set("source", nextSource);
    const query = params.toString();
    return query ? `/admin/errors?${query}` : "/admin/errors";
  };

  return (
    <div className="ag-section" style={{ gap: 28 }}>
      <div className="ag-head">
        <div>
          <h1 className="ag-h1">Журнал ошибок</h1>
          <p className="ag-sub">
            Одинаковые ошибки схлопываются в одну строку со счётчиком повторов:
            один починенный парсер не превращается в сотню жалоб. Отметка
            «решённой» ничего не чинит — она честно говорит «я это посмотрел».
          </p>
        </div>
      </div>

      <div className="ag-section" style={{ gap: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }} role="group" aria-label="Фильтр по уровню">
          {(Object.keys(FILTERS) as FilterKey[]).map((k) => (
            <Link
              key={k}
              href={href(k, source)}
              className={`ag-chip${k === key ? " on" : ""}`}
              aria-current={k === key ? "true" : undefined}
            >
              {FILTERS[k].label} <i>{tally[k]}</i>
            </Link>
          ))}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <span className="ag-note">Источник:</span>
          <Link href={href(key)} className={`ag-chip${!source ? " on" : ""}`}>
            любой
          </Link>
          {sources.map((s) => (
            <Link
              key={s.source}
              href={href(key, s.source)}
              className={`ag-chip${source === s.source ? " on" : ""}`}
            >
              {SOURCE_LABELS[s.source] ?? s.source} <i>{s._count._all}</i>
            </Link>
          ))}
        </div>
      </div>

      <ErrorFeed entries={rows} level={filter.level ?? "all"} />
    </div>
  );
}