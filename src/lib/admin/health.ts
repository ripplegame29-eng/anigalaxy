/**
 * Проверка внешних источников.
 *
 * Зачем: у сайта три зависимости с каскадом фоллбэков (Kodik → Shikimori →
 * MangaDex), и каждый клиент умеет тихо деградировать. Из-за этого поломка
 * источника не видна снаружи — страница просто теряет кадры, трейлеры или
 * серии, и первым признаком становится жалоба пользователя. Здесь мы
 * спрашиваем источники сами и кладём результат в `api_health`, чтобы
 * поломка была видна в панели раньше, чем её заметят.
 *
 * Проверка намеренно дешёвая: один запрос с минимальным лимитом и жёстким
 * таймаутом. Это health-check, а не сбор данных — тянуть каталог не нужно.
 */

import "server-only";

import { db } from "@/lib/db";
import { logError } from "@/lib/logger";

export type ServiceName = "kodik" | "shikimori" | "mangadex" | "anilibria";

export interface HealthResult {
  service: ServiceName;
  ok: boolean;
  latencyMs: number | null;
  error: string | null;
  /** Известный фоллбэк — что сайт сделает, если источник недоступен */
  fallback: string;
}

const TIMEOUT_MS = 8000;

/** Падает ли запрос по таймауту, а не по ответу сервера. */
function timedOut(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

async function probe(url: string, init?: RequestInit): Promise<HealthResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent": "AniGalaxy-healthcheck/1.0",
        ...(init?.headers as Record<string, string> | undefined),
      },
    });

    const latencyMs = Date.now() - started;

    // Ответ нужен только чтобы «съесть» тело и освободить соединение;
    // нечитаемый ответ всё равно означает, что источник жив.
    await res.arrayBuffer().catch(() => undefined);

    return {
      ok: res.ok,
      latencyMs,
      error: res.ok ? null : `HTTP ${res.status}`,
      service: "" as never, // проставляется вызывающим
      fallback: "",
    };
  } catch (error: unknown) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: timedOut(error)
        ? `не ответил за ${TIMEOUT_MS / 1000} с`
        : error instanceof Error
          ? error.message
          : String(error),
      service: "" as never,
      fallback: "",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Адреса проб. Требования — самые дешёвые эндпоинты, которые есть у каждого
 * источника, чтобы проверка не съедала лимит запросов Kodik.
 */
const PROBES: Record<
  ServiceName,
  { url: string; init?: RequestInit; fallback: string }
> = {
  kodik: {
    url: "https://kodik-api.com/genres",
    fallback: "каталог и серии пропадают — резервных источников нет",
  },
  shikimori: {
    url: "https://shikimori.io/api/titles?limit=1",
    fallback: "кадры и трейлеры берутся из Kodik, затем ищутся на YouTube",
  },
  mangadex: {
    url: "https://api.mangadex.org/manga?limit=1",
    fallback: "раздел «Манга» отдаёт последний успешный ответ с диска",
  },
  anilibria: {
    url: "https://anilibria.top/api/public/updates?limit=1",
    fallback: "подборки в каталоге пустеют",
  },
};

/** Проверяет все источники и пишет результат в `api_health`. */
export async function checkAllSources(): Promise<HealthResult[]> {
  const entries = Object.entries(PROBES) as [
    ServiceName,
    (typeof PROBES)[ServiceName],
  ][];

  const checked = await Promise.all(
    entries.map(async ([service, cfg]) => {
      const result = await probe(cfg.url, cfg.init);
      return { ...result, service, fallback: cfg.fallback };
    }),
  );

  const now = Date.now();

  // Пишем результат в базу. Ошибка записи не должна ломать саму проверку —
  // она вернёт результат в интерфейс, а таблица обновится при следующем разе.
  await Promise.all(
    checked.map((r) =>
      db.apiHealth
        .upsert({
          where: { service: r.service },
          create: {
            service: r.service,
            ok: r.ok,
            latencyMs: r.latencyMs,
            error: r.error,
            checkedAt: now,
          },
          update: {
            ok: r.ok,
            latencyMs: r.latencyMs,
            error: r.error,
            checkedAt: now,
          },
        })
        .catch(() => undefined),
    ),
  );

  // Недоступный источник попадает и в журнал ошибок: панель ошибок и панель
  // здоровья смотрят на одну и ту же проблему с двух сторон.
  const failed = checked.filter((r) => !r.ok);
  if (failed.length > 0) {
    void logError({
      level: "warn",
      source: "job",
      operation: "health.check",
      message: `Источники не отвечают: ${failed.map((r) => `${r.service} (${r.error ?? "?"})`).join(", ")}`,
      context: failed.map((r) => ({ service: r.service, error: r.error })),
    });
  }

  return checked;
}

/** Последний сохранённый результат без обращения к сети. */
export async function readHealth(): Promise<HealthResult[]> {
  const rows = await db.apiHealth.findMany();
  const byName = new Map(rows.map((r) => [r.service, r]));

  return (Object.keys(PROBES) as ServiceName[]).map((service) => {
    const row = byName.get(service);
    return {
      service,
      ok: row?.ok ?? false,
      latencyMs: row?.latencyMs ?? null,
      error: row?.error ?? "не проверялся",
      fallback: PROBES[service].fallback,
    };
  });
}