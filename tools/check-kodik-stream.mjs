/**
 * Проверка сети для AniGalaxy — три хоста, без которых поток не соберётся.
 *
 * Запуск (dev-сервер не нужен, ключи берутся из .env.local):
 *   node tools/check-kodik-stream.mjs
 *
 * Смысл: с VPN всё работает, без — нет. Чтобы понять, где обрыв,
 * запустите команду дважды, с VPN включённым и выключенным, и сравните.
 * Помеченный хост — тот, до которого сеть не доходит.
 *
 *   kodik-api.com      сервер ищет ссылку на серию
 *   kodikres.com       платное API: подпись и выдача HLS-ссылок
 *   sky.solodcdn.com   CDN с самими сегментами — грузит уже браузер
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

/** Серия для проверки — обычный сериал с полным списком серий */
const LINK =
  "//kodikplayer.com/seria/102355/80717f9e7a763938dc2bf26ded405921/720p";
const TITLE_ID = "serial-3566";

const env = readFileSync(".env.local", "utf8");
const token = env.match(/KODIK_TOKEN=(\S+)/)?.[1] ?? "";
const privateKey = env.match(/KODIK_PRIVATE_KEY=(\S+)/)?.[1] ?? "";
const apiBase = env.match(/KODIK_API_URL=(\S+)/)?.[1] ?? "https://kodik-api.com";

if (!token || !privateKey) {
  console.error(
    "В .env.local нет KODIK_TOKEN или KODIK_PRIVATE_KEY — проверять нечего.",
  );
  process.exit(1);
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const pad = (n) => String(n).padStart(2, "0");

/** Проба хоста: вернуть строку «статус или причина сбоя» */
async function probe(url, headers = {}, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    await res.text();
    return { ok: res.ok, note: `HTTP ${res.status}`, ms: Date.now() - started };
  } catch (error) {
    const cause = error?.cause?.code ?? error?.name ?? "ошибка";
    return { ok: false, note: String(cause), ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

function line(label, result, hint) {
  const mark = result.ok ? "ОК  " : "СБОЙ";
  return `${mark} ${label.padEnd(18)} ${result.note.padEnd(10)} ${String(result.ms + " мс").padEnd(9)} ${hint}`;
}

const titles = new URLSearchParams({ token, id: TITLE_ID, with_seasons: "1", with_episodes: "1" });
const catalog = await probe(`${apiBase}/search?${titles}`, { "User-Agent": UA });
console.log(
  "\n" + line("kodik-api.com", catalog, "поиск серии для подписи"),
);

const d = new Date(Date.now() + 6 * 3_600_000);
const deadline =
  d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + pad(d.getUTCHours());
const ip = "127.0.0.1";
const signature = createHmac("sha256", privateKey)
  .update(`${LINK}:${ip}:${deadline}`)
  .digest("hex");

const streamUrl =
  "https://kodikres.com/api/video-links" +
  `?link=${encodeURIComponent(LINK)}&p=${token}` +
  `&ip=${ip}&d=${deadline}&s=${signature}`;

let manifest = null;
const stream = await probe(streamUrl, { Accept: "application/json" });
if (stream.ok) {
  const body = await fetch(streamUrl, { headers: { Accept: "application/json" } })
    .then((r) => r.json())
    .catch(() => null);
  manifest = body?.links?.["720"]?.Src ?? null;
}
console.log(
  "\n" +
    line(
      "kodikres.com",
      { ...stream, ok: stream.ok && Boolean(manifest) },
      manifest ? "ссылки на HLS получены" : "поток не отдан",
    ),
);

if (manifest) {
  const cdn = await probe(manifest, { Referer: "http://localhost:3000" });
  console.log("\n" + line("sky.solodcdn.com", cdn, "сегменты видео"));
} else {
  console.log("\n— sky.solodcdn.com пропущен: манифест не получен");
}

const allOk = catalog.ok && stream.ok && manifest && true;
console.log(
  `\nИтог: ${allOk ? "все три хоста доступны — AniGalaxy должен работать" : "есть недоступный хост, он и ломает плеер"}.`,
);