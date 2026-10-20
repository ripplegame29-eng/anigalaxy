/**
 * Серверный клиент платного API Kodik (kodikres.com/api/video-links).
 *
 * API отдаёт прямые HLS-манифесты (m3u8) по каждому качеству — ровно то,
 * что нужно нашему плееру на hls.js, без их плеера и iframe.
 *
 * ГЛАВНОЕ: приватный ключ подписи живёт только здесь, на сервере. По
 * документации Kodik он не должен попадать в JS — иначе его увидят все
 * посетители сайта и смогут подписывать ссылки за ваш счёт. Браузер
 * получает лишь уже подписанный HLS-адрес.
 *
 * Документация: https://bd.kodikres.com/api/info
 */
import "server-only";
import { createHmac } from "node:crypto";
import { withCache } from "./kodik";
import { clientIp, normalizeIp } from "./kodik-ip";

/* Разбор адреса вынесён в kodik-ip: там нет ключей и сети, только парсинг
 * заголовков, и его можно прогнать тестами. */
export { clientIp, normalizeIp };

/** Публичный ключ аккаунта — он и так лежит в .env.local как KODIK_TOKEN */
const PUBLIC_KEY = process.env.KODIK_TOKEN ?? "";

/** Приватный ключ подписи. Без него API не ответит. */
const PRIVATE_KEY = process.env.KODIK_PRIVATE_KEY ?? "";

/** Адрес API Kodik (на случай смены домена) */
const STREAM_API_URL = process.env.KODIK_STREAM_API_URL ?? "https://kodikres.com";

/** Сколько часов живёт подпись. Документация допускает максимум +10. */
const TTL_HOURS = Number(process.env.KODIK_STREAM_TTL_HOURS ?? 6);

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Одна ссылка на качество, как её отдаёт Kodik */
export interface KodikStreamLink {
  /** Готовый HLS-манифест (m3u8) */
  Src: string;
  /** MIME манифеста — у Kodik всегда application/x-mpegURL */
  Type: string;
}

export interface KodikStreamResult {
  /** Ключ качества ("240" | "360" | "480" | "720" | "1080") → ссылка */
  links: Record<string, KodikStreamLink>;
  /** Момент, после которого подпись протухает (UTC, формат YYYYMMDDHH) */
  deadline: string;
}

export class KodikStreamError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = "KodikStreamError";
  }
}

/* ------------------------------------------------------------------ */
/* Подпись                                                             */
/* ------------------------------------------------------------------ */

const pad = (n: number): string => String(n).padStart(2, "0");

/**
 * Дедлайн в формате `YYYYMMDDHH` по UTC — ровно то, что ждёт Kodik.
 * Документация описывает его как «YYYYMMDN», а в примере PHP-строка
 * даёт `2021050620`, то есть дата Ymd плюс час UTC. Формат проверен
 * запросом: с Ymd (8 символов) API отвечает «validation error:: deadline».
 */
export function kodikDeadline(hours: number = TTL_HOURS, from = Date.now()): string {
  const d = new Date(from + hours * 3_600_000);
  return (
    String(d.getUTCFullYear()) +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours())
  );
}

/** HMAC-SHA256 от `{ссылка}:{IP}:{дедлайн}` приватным ключом */
export function signKodikLink(
  link: string,
  ip: string,
  deadline: string,
  privateKey: string = PRIVATE_KEY,
): string {
  return createHmac("sha256", privateKey).update(`${link}:${ip}:${deadline}`).digest("hex");
}

/* ------------------------------------------------------------------ */
/* Запрос потоков                                                      */
/* ------------------------------------------------------------------ */

function requireKeys(): void {
  if (!PRIVATE_KEY) {
    throw new KodikStreamError(
      "Не задан KODIK_PRIVATE_KEY — подписывать ссылки Kodik нечем",
      500,
    );
  }
  if (!PUBLIC_KEY) {
    throw new KodikStreamError("Не задан KODIK_TOKEN — публичный ключ Kodik", 500);
  }
}

interface RawResponse {
  links?: Record<string, { Src?: string; Type?: string }>;
  error?: string;
}

/**
 * Превращает ссылку на плеер Kodik в набор HLS-ссылок.
 *
 * Подпись привязана к IP и дедлайну, поэтому результат кэшируется на пару
 * минут: при перемотке качества мы не переставляем запросы Kodik заново,
 * но и не держим ссылки дольше их реального срока.
 */
export async function resolveKodikStream(link: string, ip: string): Promise<KodikStreamResult> {
  requireKeys();

  const deadline = kodikDeadline();
  const signature = signKodikLink(link, ip, deadline);

  // Тот же IP и дедлайн, что ушли в подпись, — иначе Kodik отклонит
  const key = `kodikstream:${link}:${ip}:${deadline}`;

  const raw = await withCache<RawResponse>(key, 2 * 60_000, async () => {
    const url =
      `${STREAM_API_URL}/api/video-links` +
      `?link=${encodeURIComponent(link)}` +
      `&p=${encodeURIComponent(PUBLIC_KEY)}` +
      `&ip=${encodeURIComponent(ip)}` +
      `&d=${encodeURIComponent(deadline)}` +
      `&s=${encodeURIComponent(signature)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });

      const data = (await res.json()) as RawResponse;
      if (!res.ok || data.error) {
        throw new KodikStreamError(
          `Kodik API вернул ${res.status}: ${data.error ?? "без описания"}`,
          res.status === 404 ? 404 : 502,
        );
      }
      return data;
    } catch (error) {
      if (error instanceof KodikStreamError) throw error;
      throw new KodikStreamError("Kodik API не ответил", 502);
    } finally {
      clearTimeout(timer);
    }
  });

  const links: Record<string, KodikStreamLink> = {};
  for (const [quality, value] of Object.entries(raw.links ?? {})) {
    if (!value?.Src) continue;
    links[quality] = { Src: value.Src, Type: value.Type ?? "application/x-mpegURL" };
  }

  if (Object.keys(links).length === 0) {
    throw new KodikStreamError("Kodik не вернул ни одной ссылки на поток", 404);
  }

  return { links, deadline };
}