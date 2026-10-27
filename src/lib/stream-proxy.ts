import "server-only";
import { NextRequest, NextResponse } from "next/server";

/**
 * Общий прокси для HLS/MP4 альтернативных источников.
 *
 * Зачем: CVH (okcdn/vkuser) и SameBand отдают потоки без CORS, а CVH ещё и
 * проверяет Referer/Origin. Браузер не может тянуть их напрямую, поэтому
 * плейлисты и сегменты идут через наш сервер. Прокси не открытый: каждый
 * маршрут передаёт свой allowlist хостов.
 *
 * m3u8 переписывается: относительные варианты и сегменты становятся
 * абсолютными URL, завёрнутыми в тот же прокси. Range пробрасывается — это
 * нужно для MP4 и корректной перемотки.
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export interface StreamProxyOptions {
  /** Домены, которые разрешено проксировать (включая поддомены) */
  hosts: readonly string[];
  /** Путь этого же прокси — им переписываются ссылки внутри m3u8 */
  proxyPath: string;
  /**
   * Referer/Origin для upstream. По умолчанию — origin самого upstream:
   * так работают CVH-сегменты okcdn/vkuser. SameBand ждёт свой Referer.
   */
  referer?: string | ((target: URL) => string);
}

function allowedHost(hostname: string, hosts: readonly string[]): boolean {
  const host = hostname.toLowerCase();
  return hosts.some((item) => host === item || host.endsWith(`.${item}`));
}

/** Ссылка на этот же прокси для абсолютного upstream-URL */
export function proxied(proxyPath: string, target: string): string {
  return `${proxyPath}?url=${encodeURIComponent(target)}`;
}

/**
 * Переписать m3u8: URI="…" в тегах (#EXT-X-KEY, #EXT-X-MAP) и обычные
 * строки-сегменты/варианты. База — финальный URL ответа, а не запрошенный:
 * CDN может редиректить.
 */
/**
 * Оставляет в master-плейлисте один видео-вариант нужной высоты, не трогая
 * аудио-дорожки (`#EXT-X-MEDIA`). У части CDN звук лежит отдельным потоком,
 * и ссылка на «голый» видео-вариант играет картинку без звука.
 */
export function pickMasterVariant(text: string, height: number): string {
  const lines = text.split(/\r?\n/);
  const keep = new Set<number>();
  let found = false;
  lines.forEach((line, i) => {
    if (!line.trim().startsWith("#EXT-X-STREAM-INF")) return;
    const match = /RESOLUTION=\d+x(\d+)/i.exec(line);
    if (match && Number(match[1]) === height) {
      found = true;
      keep.add(i);
      keep.add(i + 1);
    }
  });
  if (!found) return text;
  return lines
    .filter((line, i) => {
      if (line.trim().startsWith("#EXT-X-STREAM-INF")) return keep.has(i);
      // Строка-адрес сразу после чужого STREAM-INF
      if (i > 0 && lines[i - 1].trim().startsWith("#EXT-X-STREAM-INF")) return keep.has(i);
      return true;
    })
    .join("\n");
}

function rewritePlaylist(text: string, baseUrl: string, proxyPath: string): string {
  const absolute = (value: string): string | null => {
    try {
      return new URL(value, baseUrl).toString();
    } catch {
      return null;
    }
  };

  const lines = text.split(/\r?\n/);
  const out: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      continue;
    }
    if (trimmed.startsWith("#")) {
      out.push(
        line.replace(/URI="([^"]+)"/g, (match, uri: string) => {
          const target = absolute(uri);
          return target ? `URI="${proxied(proxyPath, target)}"` : match;
        }),
      );
      continue;
    }
    const target = absolute(trimmed);
    out.push(target ? proxied(proxyPath, target) : line);
  }

  return `${out.join("\n")}\n`;
}

function originOf(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Проксировать один upstream-запрос.
 *
 * Возвращает поток как есть, кроме m3u8 (там подменяются ссылки).
 * Ошибки upstream отдаём как 502 JSON — hls.js покажет их в консоли.
 */
export async function handleStreamProxy(
  request: NextRequest,
  options: StreamProxyOptions,
): Promise<Response> {
  const raw = request.nextUrl.searchParams.get("url")?.trim() ?? "";

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Некорректный url" }, { status: 400 });
  }

  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return NextResponse.json({ error: "Разрешены только http/https" }, { status: 400 });
  }
  if (target.username || target.password) {
    return NextResponse.json({ error: "Учётные данные в url запрещены" }, { status: 400 });
  }
  if (!allowedHost(target.hostname, options.hosts)) {
    return NextResponse.json({ error: "Хост не разрешён для прокси" }, { status: 403 });
  }

  const referer =
    typeof options.referer === "function"
      ? options.referer(target)
      : options.referer ?? `${target.origin}/`;
  const origin = originOf(referer);

  const headers: Record<string, string> = {
    "user-agent": USER_AGENT,
    accept: request.headers.get("accept") ?? "*/*",
    "accept-language": "ru-RU,ru;q=0.9,en;q=0.8",
    referer,
  };
  if (origin) headers.origin = origin;
  const range = request.headers.get("range");
  if (range) headers.range = range;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers,
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `upstream: ${message}` }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `upstream HTTP ${upstream.status}` },
      { status: 502 },
    );
  }

  const finalUrl = upstream.url || target.toString();
  const contentType = (upstream.headers.get("content-type") ?? "").toLowerCase();
  const isPlaylist =
    contentType.includes("mpegurl") ||
    /\.m3u8?$/i.test(new URL(finalUrl).pathname) ||
    /\.m3u8?$/i.test(target.pathname);

  if (isPlaylist) {
    let text: string;
    try {
      text = await upstream.text();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: `upstream body: ${message}` }, { status: 502 });
    }
    const wanted = Number(request.nextUrl.searchParams.get("h"));
    if (Number.isFinite(wanted) && wanted > 0 && text.includes("#EXT-X-STREAM-INF")) {
      text = pickMasterVariant(text, Math.trunc(wanted));
    }
    const body = rewritePlaylist(text, finalUrl, options.proxyPath);
    const bytes = new TextEncoder().encode(body);
    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
        "content-length": String(bytes.byteLength),
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      },
    });
  }

  const responseHeaders = new Headers();
  responseHeaders.set("access-control-allow-origin", "*");
  responseHeaders.set("cache-control", "public, max-age=300");

  for (const [key, value] of upstream.headers) {
    const name = key.toLowerCase();
    if (HOP_BY_HOP.has(name)) continue;
    if (name === "content-encoding" || name === "content-length") continue;
    if (name === "content-type" || name === "content-range" || name === "accept-ranges" || name === "etag" || name === "last-modified") {
      responseHeaders.set(name, value);
    }
  }

  const contentLength = upstream.headers.get("content-length");
  const contentEncoding = upstream.headers.get("content-encoding");
  if (contentLength && !contentEncoding) responseHeaders.set("content-length", contentLength);

  // Некоторые CDN отвечают на Range кодом 200, но с Content-Range и
  // частичным телом. Для video/Range такой ответ должен быть 206, иначе
  // браузер считает, что получил весь файл.
  const status =
    request.headers.get("range") &&
    responseHeaders.has("content-range") &&
    upstream.status === 200
      ? 206
      : upstream.status;

  return new Response(upstream.body, {
    status,
    headers: responseHeaders,
  });
}
