/**
 * Чистые функции времени в часовом поясе пользователя.
 *
 * Движок не зовёт `Date.now()` сам — время приходит аргументом (`ctx.now`),
 * а смена суток/недели считается по IANA-поясу пользователя (§2.4):
 * сервер в этом проекте отсутствует, «серверная дата» = время клиента,
 * зафиксировано в docs/progression/ASSUMPTIONS.md.
 */

/** Пояс браузера; UTC, если определить не удалось */
export function systemTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const timeFormatters = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(tz: string): Intl.DateTimeFormat {
  let fmt = dateFormatters.get(tz);
  if (!fmt) {
    // en-CA даёт ISO-вид «YYYY-MM-DD»
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dateFormatters.set(tz, fmt);
  }
  return fmt;
}

function timeFormatter(tz: string): Intl.DateTimeFormat {
  let fmt = timeFormatters.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    timeFormatters.set(tz, fmt);
  }
  return fmt;
}

/** «YYYY-MM-DD» для момента в поясе tz */
export function dayKeyOf(now: number, tz: string): string {
  try {
    return dateFormatter(tz).format(new Date(now));
  } catch {
    return new Date(now).toISOString().slice(0, 10);
  }
}

/** Индекс суток (дней с эпохи) по ключу «YYYY-MM-DD» */
export function dayIndexFromKey(key: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return NaN;
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}

/** Индекс суток момента в поясе tz */
export function dayIndex(now: number, tz: string): number {
  return dayIndexFromKey(dayKeyOf(now, tz));
}

/** Неделя = 7 календарных суток (детерминировано, не «календарная неделя») */
export function weekIndexOf(day: number): number {
  return Math.floor(day / 7);
}

/** Локальное время момента в поясе tz */
export function timeParts(now: number, tz: string): { hour: number; minute: number } {
  try {
    const parts = timeFormatter(tz).formatToParts(new Date(now));
    let hour = 0;
    let minute = 0;
    for (const p of parts) {
      if (p.type === "hour") hour = Number(p.value);
      if (p.type === "minute") minute = Number(p.value);
    }
    return { hour, minute };
  } catch {
    const d = new Date(now);
    return { hour: d.getUTCHours(), minute: d.getUTCMinutes() };
  }
}

/** Текущий пояс браузера (для миграции и первого запуска) */
export function systemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
