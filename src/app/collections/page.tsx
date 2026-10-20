import type { Metadata } from "next";
import { CollectionsView } from "@/components/collections/CollectionsView";
import { collectionPosters } from "@/lib/collections-posters";

export const metadata: Metadata = {
  title: "Подборки аниме",
  description:
    "Подборки аниме от зрителей: курируемые списки тайтлов, которые можно лайкнуть, пройти и дополнить своим.",
  robots: { index: false, follow: true },
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Подборки — отдельный раздел, а не вкладка каталога: у него своя
 * навигация (вкладки, сортировка, виды сетки) и он открывается из
 * мега-меню шапки. Каталог при этом остаётся списком тайтлов с
 * фильтрами.
 *
 * Обложки плиток подтягиваются на сервере тем же API, что и карточки
 * каталога. Если Kodik недоступен, страница всё равно открывается: плитки
 * останутся градиентными, как в макете без картинок.
 *
 * `?c=<id>` открывает подборку сразу — это ссылка из кнопки «Поделиться».
 */
export default async function CollectionsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const raw = typeof sp.c === "string" ? Number(sp.c) : Number.NaN;
  const initialId = Number.isFinite(raw) && raw > 0 ? raw : null;

  const posters = await collectionPosters().catch(() => ({}) as Record<string, string>);
  return <CollectionsView posters={posters} initialId={initialId} />;
}
