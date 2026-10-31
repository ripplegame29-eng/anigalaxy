/**
 * Публичный адрес сайта для return/failed URL платёжной формы.
 *
 * В продакшене задаётся `NEXT_PUBLIC_SITE_URL` (deploy/setup.sh выставляет его
 * из DOMAIN). Без переменной берём адрес текущего запроса — это удобно на
 * localhost, но для колбэков Platega всё равно нужен публичный HTTPS-домен.
 */
export function siteBaseUrl(request: Request): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "").trim();
  if (configured) return configured.replace(/\/+$/, "");

  const url = new URL(request.url);
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    url.host;
  return `${proto}://${host}`;
}
