import { searchReleases } from "@/lib/anilibria";
import type { AnimeCard } from "@/lib/types";

/** Префикс id тайтлов, которых нет в Kodik и которые берутся из AniLiberty */
export const ANI_PREFIX = "ani-";
export const isAniId = (id: string): boolean => id.startsWith(ANI_PREFIX) && id.length > ANI_PREFIX.length;
export const aniAlias = (id: string): string => id.slice(ANI_PREFIX.length);

const norm = (s?: string): string => (s ?? "").toLowerCase().replace(/[^a-zа-яё0-9]+/g, "");

/**
 * Дополняет выдачу Kodik тайтлами из AniLiberty, которых в ней нет
 * (сравнение по id Shikimori, затем по названию). Любая ошибка источника
 * молча даёт исходный список: поиск не должен падать из-за запасного канала.
 */
export async function withAniFallback(query: string, cards: AnimeCard[], limit = 12): Promise<AnimeCard[]> {
  const q = query.trim();
  if (q.length < 2) return cards;
  try {
    const found = await searchReleases(q, limit);
    const haveIds = new Set(cards.map((c) => c.shikimoriId).filter(Boolean));
    const haveNames = new Set(cards.flatMap((c) => [norm(c.title), norm(c.titleOrig)]).filter(Boolean));
    const extra: AnimeCard[] = [];
    for (const r of found) {
      if (!r.alias) continue;
      if (r.shikimoriId && haveIds.has(r.shikimoriId)) continue;
      if (haveNames.has(norm(r.title)) || (r.titleOrig && haveNames.has(norm(r.titleOrig)))) continue;
      extra.push({ ...r, id: `${ANI_PREFIX}${r.alias}` });
    }
    return extra.length ? [...cards, ...extra] : cards;
  } catch {
    return cards;
  }
}
