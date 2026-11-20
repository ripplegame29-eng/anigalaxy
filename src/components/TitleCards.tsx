import "../app/title-cards.css";
import { CATALOG } from "@/lib/cards/catalog";
import { RANKS } from "@/lib/cards/config";
import { seriesForTitle } from "@/lib/cards/series-match";
import { artIds } from "@/lib/server/cards-art";
import { TitleCardsRow, type TcHero } from "./TitleCardsRow";

/** Серии, записанные в каталоге по-разному, но означающие один тайтл */
const SIBLINGS: Record<string, string[]> = {
  "Код Гиас": ["Код Гиасс"],
  "Код Гиасс": ["Код Гиас"],
  "Невероятные приключения ДжоДжо": ["ДжоДжо"],
  "ДжоДжо": ["Невероятные приключения ДжоДжо"],
};

/**
 * «Герои этого тайтла»: карточки гачи из этого аниме и личный прогресс сбора.
 * Блок появляется только у тайтлов, для которых в гаче есть хотя бы один герой с артом.
 */
export function TitleCards({ title, alt = [], poster }: { title: string; alt?: string[]; poster?: string }) {
  const series = seriesForTitle(title, alt);
  if (!series) return null;
  const names = new Set([series, ...(SIBLINGS[series] ?? [])]);
  const have = new Set(artIds());
  const all = CATALOG.filter((c) => names.has(c.series) && have.has(c.id));
  if (!all.length) return null;
  const heroes: TcHero[] = [...all]
    .sort((a, b) => b.rank - a.rank || a.num - b.num)
    .map((c) => ({ id: c.id, name: c.name, num: c.num, rank: c.rank, blurb: c.blurb }));
  const counts = RANKS.map((r) => ({ id: r.id, short: r.short, color: r.color, n: all.filter((c) => c.rank === r.id).length })).filter((x) => x.n > 0).reverse();
  const ranks = RANKS.map((r) => ({ key: r.key, short: r.short, name: r.name, color: r.color }));
  return <TitleCardsRow series={series} heroes={heroes} counts={counts} ranks={ranks} poster={poster} />;
}
