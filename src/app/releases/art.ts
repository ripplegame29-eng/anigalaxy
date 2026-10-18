/**
 * Обложки и баннеры для календаря релизов.
 *
 * Если у релиза нет картинки, рисуем обстановку по названию: одинаковая
 * серия всегда выглядит одинаково, и в календаре не появляется серая дыра.
 *
 * Генерация детерминированная — тот же заголовок всегда даёт ту же картинку.
 * Это принципиально: иначе при каждом рендере обложки менялись бы, и
 * страница «дышала» бы при перерисовке.
 *
 * Отдаём data:image/svg+xml, потому что это не сетевой запрос: не нужен
 * домен в next.config, не нужен прокси и не появляется 404-запись в журнале
 * ошибок из-за заглушки.
 */

export interface ArtSubject {
  id: string;
  title: string;
}

/** Устойчивый хеш строки в число. */
function hue(text: string): number {
  let h = 0;
  for (const char of text) h = (h * 31 + char.charCodeAt(0)) % 360;
  return h;
}

/** Линейный генератор с фиксированным зерном — «случайность» без случайности. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map<string, string>();

function artURI(item: ArtSubject, w: number, h: number): string {
  const key = `${item.id}|${w}x${h}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const base = hue(item.title);
  const r = rng(base * 977 + hashId(item.id) * 131 + w);
  const min = Math.min(w, h);

  let s = "";

  for (let k = 0; k < 3; k += 1) {
    s += `<circle cx="${r() * w}" cy="${r() * h}" r="${(0.25 + r() * 0.35) * min}" fill="hsl(${(base + r() * 120) % 360} 90% 60%)" opacity="${0.25 + r() * 0.25}" filter="url(#b)"/>`;
  }

  for (let k = 0; k < 7; k += 1) {
    const x = r() * w;
    const y = r() * h;
    const q = (0.15 + r() * 0.4) * min;
    s += `<polygon points="${x},${y} ${x + q},${y + q * (0.2 + r() * 0.6)} ${x + q * 0.3},${y + q * (0.8 + r() * 0.5)}" fill="hsl(${(base + r() * 160) % 360} 85% ${55 + r() * 25}%)" opacity="${0.12 + r() * 0.22}"/>`;
  }

  for (let k = 0; k < 26; k += 1) {
    s += `<circle cx="${r() * w}" cy="${r() * h}" r="${0.6 + r() * 1.6}" fill="#fff" opacity="${0.4 + r() * 0.6}"/>`;
  }

  s += `<circle cx="${w * (0.55 + r() * 0.3)}" cy="${h * (0.25 + r() * 0.3)}" r="${min * 0.22}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3"/>`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">` +
    `<defs><filter id="b"><feGaussianBlur stdDeviation="${min * 0.09}"/></filter>` +
    `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="hsl(${base} 70% 22%)"/>` +
    `<stop offset="1" stop-color="hsl(${(base + 40) % 360} 80% 10%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#g)"/>${s}</svg>`;

  const uri =
    "data:image/svg+xml," +
    encodeURIComponent(svg).replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29");

  cache.set(key, uri);
  return uri;
}

/** Идентификаторы в базе — строки, поэтому нужен свой хеш в число. */
function hashId(id: string): number {
  let h = 0;
  for (const char of id) h = (h * 33 + char.charCodeAt(0)) % 100000;
  return h;
}

export function posterURL(item: ArtSubject & { poster?: string | null }): string {
  return item.poster || artURI(item, 400, 600);
}

export function bannerURL(item: ArtSubject & { poster?: string | null; banner?: string | null }): string {
  return item.banner || item.poster || artURI(item, 1600, 640);
}