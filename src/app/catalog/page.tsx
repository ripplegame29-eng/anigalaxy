import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CatalogFilters } from "@/components/CatalogFilters";
import { CatalogResults } from "@/components/CatalogResults";
import { catalog, getMeta } from "@/lib/kodik";
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

  const [{ cards, total, next }, meta] = await Promise.all([
    // Если API временно недоступен — каталог не должен падать
    catalog(query).catch(() => ({ cards: [], total: 0, next: null })),
    getMeta().catch(() => ({ genres: [], years: [] })),
  ]);

  const title = state.q ? `Поиск: «${state.q}»` : "Каталог аниме";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs items={[{ label: "Каталог" }, ...(state.q ? [{ label: state.q }] : [])]} />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-1.5 text-sm text-muted">
            {total > 0 ? (
              <>
                Найдено{" "}
                <span className="font-semibold text-white">
                  {next ? "≈ " : ""}
                  {total.toLocaleString("ru-RU")}
                </span>{" "}
                тайтлов
              </>
            ) : (
              "По вашему запросу ничего не найдено"
            )}
          </p>
        </div>
      </div>

      <CatalogFilters value={state} meta={meta} />

      <div className="mt-8">
        <CatalogResults
          key={toSearch(state)}
          initial={cards}
          next={next}
          total={total}
          state={state}
        />
      </div>
    </div>
  );
}
