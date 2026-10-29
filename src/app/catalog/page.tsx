import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CatalogFilters } from "@/components/CatalogFilters";
import { CatalogResults } from "@/components/CatalogResults";
import { catalog, getMeta } from "@/lib/kodik";
import { withAniFallback } from "@/lib/ani-fallback";
import { parseQuery, toSearch, type SearchParams } from "@/lib/catalog-query";
import type { CatalogQuery } from "@/lib/types";

export const metadata: Metadata = {
  title: "Каталог аниме",
  description:
    "Каталог аниме онлайн: фильтры по жанрам, годам, типу и статусу выхода, сортировка по рейтингу и свежим релизам.",
};

interface PageProps {
  searchParams: Promise<SearchParams>;
}

/** 1 тайтл / 2 тайтла / 5 тайтлов */
function pluralTitles(count: number): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "тайтлов";
  if (last === 1) return "тайтл";
  if (last > 1 && last < 5) return "тайтла";
  return "тайтлов";
}

export default async function CatalogPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const state = parseQuery(sp);

  const query: CatalogQuery = {
    q: state.q,
    type: state.type,
    kind: state.kind,
    status: state.status,
    genre: state.genre,
    yearFrom: state.yearFrom,
    yearTo: state.yearTo,
    sort: state.sort,
  };

  const [{ cards: kodikCards, total: kodikTotal, next }, meta] = await Promise.all([
    // Если API временно недоступен — каталог не должен падать
    catalog(query).catch(() => ({ cards: [], total: 0, next: null })),
    getMeta().catch(() => ({ genres: [], years: [] })),
  ]);

  // Поиск по названию: тайтлы, которых нет в Kodik, добираем из AniLiberty
  const withExtra = state.q ? await withAniFallback(state.q, kodikCards) : kodikCards;
  const cards = withExtra;
  const total = kodikTotal + (withExtra.length - kodikCards.length);

  const title = state.q ? `Поиск: «${state.q}»` : "Каталог аниме";
  const totalText = total.toLocaleString("ru-RU");

  return (
    <div className="cat-page">
      <div className="cat-wrap">
        <div className="cat-crumbs">
          <Breadcrumbs items={[{ label: "Каталог" }, ...(state.q ? [{ label: state.q }] : [])]} />
        </div>

        <h1 className="cat-h1">{title}</h1>
        <p className="cat-found" aria-live="polite">
          {total > 0 ? (
            <>
              Найдено <b>{next ? "≈ " : ""}{totalText}</b> {pluralTitles(total)}
            </>
          ) : (
            "По вашему запросу ничего не найдено"
          )}
        </p>

        <CatalogFilters value={state} meta={meta} />

        <div className="cat-results">
          <CatalogResults
            key={toSearch(state)}
            initial={cards}
            next={next}
            total={total}
            state={state}
          />
        </div>
      </div>
    </div>
  );
}
