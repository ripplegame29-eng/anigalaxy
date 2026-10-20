/**
 * Адрес посетителя для подписи ссылок Kodik.
 *
 * Отдельный модуль без «server-only»: здесь нет ни ключей, ни сети —
 * только разбор заголовков. Kodik требует в подписи именно тот адрес,
 * который уходит в параметр `ip`, и принимает **только IPv4**: на IPv6
 * он отвечает «validation error:: IP».
 *
 * Отсюда важный случай — Next.js в dev кладёт в X-Forwarded-For адрес
 * `::1` (IPv6-петлю). С ним подпись не проходила, и плеер показывал
 * «не нашли», хотя сеть была в порядке.
 */

/** Адрес на случай, если в заголовках ничего пригодного нет */
export const IP_FALLBACK = "1.1.1.1";

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
/** IPv4, вписанный в IPv6: ::ffff:1.2.3.4 */
const IPV4_EMBEDDED = /(?:^|[^0-9a-f])(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i;
/** ::1 и его развёрнутая запись 0:0:0:0:0:0:0:1 */
const IPV6_LOOPBACK = /^(?:0*:)*0*1$|^::1$/;

function isIpv4(value: string): boolean {
  if (!IPV4.test(value)) return false;
  return value
    .split(".")
    .every((part) => part.length <= 3 && Number(part) >= 0 && Number(part) <= 255);
}

/**
 * Приводит адрес из заголовков к IPv4, который Kodik примет.
 * Мусор, IPv6 без вписанного IPv4 и пустые значения уходят в запасной
 * адрес — лишь бы подпись совпала с параметром `ip`.
 */
export function normalizeIp(raw: string | null | undefined): string {
  let value = (raw ?? "").trim();
  if (!value) return IP_FALLBACK;

  // [::1]:443 и ::1%eth0 — служебные обёртки, которых Kodik не понимает
  value = value.replace(/^\[/, "").replace(/\]$/, "").split("%")[0] ?? "";
  // IPv4 с портом: 1.2.3.4:5678
  if (value.includes(":") && isIpv4(value.split(":")[0] ?? "")) {
    value = value.split(":")[0] ?? "";
  }

  if (isIpv4(value)) return value;

  const embedded = value.match(IPV4_EMBEDDED);
  if (embedded?.[1] && isIpv4(embedded[1])) return embedded[1];

  // Локальная петля — Kodik её отвергает, но по смыслу это тот же 127.0.0.1
  if (IPV6_LOOPBACK.test(value)) return "127.0.0.1";

  return IP_FALLBACK;
}

/**
 * IP посетителя. За обратным прокси это первый адрес из X-Forwarded-For.
 * Берём первый заголовок, из которого получился настоящий IPv4: если
 * X-Forwarded-For пуст или это IPv6-петля, пробуем следующий.
 */
export function clientIp(headers: Headers): string {
  const candidates = [
    headers.get("x-forwarded-for")?.split(",")[0],
    headers.get("x-real-ip"),
    headers.get("cf-connecting-ip"),
    headers.get("true-client-ip"),
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const ip = normalizeIp(candidate);
    if (ip !== IP_FALLBACK) return ip;
  }
  return IP_FALLBACK;
}