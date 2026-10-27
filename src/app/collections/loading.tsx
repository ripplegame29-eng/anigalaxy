/** Заглушка подборок */
export default function CollectionsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10" aria-busy="true">
      <div className="skeleton h-40 w-full rounded-3xl sm:h-52" />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-48 rounded-2xl" />
        ))}
      </div>
      <span className="sr-only">Загружаем подборки…</span>
    </div>
  );
}
