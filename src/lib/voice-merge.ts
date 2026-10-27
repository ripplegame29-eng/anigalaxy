/**
 * Единый список озвучек из всех источников.
 *
 * Одна студия часто есть сразу у Kodik (до 720p) и у CVH/AniLiberty/SameBand
 * (1080p). В списке остаётся одна запись — с лучшим качеством; остальные
 * лежат в `fallbacks` на случай, если выбранный источник не отдаст серию.
 */

import type { TranslationOption } from "./types";

export const KODIK_QUALITY = 720;
export const HQ_QUALITY = 1080;

/** При равном качестве предпочитаем источник с более полным каталогом */
const PROVIDER_RANK: Record<string, number> = { cvh: 3, anilibria: 2, sameband: 1 };

const NOISE = new Set(["tv", "online", "project", "studio", "team", "fhd", "cvh", "hd"]);

/** Ключ студии: одинаковый для «AniLibria.TV», «AnilibriaTV» и «AniLiberty · FHD» */
export function voiceKey(title: string): string {
  const base = title.toLowerCase().replace(/ё/g, "е").replace(/liberty/g, "libria");
  const tokens = base
    .split(/[^a-z0-9а-я]+/)
    .filter(Boolean)
    .map((t) => (t.length > 5 && t.endsWith("tv") ? t.slice(0, -2) : t))
    .filter((t) => !NOISE.has(t));
  return tokens.join("");
}

const qualityOf = (o: TranslationOption): number => o.quality ?? (o.provider ? HQ_QUALITY : KODIK_QUALITY);
const rankOf = (o: TranslationOption): number => (o.provider ? (PROVIDER_RANK[o.provider] ?? 0) : 0);

/** Чистое название студии для меню: без «CVH ·» и «· FHD» */
export function cleanTitle(title: string): string {
  return title.replace(/^CVH\s*·\s*/i, "").replace(/\s*·\s*FHD$/i, "").trim() || title;
}

export function mergeVoices(kodik: TranslationOption[], alternatives: TranslationOption[]): TranslationOption[] {
  const groups = new Map<string, TranslationOption[]>();
  const order: string[] = [];
  for (const raw of [...alternatives, ...kodik]) {
    const option = { ...raw, quality: qualityOf(raw) };
    const key = voiceKey(option.title) || `id:${option.id}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(option);
  }

  const merged = order.map((key, index) => {
    const list = groups.get(key)!;
    const sorted = [...list].sort(
      (a, b) => qualityOf(b) - qualityOf(a) || rankOf(b) - rankOf(a) || (b.episodeCount ?? 0) - (a.episodeCount ?? 0),
    );
    const [best, ...rest] = sorted;
    const episodeCount = Math.max(...list.map((o) => o.episodeCount ?? 0)) || undefined;
    return {
      index,
      option: {
        ...best,
        title: best.provider ? cleanTitle(best.title) : best.title,
        episodeCount: best.episodeCount ?? episodeCount,
        current: list.some((o) => o.current),
        fallbacks: rest.length ? rest : undefined,
      } as TranslationOption,
    };
  });

  // Сначала 1080p, внутри — озвучки перед субтитрами, затем по числу серий
  return merged
    .sort(
      (a, b) =>
        qualityOf(b.option) - qualityOf(a.option) ||
        Number(a.option.type === "subtitles") - Number(b.option.type === "subtitles") ||
        (b.option.episodeCount ?? 0) - (a.option.episodeCount ?? 0) ||
        a.index - b.index,
    )
    .map((m) => m.option);
}

/** Какую озвучку включить по умолчанию: лучшее качество, а среди равных — та, что играла у Kodik */
export function pickDefaultVoice(list: TranslationOption[], currentKodikTitle?: string): TranslationOption | undefined {
  const best = Math.max(0, ...list.map(qualityOf));
  const top = list.filter((o) => qualityOf(o) === best && o.type === "voice");
  const key = currentKodikTitle ? voiceKey(currentKodikTitle) : "";
  return (key && top.find((o) => voiceKey(o.title) === key)) || top[0] || list[0];
}
