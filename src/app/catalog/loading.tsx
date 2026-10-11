import { CatalogSkeleton } from "@/components/CatalogResults";

/** Скелетон каталога на время серверной выборки */
export default function CatalogLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-5 h-4 w-40 rounded bg-white/8" />
      <div className="skeleton h-9 w-64 rounded-lg" />
      <div className="skeleton mt-3 h-4 w-52 rounded-md" />
      <div className="skeleton mt-6 h-40 w-full rounded-2xl" />
      <div className="mt-8">
        <CatalogSkeleton />
      </div>
    </div>
  );
}
